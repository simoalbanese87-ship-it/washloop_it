#!/usr/bin/env node
/**
 * Le email di marketing WashLoop, con lo stesso stampo per tutte.
 *
 * Perché esiste
 * -------------
 * Le tre email di riattivazione erano nate in tre momenti diversi: la 2/3 e la
 * 3/3 con la grafica WashLoop, la 1/3 come testo nudo. Chi la riceveva vedeva
 * due marchi diversi nella stessa settimana. Qui lo stampo è uno solo e il
 * testo si cambia senza toccare l'HTML.
 *
 * Le immagini stanno su washloop.it/email: prima erano sui file temporanei
 * dello strumento con cui le campagne sono state disegnate, e quando quel link
 * scade l'email riaperta resta senza immagini.
 *
 * Uso:
 *   node scripts/brevo-campagne.mjs anteprima      # scrive gli HTML in /tmp e basta
 *   node scripts/brevo-campagne.mjs template       # crea/aggiorna i template su Brevo
 *   node scripts/brevo-campagne.mjs campagne       # riscrive le campagne ancora in coda
 *
 * Legge BREVO_SYNC_KEY (o BREVO_API_KEY) da web/.env.local.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const SITO = "https://washloop.it";
const IMG = `${SITO}/email`;

// ---------------------------------------------------------------- stampo ---

const esc = (s) => String(s);

/** Un blocco di testo normale. */
const testo = (html) =>
  `<tr><td class="pad" style="padding:0 44px 24px 44px;"><div style="font-family:Nunito,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.7;color:#3B4A5F;">${esc(html)}</div></td></tr>`;

/** Il riquadro con la barra azzurra: serve per una frase che deve staccarsi. */
const citazione = (html) =>
  `<tr><td class="pad" style="padding:0 44px 30px 44px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F9FF;border-radius:12px;"><tr><td width="6" style="background:#00C8F0;border-radius:12px 0 0 12px;">&nbsp;</td><td style="padding:22px 24px;font-family:Nunito,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.7;color:#1B2D5E;">${esc(html)}</td></tr></table></td></tr>`;

/** L'elenco con le frecce, come nella 3/3. */
const elenco = (voci) =>
  `<tr><td class="pad" style="padding:0 44px 30px 44px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${voci
    .map(
      (v, i) =>
        `<tr><td width="24" valign="top" style="padding:0 0 ${i === voci.length - 1 ? "0" : "12px"} 0;font-family:Nunito,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#2B7FD4;font-weight:900;">&#8250;</td><td valign="top" style="padding:0 0 ${i === voci.length - 1 ? "0" : "12px"} 0;font-family:Nunito,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#3B4A5F;">${esc(v)}</td></tr>`,
    )
    .join("")}</table></td></tr>`;

/** Il bottone, con la nota piccola sotto. */
const bottone = (testoBottone, href, nota) =>
  `<tr><td class="pad" align="left" style="padding:0 44px 8px 44px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="#2B7FD4" style="border-radius:10px;box-shadow:0 4px 14px rgba(43,127,212,0.35);"><a href="${href}" style="display:inline-block;padding:16px 30px;font-family:Nunito,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;font-weight:900;color:#ffffff;text-decoration:none;">${esc(testoBottone)} &nbsp;&#8594;</a></td></tr></table></td></tr>` +
  (nota
    ? `<tr><td class="pad" style="padding:0 44px 0 44px;"><div style="font-family:Nunito,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#7C8AA0;">${esc(nota)}</div></td></tr>`
    : "");

/** La pagina intera. */
function stampo({ preheader, kicker, titolo, hero, corpo, firma = "A presto,<br><span style=\"font-weight:900;color:#1B2D5E;\">Team WashLoop</span>" }) {
  return `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title>WashLoop</title><style> @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800;900&display=swap'); body { margin:0; padding:0; background:#F4F9FF; } a { text-decoration:none; } img { border:0; display:block; } @media only screen and (max-width:620px) { .wrap { width:100% !important; } .pad { padding-left:22px !important; padding-right:22px !important; } .h1 { font-size:25px !important; } } </style></head><body style="margin:0;padding:0;background:#F4F9FF;"><div style="display:none;font-size:1px;color:#F4F9FF;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${esc(preheader)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F9FF;"><tr><td align="center" style="padding:26px 12px 34px 12px;"><table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 6px 24px rgba(27,45,94,0.10);"><tr><td align="center" style="background:#1B2D5E;padding:30px 24px 26px 24px;"><img src="${IMG}/logo-washloop.png" width="196" alt="WashLoop" style="width:196px;max-width:196px;height:auto;"><div style="font-family:Nunito,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.6px;color:#9FE4F8;padding-top:14px;">Smetti di fare il bucato. Inizia a vivere.</div></td></tr><tr><td style="line-height:0;"><img src="${IMG}/${hero}" width="600" alt="" style="width:100%;max-width:600px;height:auto;"></td></tr><tr><td class="pad" style="padding:38px 44px 24px 44px;"><div style="font-family:Nunito,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;font-weight:800;letter-spacing:1.4px;color:#2B7FD4;padding-bottom:12px;">${esc(kicker)}</div><div class="h1" style="font-family:Nunito,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:28px;line-height:1.26;font-weight:900;color:#1B2D5E;">${esc(titolo)}</div></td></tr>${corpo.join("")}<tr><td class="pad" style="padding:26px 44px 40px 44px;"><div style="font-family:Nunito,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.7;color:#3B4A5F;">${firma}</div></td></tr><tr><td style="background:#F4F9FF;padding:26px 44px 30px 44px;"><div style="font-family:Nunito,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.7;color:#7C8AA0;"><span style="font-weight:900;color:#1B2D5E;">WashLoop</span> &mdash; il bucato, senza pensieri.<br> Lavanderia a domicilio · Milano<br> Hai ricevuto questa email perché hai chiesto informazioni su WashLoop.<br><a href="${SITO}" style="color:#2B7FD4;font-weight:700;">washloop.it</a></div></td></tr></table></td></tr></table></body></html>`;
}

// ------------------------------------------------------------ i contenuti ---

/** La 1/3, con lo stesso testo di prima e la grafica delle altre due. */
const uno = {
  nome: "WashLoop · Riattivazione lead 1/3",
  oggetto: "La tua lavanderia, da oggi, può sparire dalla lista",
  html: stampo({
    preheader: "Ti spiego in 30 secondi perché WashLoop esiste.",
    kicker: "BENVENUTO",
    titolo: "La tua lavanderia, da oggi, può sparire dalla lista.",
    hero: "hero-borsone.jpg",
    corpo: [
      testo(
        "Ciao, hai appena lasciato i tuoi dati per saperne di più su WashLoop.<br><br>Ti spiego in 30 secondi perché esiste.",
      ),
      citazione(
        "Lavare, asciugare, stirare, piegare, organizzare tutto&hellip; sembra una piccola cosa. Ma quando hai lavoro, famiglia e mille impegni, è <span style=\"font-weight:900;\">una delle incombenze che continuano a tornare</span>.",
      ),
      testo("Con WashLoop non devi più pensarci."),
      elenco([
        "&#128230;&nbsp; Prenoti il ritiro",
        "&#128085;&nbsp; Noi ritiriamo i tuoi capi",
        "&#129530;&nbsp; Li laviamo e li stiriamo",
        "&#128666;&nbsp; Te li riportiamo pronti da mettere nell'armadio",
      ]),
      testo(
        "E soprattutto: <span style=\"font-weight:900;color:#1B2D5E;\">non devi essere a casa ad aspettare nessuno.</span>",
      ),
      bottone(
        "Attiva WashLoop",
        `${SITO}/login`,
        "Creare l'account è gratuito. Una volta dentro, scegli tu come iniziare.",
      ),
    ],
  }),
};

const campagne = { 3: uno };

// ----------------------------------------------------------------- Brevo ---

function chiave() {
  const env = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
  const m = env.match(/^BREVO_SYNC_KEY=(.*)$/m) || env.match(/^BREVO_API_KEY=(.*)$/m);
  if (!m) throw new Error("BREVO_SYNC_KEY non trovata in web/.env.local");
  return m[1].trim();
}

async function api(percorso, metodo = "GET", corpo) {
  const res = await fetch(`https://api.brevo.com/v3${percorso}`, {
    method: metodo,
    headers: { "api-key": chiave(), accept: "application/json", "content-type": "application/json" },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const testoRisposta = await res.text();
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${testoRisposta.slice(0, 300)}`);
  return testoRisposta ? JSON.parse(testoRisposta) : null;
}

/** Sposta le immagini dei vecchi HTML sui nostri indirizzi. */
function riscriviImmagini(html) {
  return html
    .replace(/https:\/\/files\.manuscdn\.com\/[^"']*OEYLABwJvHsSllmn\.png/g, `${IMG}/logo-washloop.png`)
    .replace(/https:\/\/files\.manuscdn\.com\/[^"']*nxPKuZFnforflXkN\.png/g, `${IMG}/hero-tempo.jpg`)
    .replace(/https:\/\/files\.manuscdn\.com\/[^"']*DnbjmlahNsMocnoB\.png/g, `${IMG}/hero-borsone.jpg`);
}

const comando = process.argv[2] ?? "anteprima";

if (comando === "anteprima") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wl-email-"));
  for (const [id, c] of Object.entries(campagne)) {
    const f = path.join(dir, `campagna-${id}.html`);
    fs.writeFileSync(f, c.html);
    console.log(f);
  }
} else if (comando === "campagne") {
  // Solo quelle ancora in coda: una campagna già partita non si riscrive, e
  // riscriverla cambierebbe l'archivio senza cambiare quello che è arrivato.
  const { campaigns } = await api("/emailCampaigns?limit=50");
  for (const c of campaigns) {
    if (c.status !== "queued" && c.status !== "draft") continue;
    const nuovo = riscriviImmagini(c.htmlContent ?? "");
    if (!nuovo || nuovo === c.htmlContent) {
      console.log(`#${c.id} ${c.name}: niente da cambiare`);
      continue;
    }
    await api(`/emailCampaigns/${c.id}`, "PUT", { htmlContent: nuovo });
    console.log(`#${c.id} ${c.name}: immagini spostate su washloop.it`);
  }
} else if (comando === "template") {
  const esistenti = (await api("/smtp/templates?limit=200")).templates ?? [];
  const perNome = new Map(esistenti.map((t) => [t.name, t]));
  // I template dell'automazione: la 1/3 rifatta qui, le altre due dalle
  // campagne già disegnate, con le immagini riscritte.
  const { campaigns } = await api("/emailCampaigns?limit=50");
  const daCampagna = (id) => campaigns.find((c) => c.id === id);
  const voci = [
    { nome: uno.nome, oggetto: uno.oggetto, html: uno.html },
    ...[4, 5].map((id) => {
      const c = daCampagna(id);
      return {
        nome: c.name.replace(" - ", " · "),
        oggetto: c.subject,
        html: riscriviImmagini(c.htmlContent ?? ""),
      };
    }),
  ];
  for (const v of voci) {
    const corpo = {
      templateName: v.nome,
      subject: v.oggetto,
      sender: { name: "WashLoop", email: "info@send.washloop.it" },
      htmlContent: v.html,
      isActive: true,
    };
    const gia = perNome.get(v.nome);
    if (gia) {
      await api(`/smtp/templates/${gia.id}`, "PUT", corpo);
      console.log(`template #${gia.id} ${v.nome}: aggiornato`);
    } else {
      const r = await api("/smtp/templates", "POST", corpo);
      console.log(`template #${r.id} ${v.nome}: creato`);
    }
  }
} else {
  console.error(`comando sconosciuto: ${comando}`);
  process.exit(1);
}
