import "server-only";
import { renderEmail, sendMail } from "@/lib/email";

/** Conferma al lead della landing "/disponibilita" che la richiesta è arrivata.
 *  Il destinatario NON ha un account WashLoop: `footerNote` sostituisce la riga
 *  standard del layout, che parlerebbe di area personale.
 *  Best-effort come tutto lo stack email: `sendMail` non lancia mai. */

export type LeadConfirmInput = {
  to: string;
  fullName: string;
  cap: string;
  covered: boolean;        // il CAP rientra già nelle zone servite
  planLabel?: string | null; // es. "Piano M"
};

export async function sendLeadConfirmation(d: LeadConfirmInput) {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://washloop.it").replace(/\/+$/, "");
  const firstName = d.fullName.trim().split(/\s+/)[0] || "";

  // Le due varianti riprendono il copy già pubblicato sul sito (FAQ zone):
  // "ti diciamo subito se sei in zona, o ti avvisiamo appena apriamo da te".
  const zona = d.covered
    ? `Buone notizie: il CAP <strong>${d.cap}</strong> rientra nell'area che copriamo a Milano. Ti ricontatteremo per fornirti maggiori informazioni sul servizio.`
    : `Il CAP <strong>${d.cap}</strong> non è ancora tra le zone che serviamo. Ti avvisiamo appena apriamo da te.`;

  const html = renderEmail({
    title: `Richiesta ricevuta${firstName ? `, ${firstName}` : ""}`,
    emoji: "🫧",
    preheader: d.covered ? "Sei in zona: ti ricontattiamo a breve." : "Ti avvisiamo appena apriamo nella tua zona.",
    body: `${zona}${d.planLabel ? `<br/><br/>Preferenza indicata: <strong>${d.planLabel}</strong>.` : ""}<br/><br/>Se nel frattempo hai domande, rispondi pure a questa email.`,
    cta: { label: "Come funziona", href: `${site}/#come-funziona` },
    footerNote: "Ricevi questa email perché hai chiesto di verificare la disponibilità di WashLoop nella tua zona.",
  });

  return sendMail({
    to: d.to,
    subject: "WashLoop · abbiamo ricevuto la tua richiesta",
    html,
  });
}
