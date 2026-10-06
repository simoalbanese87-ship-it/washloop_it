/**
 * WashLoop — Web App di SCRITTURA per i lead della landing "/disponibilita".
 * Riceve un lead da washloop.it e lo aggiunge in fondo al foglio. Protetta da token.
 *
 * Foglio collegato:
 * https://docs.google.com/spreadsheets/d/1rlGkenGIej9U-MVXrSpn3_pki4tEKI9qaDntGt65A4s/edit
 *
 * ⚠️ Questo foglio deve restare DIVERSO da quello della lista d'attesa del funnel.
 *    Il foglio del funnel viene RILETTO dalla dashboard (scripts/funnel-sheet-webapp.gs):
 *    scriverci dentro farebbe comparire ogni lead due volte in admin.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * COME PUBBLICARLA (una volta sola, ~3 minuti):
 *
 * 1. Apri il foglio qui sopra → menu  Estensioni → Apps Script.
 * 2. Cancella il codice di esempio e incolla QUESTO file.
 * 3. Sostituisci il valore di TOKEN qui sotto con una stringa lunga e casuale
 *    (generala con un password manager). Segnatela: serve anche a washloop.
 * 4. Salva (icona floppy).
 * 5. In alto seleziona la funzione  «setupFoglio»  e premi  ▶ Esegui.
 *    Autorizza quando lo chiede. Questo crea la scheda, le intestazioni,
 *    la formattazione e il menù a tendina della colonna «Stato».
 * 6. In alto a destra:  Distribuisci → Nuova distribuzione.
 *      - Tipo (icona ingranaggio):  App web
 *      - Descrizione:               washloop lead writer
 *      - Esegui come:               Me (l'account che possiede il foglio)
 *      - Chi può accedere:          Chiunque
 *      - Distribuisci  →  autorizza gli accessi quando richiesto.
 * 7. Copia l'URL della Web App (finisce con /exec).
 *
 * Poi su Vercel (Production) imposta:
 *      LEADS_SHEET_URL   = <URL /exec copiato>
 *      LEADS_SHEET_TOKEN = <lo stesso TOKEN qui sotto>
 *
 * Test rapido da terminale (deve creare una riga di prova):
 *   curl -sL -X POST "<URL>/exec" -H 'Content-Type: text/plain' \
 *     -d '{"token":"IL_TUO_TOKEN","lead":{"createdAt":"2026-08-05T10:00:00.000Z",
 *          "fullName":"Test Test","email":"test@example.com","cap":"20143",
 *          "plan":"M","covered":true,"zone":"Milano Sud-Ovest",
 *          "utmSource":"google","utmMedium":"cpc","utmCampaign":"lancio"}}'
 *   Poi cancella la riga di prova a mano.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ⚠️ Sostituisci con una stringa lunga e casuale (la stessa che metti su Vercel).
var TOKEN = "CAMBIA_QUESTO_CON_UN_TOKEN_SEGRETO_LUNGO";

// Foglio di destinazione. Con lo script legato al file, getActive() basta; l'ID
// è qui come rete di sicurezza se lo script venisse spostato o eseguito a mano.
var SPREADSHEET_ID = "1rlGkenGIej9U-MVXrSpn3_pki4tEKI9qaDntGt65A4s";
var SHEET_NAME = "Lead disponibilità";

/**
 * Colonne del foglio.
 * - `key`   = campo del lead inviato da washloop.it (null = colonna compilata a mano dal team)
 * - `width` = larghezza in pixel
 * Le colonne manuali (Stato, Note) non vengono mai sovrascritte: lo script
 * aggiunge solo righe in fondo, non modifica quelle esistenti.
 */
var COLUMNS = [
  { header: "Data",          key: "data",        width: 150 },
  { header: "Nome e cognome",key: "fullName",    width: 200 },
  { header: "Email",         key: "email",       width: 240 },
  { header: "Telefono",      key: "phone",       width: 140 },
  { header: "CAP",           key: "cap",         width:  70 },
  { header: "Zona",          key: "zone",        width: 150 },
  { header: "Copertura",     key: "copertura",   width: 110 },
  { header: "Piano",         key: "plan",        width:  70 },
  { header: "UTM source",    key: "utmSource",   width: 120 },
  { header: "UTM medium",    key: "utmMedium",   width: 120 },
  { header: "UTM campaign",  key: "utmCampaign", width: 160 },
  { header: "Stato",         key: null,          width: 130 },
  { header: "Note",          key: null,          width: 300 },
];

// Valori del menù a tendina della colonna «Stato» (uso interno del team).
var STATI = ["Nuovo", "Contattato", "In trattativa", "Convertito", "Scartato"];

/**
 * Esegui UNA VOLTA dall'editor: crea la scheda, le intestazioni e la formattazione.
 * È idempotente: rilanciarla non duplica né cancella i lead già presenti.
 */
function setupFoglio() {
  var sh = sheet_();
  var headers = COLUMNS.map(function (c) { return c.header; });

  // Intestazioni in riga 1.
  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  sh.getRange(1, 1, 1, headers.length)
    .setFontWeight("bold")
    .setFontColor("#ffffff")
    .setBackground("#1b2d5e")          // navy WashLoop
    .setVerticalAlignment("middle");
  sh.setRowHeight(1, 34);
  sh.setFrozenRows(1);

  // Larghezze colonne.
  for (var i = 0; i < COLUMNS.length; i++) sh.setColumnWidth(i + 1, COLUMNS[i].width);

  // Togli le colonne vuote a destra, se il foglio è nuovo.
  var extra = sh.getMaxColumns() - headers.length;
  if (extra > 0) sh.deleteColumns(headers.length + 1, extra);

  // Menù a tendina sulla colonna «Stato».
  var statoCol = colIndex_("Stato");
  if (statoCol > 0) {
    var rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(STATI, true)
      .setAllowInvalid(false)
      .build();
    sh.getRange(2, statoCol, sh.getMaxRows() - 1, 1).setDataValidation(rule);
  }

  // La colonna Data è testo formattato dallo script: niente riformattazioni automatiche.
  sh.getRange(2, 1, sh.getMaxRows() - 1, 1).setNumberFormat("@");

  SpreadsheetApp.getActive().toast("Foglio pronto: " + headers.length + " colonne.", "WashLoop", 5);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  // Due lead nello stesso istante scriverebbero sulla stessa riga senza lock.
  if (!lock.tryLock(15000)) return json_({ ok: false, error: "busy" });
  try {
    var payload = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    // Token nel body, non in querystring: non finisce nei log degli URL.
    if (payload.token !== TOKEN) return json_({ ok: false, error: "unauthorized" });

    var lead = payload.lead || {};
    var sh = sheet_();
    if (sh.getLastRow() === 0) setupFoglio();   // primo lead su un foglio vuoto

    var values = {
      data: formatDate_(lead.createdAt),
      fullName: lead.fullName || "",
      email: lead.email || "",
      phone: lead.phone || "",
      cap: lead.cap || "",
      zone: lead.zone || "",
      copertura: lead.covered ? "In zona" : "Fuori zona",
      plan: lead.plan ? "Piano " + lead.plan : "",
      utmSource: lead.utmSource || "",
      utmMedium: lead.utmMedium || "",
      utmCampaign: lead.utmCampaign || "",
    };

    var row = COLUMNS.map(function (c) { return c.key ? values[c.key] : ""; });
    sh.appendRow(row);

    // Nuovo lead = «Nuovo», così il team vede subito cosa lavorare.
    var statoCol = colIndex_("Stato");
    if (statoCol > 0) sh.getRange(sh.getLastRow(), statoCol).setValue("Nuovo");

    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// Endpoint di sola diagnostica: conferma che la Web App risponde,
// senza mai esporre i dati del foglio.
function doGet() {
  return json_({ ok: true, info: "washloop lead writer — usa POST" });
}

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(SPREADSHEET_ID);
  return ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
}

function colIndex_(header) {
  for (var i = 0; i < COLUMNS.length; i++) if (COLUMNS[i].header === header) return i + 1;
  return -1;
}

// ISO → "dd/mm/yyyy, hh:mm:ss" nel fuso del foglio (leggibile e ordinabile a occhio).
function formatDate_(iso) {
  if (!iso) return "";
  var d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  var tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone() || "Europe/Rome";
  return Utilities.formatDate(d, tz, "dd/MM/yyyy, HH:mm:ss");
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
