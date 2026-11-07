/**
 * API-Modul für die Google-Sheets-Datenbank (einziger Sync-Weg der App).
 * Kein Token im Browser nötig, das Google Apps Script läuft mit den Rechten
 * des Sheet-Besitzers.
 */
const SheetAPI = (() => {
  const URL = 'https://script.google.com/macros/s/AKfycbxZGU7FMsF9ymRKW0bMPM5wB8X-RVmU4GUtJnX0_T8AR7W7w-deIhRgtkgrOnRVQ_iK/exec';

  // Liefert { geuebt: {typ: {grundton: {count, zeit}}}, proGeuebt: {...}, sequenzen?: {...} }
  // bzw. null, wenn das Sheet nicht erreichbar ist.
  async function load() {
    try {
      const r = await fetch(URL, { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (err) {
      console.warn('[SheetAPI] load failed:', err.message);
      return null;
    }
  }

  // Content-Type bewusst nicht gesetzt (bleibt text/plain;charset=UTF-8) –
  // vermeidet einen CORS-Preflight, den Apps-Script-Web-Apps nicht
  // beantworten können.
  async function post(body) {
    try {
      const r = await fetch(URL, { method: 'POST', body: JSON.stringify(body) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const antwort = await r.json().catch(() => ({ ok: true }));
      if (antwort.ok === false) throw new Error(antwort.fehler || 'abgelehnt');
      return { ok: true };
    } catch (err) {
      console.warn('[SheetAPI] save failed:', err.message);
      return { ok: false, reason: err.message };
    }
  }

  // Zähler um 1 erhöhen – addiert serverseitig, damit Klicks von mehreren
  // Geräten sich nicht gegenseitig überschreiben.
  const zaehleHoch = (zaehler, typ, grundton, zeit) =>
    post({ zaehler, typ, grundton, delta: 1, zeit });

  // Zähler auf mindestens count setzen (Server verringert nie).
  const speichereEintrag = (zaehler, typ, grundton, count, zeit) =>
    post({ zaehler, typ, grundton, count, zeit });

  const speichereDaten = (schluessel, daten) => post({ schluessel, daten });

  return { load, zaehleHoch, speichereEintrag, speichereDaten };
})();
