/**
 * Backend für alle synchronisierten Daten der Gitarre-Üben-App.
 * Wird als Google Apps Script an ein Google Sheet gehängt und als Web-App
 * veröffentlicht (Ausführen als: Ich, Zugriff: Jeder).
 *
 * Tabellenblatt "Fortschritt" mit Kopfzeile:
 *   Zaehler | Typ | Grundton | Count | LetzteUebung
 * Eine Zeile pro (Zaehler, Typ, Grundton)-Kombination, die schon geübt wurde.
 *
 * Tabellenblatt "Daten" mit Kopfzeile:
 *   Schluessel | JSON
 * Hält ganze Objekte (z.B. die Übungssequenzen) als JSON-Text.
 * Beide Blätter werden bei Bedarf automatisch angelegt.
 */

const BLATT_FORTSCHRITT = 'Fortschritt';
const BLATT_DATEN       = 'Daten';

// Die URL der Web-App steht öffentlich im Repo, daher nimmt doPost nur
// Werte an, die die App selbst erzeugen kann.
const ZAEHLER   = ['geuebt', 'proGeuebt'];
const TYPEN     = ['dom7', 'maj7', 'moll7', 'moll7b5', 'dim7'];
const GRUNDTOENE = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B','unbekannt'];
const DATEN_SCHLUESSEL = ['sequenzen'];
const MAX_COUNT = 100000;
const MAX_JSON  = 45000; // Zelllimit von Sheets liegt bei 50.000 Zeichen

function blatt_(name, kopf) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(kopf);
  }
  return sheet;
}

const fortschrittBlatt_ = () => blatt_(BLATT_FORTSCHRITT, ['Zaehler', 'Typ', 'Grundton', 'Count', 'LetzteUebung']);
const datenBlatt_       = () => blatt_(BLATT_DATEN, ['Schluessel', 'JSON']);

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

// GET: { geuebt: {typ: {grundton: {count, zeit}}}, proGeuebt: {...}, sequenzen: {...} }
function doGet(e) {
  const data = { geuebt: {}, proGeuebt: {} };

  const rows = fortschrittBlatt_().getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const [zaehler, typ, grundton, count, zeit] = rows[i];
    if (!zaehler || !typ || !grundton) continue;
    if (!data[zaehler]) data[zaehler] = {};
    if (!data[zaehler][typ]) data[zaehler][typ] = {};
    const vorher = data[zaehler][typ][grundton];
    // Doppelte Zeilen (aus der Zeit vor dem Lock) enthalten jeweils absolute
    // Stände – der höchste gilt.
    const n = Number(count) || 0;
    if (vorher && vorher.count >= n) continue;
    data[zaehler][typ][grundton] = { count: n, zeit: formatiereZeit_(zeit) };
  }

  const datenRows = datenBlatt_().getDataRange().getValues();
  for (let i = 1; i < datenRows.length; i++) {
    const [schluessel, json] = datenRows[i];
    if (!DATEN_SCHLUESSEL.includes(schluessel)) continue;
    try { data[schluessel] = JSON.parse(json); } catch (err) {}
  }

  return antwort_(data);
}

// POST, drei Formen:
//   { zaehler, typ, grundton, delta: 1, zeit }   → Zähler um delta erhöhen
//   { zaehler, typ, grundton, count, zeit }      → Zähler auf mind. count setzen (nie verringern)
//   { schluessel: 'sequenzen', daten: {...} }    → JSON-Objekt komplett ersetzen
function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return antwort_({ ok: false, fehler: 'json' }); }

  // Ohne Lock können zwei fast gleichzeitige Requests dieselbe Zeile nicht
  // finden und beide eine neue anhängen.
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return antwort_({ ok: false, fehler: 'busy' });
  try {
    if (body.schluessel !== undefined) return speichereDaten_(body);
    return speichereZaehler_(body);
  } finally {
    lock.releaseLock();
  }
}

function speichereZaehler_({ zaehler, typ, grundton, count, delta, zeit }) {
  if (!ZAEHLER.includes(zaehler) || !TYPEN.includes(typ) || !GRUNDTOENE.includes(grundton)) {
    return antwort_({ ok: false, fehler: 'ungueltig' });
  }
  const istDelta = delta !== undefined;
  const wert = Number(istDelta ? delta : count);
  if (!Number.isInteger(wert) || wert < 0 || wert > (istDelta ? 1 : MAX_COUNT)) {
    return antwort_({ ok: false, fehler: 'ungueltig' });
  }
  zeit = String(zeit || '').slice(0, 20);

  const sheet = fortschrittBlatt_();
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === zaehler && rows[i][1] === typ && rows[i][2] === grundton) {
      const alt = Number(rows[i][3]) || 0;
      const neu = istDelta ? alt + wert : Math.max(alt, wert);
      if (neu === alt) return antwort_({ ok: true, count: alt });
      const ziel = sheet.getRange(i + 1, 4, 1, 2);
      ziel.getCell(1, 2).setNumberFormat('@'); // Spalte E als Text erzwingen
      ziel.setValues([[neu, zeit]]);
      return antwort_({ ok: true, count: neu });
    }
  }

  const neueZeile = sheet.getLastRow() + 1;
  sheet.getRange(neueZeile, 5).setNumberFormat('@');
  sheet.appendRow([zaehler, typ, grundton, wert, zeit]);
  return antwort_({ ok: true, count: wert });
}

function speichereDaten_({ schluessel, daten }) {
  if (!DATEN_SCHLUESSEL.includes(schluessel) || !daten || typeof daten !== 'object') {
    return antwort_({ ok: false, fehler: 'ungueltig' });
  }
  const json = JSON.stringify(daten);
  if (json.length > MAX_JSON) return antwort_({ ok: false, fehler: 'zu_gross' });

  const sheet = datenBlatt_();
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === schluessel) {
      sheet.getRange(i + 1, 2).setValue(json);
      return antwort_({ ok: true });
    }
  }
  sheet.appendRow([schluessel, json]);
  return antwort_({ ok: true });
}

function antwort_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
