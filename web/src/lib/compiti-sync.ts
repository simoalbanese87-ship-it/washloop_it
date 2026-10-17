import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { riderPerIndirizzo } from "@/lib/rider-predefinito";
import { decidiCompiti, type StatoCliente, type TipoCompito } from "@/lib/compiti";

/** Fa nascere e morire i compiti di un cliente, ogni volta che il suo
 *  abbonamento cambia stato.
 *
 *  Dove viene chiamata, e perché in quei due punti
 *  ----------------------------------------------
 *  1. `subscription-sync.ts` — è l'imbuto di **tutti** i percorsi Stripe:
 *     webhook, ritorno dal checkout, eventi successivi. Se un passaggio si
 *     perde, ci pensa il successivo.
 *  2. `changeSubscription` in `actions/admin-customer.ts` — gli abbonamenti
 *     manuali da Stripe non passano mai, e sono metà dei clienti.
 *
 *  Più il cron notturno, che è la rete: ripassa tutti e crea quello che manca.
 *
 *  Non lancia mai. Un compito non creato è un promemoria in meno; un webhook
 *  Stripe che fallisce per colpa di un promemoria è un abbonamento che non si
 *  attiva. */

/** Lo stato dell'abbonamento che conta, quando ce n'è più di uno in archivio.
 *
 *  Vince quello in corso, non il più recente: chi si è riabbonato dopo una
 *  disdetta ha due righe, e la riga vecchia farebbe nascere un rientro per un
 *  cliente che paga. */
async function abbonamentoRilevante(userId: string): Promise<{
  status: string | null;
  cancel_at_period_end: boolean | null;
  current_period_end: string | null;
} | null> {
  const svc = createServiceClient();
  const sel = "status, cancel_at_period_end, current_period_end";
  const { data: inCorso } = await svc
    .from("subscriptions")
    .select(sel)
    .eq("user_id", userId)
    .in("status", ["active", "trialing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ status: string | null; cancel_at_period_end: boolean | null; current_period_end: string | null }>();
  if (inCorso) return inCorso;

  const { data: ultimo } = await svc
    .from("subscriptions")
    .select(sel)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ status: string | null; cancel_at_period_end: boolean | null; current_period_end: string | null }>();
  return ultimo ?? null;
}

/** A chi tocca andarci: il rider della zona dell'indirizzo del cliente.
 *
 *  Stessa regola degli ordini (`rider-predefinito.ts`), che si spegne da sola
 *  quando i rider diventano più di uno con zone diverse. `null` è un esito
 *  previsto: il compito nasce comunque e lo assegna l'ops da `/admin/compiti`.
 *  Un compito senza rider è un problema da vedere, non da nascondere. */
async function riderDelCliente(userId: string): Promise<string | null> {
  const svc = createServiceClient();
  const { data: ind } = await svc
    .from("addresses")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();
  return riderPerIndirizzo(svc, ind?.id ?? null);
}

export type EsitoAllineamento = { creati: TipoCompito[]; annullati: TipoCompito[] };

export async function allineaCompiti(
  userId: string,
  origine: "automatico" | "cron" | "pannello" = "automatico",
): Promise<EsitoAllineamento> {
  const esito: EsitoAllineamento = { creati: [], annullati: [] };
  try {
    const svc = createServiceClient();

    const { data: prof } = await svc
      .from("profiles")
      .select("id, role, is_test, tags_delivered_at, borsa_consegnata_at, materiale_rientrato_at")
      .eq("id", userId)
      .maybeSingle<{
        id: string;
        role: string;
        is_test: boolean | null;
        tags_delivered_at: string | null;
        borsa_consegnata_at: string | null;
        materiale_rientrato_at: string | null;
      }>();
    // Solo i clienti hanno materiale in casa. Un rider o un admin con un
    // abbonamento di prova non deve comparire nel giro di nessuno.
    if (!prof || prof.role !== "customer") return esito;
    // E nemmeno i profili di prova: «Mario Test» ha un abbonamento attivo e i
    // tag segnati, e manderebbe il rider a un indirizzo che non esiste.
    if (prof.is_test) return esito;

    const sub = await abbonamentoRilevante(userId);
    const stato: StatoCliente = {
      stato: sub?.status ?? null,
      disdettaProgrammata: sub?.cancel_at_period_end === true,
      finePeriodoIso: sub?.current_period_end ?? null,
      tagConsegnatiAt: prof.tags_delivered_at,
      borsaConsegnataAt: prof.borsa_consegnata_at,
      materialeRientratoAt: prof.materiale_rientrato_at,
    };

    const decisione = decidiCompiti(stato, Date.now());

    // Prima si annulla, poi si crea: sullo stesso cliente i due gesti possono
    // riguardare tipi diversi, ma l'ordine inverso lascerebbe un attimo in cui
    // esistono entrambi — e l'indice unico farebbe fallire la creazione.
    for (const tipo of decisione.daAnnullare) {
      const { data } = await svc
        .from("compiti")
        .update({
          stato: "annullato",
          annullato_at: new Date().toISOString(),
          annullato_perche: tipo === "rientro" ? "Abbonamento ripreso: il materiale gli serve ancora." : "Abbonamento chiuso prima della consegna.",
        })
        .eq("customer_id", userId)
        .eq("tipo", tipo)
        .eq("stato", "aperto")
        .select("id");
      if (data?.length) esito.annullati.push(tipo);
    }

    if (decisione.daCreare.length > 0) {
      const assegnatoA = await riderDelCliente(userId);
      for (const c of decisione.daCreare) {
        const { error } = await svc.from("compiti").insert({
          tipo: c.tipo,
          customer_id: userId,
          assegnato_a: assegnatoA,
          visibile_dal: c.visibileDal,
          scade_il: c.scadeIl,
          origine,
        });
        // 23505 = ne esiste già uno aperto. È il caso normale: Stripe rimanda
        // lo stesso evento per tre giorni e il cron ripassa ogni notte.
        if (!error) esito.creati.push(c.tipo);
        else if ((error as { code?: string }).code !== "23505") {
          console.error(`[compiti] creazione ${c.tipo} per ${userId} fallita:`, error.message);
        }
      }
    }
  } catch (err) {
    console.error("[compiti] allineamento fallito:", err);
  }
  return esito;
}

/** La rete notturna: ripassa tutti i clienti e allinea quello che manca.
 *
 *  Serve ai webhook persi e agli abbonamenti toccati direttamente dalla
 *  dashboard di Stripe, che da noi non passano. Gira su tutti i clienti che
 *  hanno almeno un abbonamento in archivio: chi non ne ha mai avuto uno non ha
 *  niente da ricevere e niente da restituire. */
export async function allineaCompitiDiTutti(): Promise<{ clienti: number; creati: number; annullati: number }> {
  const svc = createServiceClient();
  const { data } = await svc.from("subscriptions").select("user_id").returns<{ user_id: string | null }[]>();
  const utenti = [...new Set((data ?? []).map((r) => r.user_id).filter((u): u is string => !!u))];

  let creati = 0;
  let annullati = 0;
  for (const u of utenti) {
    const e = await allineaCompiti(u, "cron");
    creati += e.creati.length;
    annullati += e.annullati.length;
  }
  return { clienti: utenti.length, creati, annullati };
}

/** Un compito pronto da mostrare: cliente, dove, cosa manca. */
export type CompitoDaFare = {
  id: string;
  tipo: "dotazione" | "rientro";
  clienteId: string;
  cliente: string;
  clientCode: string | null;
  indirizzo: string;
  zona: string | null;
  telefono: string | null;
  scadeIl: string | null;
  inRitardo: boolean;
  manca: string | null;
  assegnatoA: string | null;
  assegnatoANome: string | null;
};

type RigaCompito = {
  id: string;
  tipo: "dotazione" | "rientro";
  customer_id: string;
  assegnato_a: string | null;
  visibile_dal: string;
  scade_il: string | null;
  customer: {
    full_name: string | null;
    phone: string | null;
    client_code: string | null;
    tags_delivered_at: string | null;
    borsa_consegnata_at: string | null;
  } | null;
  rider: { full_name: string | null } | null;
};

/** Cosa gli manca, in parole. Il rider deve sapere se caricare i cartellini, il
 *  sacco o entrambi: «dotazione» non gli dice cosa prendere dal furgone. */
function cosaManca(tipo: "dotazione" | "rientro", tag: string | null, borsa: string | null): string | null {
  if (tipo === "rientro") {
    const ha = [tag ? "cartellini" : null, borsa ? "sacco" : null].filter(Boolean);
    return ha.length ? ha.join(" e ") : null;
  }
  const manca = [tag ? null : "cartellini", borsa ? null : "sacco"].filter(Boolean);
  return manca.length ? manca.join(" e ") : null;
}

const giornoIt = (g: string | null): string | null => {
  if (!g) return null;
  const [a, m, d] = g.split("-");
  return a && m && d ? `${d}/${m}` : g;
};

/** I compiti aperti, con il cliente e l'indirizzo attaccati.
 *
 *  Letti con il service client, non con la sessione: una politica RLS che nega
 *  **torna vuoto, non errore**, e una lista vuota qui vorrebbe dire «niente da
 *  fare» invece di «non ti faccio vedere». Chi può vedere cosa lo decide il
 *  chiamante passando `riderId`, che viene dalla sessione e non dal browser. */
export async function compitiDaFare(opts: { riderId?: string; soloVisibili?: boolean }): Promise<CompitoDaFare[]> {
  const svc = createServiceClient();
  let q = svc
    .from("compiti")
    .select(
      "id, tipo, customer_id, assegnato_a, visibile_dal, scade_il, customer:profiles!compiti_customer_id_fkey(full_name, phone, client_code, tags_delivered_at, borsa_consegnata_at), rider:profiles!compiti_assegnato_a_fkey(full_name)",
    )
    .eq("stato", "aperto")
    .order("visibile_dal", { ascending: true });
  if (opts.riderId) q = q.eq("assegnato_a", opts.riderId);
  const oggi = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Rome" });
  if (opts.soloVisibili) q = q.lte("visibile_dal", oggi);

  const { data, error } = await q.returns<RigaCompito[]>();
  if (error) {
    console.error("[compiti] lettura fallita:", error.message);
    return [];
  }
  const righe = data ?? [];
  if (righe.length === 0) return [];

  // L'indirizzo in una query sola: dentro l'innesto del cliente diventerebbe
  // un elenco di tutti i suoi indirizzi, e servirebbe comunque sceglierne uno.
  const { data: indirizzi } = await svc
    .from("addresses")
    .select("user_id, street, created_at, zones(name)")
    .in("user_id", [...new Set(righe.map((r) => r.customer_id))])
    .order("created_at", { ascending: false })
    .returns<{ user_id: string; street: string; created_at: string; zones: { name: string } | { name: string }[] | null }[]>();

  const perCliente = new Map<string, { street: string; zona: string | null }>();
  for (const i of indirizzi ?? []) {
    if (perCliente.has(i.user_id)) continue; // il primo è il più recente
    const z = Array.isArray(i.zones) ? i.zones[0] : i.zones;
    perCliente.set(i.user_id, { street: i.street, zona: z?.name ?? null });
  }

  const uno = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

  return righe.map((r) => {
    const c = uno(r.customer);
    const ind = perCliente.get(r.customer_id);
    return {
      id: r.id,
      tipo: r.tipo,
      clienteId: r.customer_id,
      cliente: c?.full_name ?? "Cliente",
      clientCode: c?.client_code ?? null,
      indirizzo: ind?.street ?? "indirizzo non registrato",
      zona: ind?.zona ?? null,
      telefono: c?.phone ?? null,
      scadeIl: giornoIt(r.scade_il),
      inRitardo: !!r.scade_il && r.scade_il < oggi,
      manca: cosaManca(r.tipo, c?.tags_delivered_at ?? null, c?.borsa_consegnata_at ?? null),
      assegnatoA: r.assegnato_a,
      assegnatoANome: uno(r.rider)?.full_name ?? null,
    };
  });
}
