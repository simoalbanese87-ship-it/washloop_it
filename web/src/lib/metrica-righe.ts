import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { abbonamentiAttivi } from "@/lib/admin-metrics";

/** Le righe che compongono un numero della Home.
 *
 *  Nasce da una richiesta precisa: «ogni numero deve essere cliccabile e
 *  verificabile». Un totale che non si può aprire è un totale di cui bisogna
 *  fidarsi — ed è esattamente così che 440 € di abbonamenti scaduti di due
 *  account di prova sono rimasti nel ricorrente per settimane senza che nessuno
 *  potesse accorgersene.
 *
 *  Ogni voce qui dentro deve sommare ESATTAMENTE al numero mostrato: se un
 *  giorno le due cose divergono, è un errore da correggere, non un dettaglio. */

export type RigaMetrica = {
  etichetta: string;
  dettaglio: string;
  importoCents?: number;
  quantita?: number;
  href?: string;
  nota?: string;
};

export type DettaglioMetrica = {
  titolo: string;
  spiegazione: string;
  righe: RigaMetrica[];
  totaleCents?: number;
  totaleQuantita?: number;
};

export const METRICHE = [
  "incassato-mese",
  "ricorrente",
  "extra-mese",
  "sacchi-mese",
  "da-dare",
  "nuovi-abbonati",
  "interrotti",
] as const;
export type ChiaveMetrica = (typeof METRICHE)[number];

export const isChiaveMetrica = (v: string): v is ChiaveMetrica => (METRICHE as readonly string[]).includes(v);

function confini() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [y, m] = parts.split("-").map(Number);
  return {
    monthStart: new Date(Date.UTC(y, m - 1, 1)).toISOString(),
    yearStart: new Date(Date.UTC(y, 0, 1)).toISOString(),
  };
}

const data = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

/** `mese` in forma `2026-08`: serve al grafico della Home, dove ogni barra apre
 *  l'elenco dei clienti di quel mese. Senza, si poteva vedere solo il mese in
 *  corso e lo storico restava un numero solo. */
export async function righeMetrica(chiave: ChiaveMetrica, includiProva = false, mese?: string): Promise<DettaglioMetrica> {
  const svc = createServiceClient();
  const { monthStart } = confini();

  switch (chiave) {
    case "ricorrente": {
      const attivi = await abbonamentiAttivi(includiProva);
      return {
        titolo: "Ricorrente atteso",
        spiegazione:
          "Un abbonamento per cliente, contato solo se lo stato è attivo E il periodo non è ancora finito. È una previsione: dice quanto dovrebbe entrare, non quanto è entrato. Chi ha un prezzo concordato a zero resta in elenco e somma zero: è attivo come servizio, non come ricavo.",
        righe: attivi.map((a) => ({
          etichetta: a.nome,
          dettaglio: `${a.piano ?? "piano non a listino"} · rinnovo ${data(a.fino)}`,
          importoCents: a.prezzoCents,
          href: `/admin/abbonati/${a.userId}`,
          // Un cliente a zero fa sembrare rotto il totale: chi legge conta le
          // righe, vede due abbonati e un solo importo, e pensa a un bug. È
          // un omaggio, e va detto.
          nota: a.prezzoCents === 0
            ? "prezzo concordato a zero: non entra nel ricorrente perché non fattura nulla"
            : a.manuale
              ? "abbonamento manuale, non addebitato da Stripe"
              : undefined,
        })),
        totaleCents: attivi.reduce((t, a) => t + a.prezzoCents, 0),
      };
    }

    case "incassato-mese": {
      const scelto = /^\d{4}-\d{2}$/.test(mese ?? "") ? mese! : null;
      const [anno, m] = scelto ? scelto.split("-").map(Number) : [0, 0];
      const dal = scelto ? new Date(Date.UTC(anno, m - 1, 1)).toISOString() : monthStart;
      const al = scelto ? new Date(Date.UTC(anno, m, 1)).toISOString() : null;
      const nomeMese = scelto
        ? new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", month: "long", year: "numeric" }).format(new Date(Date.UTC(anno, m - 1, 1)))
        : null;

      let query = svc
        .from("invoices")
        .select("id, amount_cents, created_at, stato, fic_number, user_id, profiles(full_name, is_test)")
        .gte("created_at", dal);
      if (al) query = query.lt("created_at", al);
      const { data: righe } = await query
        .order("created_at", { ascending: false })
        .returns<{ id: string; amount_cents: number; created_at: string; stato: string; fic_number: string | null; user_id: string | null; profiles: { full_name: string | null; is_test: boolean } | null }[]>();

      const utili = (righe ?? []).filter((r) => includiProva || !r.profiles?.is_test);
      return {
        titolo: nomeMese ? `Incassato a ${nomeMese}` : "Incassato questo mese",
        spiegazione: nomeMese
          ? `Pagamenti arrivati su Stripe in ${nomeMese}. Ogni riga è un incasso registrato: questi sono soldi sul conto, non previsioni.`
          : "Pagamenti realmente arrivati su Stripe dal primo del mese. Ogni riga è un incasso registrato: questi sono soldi sul conto, non previsioni.",
        righe: utili.map((r) => ({
          etichetta: r.profiles?.full_name ?? "—",
          dettaglio: `${data(r.created_at)} · ${r.fic_number ? `fattura n. ${r.fic_number}` : "ricevuta"}`,
          importoCents: r.amount_cents,
          href: r.user_id ? `/admin/abbonati/${r.user_id}` : undefined,
        })),
        totaleCents: utili.reduce((t, r) => t + r.amount_cents, 0),
      };
    }

    case "extra-mese": {
      const [{ data: specials }, { data: charges }] = await Promise.all([
        svc.from("order_specials").select("id, item_name, qty, price_cli_cents, created_at, refunded_at, order_id, orders(status, customer_id, profiles!orders_customer_id_fkey(full_name, is_test))").gte("created_at", monthStart)
          .returns<{ id: string; item_name: string; qty: number; price_cli_cents: number; created_at: string; refunded_at: string | null; order_id: string; orders: { status: string; customer_id: string | null; profiles: { full_name: string | null; is_test: boolean } | null } | null }[]>(),
        svc.from("customer_charges").select("id, description, amount_cents, kind, created_at, customer_id, profiles(full_name, is_test)").neq("status", "void").gte("created_at", monthStart)
          .returns<{ id: string; description: string; amount_cents: number; kind: string; created_at: string; customer_id: string; profiles: { full_name: string | null; is_test: boolean } | null }[]>(),
      ]);

      const righe: RigaMetrica[] = [];
      for (const x of specials ?? []) {
        if (x.refunded_at || x.orders?.status === "cancelled") continue;
        if (!includiProva && x.orders?.profiles?.is_test) continue;
        righe.push({
          etichetta: `${x.qty}× ${x.item_name}`,
          dettaglio: `${x.orders?.profiles?.full_name ?? "—"} · ${data(x.created_at)}`,
          importoCents: x.price_cli_cents * x.qty,
          href: `/admin/ordini/${x.order_id}`,
        });
      }
      for (const c of charges ?? []) {
        if (c.kind === "refund") continue;
        if (!includiProva && c.profiles?.is_test) continue;
        righe.push({
          etichetta: c.description,
          dettaglio: `${c.profiles?.full_name ?? "—"} · ${data(c.created_at)}`,
          importoCents: c.amount_cents,
          href: `/admin/abbonati/${c.customer_id}`,
        });
      }
      return {
        titolo: "Extra del mese",
        spiegazione:
          "Capi fuori abbonamento e addebiti manuali. I capi rimborsati non compaiono: prima venivano tolti due volte, e un capo da 10 € addebitato e rimborsato faceva scendere il totale a −10 €.",
        righe,
        totaleCents: righe.reduce((t, r) => t + (r.importoCents ?? 0), 0),
      };
    }

    case "sacchi-mese": {
      const { data: ordini } = await svc
        .from("orders")
        .select("id, bags, created_at, status, customer_id, pickup_slot:slots!orders_pickup_slot_id_fkey(starts_at), profiles!orders_customer_id_fkey(full_name, is_test)")
        .neq("status", "cancelled")
        .gte("created_at", monthStart)
        .returns<{ id: string; bags: number; created_at: string; status: string; customer_id: string | null; pickup_slot: { starts_at: string } | null; profiles: { full_name: string | null; is_test: boolean } | null }[]>();

      // La data che conta è quella del RITIRO, non quella in cui il cliente ha
      // premuto il pulsante. Cinque ritiri prenotati la stessa sera per quattro
      // settimane diverse comparivano tutti come «29/08», e sembravano lo
      // stesso giorno. Ordinati per passaggio, così l'elenco è un calendario.
      const utili = (ordini ?? [])
        .filter((o) => includiProva || !o.profiles?.is_test)
        .sort((a, b) => (a.pickup_slot?.starts_at ?? a.created_at).localeCompare(b.pickup_slot?.starts_at ?? b.created_at));
      return {
        titolo: "Sacchi del mese",
        spiegazione:
          "Sacchi dichiarati sugli ordini creati questo mese, esclusi gli annullati. La data è quella del ritiro, non quella della prenotazione.",
        righe: utili.map((o) => ({
          etichetta: o.profiles?.full_name ?? "—",
          dettaglio: o.pickup_slot?.starts_at
            ? `Ritiro ${data(o.pickup_slot.starts_at)} · prenotato il ${data(o.created_at)} · #${o.id.slice(0, 8)}`
            : `Prenotato il ${data(o.created_at)} · ritiro da fissare · #${o.id.slice(0, 8)}`,
          quantita: o.bags,
          href: `/admin/ordini/${o.id}`,
        })),
        totaleQuantita: utili.reduce((t, o) => t + (o.bags ?? 0), 0),
      };
    }

    case "da-dare": {
      const { data: righe } = await svc
        .from("laundry_payouts")
        .select("id, amount_cents, kind, status, created_at, order_id, laundries(name), orders(customer_id, profiles!orders_customer_id_fkey(full_name, is_test))")
        .neq("status", "void")
        .gte("created_at", monthStart)
        .order("created_at", { ascending: false })
        .returns<{ id: string; amount_cents: number; kind: string; status: string; created_at: string; order_id: string | null; laundries: { name: string } | null; orders: { customer_id: string | null; profiles: { full_name: string | null; is_test: boolean } | null } | null }[]>();

      const utili = (righe ?? []).filter((r) => includiProva || !r.orders?.profiles?.is_test);
      return {
        titolo: "Da dare alla lavanderia questo mese",
        spiegazione:
          "Righe del registro compensi, scritte quando il lavoro è fatto. È la stessa fonte della pagina «Soldi alla lavanderia»: prima la Home ricalcolava per conto suo e i due numeri non coincidevano.",
        righe: utili.map((r) => ({
          etichetta: r.kind === "bag" ? "Sacchi" : "Capo speciale",
          dettaglio: `${r.orders?.profiles?.full_name ?? "—"} · ${data(r.created_at)}${r.status === "settled" ? " · già pagato" : ""}`,
          importoCents: r.amount_cents,
          href: r.order_id ? `/admin/ordini/${r.order_id}` : undefined,
        })),
        totaleCents: utili.reduce((t, r) => t + r.amount_cents, 0),
      };
    }

    case "nuovi-abbonati":
    case "interrotti": {
      const nuovi = chiave === "nuovi-abbonati";
      const colonna = nuovi ? "activated_at" : "canceled_at";
      const { data: subs } = await svc
        .from("subscriptions")
        .select("id, user_id, status, activated_at, canceled_at, current_period_end, plans(name), profiles(full_name, is_test)")
        .gte(colonna, monthStart)
        .order(colonna, { ascending: false })
        .returns<{ id: string; user_id: string; status: string; activated_at: string | null; canceled_at: string | null; current_period_end: string | null; plans: { name: string } | null; profiles: { full_name: string | null; is_test: boolean } | null }[]>();

      const utili = (subs ?? []).filter((s) => includiProva || !s.profiles?.is_test);
      return {
        titolo: nuovi ? "Nuovi abbonati del mese" : "Abbonamenti interrotti nel mese",
        spiegazione: nuovi
          ? "Abbonamenti attivati dal primo del mese."
          : "Disdette registrate dal primo del mese. Attenzione: se la disdetta è stata fatta dal pannello, Stripe continua a fatturare fino alla fine del periodo pagato.",
        righe: utili.map((s) => ({
          etichetta: s.profiles?.full_name ?? "—",
          dettaglio: `${s.plans?.name ?? "piano non a listino"} · ${data(nuovi ? s.activated_at : s.canceled_at)}${!nuovi && s.current_period_end ? ` · coperto fino al ${data(s.current_period_end)}` : ""}`,
          href: `/admin/abbonati/${s.user_id}`,
        })),
        totaleQuantita: utili.length,
      };
    }
  }
}
