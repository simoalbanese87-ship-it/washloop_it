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
    await tx.sendMail({ from: SMTP_FROM, to, subject, html, text: text ?? stripHtml(html) });
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
export function renderEmail({ title, body, cta }: { title: string; body: string; cta?: { label: string; href: string } }) {
  const site = clean(process.env.NEXT_PUBLIC_SITE_URL) || "https://washloop.it";
  const button = cta
    ? `<a href="${cta.href}" style="display:inline-block;background:#0B1F3A;color:#7FE3D6;text-decoration:none;font-weight:800;font-family:Arial,sans-serif;padding:14px 28px;border-radius:40px;font-size:15px">${cta.label}</a>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#F4F7FB;padding:32px 0;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:24px;border:1px solid #E5EBF2;overflow:hidden">
      <tr><td style="padding:28px 32px 0">
        <div style="font-size:22px;font-weight:900;color:#0B1F3A;letter-spacing:-0.5px">WashLoop</div>
      </td></tr>
      <tr><td style="padding:20px 32px 8px">
        <h1 style="margin:0;font-size:22px;font-weight:900;color:#0B1F3A">${title}</h1>
      </td></tr>
      <tr><td style="padding:4px 32px 24px">
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4A5A6E">${body}</p>
        ${button}
      </td></tr>
      <tr><td style="padding:20px 32px;border-top:1px solid #E5EBF2">
        <p style="margin:0;font-size:12px;color:#8A99AC">WashLoop · <a href="${site}" style="color:#2D7DD2;text-decoration:none">${site.replace(/^https?:\/\//, "")}</a></p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}
