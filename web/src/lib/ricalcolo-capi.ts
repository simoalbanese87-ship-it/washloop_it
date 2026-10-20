import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { franchigiaPerSacco, ridistribuisciFranchigia, sacchiPerFranchigia } from "@/lib/franchigia";
import { ridistribuisciCanone } from "@/lib/capi-compresi";
import { dirittoPerCapo, saldoCapiCompresi } from "@/lib/capi-compresi-abbonamento";
import { haAbbonamentoAttivo } from "@/lib/abbonamento-sacchi";
import { dataServizio } from "@/lib/periodo-servizio";

/** Rifà il conto dei capi di un ordine: franchigia del sacco e capi compresi
 *  nel canone, **insieme**.
 *
 *  Perché insieme, e non una alla volta
 *  ------------------------------------
 *  Le due comprensioni si contendono le stesse unità, nell'ordine: prima il
 *  sacco, poi il canone. Quando la lavanderia conferma più sacchi di quelli
 *  previsti, più unità passano alla franchigia del sacco e il canone **deve
 *  liberarne altrettante**: sei camicie, un sacco e due comprese nel canone
 *  fanno 3 + 2 + 1; confermando due sacchi diventano 6 + 0 + 0. Ricalcolando
 *  solo il sacco, quelle due resterebbero segnate come comprese nel canone —
 *  contate due volte, con il compenso alla lavanderia fermo al numero vecchio.
 *
 *  Sostituisce `rifaiFranchigia`, che faceva solo metà del conto.
 *
 *  Si rifiuta su un gruppo già addebitato: la franchigia è un conto unico, e
 *  rifarne metà darebbe un numero peggiore di quello sbagliato. */

export type EsitoRicalcolo = {
  /** Cosa è cambiato, da dire a chi ha premuto. `null` se niente. */
  frase: string | null;
  /** Perché non si è potuto fare. `null` se è andata. */
  bloccato: string | null;
};

type Riga = {
  id: string;
  item_id: string;
  item_name: string;
  qty: number;
  qty_totale: number | null;
  qty_inclusa: number | null;
  qty_inclusa_canone: number | null;
  comp_lav_cents: number;
  created_at: string;
  charged_at: string | null;
  incassato_at: string | null;
  annullato_at: string | null;
  refunded_at: string | null;
};

export async function ricalcolaCapiOrdine(
  svc: SupabaseClient,
  orderId: string,
  opts?: { sacchi?: number; laundryId?: string | null },
): Promise<EsitoRicalcolo> {
  const { data: ordine } = await svc
    .from("orders")
    .select("id, customer_id, laundry_id, bags, bags_arrivati")
    .eq("id", orderId)
    .maybeSingle<{ id: string; customer_id: string | null; laundry_id: string | null; bags: number | null; bags_arrivati: number | null }>();
  if (!ordine) return { frase: null, bloccato: "Ordine non trovato." };

  const { data: tutte } = await svc
    .from("order_specials")
    .select(
      "id, item_id, item_name, qty, qty_totale, qty_inclusa, qty_inclusa_canone, comp_lav_cents, created_at, charged_at, incassato_at, annullato_at, refunded_at",
    )
    .eq("order_id", orderId)
    .order("created_at", { ascending: true })
    .returns<Riga[]>();

  const righe = (tutte ?? []).filter((r) => !r.annullato_at && !r.refunded_at);
  if (righe.length === 0) return { frase: null, bloccato: "Su questo ritiro non c'è nessun capo da ricalcolare." };
  if (righe.some((r) => r.charged_at || r.incassato_at)) {
    return {
      frase: null,
      bloccato:
        "Su questo ritiro qualcosa è già stato messo in fattura: il conto non si rifà a metà. Se il cliente ha pagato un capo che il canone comprende, stornalo come «offerto» — la lavanderia resta pagata.",
    };
  }

  const [{ count: scansionati }, saldo] = await Promise.all([
    svc.from("order_bags").select("id", { count: "exact", head: true }).eq("order_id", orderId),
    // **`escludiOrdine`**: le unità che questo ordine aveva assorbito non
    // vanno contate come già usate, o il piatto risulterebbe vuoto e il
    // cliente si vedrebbe addebitare capi che il canone comprende. È il
    // doppio conteggio più facile da introdurre in tutto questo giro.
    ordine.customer_id ? saldoCapiCompresi(svc, ordine.customer_id, { escludiOrdine: orderId }) : Promise.resolve(null),
  ]);

  const sacchi = opts?.sacchi ?? sacchiPerFranchigia(ordine.bags_arrivati, scansionati, ordine.bags);
  const conAbbonamento = ordine.customer_id ? await haAbbonamentoAttivo(svc, ordine.customer_id) : false;

  const itemIds = [...new Set(righe.map((r) => r.item_id))];
  const { data: listino } = await svc
    .from("special_items")
    .select("id, name, category_id, incluse_per_sacco")
    .in("id", itemIds)
    .returns<{ id: string; name: string; category_id: string | null; incluse_per_sacco: number | null }[]>();
  const capoDi = new Map((listino ?? []).map((i) => [i.id, i]));

  // Il piatto del canone si consuma a mano a mano, capo per capo: due voci di
  // listino possono pescare dallo stesso diritto di categoria.
  const residuoDiritto = new Map<string, number>();
  for (const d of saldo?.diritti ?? []) residuoDiritto.set(d.id, d.residue);

  const cambiati: string[] = [];

  for (const itemId of itemIds) {
    const capo = capoDi.get(itemId);
    const delCapo = righe.filter((r) => r.item_id === itemId);
    const perSacco = franchigiaPerSacco(capo?.incluse_per_sacco, conAbbonamento);

    // Prima il sacco: non ci costa niente, e non brucia un diritto del mese.
    const dalSacco = ridistribuisciFranchigia(
      delCapo.map((r) => ({ id: r.id, qtyTotale: r.qty_totale ?? r.qty })),
      perSacco * sacchi,
    );

    // Poi il canone, su quello che il sacco non ha coperto.
    const diritto = capo && saldo ? dirittoPerCapo(saldo, capo) : null;
    const residuo = diritto ? residuoDiritto.get(diritto.id) ?? 0 : 0;
    const dalCanone = ridistribuisciCanone(
      dalSacco.map((x) => ({ id: x.id, daCoprire: x.daAddebitare })),
      residuo,
    );
    if (diritto) {
      const usate = dalCanone.reduce((t, x) => t + x.incluseCanone, 0);
      residuoDiritto.set(diritto.id, Math.max(0, residuo - usate));
    }

    for (const riga of delCapo) {
      const sacco = dalSacco.find((x) => x.id === riga.id)!;
      const canone = dalCanone.find((x) => x.id === riga.id)!;
      const qty = sacco.daAddebitare - canone.incluseCanone;
      const daPagare = qty + canone.incluseCanone;

      const uguale =
        riga.qty === qty &&
        (riga.qty_inclusa ?? 0) === sacco.incluse &&
        (riga.qty_inclusa_canone ?? 0) === canone.incluseCanone;
      if (uguale) continue;

      await svc
        .from("order_specials")
        .update({ qty, qty_inclusa: sacco.incluse, qty_inclusa_canone: canone.incluseCanone })
        .eq("id", riga.id);

      // Il compenso segue il lavoro: si rifà la riga pending, e una già
      // liquidata non si tocca.
      await svc.from("laundry_payouts").delete().eq("special_id", riga.id).eq("status", "pending");
      const laundryId = opts?.laundryId ?? ordine.laundry_id;
      if (daPagare > 0 && laundryId) {
        await svc.from("laundry_payouts").insert({
          laundry_id: laundryId,
          order_id: orderId,
          special_id: riga.id,
          kind: "special",
          amount_cents: riga.comp_lav_cents * daPagare,
          status: "pending",
          servizio_il: await dataServizio(svc, orderId),
        });
      }

      cambiati.push(
        canone.incluseCanone > 0
          ? `${riga.item_name}: ${qty} da addebitare, ${canone.incluseCanone} ${canone.incluseCanone === 1 ? "compreso" : "compresi"} nel canone`
          : `${riga.item_name}: ${qty} da addebitare`,
      );
    }
  }

  return {
    frase: cambiati.length > 0 ? cambiati.join(" · ") : "Il conto era già giusto: non è cambiato niente.",
    bloccato: null,
  };
}
