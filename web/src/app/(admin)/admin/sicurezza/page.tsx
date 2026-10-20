import { Card, PageTitle } from "@/components/app/AppShell";
import { StatoNotifiche } from "@/components/app/StatoNotifiche";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { statoStripe } from "@/lib/stato-stripe";
import { METODI_CHECKOUT, metodiOffertiDaStripe, nomeMetodo } from "@/lib/metodi-accettati";
import { statoClausolaRider } from "@/lib/rider-predefinito";
import { coperturaNotifiche } from "@/lib/notifiche-copertura";
import { daRisistemare } from "@/lib/riconsegna";
import { romeHHMM, romeWeekday } from "@/lib/format";
import { STATI_CHIUSI, type OrderStatus } from "@/lib/orders";

export const dynamic = "force-dynamic";

type Status = "ok" | "warn" | "fail";
type Check = { label: string; status: Status; detail: string };

const has = (v?: string) => !!(v && v.replace(/\s+/g, "").length > 0);

function StatusDot({ s }: { s: Status }) {
  const map: Record<Status, string> = { ok: "bg-[#1F8A5B]", warn: "bg-[#E08A00]", fail: "bg-[#C0392B]" };
  return <span className={`mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${map[s]}`} />;
}

function CheckRow({ c }: { c: Check }) {
  return (
    <div className="flex items-start gap-3 border-b border-line py-3 last:border-0">
      <StatusDot s={c.status} />
      <div>
        <div className="font-display text-sm font-bold text-navy">{c.label}</div>
        <div className="text-sm font-medium text-muted">{c.detail}</div>
      </div>
    </div>
  );
}

export default async function SicurezzaPage() {
  // --- Check di configurazione (server-side, solo booleani: nessun segreto esposto) ---
  const env: Check[] = [
    { label: "Supabase service role key", status: has(process.env.SUPABASE_SERVICE_ROLE_KEY) ? "ok" : "fail", detail: has(process.env.SUPABASE_SERVICE_ROLE_KEY) ? "Configurata" : "Mancante: operazioni server bloccate" },
    { label: "Stripe secret key", status: has(process.env.STRIPE_SECRET_KEY) ? "ok" : "fail", detail: has(process.env.STRIPE_SECRET_KEY) ? "Configurata" : "Mancante: pagamenti non operativi" },
    { label: "Stripe webhook secret", status: has(process.env.STRIPE_WEBHOOK_SECRET) ? "ok" : "fail", detail: has(process.env.STRIPE_WEBHOOK_SECRET) ? "Configurato" : "Mancante: sync abbonamenti a rischio" },
    { label: "Email SMTP", status: has(process.env.SMTP_HOST) && has(process.env.SMTP_USER) && has(process.env.SMTP_PASS) ? "ok" : "warn", detail: has(process.env.SMTP_HOST) ? "Configurato" : "Non configurato: le email vengono saltate" },
    { label: "URL sito in HTTPS", status: (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://") ? "ok" : "warn", detail: process.env.NEXT_PUBLIC_SITE_URL || "Non impostato" },
    // Senza le due chiavi VAPID le notifiche non partono e non dà errore
    // nessuno: `sendPush` diventa un'operazione che non fa niente.
    { label: "Chiavi notifiche (VAPID)", status: has(process.env.VAPID_PRIVATE_KEY) && has(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) ? "ok" : "fail", detail: has(process.env.VAPID_PRIVATE_KEY) && has(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) ? "Configurate" : "Mancanti: nessuna notifica push parte, in silenzio" },
  ];

  // --- Audit del database (richiede la function security_audit, migration 0010) ---
  const supabase = await createClient();
  const { data: audit, error } = await supabase.rpc("security_audit");

  const db: Check[] = [];
  let auditAvailable = false;
  if (!error && audit) {
    auditAvailable = true;
    const a = audit as {
      tables_without_rls: string[];
      tables_without_policy: string[];
      role_counts: Record<string, number>;
      profiles_total: number;
      profiles_without_client_code: number;
    };
    const noRls = a.tables_without_rls ?? [];
    const noPol = a.tables_without_policy ?? [];
    db.push({
      label: "Row Level Security su tutte le tabelle",
      status: noRls.length === 0 ? "ok" : "fail",
      detail: noRls.length === 0 ? "Tutte le tabelle hanno RLS attiva" : `RLS DISATTIVA su: ${noRls.join(", ")}`,
    });
    db.push({
      label: "Policy presenti dove RLS è attiva",
      status: noPol.length === 0 ? "ok" : "warn",
      detail: noPol.length === 0 ? "Nessuna tabella senza policy" : `RLS senza policy su: ${noPol.join(", ")}`,
    });
    db.push({
      label: "Codice cliente anonimo su tutti i profili",
      status: (a.profiles_without_client_code ?? 0) === 0 ? "ok" : "warn",
      detail: `${a.profiles_without_client_code}/${a.profiles_total} profili senza codice (privacy lavanderia)`,
    });
    const roles = a.role_counts ?? {};
    db.push({
      label: "Account per ruolo",
      status: "ok",
      detail: `admin: ${roles.admin ?? 0} · partner: ${roles.partner ?? 0} · courier: ${roles.courier ?? 0} · customer: ${roles.customer ?? 0}`,
    });
  }

  // --- Pronti a operare? Controlli che nessuna pagina faceva, e che sono la
  //     differenza tra "il sito è su" e "il servizio funziona davvero". ---
  const svc = createServiceClient();
  // Un solo istante letto, e da lì si deriva il resto: chiamare l'orologio due
  // volte dentro il render è quello che il linter segnala, giustamente.
  const adesso = new Date();
  const oraIso = adesso.toISOString();
  const fraUnaSettimana = new Date(adesso.getTime() + 7 * 86_400_000).toISOString();

  const [ritiri, consegne, zoneAttive, lavanderie, deposito, indirizziSenzaGeo, ordiniAperti, ricorrenze, fasceRitiroFuture, senzaLavanderia] = await Promise.all([
    svc.from("slots").select("id", { count: "exact", head: true }).eq("kind", "pickup").is("archived_at", null).gte("starts_at", oraIso).lte("starts_at", fraUnaSettimana),
    svc.from("slots").select("id", { count: "exact", head: true }).eq("kind", "delivery").is("archived_at", null).gte("starts_at", oraIso).lte("starts_at", fraUnaSettimana),
    svc.from("zones").select("name, courier_id").eq("active", true).returns<{ name: string; courier_id: string | null }[]>(),
    svc.from("laundries").select("name, address, email, active").eq("active", true).returns<{ name: string; address: string | null; email: string | null; active: boolean }[]>(),
    svc.from("depots").select("name, lat").eq("active", true).maybeSingle<{ name: string; lat: number | null }>(),
    svc.from("addresses").select("id", { count: "exact", head: true }).is("lat", null),
    // Ordini rimasti su fasce tolte dal calendario. Si legge tutto e si filtra
    // in JS: la condizione è «l'ordine è aperto E almeno una delle due fasce è
    // archiviata», e in PostgREST un OR su due tabelle innestate non si scrive
    // in modo leggibile. Sono poche righe, non vale una vista.
    svc
      .from("orders")
      .select("id, status, cliente:profiles!orders_customer_id_fkey(is_test), pickup:slots!orders_pickup_slot_id_fkey(archived_at), consegna:slots!orders_delivery_slot_id_fkey(archived_at)")
      .not("status", "in", `(${STATI_CHIUSI.join(",")})`)
      .returns<{ id: string; status: OrderStatus; cliente: { is_test: boolean } | null; pickup: { archived_at: string | null } | null; consegna: { archived_at: string | null } | null }[]>(),
    // Ricorrenze attive che non trovano la loro fascia. È lo stesso guasto che
    // il cron registra da solo (`app/api/cron/recurring/route.ts`), ma quel
    // registro non lo apre nessuno: il commento lì dice che quel silenzio «è
    // costato un cliente». Qui la stessa domanda si vede senza doverla cercare.
    svc.from("recurring_pickups").select("id, weekday, hhmm, cliente:profiles!recurring_pickups_customer_id_fkey(is_test)").eq("active", true).returns<{ id: string; weekday: number; hhmm: string; cliente: { is_test: boolean } | null }[]>(),
    svc.from("slots").select("starts_at").eq("kind", "pickup").is("archived_at", null).gte("starts_at", oraIso).returns<{ starts_at: string }[]>(),
    // Ordini aperti senza lavanderia: il portale filtra per lavanderia, quindi
    // un ordine così **non lo vede nessuno** — il sacco arriva sul banco senza
    // comparire in nessuna lista, e ce ne si accorge quando chiama il cliente.
    svc
      .from("orders")
      .select("id, cliente:profiles!orders_customer_id_fkey(is_test)")
      .is("laundry_id", null)
      .not("status", "in", `(${STATI_CHIUSI.join(",")})`)
      .returns<{ id: string; cliente: { is_test: boolean } | null }[]>(),
  ]);

  // --- Stripe, chiesto a Stripe. ---
  //
  // «Incassato 0 €» e «il webhook non arriva» erano due deduzioni fatte
  // guardando tabelle vuote. Le tabelle vuote hanno molte cause, e da fuori non
  // si distinguono: qui si chiede direttamente a Stripe quali endpoint webhook
  // sono configurati e quanto è stato incassato davvero. Le chiavi ce le ha il
  // server, non chi legge questa pagina — ed è l'unico posto da cui la domanda
  // può ricevere una risposta invece di un'ipotesi.
  const [stato, metodi, clausola, { data: abbonamentiVivi }] = await Promise.all([
    statoStripe(),
    metodiOffertiDaStripe(),
    statoClausolaRider(svc),
    // Un cliente alla volta ha un abbonamento attivo: è l'assunzione su cui
    // poggiano il saldo dei capi compresi (che legge il più recente) e il
    // conto di Competenza (che li guarda tutti). Finché è vera i due numeri
    // coincidono; se un giorno smette di esserlo, divergono in silenzio — ed è
    // esattamente il tipo di cosa che si scopre da un importo sbagliato tre
    // mesi dopo. Qui si legge, invece di darla per buona.
    svc
      .from("subscriptions")
      .select("user_id, plans(name, servizio), profiles(full_name, is_test, tipo_servizio)")
      .in("status", ["active", "trialing"])
      .returns<
        {
          user_id: string;
          plans: { name: string; servizio: string | null } | { name: string; servizio: string | null }[] | null;
          profiles:
            | { full_name: string | null; is_test: boolean; tipo_servizio: string | null }
            | { full_name: string | null; is_test: boolean; tipo_servizio: string | null }[]
            | null;
        }[]
      >(),
  ]);

  const quantiAttivi = new Map<string, { nome: string; n: number }>();
  for (const a of abbonamentiVivi ?? []) {
    const prof = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
    if (prof?.is_test) continue;
    const gia = quantiAttivi.get(a.user_id);
    quantiAttivi.set(a.user_id, { nome: prof?.full_name ?? "Cliente", n: (gia?.n ?? 0) + 1 });
  }
  const doppioni = [...quantiAttivi.values()].filter((x) => x.n > 1);

  // Il piano dice un servizio e l'anagrafica un altro.
  //
  // È successo a Federica Corsini: passata al solo stiro il 13 ottobre con
  // canone e anagrafica giusti, ma con il piano «Lava e stira» rimasto
  // attaccato. I ritiri andavano alla stireria e l'addebito era corretto —
  // però la sua scheda ha raccontato per una settimana un servizio che non
  // aveva, e quello è il genere di dato che si ripete a voce.
  const incoerenti: string[] = [];
  for (const a of abbonamentiVivi ?? []) {
    const prof = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
    const piano = Array.isArray(a.plans) ? a.plans[0] : a.plans;
    if (!prof || prof.is_test || !piano?.servizio) continue;
    const stiroDiQua = piano.servizio === "stiro";
    const stiroDiLa = prof.tipo_servizio === "solo_stiro";
    if (stiroDiQua !== stiroDiLa && prof.tipo_servizio) {
      incoerenti.push(`${prof.full_name ?? "Cliente"} (piano ${piano.name}, anagrafica ${prof.tipo_servizio.replace("_", " ")})`);
    }
  }

  const senzaRider = (zoneAttive.data ?? []).filter((z) => !z.courier_id).map((z) => z.name);
  const lavIncomplete = (lavanderie.data ?? []).filter((l) => !l.address || !l.email);
  const nRitiri = ritiri.count ?? 0;
  const nConsegne = consegne.count ?? 0;
  const nSenzaGeo = indirizziSenzaGeo.count ?? 0;

  const unoSolo = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

  /** Un guasto sui dati di prova va **detto**, non fatto suonare.
   *
   *  Mario Test ha un ritiro ricorrente al martedì alle 09:00 e nessuno slot a
   *  quell'ora: da manuale è lo stesso guasto che a settembre è costato un
   *  cliente vero, ma su un profilo di prova non c'è niente da rincorrere. Se
   *  resta rosso, questa pagina ha un allarme perenne che nessuno spegnerà — e
   *  il giorno in cui compare quello vero non lo distingue più nessuno. */
  const gravita = (reali: number, prova: number): Status => (reali > 0 ? "fail" : prova > 0 ? "warn" : "ok");
  const codaProva = (prova: number) =>
    prova === 0 ? "" : ` Più ${prova} su ${prova === 1 ? "un profilo di prova" : "profili di prova"}: solo da sapere.`;

  const orfaniTutti = (ordiniAperti.data ?? []).filter((o) =>
    daRisistemare({
      aperto: true,
      ritiroArchiviato: unoSolo(o.pickup)?.archived_at != null,
      riconsegnaArchiviata: unoSolo(o.consegna)?.archived_at != null,
    }),
  );
  const orfani = orfaniTutti.filter((o) => !unoSolo(o.cliente)?.is_test).length;
  const orfaniProva = orfaniTutti.length - orfani;

  // La regola è la stessa del cron: stesso giorno della settimana **e** stessa
  // ora, in fuso di Roma. Scritta diversa qui darebbe una risposta diversa da
  // quella che il cron poi userà davvero.
  const ricorrenzeSenzaFascia = (ricorrenze.data ?? []).filter(
    (r) => !(fasceRitiroFuture.data ?? []).some((f) => romeWeekday(f.starts_at) === r.weekday && romeHHMM(f.starts_at) === r.hhmm),
  );
  const ricorrenzeOrfane = ricorrenzeSenzaFascia.filter((r) => !unoSolo(r.cliente)?.is_test).length;
  const ricorrenzeOrfaneProva = ricorrenzeSenzaFascia.length - ricorrenzeOrfane;

  const senzaLav = (senzaLavanderia.data ?? []).filter((o) => !unoSolo(o.cliente)?.is_test).length;
  const senzaLavProva = (senzaLavanderia.data ?? []).length - senzaLav;

  const ops: Check[] = [
    {
      label: "Webhook Stripe",
      status: stato.ok ? (stato.endpointNostro ? "ok" : "fail") : "warn",
      detail: !stato.ok
        ? `Stripe non risponde: ${stato.errore}`
        : stato.endpointNostro
          ? `Registrato e ${stato.endpointNostro.attivo ? "attivo" : "DISATTIVATO"} · ${stato.endpointNostro.eventi} eventi ascoltati`
          : stato.endpoints === 0
            ? "Nessun endpoint webhook configurato su Stripe: i pagamenti non arrivano mai nel sistema, e il registro incassi resta vuoto. Va aggiunto da Sviluppatori → Webhook, puntato su /api/stripe/webhook."
            : `${stato.endpoints} endpoint configurati su Stripe, ma nessuno punta a questo sito: i pagamenti non arrivano qui.`,
    },
    {
      // Nel codice i metodi li scegliamo noi, ma una fattura rimasta aperta la
      // paga il cliente su una pagina che disegna Stripe: lì vale ciò che è
      // acceso sull'account, e da qui non si vedrebbe. Questa riga lo chiede.
      label: "Modi di pagare offerti al cliente",
      status: !metodi.ok ? "warn" : metodi.inattesi.length === 0 ? "ok" : "warn",
      detail: !metodi.ok
        ? `Non verificabile: ${metodi.errore}`
        : metodi.inattesi.length === 0
          ? `Accettiamo ${METODI_CHECKOUT.map(nomeMetodo).join(", ")} (con carta viaggiano Apple Pay e Google Pay). Su Stripe non è acceso nient'altro.`
          : `Acceso su Stripe anche: ${metodi.inattesi.map(nomeMetodo).join(", ")}. Non compare dove passiamo la lista noi, ma sì sulla pagina di una fattura rimasta aperta. Si spegne da Stripe → Impostazioni → Metodi di pagamento (configurazione «${metodi.configurazione}»).`,
    },
    {
      label: "Incassi su Stripe",
      status: stato.ok ? "ok" : "warn",
      detail: stato.ok
        ? `${stato.fatturePagate} fatture pagate negli ultimi 90 giorni, per ${(stato.incassatoCents / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" })}`
        : "Non verificabile finché Stripe non risponde",
    },
    {
      label: "Fasce di ritiro nei prossimi 7 giorni",
      status: nRitiri === 0 ? "fail" : nRitiri < 7 ? "warn" : "ok",
      detail: nRitiri === 0 ? "Nessuna: il cliente non può prenotare nulla" : `${nRitiri} fasce disponibili`,
    },
    {
      label: "Fasce di riconsegna nei prossimi 7 giorni",
      status: nConsegne === 0 ? "fail" : nConsegne < 7 ? "warn" : "ok",
      detail: nConsegne === 0 ? "Nessuna: non possiamo programmare le riconsegne" : `${nConsegne} fasce disponibili`,
    },
    {
      // Una regola provvisoria che nessuno vede è una regola per sempre. Questa
      // riga esiste perché si possa leggere che c'è, cosa sta facendo, e a che
      // condizione smetterà — senza aprire il codice.
      label: "Rider messo in automatico alla creazione (clausola momentanea)",
      status: clausola.attiva ? "ok" : "warn",
      detail: clausola.motivo,
    },
    {
      label: "Piano e servizio dicono la stessa cosa",
      status: incoerenti.length === 0 ? "ok" : "warn",
      detail:
        incoerenti.length === 0
          ? "Nessun cliente ha un piano che racconta un servizio diverso da quello in anagrafica."
          : `${incoerenti.join(", ")}. Si sistema dalla scheda del cliente, con «Cambia piano».`,
    },
    {
      label: "Un abbonamento attivo per cliente",
      status: doppioni.length === 0 ? "ok" : "fail",
      detail:
        doppioni.length === 0
          ? "Nessun cliente ha due abbonamenti attivi insieme: i capi compresi e il conto di Competenza leggono lo stesso canone."
          : `${doppioni.map((d) => `${d.nome} (${d.n})`).join(", ")}: con due abbonamenti attivi, i capi compresi leggono il più recente e Competenza li guarda tutti. Disdici quello vecchio.`,
    },
    {
      label: "Rider assegnato alle zone attive",
      status: (zoneAttive.data ?? []).length === 0 ? "fail" : senzaRider.length === 0 ? "ok" : "warn",
      detail:
        (zoneAttive.data ?? []).length === 0
          ? "Nessuna zona attiva: la landing dirà a tutti che non copriamo"
          : senzaRider.length === 0
            ? `${zoneAttive.data?.length} zone attive, tutte con rider`
            : `Senza rider: ${senzaRider.join(", ")} (usano il ripiego bilanciato)`,
    },
    {
      label: "Lavanderia con indirizzo ed email",
      status: (lavanderie.data ?? []).length === 0 ? "fail" : lavIncomplete.length === 0 ? "ok" : "warn",
      detail:
        (lavanderie.data ?? []).length === 0
          ? "Nessuna lavanderia attiva"
          : lavIncomplete.length === 0
            ? `${lavanderie.data?.length} attiva/e, dati completi`
            : `Dati mancanti su: ${lavIncomplete.map((l) => l.name).join(", ")}`,
    },
    {
      label: "Deposito geocodificato",
      status: !deposito.data ? "fail" : deposito.data.lat == null ? "warn" : "ok",
      detail: !deposito.data
        ? "Nessun deposito attivo: il giro del rider non ha punto di partenza"
        : deposito.data.lat == null
          ? "Indirizzo senza coordinate: il percorso non si ottimizza"
          : deposito.data.name,
    },
    {
      label: "Indirizzi cliente con coordinate",
      status: nSenzaGeo === 0 ? "ok" : "warn",
      detail: nSenzaGeo === 0 ? "Tutti geocodificati" : `${nSenzaGeo} senza coordinate: non compaiono sulla mappa del rider`,
    },
    {
      label: "Ordini su fasce tolte dal calendario",
      status: gravita(orfani, orfaniProva),
      detail: orfani === 0
        ? `Nessun cliente vero è rimasto su una fascia archiviata.${codaProva(orfaniProva)}`.trim()
        : `${orfani} ${orfani === 1 ? "ordine è rimasto" : "ordini sono rimasti"} su una fascia archiviata: quel giorno non passa nessuno. Si sistemano dal board ordini.${codaProva(orfaniProva)}`,
    },
    {
      label: "Ordini agganciati a una lavanderia",
      status: gravita(senzaLav, senzaLavProva),
      detail: senzaLav === 0
        ? `Ogni ordine aperto ha la sua lavanderia.${codaProva(senzaLavProva)}`.trim()
        : `${senzaLav} ${senzaLav === 1 ? "ordine aperto non ha" : "ordini aperti non hanno"} una lavanderia: il portale filtra per lavanderia, quindi loro non li vedono affatto.${codaProva(senzaLavProva)}`,
    },
    {
      label: "Ricorrenze con la loro fascia",
      status: gravita(ricorrenzeOrfane, ricorrenzeOrfaneProva),
      detail: ricorrenzeOrfane === 0
        ? `Ogni ritiro settimanale di un cliente vero trova la sua fascia.${codaProva(ricorrenzeOrfaneProva)}`.trim()
        : `${ricorrenzeOrfane} ${ricorrenzeOrfane === 1 ? "ricorrenza attiva non trova" : "ricorrenze attive non trovano"} nessuna fascia al loro giorno e ora: quei ritiri non nasceranno, in silenzio.${codaProva(ricorrenzeOrfaneProva)}`,
    },
  ];

  const all = [...env, ...db, ...ops];
  const fails = all.filter((c) => c.status === "fail").length;
  const warns = all.filter((c) => c.status === "warn").length;
  const overall: Status = fails > 0 ? "fail" : warns > 0 ? "warn" : "ok";
  const overallText =
    overall === "ok" ? "Tutti i controlli superati" : overall === "warn" ? `${warns} avvisi da verificare` : `${fails} problemi critici · ${warns} avvisi`;

  const notifiche = await coperturaNotifiche();
  const operativiSenza = notifiche.operativi.filter((o) => o.dispositivi === 0);

  return (
    <>
      <PageTitle kicker="Admin" title="Sicurezza" sub="Stato di configurazione e protezione del sistema. Aggiornato a ogni apertura." />

      <Card className={`mb-6 ${overall === "ok" ? "bg-[#1F8A5B]/8" : overall === "warn" ? "bg-[#E08A00]/8" : "bg-[#C0392B]/8"}`}>
        <div className="flex items-center gap-3">
          <StatusDot s={overall} />
          <span className="font-display text-lg font-extrabold text-navy">{overallText}</span>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 font-display text-base font-extrabold text-navy">Configurazione & segreti</h2>
          {env.map((c) => <CheckRow key={c.label} c={c} />)}
        </Card>

        <Card>
          <h2 className="mb-2 font-display text-base font-extrabold text-navy">Pronti a operare</h2>
          <p className="mb-2 text-xs font-medium text-muted">Non è sicurezza: è se il servizio può girare davvero domani mattina.</p>
          {ops.map((c) => <CheckRow key={c.label} c={c} />)}
        </Card>

        <Card>
          <h2 className="mb-2 font-display text-base font-extrabold text-navy">Chi riceve le notifiche</h2>
          <p className="mb-3 text-xs font-medium text-muted">
            Un avviso che non arriva non lascia traccia da nessuna parte: si scopre quando qualcuno salta
            un giro. Le notifiche sono per <strong className="text-navy">dispositivo</strong>, non per persona.
          </p>

          <div className="mb-3">
            <StatoNotifiche perche="Qui arrivano i guasti e i pagamenti falliti." />
          </div>

          {operativiSenza.length > 0 && (
            <p className="mb-2 text-sm font-semibold text-[#C9881F]">
              {operativiSenza.length === 1 ? "Una persona non le riceve" : `${operativiSenza.length} persone non le ricevono`}:{" "}
              {operativiSenza.map((o) => `${o.nome} (${o.ruolo})`).join(", ")}. Devono attivarle loro, dalla
              propria app: il permesso lo dà il browser di chi lo usa, non si può dare da qui.
            </p>
          )}

          <ul className="space-y-1.5">
            {notifiche.operativi.map((o) => (
              <li key={`${o.ruolo}-${o.nome}`} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-semibold text-navy">
                  {o.nome} <span className="font-medium text-muted">· {o.ruolo}</span>
                </span>
                <span className={`font-display text-xs font-bold ${o.dispositivi ? "text-[#1F8A5B]" : "text-[#C9881F]"}`}>
                  {o.dispositivi === 0 ? "nessun dispositivo" : `${o.dispositivi} ${o.dispositivi === 1 ? "dispositivo" : "dispositivi"}`}
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-3 border-t border-line pt-3 text-sm font-medium text-muted">
            Clienti con abbonamento in corso:{" "}
            <strong className="text-navy">
              {notifiche.clienti.conNotifiche} su {notifiche.clienti.totale}
            </strong>{" "}
            ricevono le notifiche. Gli altri le vedono solo aprendo l&apos;app — l&apos;email parte comunque.
          </p>
        </Card>

        <Card>
          <h2 className="mb-2 font-display text-base font-extrabold text-navy">Database & privacy</h2>
          {auditAvailable ? (
            db.map((c) => <CheckRow key={c.label} c={c} />)
          ) : (
            <div className="py-3">
              <p className="text-sm font-semibold text-[#C0392B]">Audit DB non disponibile.</p>
              <p className="mt-1 text-sm font-medium text-muted">
                Applica la migration <code>0010_security_audit.sql</code> (Supabase SQL Editor) per abilitare i controlli su RLS, policy e privacy.
              </p>
            </div>
          )}
        </Card>
      </div>

      <p className="mt-6 text-xs font-medium text-muted">
        Nota: questa pagina mostra solo metadati di configurazione (presenza/assenza), mai i valori dei segreti.
      </p>
    </>
  );
}
