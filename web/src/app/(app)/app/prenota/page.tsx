import Link from "next/link";
import { BookFlow, type Address, type Slot, type SpecialCategory } from "@/components/app/BookFlow";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { hasActiveSubscription } from "@/lib/auth";
import { pickupCounts, deliveryCounts } from "@/lib/slots";
import { oreDiLavorazione } from "@/lib/turnaround";
import { dirittoAPrenotare, ritiriPerSettimana } from "@/lib/diritto-a-prenotare";
import { settimanaRoma, giornoEsteso } from "@/lib/settimana-roma";
import { puoPrenotare, canoneACadenzaLibera } from "@/lib/puo-prenotare";
import { compraUnRitiro, chiediAbbonamento } from "@/lib/actions/ritiri";
import { fasciaPermessa } from "@/lib/servizio-fascia";
import { isTipoServizio } from "@/lib/tipo-servizio";

type Cat = { id: string; name: string; emoji: string; sort: number };
type Item = { category_id: string; name: string; price_cli_cents: number; sort: number };
type RawSlot = { id: string; starts_at: string; ends_at: string; laundry_id: string | null; capacity: number | null; servizio: string | null };

export default async function PrenotaPage() {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const [abbonato, { data: sub }, { data: io }, { data: addresses }, { data: rawSlots }, { data: rawDelivery }, { data: cats }, { data: items }] = await Promise.all([
    hasActiveSubscription(),
    // `turnaround_hours` serve a sapere da quando in poi il bucato può tornare:
    // le fasce di riconsegna prima di quel momento non hanno senso mostrarle.
    supabase.from("subscriptions").select("status, plans(turnaround_hours)").order("created_at", { ascending: false }).limit(1).maybeSingle<{ status: string; plans: { turnaround_hours: number } | null }>(),
    // Il cliente a consumo prenota come gli altri: niente canone, paga i capi.
    supabase.from("profiles").select("a_consumo, tipo_servizio").eq("id", (await supabase.auth.getUser()).data.user?.id ?? "").maybeSingle<{ a_consumo: boolean | null; tipo_servizio: string | null }>(),
    supabase.from("addresses").select("id, label, street, zone_id, access_mode, access_note").order("created_at", { ascending: false }).returns<Address[]>(),
    supabase.from("slots").select("id, starts_at, ends_at, laundry_id, capacity, servizio").eq("kind", "pickup").is("archived_at", null).gte("starts_at", nowIso).order("starts_at").limit(80).returns<RawSlot[]>(),
    supabase.from("slots").select("id, starts_at, ends_at, laundry_id, capacity, servizio").eq("kind", "delivery").is("archived_at", null).gte("starts_at", nowIso).order("starts_at").limit(120).returns<RawSlot[]>(),
    supabase.from("special_categories").select("id, name, emoji, sort").order("sort").returns<Cat[]>(),
    // Vista e non tabella: `special_items` contiene anche il compenso pagato
    // alla lavanderia, che al cliente non deve arrivare nemmeno via API.
    supabase.from("special_items_public").select("category_id, name, price_cli_cents, sort").order("sort").returns<Item[]>(),
  ]);

  // Chi può prenotare, con quale borsa, e quali settimane ha già usato. Col
  // service client, come tutto quello che decide: una lettura negata da RLS
  // torna vuota invece di dare errore, e un saldo vuoto per sbaglio
  // bloccherebbe chi ha pagato.
  const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
  const svc = createServiceClient();
  const [diritto, settimanePrese] = await Promise.all([
    userId ? dirittoAPrenotare(userId, svc) : Promise.resolve(null),
    userId ? ritiriPerSettimana(userId, svc) : Promise.resolve(new Map()),
  ]);

  // Posti residui per slot (capacità − ordini non annullati già agganciati).
  const [counts, dCounts] = await Promise.all([
    pickupCounts(supabase, (rawSlots ?? []).map((s) => s.id)),
    deliveryCounts(supabase, (rawDelivery ?? []).map((s) => s.id)),
  ]);
  const residuo = (s: RawSlot, m: Map<string, number>) =>
    s.capacity == null ? null : Math.max(0, s.capacity - (m.get(s.id) ?? 0));
  // Il giorno giusto per il lavoro giusto: il martedì è della lavanderia, il
  // mercoledì dello stiro. Chi fa solo stiro non deve nemmeno vedere il
  // martedì — vedere una data che non può usare è un errore che si scopre
  // dopo averla scelta. La regola, con i test, sta in `servizio-fascia.ts`.
  const mioServizio = isTipoServizio(io?.tipo_servizio) ? io.tipo_servizio : null;
  // Un ritiro a settimana: i giorni delle settimane in cui ne ha già uno non si
  // mostrano proprio. Rifiutarlo alla fine sarebbe peggio — sceglie il giorno,
  // fa tre passi e scopre di no mentre conferma.
  const slots: Slot[] = (rawSlots ?? [])
    .filter((s) => fasciaPermessa(s.servizio, mioServizio))
    .filter((s) => !settimanePrese.has(settimanaRoma(s.starts_at)))
    .map((s) => ({
      id: s.id, starts_at: s.starts_at, ends_at: s.ends_at, laundry_id: s.laundry_id, remaining: residuo(s, counts),
    }));
  // Il prossimo ritiro che ha già: si dice, se no la settimana sparita sembra
  // un errore del sito.
  const prossimoSuo = [...settimanePrese.values()]
    .map((r) => r.quandoIso)
    .filter((iso) => iso >= nowIso)
    .sort()[0] ?? null;
  const deliverySlots: Slot[] = (rawDelivery ?? []).map((s) => ({
    id: s.id, starts_at: s.starts_at, ends_at: s.ends_at, laundry_id: s.laundry_id, remaining: residuo(s, dCounts),
  }));
  // Le ore che il cliente legge e su cui si filtrano le fasce di riconsegna:
  // 48 per il solo stiro, il suo piano per gli altri. La regola sta in
  // `turnaround.ts` — qui si passano solo i due dati che le servono.
  const turnaroundHours = oreDiLavorazione({ tipoServizio: io?.tipo_servizio, orePiano: sub?.plans?.turnaround_hours });

  const categories: SpecialCategory[] = (cats ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    emoji: c.emoji,
    items: (items ?? []).filter((i) => i.category_id === c.id).map((i) => ({ name: i.name, price_cli_cents: i.price_cli_cents })),
  })).filter((c) => c.items.length > 0);

  const aConsumo = io?.a_consumo === true;

  // Chi può prenotare, e con quale borsa. Dal 30 ottobre non è più un sì o un
  // no: i ritiri comprati sono una quantità, e chi li ha finiti è fermo. La
  // regola sta in `puo-prenotare.ts`, le quantità le raccoglie
  // `dirittoAPrenotare` col service client — con la sessione del cliente un
  // saldo può tornare vuoto invece che negare, e un vuoto per sbaglio
  // bloccherebbe chi ha pagato.
  const active = diritto ? puoPrenotare(diritto) : abbonato || aConsumo;
  // Ha finito i ritiri comprati: non è uno che non ha mai cominciato, e non
  // deve leggere la pagina di chi non ha mai cominciato.
  const ritiriFiniti = !!diritto && !active && (diritto.ritiriAccreditati ?? 0) > 0 && diritto.abbonamentoARitiri !== true;
  // Ha finito quelli del rinnovo: a lui non si vende niente, gli si dice
  // quando tornano.
  const rinnovoDaAspettare = !!diritto && !active && diritto.abbonamentoARitiri === true;
  const ritiriInCassa = diritto?.ritiri ?? 0;
  // Come paga i sacchi: lo legge una didascalia sola, ma dirlo sbagliato
  // significa promettere «compreso» a chi compreso non ce l'ha. L'ordine conta:
  // chi ha un canone a cadenza libera lo paga col canone; chi ha un numero di
  // ritiri — comprati o compresi in un abbonamento — li paga con quelli; il
  // resto è il cliente a consumo, che paga a listino.
  const comePaga: "abbonamento" | "ritiri" | "consumo" =
    diritto && canoneACadenzaLibera(diritto) ? "abbonamento" : (diritto?.ritiri ?? 0) > 0 || diritto?.abbonamentoARitiri ? "ritiri" : aConsumo ? "consumo" : "abbonamento";
  const noAddress = !addresses || addresses.length === 0;
  const sofferenza = !aConsumo && (sub?.status === "past_due" || sub?.status === "unpaid");

  return (
    <div className="space-y-4">
      {!active ? (
        <>
          <div>
            <div className="font-display text-[11px] font-extrabold uppercase tracking-[0.2em] text-blue">Nuovo ritiro</div>
            <h1 className="mt-1.5 font-display text-[26px] font-black tracking-[-0.02em] text-navy">Prenota un ritiro</h1>
          </div>
          {/* Chi ha una fattura aperta non è un nuovo utente: dirgli «attiva un
              piano» quando paga da mesi è il modo più veloce per farlo scrivere
              all'assistenza. */}
          {rinnovoDaAspettare ? (
            <section className="rounded-[18px] border border-line bg-white p-5">
              <h2 className="font-display text-lg font-black text-navy">Hai usato tutti i ritiri che avevi</h2>
              <p className="mt-2 text-sm font-medium text-muted">
                Al prossimo rinnovo dell&apos;abbonamento te ne arrivano altri, e quelli che non usi restano: non
                scadono. Se te ne serve uno adesso, scrivici e lo sistemiamo.
              </p>
              <a href="mailto:info@washloop.it" className="mt-5 inline-flex rounded-full border-2 border-navy/25 px-6 py-3 font-display text-sm font-extrabold text-navy hover:bg-navy/5">
                Scrivici
              </a>
            </section>
          ) : ritiriFiniti ? (
            /* Due strade, e tutt'e due sue: ricomprare lo stesso ritiro allo
               stesso prezzo, che è un gesto solo, oppure chiedere
               l'abbonamento — che non si compra da un bottone, perché il
               canone si concorda. */
            <section className="rounded-[18px] border border-line bg-white p-5">
              <h2 className="font-display text-lg font-black text-navy">Hai usato tutti i ritiri che hai comprato</h2>
              <p className="mt-2 text-sm font-medium text-muted">
                Ne hai fatti {diritto!.ritiriAccreditati}. Puoi comprarne un altro allo stesso prezzo, oppure passare
                all&apos;abbonamento: in quel caso il prezzo lo concordiamo insieme e ti scriviamo noi.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <form action={compraUnRitiro}>
                  <button type="submit" className="inline-flex rounded-full bg-gradient-to-br from-blue to-cyan px-6 py-3 font-display text-sm font-extrabold text-white shadow-[0_10px_24px_-10px_rgba(0,200,240,0.7)]">
                    Compra un altro ritiro →
                  </button>
                </form>
                <form action={chiediAbbonamento}>
                  <button type="submit" className="inline-flex rounded-full border-2 border-navy/25 px-6 py-3 font-display text-sm font-extrabold text-navy hover:bg-navy/5">
                    Voglio l&apos;abbonamento
                  </button>
                </form>
              </div>
            </section>
          ) : sofferenza ? (
            <section className="rounded-[18px] border border-[#C0392B]/30 bg-[#C0392B]/5 p-5">
              <h2 className="font-display text-lg font-black text-navy">Pagamento non riuscito</h2>
              <p className="mt-2 text-sm font-medium text-muted">
                L&apos;ultimo addebito non è andato a buon fine, quindi i nuovi ritiri sono in pausa. Quelli già fissati li facciamo
                comunque. Salda la fattura aperta e torni a prenotare subito.
              </p>
              <Link href="/app/abbonamento" className="mt-5 inline-flex rounded-full bg-gradient-to-br from-blue to-cyan px-6 py-3 font-display text-sm font-extrabold text-white shadow-[0_10px_24px_-10px_rgba(0,200,240,0.7)]">
                Sistema il pagamento →
              </Link>
            </section>
          ) : (
            <section className="rounded-[18px] border border-line bg-white p-5">
              <h2 className="font-display text-lg font-black text-navy">Serve un abbonamento attivo</h2>
              <p className="mt-2 text-sm font-medium text-muted">
                La prenotazione dei ritiri è inclusa nell&apos;abbonamento WashLoop. Attiva un piano per iniziare: puoi metterlo in pausa o disdirlo quando vuoi.
              </p>
              <Link href="/app/abbonamento" className="mt-5 inline-flex rounded-full bg-gradient-to-br from-blue to-cyan px-6 py-3 font-display text-sm font-extrabold text-white shadow-[0_10px_24px_-10px_rgba(0,200,240,0.7)]">
                Vedi i piani →
              </Link>
            </section>
          )}
        </>
      ) : noAddress ? (
        <>
          <div>
            <div className="font-display text-[11px] font-extrabold uppercase tracking-[0.2em] text-blue">Nuovo ritiro</div>
            <h1 className="mt-1.5 font-display text-[26px] font-black tracking-[-0.02em] text-navy">Prenota un ritiro</h1>
          </div>
          <section className="rounded-[18px] border border-line bg-white p-5 text-sm font-medium text-muted">
            Prima aggiungi un indirizzo.{" "}
            <Link href="/app/indirizzi" className="font-bold text-blue hover:underline">Vai agli indirizzi →</Link>
          </section>
        </>
      ) : (
        <>
          {prossimoSuo && (
            <section className="rounded-[18px] border border-line bg-white px-4 py-3 text-sm font-semibold text-navy">
              Hai già un ritiro {giornoEsteso(prossimoSuo)}: quella settimana non compare qui sotto. Se ti serve un
              altro giorno, spostalo dalla pagina del ritiro.
            </section>
          )}
          {ritiriInCassa > 0 && (
            <section className="rounded-[18px] border border-line bg-white px-4 py-3 text-sm font-semibold text-navy">
              {ritiriInCassa === 1 ? "Ti resta 1 ritiro" : `Ti restano ${ritiriInCassa} ritiri`}. Non scadono: se ne
              consuma uno quando prenoti, e se annulli te lo restituiamo.
            </section>
          )}
          <BookFlow addresses={addresses!} slots={slots ?? []} deliverySlots={deliverySlots} turnaroundHours={turnaroundHours} categories={categories} comePaga={comePaga} />
        </>
      )}
    </div>
  );
}
