import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/** Email transazionali via SMTP (nodemailer).
 *  Provider-agnostico: funziona con una casella propria o con Brevo/Resend SMTP.
 *  Se le env SMTP non sono configurate, l'invio è un no-op (log a console):
 *  così sviluppo e build non si rompono mai. L'invio non deve MAI far fallire
 *  l'azione che lo ha scatenato. */

const clean = (v?: string) => v?.replace(/\s+/g, "") ?? "";

const SMTP_HOST = clean(process.env.SMTP_HOST);
const SMTP_PORT = parseInt(clean(process.env.SMTP_PORT) || "587", 10);
const SMTP_USER = process.env.SMTP_USER?.trim() ?? "";
const SMTP_PASS = process.env.SMTP_PASS ?? "";
const SMTP_FROM = process.env.SMTP_FROM?.trim() || "WashLoop <noreply@washloop.it>";
const SMTP_REPLY_TO = process.env.SMTP_REPLY_TO?.trim() || "info@washloop.it";

let cached: Transporter | null = null;

function transporter(): Transporter | null {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  if (!cached) {
    cached = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465, // 465 = SSL; 587 = STARTTLS
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return cached;
}

/** I due flussi di posta, che non vanno confusi.
 *
 *  `servizio` — legata a un ordine o all'account: ritiro prenotato, bucato
 *  pronto, riconsegna programmata, promemoria del giorno prima, ricevuta,
 *  pagamento fallito, reset password, benvenuto, credenziali staff. **Non** ha
 *  il link di disiscrizione: chi si è abbonato deve sapere quando passiamo, e
 *  toglierglielo significherebbe lasciarlo senza il servizio che paga.
 *
 *  `marketing` — tutto il resto, a partire dalla conferma al lead della landing.
 *  Qui la disiscrizione è obbligatoria, e con essa gli header List-Unsubscribe
 *  che Gmail e Outlook si aspettano: senza, finiamo nello spam a prescindere da
 *  cosa scriviamo. */
export type EmailKind = "servizio" | "marketing";

/** Indirizzo che ha chiesto di non ricevere più email non di servizio.
 *
 *  Se il controllo non riesce (database irraggiungibile) si manda lo stesso.
 *  È una scelta esplicita: il database che non risponde è un guasto raro e
 *  rumoroso, mentre bloccare gli invii lo trasformerebbe in una comunicazione
 *  che non parte senza che nessuno se ne accorga. Il caso resta a log, così se
 *  succede si vede. */
async function disiscritto(email: string): Promise<boolean> {
  try {
    const { createServiceClient } = await import("@/lib/supabase/server");
    const { data, error } = await createServiceClient()
      .from("email_optouts")
      .select("email")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();
    if (error) {
      console.error("[email] controllo disiscrizione non riuscito, mando comunque:", error.message);
      return false;
    }
    return !!data;
  } catch (err) {
    console.error("[email] controllo disiscrizione non riuscito, mando comunque:", err);
    return false;
  }
}

export async function sendMail({
  to,
  subject,
  html,
  text,
  kind = "servizio",
  unsubUrl,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  kind?: EmailKind;
  /** Obbligatorio per `kind: "marketing"`: la stessa URL che sta nel footer. */
  unsubUrl?: string;
}) {
  if (kind === "marketing") {
    if (!unsubUrl) {
      // Errore di programmazione, non condizione da gestire a runtime: meglio
      // accorgersene qui che scoprire di aver mandato una comunicazione
      // commerciale senza via d'uscita.
      console.error(`[email] "${subject}" è marketing ma non ha unsubUrl: invio annullato`);
      return { skipped: true, error: true };
    }
    if (await disiscritto(to)) {
      console.warn(`[email] ${to} è disiscritto — "${subject}" non inviata`);
      return { skipped: true };
    }
  }

  const tx = transporter();
  if (!tx) {
    console.warn(`[email] SMTP non configurato — email "${subject}" → ${to} non inviata`);
    return { skipped: true };
  }
  try {
    await tx.sendMail({
      from: SMTP_FROM,
      replyTo: SMTP_REPLY_TO,
      to,
      subject,
      html,
      text: text ?? stripHtml(html),
      // RFC 8058: con List-Unsubscribe-Post il client mostra "Annulla
      // iscrizione" accanto al mittente e la disiscrizione avviene con un solo
      // clic, senza aprire nulla. Vale solo per il marketing.
      headers:
        kind === "marketing" && unsubUrl
          ? {
              "List-Unsubscribe": `<${unsubUrl}>, <mailto:${SMTP_REPLY_TO}?subject=Disiscrizione>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            }
          : undefined,
    });
    return { skipped: false };
  } catch (err) {
    console.error(`[email] invio fallito ("${subject}" → ${to}):`, err);
    return { skipped: false, error: true };
  }
}

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** Layout email brand WashLoop (bianco + navy, coerente con l'app). */
/** Layout email brand WashLoop — responsive, table-based (compatibile con la
 *  maggior parte dei client). Palette: navy #0B1F3A, cyan #7FE3D6, blu #2D7DD2.
 *  `body` può contenere HTML semplice. `preheader` = testo di anteprima inbox. */
/** `footerNote` sovrascrive la riga «Ricevi questa email perché hai un account
 *  WashLoop»: serve per i destinatari che un account NON ce l'hanno (es. i lead
 *  della landing). Omesso → footer invariato, le email esistenti non cambiano. */
export function renderEmail({
  title,
  body,
  cta,
  preheader,
  emoji,
  footerNote,
  unsubUrl,
}: {
  title: string;
  body: string;
  cta?: { label: string; href: string };
  preheader?: string;
  emoji?: string;
  footerNote?: string;
  /** Solo per le email di marketing: aggiunge la riga di disiscrizione in fondo.
   *  Le email di servizio non devono passarlo — non ci si disiscrive dagli
   *  avvisi sul proprio ordine. */
  unsubUrl?: string;
}) {
  const site = clean(process.env.NEXT_PUBLIC_SITE_URL) || "https://washloop.it";
  const host = site.replace(/^https?:\/\//, "");
  const pre = (preheader ?? stripHtml(body)).slice(0, 140);

  const button = cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px"><tr><td style="border-radius:40px;background:#0B1F3A">
         <a href="${cta.href}" style="display:inline-block;padding:15px 32px;font-family:'Nunito',Arial,sans-serif;font-size:15px;font-weight:800;color:#7FE3D6;text-decoration:none;border-radius:40px">${cta.label} &nbsp;→</a>
       </td></tr></table>`
    : "";

  return `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${title}</title></head>
<body style="margin:0;padding:0;background:#EEF3F9;-webkit-font-smoothing:antialiased;font-family:'Nunito',Arial,Helvetica,sans-serif">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#EEF3F9;font-size:1px;line-height:1px">${pre}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF3F9;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px">
        <!-- brand -->
        <tr><td style="padding:4px 8px 18px">
          <img src="${site}/logo-washloop.png" alt="WashLoop" width="180" height="50" style="display:block;width:180px;height:auto;max-width:70%;border:0;outline:none;-ms-interpolation-mode:bicubic" />
        </td></tr>
        <!-- card -->
        <tr><td style="background:#ffffff;border:1px solid #E1E8F1;border-radius:24px;overflow:hidden">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="height:5px;background:#7FE3D6;line-height:5px;font-size:5px">&nbsp;</td></tr>
            <tr><td style="padding:32px 36px 8px">
              ${emoji ? `<div style="font-size:34px;line-height:1;margin-bottom:10px">${emoji}</div>` : ""}
              <h1 style="margin:0;font-size:24px;line-height:1.25;font-weight:900;color:#0B1F3A;letter-spacing:-0.3px">${title}</h1>
            </td></tr>
            <tr><td style="padding:10px 36px 28px">
              <p style="margin:0 0 22px;font-size:15px;line-height:1.65;color:#46586E">${body}</p>
              ${button}
            </td></tr>
          </table>
        </td></tr>
        <!-- footer -->
        <tr><td style="padding:22px 16px 8px;text-align:center">
          <p style="margin:0 0 4px;font-size:12px;line-height:1.6;color:#8597AB">
            WashLoop · lavanderia a domicilio · <a href="${site}" style="color:#2D7DD2;text-decoration:none">${host}</a>
          </p>
          <p style="margin:0;font-size:11px;line-height:1.6;color:#A6B4C5">
            ${footerNote ?? `Ricevi questa email perché hai un account WashLoop. Gestisci tutto nella tua <a href="${site}/app" style="color:#8597AB">area personale</a>.`}
          </p>
          ${unsubUrl ? `<p style="margin:8px 0 0;font-size:11px;line-height:1.6;color:#A6B4C5">
            Non vuoi più ricevere queste email? <a href="${unsubUrl}" style="color:#8597AB;text-decoration:underline">Disiscriviti</a>.
          </p>` : ""}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
