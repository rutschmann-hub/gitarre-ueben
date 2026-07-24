/**
 * API-Modul für die Google-Sheets-Fortschrittsdatenbank.
 * Ersetzt GitHubAPI für geuebt/proGeuebt – kein Token im Browser nötig,
 * das Google Apps Script läuft mit den Rechten des Sheet-Besitzers.
 */
const SheetAPI = (() => {
  const URL = 'https://script.google.com/macros/s/AKfycbxZGU7FMsF9ymRKW0bMPM5wB8X-RVmU4GUtJnX0_T8AR7W7w-deIhRgtkgrOnRVQ_iK/exec';

  // Liefert { geuebt: {typ: {grundton: {count, zeit}}}, proGeuebt: {...} }
  async function load() {
    try {
      const r = await fetch(URL, { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (err) {
      console.warn('[SheetAPI] load failed:', err.message);
      return { geuebt: {}, proGeuebt: {} };
    }
  }

  // Content-Type bewusst nicht gesetzt (bleibt text/plain;charset=UTF-8) –
  // vermeidet einen CORS-Preflight, den Apps-Script-Web-Apps nicht
  // beantworten können.
  async function speichereEintrag(zaehler, typ, grundton, count, zeit) {
    try {
      const r = await fetch(URL, {
        method: 'POST',
        body: JSON.stringify({ zaehler, typ, grundton, count, zeit }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return { ok: true };
    } catch (err) {
      console.warn('[SheetAPI] save failed:', err.message);
      return { ok: false, reason: err.message };
    }
  }

  return { load, speichereEintrag };
})();
