/**
 * Backend für die Gitarre-Üben-Fortschrittsdaten.
 * Wird als Google Apps Script an ein Google Sheet gehängt und als Web-App
 * veröffentlicht. Ersetzt die bisherige GitHub-Contents-API (kein Token
 * mehr im Browser nötig).
 *
 * Tabellenblatt "Fortschritt" mit Kopfzeile:
 *   Zaehler | Typ | Grundton | Count | LetzteUebung
 *
 * Zaehler ist "geuebt" oder "proGeuebt", Typ z.B. "dom7", Grundton z.B. "G".
 * Eine Zeile pro (Zaehler, Typ, Grundton)-Kombination, die schon geübt wurde.
 */

const SHEET_NAME = 'Fortschritt';

function getSheet_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
}

// Google Sheets erkennt unser "24.07. 18:40"-Format sonst als Datum und
// wandelt die Zelle automatisch um. Falls doch mal ein Date-Objekt in der
// Zelle landet (z.B. aus alten Zeilen), hier lesbar zurückformatieren.
function formatiereZeit_(wert) {
  if (!wert) return '';
  if (Object.prototype.toString.call(wert) === '[object Date]') {
    const tag = ('0' + wert.getDate()).slice(-2);
    const monat = ('0' + (wert.getMonth() + 1)).slice(-2);
    const stunde = ('0' + wert.getHours()).slice(-2);
    const minute = ('0' + wert.getMinutes()).slice(-2);
    return `${tag}.${monat}. ${stunde}:${minute}`;
  }
  return String(wert);
}

// GET: liefert alle Daten als { geuebt: {typ: {grundton: {count, zeit}}}, proGeuebt: {...} }
function doGet(e) {
  const sheet = getSheet_();
  const rows = sheet.getDataRange().getValues();
  const data = { geuebt: {}, proGeuebt: {} };

  for (let i = 1; i < rows.length; i++) {
    const [zaehler, typ, grundton, count, zeit] = rows[i];
    if (!zaehler || !typ || !grundton) continue;
    if (!data[zaehler]) data[zaehler] = {};
    if (!data[zaehler][typ]) data[zaehler][typ] = {};
    data[zaehler][typ][grundton] = { count: Number(count) || 0, zeit: formatiereZeit_(zeit) };
  }

  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// POST: erwartet { zaehler, typ, grundton, count, zeit } und schreibt/aktualisiert die passende Zeile.
function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const { zaehler, typ, grundton, count, zeit } = body;

  const sheet = getSheet_();
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === zaehler && rows[i][1] === typ && rows[i][2] === grundton) {
      const zielRange = sheet.getRange(i + 1, 4, 1, 2);
      zielRange.getCell(1, 2).setNumberFormat('@'); // Spalte E als Text erzwingen
      zielRange.setValues([[count, zeit]]);
      return antwort_({ ok: true });
    }
  }

  const neueZeile = sheet.getLastRow() + 1;
  sheet.getRange(neueZeile, 5).setNumberFormat('@'); // Spalte E als Text erzwingen
  sheet.appendRow([zaehler, typ, grundton, count, zeit]);
  return antwort_({ ok: true });
}

function antwort_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
