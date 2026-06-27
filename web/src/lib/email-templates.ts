/** Template email transazionali (HTML puro, niente import: riusabile e testabile).
 *  Palette brand: navy #0B1F3A · cyan #7FE3D6 · blue #2D7DD2. Table-based per
 *  compatibilità con i client di posta. */

export type WelcomeEmailData = {
  fullName: string;
  email: string;
  password: string;
  planLabel?: string | null; // es. "Small · €60,00/mese"
  siteUrl?: string;
  legal: { company: string; vat: string; address: string; email: string; phone?: string };
};

/** Logo WashLoop ufficiale (PNG da /public) — l'SVG non rende nei client di posta. */
function logo(site: string): string {
  return `<img src="${site}/logo-washloop.png" alt="WashLoop" width="170" height="47" style="display:block;border:0;outline:none;height:auto" />`;
}

export function welcomeEmailHtml(d: WelcomeEmailData): string {
  const site = (d.siteUrl ?? "https://washloop.it").replace(/\/+$/, "");
  const host = site.replace(/^https?:\/\//, "");
  const firstName = d.fullName.trim().split(/\s+/)[0] || "";

  const row = (label: string, value: string, strong = false) =>
    `<tr>
       <td style="padding:10px 0;border-bottom:1px solid #EEF3F9;font-size:13px;color:#8597AB;font-family:Arial,sans-serif">${label}</td>
       <td style="padding:10px 0;border-bottom:1px solid #EEF3F9;font-size:14px;color:#0B1F3A;text-align:right;font-family:'Nunito',Arial,sans-serif;font-weight:${strong ? 900 : 700}">${value}</td>
     </tr>`;

  return `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting"><title>Il tuo account WashLoop</title></head>
<body style="margin:0;padding:0;background:#EEF3F9;-webkit-font-smoothing:antialiased;font-family:'Nunito',Arial,Helvetica,sans-serif">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#EEF3F9;font-size:1px">Il tuo account WashLoop è stato attivato: ecco come accedere.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF3F9;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px">
        <tr><td style="padding:4px 8px 18px">${logo(site)}</td></tr>
        <tr><td style="background:#ffffff;border:1px solid #E1E8F1;border-radius:24px;overflow:hidden">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="height:5px;background:#7FE3D6;line-height:5px;font-size:5px">&nbsp;</td></tr>
            <tr><td style="padding:32px 36px 6px">
              <div style="font-size:34px;line-height:1;margin-bottom:12px">🧺</div>
              <h1 style="margin:0;font-size:24px;line-height:1.25;font-weight:900;color:#0B1F3A;letter-spacing:-0.3px">Il tuo account è stato attivato${firstName ? `, ${firstName}` : ""}!</h1>
            </td></tr>
            <tr><td style="padding:10px 36px 4px">
              <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#46586E;font-family:Arial,sans-serif">
                Benvenuto in WashLoop. Ecco i dati per accedere alla tua area personale.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${row("Email di accesso", d.email)}
                ${row("Password temporanea", d.password, true)}
                ${d.planLabel ? row("Abbonamento attivo", d.planLabel, true) : ""}
              </table>
              <p style="margin:18px 0 6px;font-size:13px;line-height:1.6;color:#8597AB;font-family:Arial,sans-serif">
                Per sicurezza, dopo il primo accesso cambia la password dal tuo profilo (o usa «Password dimenticata?»).
              </p>
            </td></tr>
            <tr><td style="padding:14px 36px 32px">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:40px;background:#0B1F3A">
                <a href="${site}/login" style="display:inline-block;padding:15px 32px;font-family:'Nunito',Arial,sans-serif;font-size:15px;font-weight:800;color:#7FE3D6;text-decoration:none;border-radius:40px">Accedi a WashLoop &nbsp;&rarr;</a>
              </td></tr></table>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:22px 16px 8px;text-align:center">
          <p style="margin:0 0 6px;font-size:12px;line-height:1.6;color:#8597AB;font-family:Arial,sans-serif">
            WashLoop · lavanderia a domicilio · <a href="${site}" style="color:#2D7DD2;text-decoration:none">${host}</a>
          </p>
          <p style="margin:0;font-size:11px;line-height:1.7;color:#A6B4C5;font-family:Arial,sans-serif">
            ${d.legal.company} · P.IVA ${d.legal.vat} · ${d.legal.address}<br/>
            ${d.legal.email}${d.legal.phone ? ` · ${d.legal.phone}` : ""}
          </p>
          <p style="margin:8px 0 0;font-size:11px;line-height:1.6;color:#A6B4C5;font-family:Arial,sans-serif">
            Email di servizio relativa al tuo account WashLoop.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
