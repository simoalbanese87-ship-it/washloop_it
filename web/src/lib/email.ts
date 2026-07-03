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

export async function sendMail({ to, subject, html, text }: { to: string; subject: string; html: string; text?: string }) {
  const tx = transporter();
  if (!tx) {
    console.warn(`[email] SMTP non configurato — email "${subject}" → ${to} non inviata`);
    return { skipped: true };
  }
  try {
    await tx.sendMail({ from: SMTP_FROM, replyTo: SMTP_REPLY_TO, to, subject, html, text: text ?? stripHtml(html) });
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
export function renderEmail({
  title,
  body,
  cta,
  preheader,
  emoji,
}: {
  title: string;
  body: string;
  cta?: { label: string; href: string };
  preheader?: string;
  emoji?: string;
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
          <img src="${site}/logo-washloop.png" alt="WashLoop" width="180" height="39" style="display:block;width:180px;height:auto;max-width:70%;border:0;outline:none;-ms-interpolation-mode:bicubic" />
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
            Ricevi questa email perché hai un account WashLoop. Gestisci tutto nella tua <a href="${site}/app" style="color:#8597AB">area personale</a>.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
