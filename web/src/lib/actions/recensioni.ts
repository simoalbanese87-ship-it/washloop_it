"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { renderEmail, sendMail } from "@/lib/email";
import { candidatiRecensione } from "@/lib/candidati-recensione";
import {
  BANNER_PROVA,
  CTA_INVITO,
  OGGETTO_INVITO,
  TITOLO_INVITO,
  PREHEADER_INVITO,
  NOTA_FONDO_INVITO,
  corpoInvito,
  nomeDiCortesia,
  type StoriaCliente,
} from "@/lib/invito-recensione";

async function requireAdmin() {
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") throw new Error("Solo admin");
  return me;
}

const site = () => (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://washloop.it").replace(/\/+$/, "");
const linkRecensione = () => process.env.GOOGLE_REVIEW_URL?.trim() || null;

/** L'email pronta da mandare, o da guardare in anteprima.
 *
 *  Esportata perché la pagina del pannello mostra **esattamente** questo HTML
 *  in un riquadro: un'anteprima ricostruita a parte è un'anteprima che prima o
 *  poi dice una cosa diversa da quella che parte. */
export async function anteprimaInvito(
  nomeCompleto: string | null,
  storia: StoriaCliente,
  unsubUrl: string,
  prova = false,
): Promise<string> {
  const link = linkRecensione();
  return renderEmail({
    title: TITOLO_INVITO,
    body: (prova ? BANNER_PROVA : "") + corpoInvito(nomeDiCortesia(nomeCompleto), storia),
    preheader: PREHEADER_INVITO,
    cta: link ? { label: CTA_INVITO, href: link } : undefined,
    footerNote: NOTA_FONDO_INVITO,
    unsubUrl,
  });
}

/** Chi riceverà la prova: il nome con cui salutarlo e il suo link di
 *  disiscrizione.
 *
 *  Il token sta sul profilo se la persona ha un account, sul lead se è
 *  arrivata dalla landing. Senza token non si manda niente: una comunicazione
 *  commerciale senza via d'uscita non parte, nemmeno come prova. */
async function destinatarioDi(
  svc: ReturnType<typeof createServiceClient>,
  email: string,
): Promise<{ nome: string | null; unsubUrl: string } | null> {
  const { data: utenti } = await svc.auth.admin.listUsers({ perPage: 200 });
  const utente = utenti?.users.find((u) => u.email?.trim().toLowerCase() === email);
  if (utente) {
    const { data: p } = await svc
      .from("profiles")
      .select("full_name, unsub_token")
      .eq("id", utente.id)
      .maybeSingle<{ full_name: string | null; unsub_token: string }>();
    if (p?.unsub_token) {
      return { nome: p.full_name, unsubUrl: `${site()}/api/email/unsubscribe?t=${p.unsub_token}` };
    }
  }
  const { data: lead } = await svc
    .from("leads")
    .select("full_name, unsub_token")
    .eq("email", email)
    .maybeSingle<{ full_name: string | null; unsub_token: string }>();
  if (!lead?.unsub_token) return null;
  return { nome: lead.full_name, unsubUrl: `${site()}/api/email/unsubscribe?t=${lead.unsub_token}` };
}

/** Una copia di prova, senza toccare nessun cliente.
 *
 *  Non scrive `recensione_chiesta_at`: chi riceve la prova resta nell'elenco
 *  di quelli da invitare, e l'invito vero gli arriverà lo stesso.
 *
 *  Tre cose si scelgono: a chi va, **con i numeri di chi** (perché la riga che
 *  può venire storta è proprio quella dei sacchi, e con dati finti non la si
 *  vedrebbe mai) e chi la riceve in copia. Se la prova va a un cliente vero,
 *  la fascia in cima glielo dice prima di tutto il resto. */
export async function mandaCopiaDiProva(formData: FormData): Promise<void> {
  await requireAdmin();
  const a = String(formData.get("a") ?? "").trim().toLowerCase();
  const cc = String(formData.get("cc") ?? "").trim().toLowerCase() || undefined;
  const conIDatiDi = String(formData.get("dati") ?? "").trim();
  if (!a.includes("@")) throw new Error("Indirizzo non valido.");
  if (cc && !cc.includes("@")) throw new Error("L'indirizzo in copia non è valido.");
  if (!linkRecensione()) throw new Error("GOOGLE_REVIEW_URL non è configurata: l'email partirebbe senza il bottone.");

  const svc = createServiceClient();
  const destinatario = await destinatarioDi(svc, a);
  if (!destinatario) throw new Error(`${a} non è né un cliente né un lead: non ho un link di disiscrizione da metterci.`);
  const { unsubUrl } = destinatario;

  const { daInvitare, invitati } = await candidatiRecensione(svc);
  const tutti = [...daInvitare, ...invitati];
  const esempio = (conIDatiDi && tutti.find((c) => c.id === conIDatiDi)) || daInvitare[0];

  await sendMail({
    to: a,
    cc,
    subject: `[PROVA — non è l'email vera] ${OGGETTO_INVITO}`,
    html: await anteprimaInvito(
      esempio?.nome ?? destinatario.nome,
      esempio?.storia ?? { sacchi: 0, meseDiPartenza: null },
      unsubUrl,
      true,
    ),
    kind: "marketing",
    unsubUrl,
  });
  revalidatePath("/admin/recensioni");
}

/** L'invito vero a un cliente, una volta sola.
 *
 *  Si scrive **prima** di mandare, con un update condizionale su `is null`:
 *  se il pulsante viene premuto due volte — succede, la pagina è lenta e la
 *  mano è veloce — solo la prima scrittura passa, e solo quella manda l'email.
 *  Il contrario (prima mando, poi segno) è il modo in cui si chiede due volte
 *  la stessa cosa alla stessa persona. È la stessa regola dell'invito
 *  automatico in `notify.ts`, e si segna nello stesso campo: così le due
 *  strade non si pestano i piedi. */
export async function mandaInvito(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Cliente non indicato.");
  if (!linkRecensione()) throw new Error("GOOGLE_REVIEW_URL non è configurata: l'email partirebbe senza il bottone.");

  const svc = createServiceClient();
  const { data: profilo } = await svc
    .from("profiles")
    .select("id, full_name, unsub_token, recensione_chiesta_at")
    .eq("id", id)
    .maybeSingle<{ id: string; full_name: string | null; unsub_token: string; recensione_chiesta_at: string | null }>();
  if (!profilo) throw new Error("Cliente non trovato.");
  if (profilo.recensione_chiesta_at) throw new Error("A questa persona l'invito è già stato chiesto.");

  const { daInvitare } = await candidatiRecensione(svc);
  const storia = daInvitare.find((c) => c.id === id)?.storia;
  if (!storia) throw new Error("Questo cliente non ha consegne: non c'è niente da raccontare.");

  const { data: email } = await svc.auth.admin.getUserById(id);
  const indirizzo = email?.user?.email?.trim().toLowerCase();
  if (!indirizzo) throw new Error("Questo cliente non ha un indirizzo email.");

  const { data: segnato } = await svc
    .from("profiles")
    .update({ recensione_chiesta_at: new Date().toISOString() })
    .eq("id", id)
    .is("recensione_chiesta_at", null)
    .select("id")
    .maybeSingle<{ id: string }>();
  if (!segnato) throw new Error("L'invito è partito un attimo fa da un'altra parte.");

  const unsubUrl = `${site()}/api/email/unsubscribe?t=${profilo.unsub_token}`;
  await sendMail({
    to: indirizzo,
    subject: OGGETTO_INVITO,
    html: await anteprimaInvito(profilo.full_name, storia, unsubUrl),
    kind: "marketing",
    unsubUrl,
  });
  revalidatePath("/admin/recensioni");
}
