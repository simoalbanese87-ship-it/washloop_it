import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { elencoPersone } from "@/lib/persone";
import { assicuraAttributi, assicuraLista, listeBrevo, pausa, sincronizzaContatto, sincronizzaContattoSilenzioso } from "@/lib/brevo-contatti";
import { LISTA, appartenenzeDi, clusterDi, type Cluster } from "@/lib/brevo-liste";
import { isTipoServizio, type TipoServizio } from "@/lib/tipo-servizio";

/** La rete di sicurezza: una volta a notte si riallineano tutte le liste.
 *
 *  Gli agganci immediati — registrazione, pagamento, disiscrizione, tipo di
 *  servizio — coprono i momenti in cui qualcosa succede. Questo copre tutto il
 *  resto: un abbonamento scaduto senza che nessuno prema niente, una modifica
 *  fatta a mano sul database, una chiamata a Brevo fallita ieri sera.
 *
 *  Si può eseguire **a secco**: dice cosa farebbe senza toccare niente. È il
 *  modo in cui va guardato la prima volta, perché una lista sbagliata non si
 *  disfa — le email partono. */

export type RigaSync = {
  email: string;
  nome: string;
  cluster: Cluster;
  tipoServizio: TipoServizio | null;
  dentro: string[];
  fuori: string[];
  errori: string[];
};

export type EsitoSyncTotale = {
  dry: boolean;
  esaminati: number;
  scritti: number;
  falliti: number;
  perCluster: Record<Cluster, number>;
  righe: RigaSync[];
};

const norm = (e: string) => e.trim().toLowerCase();

export async function sincronizzaTuttiIContatti(opts: { dry?: boolean; limite?: number } = {}): Promise<EsitoSyncTotale> {
  const dry = opts.dry === true;
  const svc = createServiceClient();

  // `elencoPersone` è la stessa vista che si legge in /admin/persone: lead e
  // clienti già uniti, i doppioni già tolti per email e per telefono, i dati di
  // prova già fuori. Rifare qui quella fusione vorrebbe dire avere due verità.
  const [persone, { data: subs }, { data: profili }, { data: leads }, { data: optout }] = await Promise.all([
    elencoPersone(false),
    svc.from("subscriptions").select("user_id, status").returns<{ user_id: string; status: string }[]>(),
    svc.from("profiles").select("id, tipo_servizio").returns<{ id: string; tipo_servizio: string | null }[]>(),
    svc.from("leads").select("email, unsubscribed_at").returns<{ email: string; unsubscribed_at: string | null }[]>(),
    svc.from("email_optouts").select("email").returns<{ email: string }[]>(),
  ]);

  // Chi ha avuto un abbonamento, anche chiuso. Si guarda lo stato e non
  // `activated_at`: in produzione due righe `active` ce l'hanno nullo perché
  // nate prima che quella colonna esistesse, e sarebbero finite fra i free.
  const haPagato = new Set(
    (subs ?? []).filter((s) => !["incomplete", "incomplete_expired"].includes(s.status)).map((s) => s.user_id),
  );
  const tipoDi = new Map<string, TipoServizio | null>(
    (profili ?? []).map((p) => [p.id, isTipoServizio(p.tipo_servizio) ? p.tipo_servizio : null]),
  );
  const disiscritti = new Set<string>([
    ...(optout ?? []).map((o) => norm(o.email)),
    ...(leads ?? []).filter((l) => l.unsubscribed_at).map((l) => norm(l.email)),
  ]);

  const righe: RigaSync[] = [];
  const perCluster: Record<Cluster, number> = { disiscritto: 0, clienti: 0, account_free: 0, lead: 0 };
  let scritti = 0;
  let falliti = 0;

  if (!dry) {
    // Gli attributi e la lista dei disiscritti nascono qui, una volta sola.
    await assicuraAttributi();
    await assicuraLista(LISTA.disiscritti);
    await listeBrevo(true);
  }

  // Un indirizzo scritto male non si corregge qui: si salta e si lascia dov'è.
  // In produzione ce n'è uno — «simo?@gmail.com» — e inventarne la versione
  // giusta vorrebbe dire scrivere a una persona che non l'ha mai chiesto.
  const indirizzoSensato = /^[^\s@?]+@[^\s@?]+\.[a-z]{2,}$/i;
  const candidati = persone.filter((p) => p.email && indirizzoSensato.test(p.email.trim()));
  const lista = opts.limite ? candidati.slice(0, opts.limite) : candidati;

  for (const [i, p] of lista.entries()) {
    const email = norm(p.email!);
    const persona = {
      haAccount: p.profileId != null,
      haAvutoAbbonamento: p.profileId != null && haPagato.has(p.profileId),
      disiscritto: disiscritti.has(email),
    };
    const tipoServizio = p.profileId ? tipoDi.get(p.profileId) ?? null : null;
    const cluster = clusterDi(persona);
    perCluster[cluster] += 1;
    const { dentro, fuori } = appartenenzeDi(persona, tipoServizio);

    if (dry) {
      righe.push({ email, nome: p.nome, cluster, tipoServizio, dentro, fuori, errori: [] });
      continue;
    }

    const esito = await sincronizzaContatto({
      email,
      nome: p.nome,
      cap: p.cap,
      fonte: p.provenienza ?? (p.profileId ? "sito" : "landing"),
      tipoServizio,
      persona,
    });
    if (esito.ok) scritti += 1;
    else falliti += 1;
    righe.push({ email, nome: p.nome, cluster, tipoServizio, dentro, fuori, errori: esito.errori });

    // Il tetto di Brevo sui contatti è 10 richieste al secondo e ogni persona
    // ne costa fino a cinque: si respira ogni due.
    if (i % 2 === 1) await pausa(400);
  }

  return { dry, esaminati: lista.length, scritti, falliti, perCluster, righe };
}

/** Una riga sola per il registro delle automazioni. */
export function riassuntoSync(e: EsitoSyncTotale): string {
  const c = e.perCluster;
  const testa = e.dry ? "prova a secco" : `${e.scritti} allineati`;
  const coda = e.falliti > 0 ? `, ${e.falliti} falliti` : "";
  return `${testa}${coda} · ${e.esaminati} contatti: ${c.clienti} clienti, ${c.account_free} account free, ${c.lead} lead, ${c.disiscritto} disiscritti`;
}

/** Allinea **una** persona, da id del profilo. È la funzione che chiamano gli
 *  agganci: registrazione, pagamento, cambio di tipo servizio.
 *
 *  Legge da sola tutto quello che serve invece di farselo passare: chi la
 *  chiama sta in mezzo a un flusso vivo — un webhook di Stripe, una email di
 *  benvenuto — e non deve conoscere le regole delle liste. Non lancia mai. */
export async function sincronizzaPersona(userId: string): Promise<void> {
  try {
    const svc = createServiceClient();
    const [{ data: profilo }, { data: utente }, { data: subs }] = await Promise.all([
      svc.from("profiles").select("full_name, tipo_servizio, is_test, role").eq("id", userId)
        .maybeSingle<{ full_name: string | null; tipo_servizio: string | null; is_test: boolean; role: string }>(),
      svc.auth.admin.getUserById(userId),
      svc.from("subscriptions").select("status").eq("user_id", userId).returns<{ status: string }[]>(),
    ]);
    // I dati di prova non escono di qui: è la stessa guardia dell'elenco
    // persone, e senza di essa le liste si riempirebbero di «Mario Test».
    if (!profilo || profilo.is_test || profilo.role !== "customer") return;

    const email = utente?.user?.email?.trim().toLowerCase();
    if (!email) return;

    const { data: optout } = await svc.from("email_optouts").select("email").eq("email", email).maybeSingle();
    const { data: lead } = await svc.from("leads").select("unsubscribed_at, cap, source").ilike("email", email)
      .maybeSingle<{ unsubscribed_at: string | null; cap: string | null; source: string | null }>();
    const { data: indirizzo } = await svc.from("addresses").select("cap").eq("user_id", userId).limit(1)
      .maybeSingle<{ cap: string | null }>();

    await sincronizzaContattoSilenzioso({
      email,
      nome: profilo.full_name,
      cap: indirizzo?.cap ?? lead?.cap ?? null,
      fonte: lead?.source ?? "sito",
      tipoServizio: isTipoServizio(profilo.tipo_servizio) ? profilo.tipo_servizio : null,
      persona: {
        haAccount: true,
        haAvutoAbbonamento: (subs ?? []).some((s) => !["incomplete", "incomplete_expired"].includes(s.status)),
        disiscritto: optout != null || lead?.unsubscribed_at != null,
      },
    });
  } catch {
    // Mai verso il chiamante: un'email di benvenuto non deve fallire perché
    // Brevo è lento. Il guasto lo registra già `sincronizzaContattoSilenzioso`.
  }
}

/** Allinea una email che si è appena disiscritta, anche se non ha un account:
 *  i lead della landing stanno in `leads` e non hanno nessun profilo. */
export async function sincronizzaDisiscritto(email: string): Promise<void> {
  await sincronizzaContattoSilenzioso({
    email: norm(email),
    persona: { haAccount: false, haAvutoAbbonamento: false, disiscritto: true },
  });
}
