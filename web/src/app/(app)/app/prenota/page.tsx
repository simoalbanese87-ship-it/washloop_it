import Link from "next/link";
import { BookFlow, type Address, type Slot, type SpecialCategory } from "@/components/app/BookFlow";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { hasActiveSubscription } from "@/lib/auth";
import { pickupCounts, deliveryCounts } from "@/lib/slots";
import { oreDiLavorazione } from "@/lib/turnaround";
import { saldoPassaggi } from "@/lib/passaggi-abbonamento";
import { fasciaPermessa } from "@/lib/servizio-fascia";
import { isTipoServizio } from "@/lib/tipo-servizio";

type Cat = { id: string; name: string; emoji: string; sort: number };
type Item = { category_id: string; name: string; price_cli_cents: number; sort: number };
type RawSlot = { id: string; starts_at: string; ends_at: string; laundry_id: string | null; capacity: number | null; servizio: string | null };

/** Giorno e mese, in ora di Roma: la data entro cui vanno usati i passaggi. */
const fmtGiorno = (iso: string) =>
  new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit" }).format(new Date(iso));

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
  const slots: Slot[] = (rawSlots ?? []).filter((s) => fasciaPermessa(s.servizio, mioServizio)).map((s) => ({
    id: s.id, starts_at: s.starts_at, ends_at: s.ends_at, laundry_id: s.laundry_id, remaining: residuo(s, counts),
  }));
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
  const active = abbonato || aConsumo;

  // Il saldo dei passaggi, per chi ne ha un numero concordato. Si mostra e
  // basta: chi li ha finiti prenota lo stesso — un passaggio in più è una
  // conversazione, non un errore da bloccare al cliente che sta prenotando.
  const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
  const passaggi = userId ? await saldoPassaggi(createServiceClient(), userId) : null;
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
          {sofferenza ? (
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
          {passaggi?.spettanti != null && (
            <section
              className={`rounded-[18px] border px-4 py-3 text-sm font-semibold ${
                passaggi.residui === 0
                  ? "border-[#C9881F]/35 bg-[#C9881F]/10 text-[#C9881F]"
                  : "border-line bg-white text-navy"
              }`}
            >
              {passaggi.residui === 0 ? (
                <>
                  Hai usato tutti i {passaggi.spettanti} passaggi di questo periodo
                  {passaggi.scadeIl ? `, che finisce il ${fmtGiorno(passaggi.scadeIl)}` : ""}. Puoi prenotare lo
                  stesso: ti scriviamo noi per accordarci.
                </>
              ) : (
                <>
                  {passaggi.residui === 1 ? "Ti resta 1 passaggio" : `Ti restano ${passaggi.residui} passaggi`} di{" "}
                  {passaggi.spettanti}
                  {passaggi.scadeIl ? `, da usare entro il ${fmtGiorno(passaggi.scadeIl)}` : ""}.
                </>
              )}
            </section>
          )}
          <BookFlow addresses={addresses!} slots={slots ?? []} deliverySlots={deliverySlots} turnaroundHours={turnaroundHours} categories={categories} />
        </>
      )}
    </div>
  );
}
