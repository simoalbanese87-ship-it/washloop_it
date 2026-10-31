import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { romeWeekday, romeHHMM } from "@/lib/format";
import { notifyOrderStatus } from "@/lib/notify";
import { registraGuasto } from "@/lib/incidenti";
import { destinazioneOrdine } from "@/lib/lavanderia";
import { assegnaRiderIniziale } from "@/lib/assegna-rider";
import { allineaProva } from "@/lib/prova-stripe";
import { oreDiLavorazione } from "@/lib/turnaround";
import { puoPrenotare } from "@/lib/puo-prenotare";
import { dirittoAPrenotare, ritiriPerSettimana } from "@/lib/diritto-a-prenotare";
import { settimanaRoma } from "@/lib/settimana-roma";
import { eseguiCron } from "@/lib/cron-log";

/** Cron giornaliero: genera gli ordini delle ricorrenze settimanali attive,
 *  agganciandoli a uno slot reale con stesso giorno+ora (Europe/Rome) nei
 *  prossimi giorni. Idempotente: non duplica se l'ordine esiste già. */

export const dynamic = "force-dynamic";
const LOOKAHEAD_DAYS = 4;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const r = await eseguiCron(
    "recurring",
    async () => {
    // `createServiceClient()` e non un client costruito qui: la chiave nelle env
    // contiene spazi e un a capo, e passata grezza fa fallire `Headers.set` prima
    // ancora della richiesta. La libreria condivisa la ripulisce da sempre; questi
    // due cron se la costruivano per conto loro ed erano gli unici a non farlo.
    // Risultato: non hanno MAI funzionato — zero promemoria inviati su 11 ordini e
    // zero ordini generati dalle ricorrenze attive — e si è scoperto solo quando
    // il registro dei guasti ha iniziato a raccogliere gli errori.
    const sb = createServiceClient();

    const now = new Date();
    const until = new Date(now.getTime() + LOOKAHEAD_DAYS * 86_400_000);

    const [{ data: recs }, { data: slots }, { data: deliverySlots }] = await Promise.all([
      sb.from("recurring_pickups").select("id, customer_id, address_id, weekday, hhmm, delivery_hhmm, bags, notes").eq("active", true),
      sb.from("slots").select("id, starts_at, laundry_id, capacity, servizio").eq("kind", "pickup").is("archived_at", null).gte("starts_at", now.toISOString()).lte("starts_at", until.toISOString()),
      // Fasce di riconsegna: si guarda più avanti dei ritiri, perché la
      // riconsegna cade dopo la lavorazione (48h, o 24h sui piani veloci).
      sb.from("slots").select("id, starts_at, laundry_id, capacity").eq("kind", "delivery").is("archived_at", null).gte("starts_at", now.toISOString()).lte("starts_at", new Date(until.getTime() + 4 * 86_400_000).toISOString()),
    ]);

    // Le fasce generate dal calendario non hanno lavanderia: senza un ripiego
    // ogni ritiro nato dalle ricorrenze sarebbe invisibile al portale. La
    // destinazione si chiede per cliente, perché chi fa solo stiro va alla
    // stireria anche quando il ritiro lo crea il cron di notte.
    const destinazioni = new Map<string, { laundryId: string | null; servizioSaccoId: string | null }>();
    const destinazioneDi = async (customerId: string, fascia: string | null, servizioFascia: string | null) => {
      // La chiave comprende la fascia e il suo servizio: la stessa persona può
      // avere ricorrenze su giorni diversi — martedì il bucato, mercoledì le
      // camicie — e sono due destinazioni diverse.
      const chiave = `${customerId}|${fascia ?? ""}|${servizioFascia ?? ""}`;
      const gia = destinazioni.get(chiave);
      if (gia) return gia;
      const d = await destinazioneOrdine(sb, customerId, fascia, servizioFascia);
      destinazioni.set(chiave, d);
      return d;
    };

    let created = 0;
    let skippedFull = 0;
    const turnaroundCache = new Map<string, number>();
    // Ritiri comprati ancora spendibili stanotte, cliente per cliente.
    const ritiriCache = new Map<string, number>();

    // I giorni della settimana che cadono davvero nella finestra guardata.
    // Serve per non gridare al guasto quando non c'è niente che non va: una
    // ricorrenza al martedì, controllata di mercoledì, non trova il martedì
    // perché il martedì non è nei prossimi quattro giorni — e per mesi ha
    // riempito il registro di allarmi falsi, che è il modo più sicuro di far
    // ignorare quelli veri.
    const giorniGuardati = new Set<number>();
    for (let t = now.getTime(); t <= until.getTime(); t += 86_400_000) giorniGuardati.add(romeWeekday(new Date(t)));
    giorniGuardati.add(romeWeekday(until));

    for (const rec of recs ?? []) {
      const matches = (slots ?? []).filter((s) => romeWeekday(s.starts_at) === rec.weekday && romeHHMM(s.starts_at) === rec.hhmm);
      if (matches.length === 0 && !giorniGuardati.has(rec.weekday)) continue;
      if (matches.length === 0) {
        // Questo `continue` è stato muto per giorni ed è costato un cliente.
        // Saverio ha il ritiro ricorrente al martedì alle 09:00; il calendario è
        // stato rigenerato con soli lunedì e mercoledì, e da allora il suo ritiro
        // non è più nato — senza un errore, senza una riga, senza che nessuno
        // potesse accorgersene finché non è arrivato il giorno e non è passato
        // nessuno. Una ricorrenza attiva che non trova la sua fascia è un guasto,
        // non un caso normale.
        await registraGuasto(
          "cron",
          `Ricorrenza senza fascia compatibile: nessuno slot di ritiro il giorno ${rec.weekday} alle ${rec.hhmm} nei prossimi ${LOOKAHEAD_DAYS} giorni`,
          { recurring_id: rec.id, weekday: rec.weekday, hhmm: rec.hhmm },
        );
        continue;
      }

      // Chi ha diritto al ritiro, e in quante ore glielo rendiamo.
      //
      // Il permesso non è «ha un abbonamento attivo»: è la regola di
      // `puo-prenotare.ts`, cioè **abbonamento vivo oppure accordo a consumo**.
      // Quel modulo esiste proprio per tenerla in un posto solo, e qui non la
      // si usava: un cliente a consumo poteva prenotare dall'app, pagava, ma la
      // sua ricorrenza settimanale non produceva **mai** un ritiro. In silenzio,
      // come sempre quando una regola viene riscritta a mano in un secondo
      // posto.
      let turnaround = turnaroundCache.get(rec.customer_id) ?? -1;
      if (turnaround === -1) {
        const [{ data: sub }, { data: prof }, diritto] = await Promise.all([
          sb
            .from("subscriptions")
            .select("status, plans(turnaround_hours)")
            .eq("user_id", rec.customer_id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle<{ status: string; plans: { turnaround_hours: number } | null }>(),
          sb
            .from("profiles")
            .select("tipo_servizio, a_consumo")
            .eq("id", rec.customer_id)
            .maybeSingle<{ tipo_servizio: string | null; a_consumo: boolean | null }>(),
          dirittoAPrenotare(rec.customer_id, sb),
        ]);
        turnaround = puoPrenotare(diritto)
          ? oreDiLavorazione({ tipoServizio: prof?.tipo_servizio, orePiano: sub?.plans?.turnaround_hours })
          : 0;
        turnaroundCache.set(rec.customer_id, turnaround);
        // Quanti ritiri comprati può ancora spendere questo giro. Si tiene il
        // conto a parte perché dentro una sola notte lo stesso cliente può
        // avere più fasce buone, e il saldo letto all'inizio non si
        // accorgerebbe degli ordini appena creati.
        ritiriCache.set(rec.customer_id, diritto.consumaRitiro ? diritto.ritiri ?? 0 : 0);
      }
      // 0 = non ha diritto al servizio: niente generazione.
      if (turnaround === 0) continue;

      for (const slot of matches) {
        // Doppione = stessa PERSONA nella stessa fascia, non stessa ricorrenza.
        //
        // Il controllo guardava `recurring_id`, e bastava un ritiro prenotato a
        // mano per non essere visto: il 1° settembre Saverio si era prenotato da
        // solo per le 09:00 del martedì, il cron alle 08:04 non ha riconosciuto
        // quell'ordine come suo e gliene ha creato un secondo nella stessa fascia.
        // Due ritiri per la stessa persona alla stessa ora, uno dei quali non lo
        // farà mai nessuno — e intanto occupa un posto nello slot.
        //
        // Nessuno ha due ritiri contemporanei, quindi la chiave giusta è
        // cliente + fascia. Copre anche il caso opposto: ricorrenza rifatta da
        // capo (nuovo `recurring_id`) sulla stessa fascia di prima.
        const { data: existing } = await sb
          .from("orders")
          .select("id")
          .eq("customer_id", rec.customer_id)
          .eq("pickup_slot_id", slot.id)
          .neq("status", "cancelled")
          .limit(1)
          .maybeSingle();
        if (existing) continue;

        // Rispetta la capacità dello slot: se è pieno, salta (il trigger DB
        // bloccherebbe comunque l'insert, qui evitiamo l'eccezione).
        if (slot.capacity != null) {
          const { count } = await sb.from("orders").select("id", { count: "exact", head: true }).eq("pickup_slot_id", slot.id).neq("status", "cancelled");
          if ((count ?? 0) >= slot.capacity) { skippedFull++; continue; }
        }

        const eta = new Date(new Date(slot.starts_at).getTime() + turnaround * 3600_000).toISOString();

        // La fascia di riconsegna: prima quella preferita, poi comunque una.
        //
        // Prima qui c'era solo il primo passaggio — «l'ora che il cliente ha
        // chiesto» — e se quell'ora non esisteva fra le fasce aperte l'ordine
        // nasceva senza riconsegna. È esattamente quello che è successo: le
        // ricorrenze erano state salvate con `delivery_hhmm = 09:00`, poi il
        // calendario generale ha spostato le riconsegne al venerdì pomeriggio,
        // e da allora **ogni** ordine generato di notte è nato senza fascia.
        // Nessuno se n'era accorto perché l'ordine si crea lo stesso: manca
        // solo la metà che riguarda il ritorno.
        //
        // La regola adesso: l'ora chiesta se c'è, altrimenti la prima fascia
        // utile dopo che il bucato è pronto. Una riconsegna che si può
        // spostare è meglio di una riconsegna che non c'è — e l'ops se la
        // ritrova già in calendario invece che in un elenco di eccezioni.
        const liberaDopoEta = (deliverySlots ?? [])
          .filter((d) => d.starts_at >= eta)
          .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

        const haPosto = async (d: { id: string; capacity: number | null }) => {
          if (d.capacity == null) return true;
          const { count } = await sb
            .from("orders")
            .select("id", { count: "exact", head: true })
            .eq("delivery_slot_id", d.id)
            .neq("status", "cancelled");
          return (count ?? 0) < d.capacity;
        };

        let deliverySlotId: string | null = null;
        const preferite = rec.delivery_hhmm
          ? liberaDopoEta.filter((d) => romeHHMM(d.starts_at) === rec.delivery_hhmm)
          : [];
        for (const d of [...preferite, ...liberaDopoEta]) {
          if (await haPosto(d)) { deliverySlotId = d.id; break; }
        }

        // Un ritiro a settimana vale anche per i ritiri generati: se il cliente
        // se n'è già prenotato uno a mano in quella settimana, il cron non
        // gliene aggiunge un secondo.
        const settimanePrese = await ritiriPerSettimana(rec.customer_id, sb);
        if (settimanePrese.has(settimanaRoma(slot.starts_at))) continue;

        const destinazione = await destinazioneDi(rec.customer_id, slot.laundry_id, slot.servizio ?? null);
        // Un ritiro generato è un ritiro prenotato: se a pagarlo è uno di
        // quelli comprati, si consuma qui come se l'avesse aperto il cliente.
        const ritiriRimasti = ritiriCache.get(rec.customer_id) ?? 0;
        const conRitiro = ritiriRimasti > 0;
        const { data: ins, error } = await sb.from("orders").insert({
          customer_id: rec.customer_id,
          address_id: rec.address_id,
          pickup_slot_id: slot.id,
          delivery_slot_id: deliverySlotId,
          laundry_id: destinazione.laundryId,
          servizio_sacco_id: destinazione.servizioSaccoId,
          eta_ready_at: eta,
          bags: rec.bags,
          notes: rec.notes,
          status: "pickup_scheduled",
          recurring_id: rec.id,
          ritiro_pagato_at: conRitiro ? new Date().toISOString() : null,
        }).select("id").single();
        if (!error && ins) {
          created++;
          if (conRitiro) ritiriCache.set(rec.customer_id, ritiriRimasti - 1);
          // I ritiri settimanali li genera questo cron di notte: senza questa
          // riga nascevano tutti senza rider, e il calendario del mattino era
          // rosso su ogni riga.
          await assegnaRiderIniziale(sb, ins.id, rec.address_id);
          // Un cliente ancora in prova con la ricorrenza già accesa: l'addebito
          // si aggancia al primo ritiro generato, come se l'avesse prenotato lui.
          await allineaProva(sb, rec.customer_id, ins.id, "primo-ordine");
          await notifyOrderStatus(ins.id, "pickup_scheduled"); // email+push cliente + heads-up lavanderia
        } else if (error) {
          // Prima finiva qui, in silenzio: il ritiro settimanale del cliente non
          // veniva creato e non lo sapeva nessuno, né lui né noi.
          await registraGuasto("cron", `Ricorrenza non generata: ${error.message}`, { recurring_id: rec.id, slot_id: slot.id });
        }
      }
    }
      return { recurrences: recs?.length ?? 0, slots: slots?.length ?? 0, created, skippedFull };
    },
    (e) =>
      e.created === 0
        ? `nessun ritiro da creare (${e.recurrences} ricorrenze attive)`
        : `${e.created} ritiri creati su ${e.recurrences} ricorrenze${e.skippedFull ? `, ${e.skippedFull} saltati per fascia piena` : ""}`,
  );

  return r.ok
    ? NextResponse.json({ ok: true, ...r.esito })
    : NextResponse.json({ ok: false, error: r.errore }, { status: 500 });
}
