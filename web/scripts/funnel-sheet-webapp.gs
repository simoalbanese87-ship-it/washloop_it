/**
 * WashLoop — Web App di sola lettura per la lista d'attesa (funnel → Google Sheet).
 * Espone i lead del foglio come JSON, protetto da un token segreto, così l'admin
 * di washloop.it può mostrarli senza rendere pubblico il foglio (dati personali).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * COME PUBBLICARLA (una volta sola, ~2 minuti):
 *
 * 1. Apri il Google Sheet dei lead.
 * 2. Menu  Estensioni → Apps Script.
 * 3. Cancella tutto il codice di esempio e incolla QUESTO file.
 * 4. In alto, sostituisci il valore di TOKEN qui sotto con una stringa lunga e
 *    casuale a tua scelta (es. generane una con un password manager). Segnatela:
 *    servirà anche a washloop.
 * 5. Salva (icona floppy).
 * 6. In alto a destra:  Distribuisci → Nuova distribuzione.
 *      - Tipo (icona ingranaggio):  App web
 *      - Descrizione:               washloop lead reader
 *      - Esegui come:               Me (l'account che possiede il foglio)
 *      - Chi può accedere:          Chiunque
 *      - Distribuisci  →  autorizza gli accessi quando richiesto.
 * 7. Copia l'URL della Web App (finisce con /exec). Serve a washloop.
 *
 * Poi in washloop imposta le due variabili d'ambiente:
 *      FUNNEL_SHEET_URL   = <URL /exec copiato>
 *      FUNNEL_SHEET_TOKEN = <lo stesso TOKEN qui sotto>
 *
 * Test rapido nel browser (deve dare {"ok":false,"error":"unauthorized"}):
 *      <URL>/exec
 * Con il token deve dare i dati:
 *      <URL>/exec?token=IL_TUO_TOKEN
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ⚠️ Sostituisci con una stringa lunga e casuale (la stessa che metti in washloop).
var TOKEN = "CAMBIA_QUESTO_CON_UN_TOKEN_SEGRETO_LUNGO";

function doGet(e) {
  var provided = (e && e.parameter && e.parameter.token) || "";
  if (provided !== TOKEN) {
    return json_({ ok: false, error: "unauthorized" });
  }
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheets = ss.getSheets();
    var out = [];
    for (var s = 0; s < sheets.length; s++) {
      var sheet = sheets[s];
      var values = sheet.getDataRange().getValues();
      if (!values || values.length < 2) continue; // niente dati

      // La prima riga non vuota è l'intestazione.
      var headerIdx = -1;
      for (var r = 0; r < values.length; r++) {
        if (rowHasText_(values[r])) { headerIdx = r; break; }
      }
      if (headerIdx === -1) continue;

      var headers = values[headerIdx].map(function (h) { return String(h).trim(); });
      var rows = [];
      for (var i = headerIdx + 1; i < values.length; i++) {
        var raw = values[i];
        if (!rowHasText_(raw)) continue;
        var obj = {};
        for (var c = 0; c < headers.length; c++) {
          if (!headers[c]) continue;
          var val = raw[c];
          obj[headers[c]] = val === null || val === undefined ? "" : String(val).trim();
        }
        rows.push(obj);
      }
      out.push({ name: sheet.getName(), rows: rows });
    }
    return json_({ ok: true, sheets: out });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function rowHasText_(row) {
  for (var i = 0; i < row.length; i++) {
    if (String(row[i]).trim() !== "") return true;
  }
  return false;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
