/**
 * GitHub API module for reading/writing progress.json
 * Token stored in localStorage (persistent), data cached in localStorage for offline use.
 */
const GitHubAPI = (() => {
  const OWNER     = 'rutschmann-hub';
  const REPO      = 'gitarre-ueben';
  const FILE_PATH = 'data/progress.json';
  const API_BASE  = 'https://api.github.com';

  const TOKEN_KEY = 'gh_token';
  const CACHE_KEY = 'gitueben_progress';
  const SHA_KEY   = 'gitueben_sha';
  const DIRTY_KEY = 'gitueben_dirty';

  // ── Token ──────────────────────────────────────────────────────────────
  const getToken   = ()  => localStorage.getItem(TOKEN_KEY);
  const clearToken = ()  => localStorage.removeItem(TOKEN_KEY);
  const isDirty    = ()  => !!localStorage.getItem(DIRTY_KEY);

  // ── Passwortmanager-Fallback für den Token ─────────────────────────────
  // localStorage wird von Firefox beim Löschen von "Cookies und Website-
  // Daten" mitgelöscht (auch automatisch beim Schließen, falls so
  // konfiguriert). Der Passwort-Speicher des Browsers ist davon nicht
  // betroffen, daher legen wir den Token zusätzlich dort ab – über ein
  // unsichtbares Login-Formular, das der Browser als solches erkennt.
  let _pwForm = null;

  function pwFormular() {
    if (_pwForm && document.body.contains(_pwForm)) return _pwForm;
    const form = document.createElement('form');
    form.id = 'gh-token-pw-form';
    form.style.cssText = 'position:absolute;left:-9999px;top:-9999px;';
    form.innerHTML = `
      <input type="text" name="username" autocomplete="username" value="gitarre-ueben" readonly>
      <input type="password" name="password" autocomplete="current-password">
    `;
    form.addEventListener('submit', (e) => e.preventDefault());
    document.body.appendChild(form);
    _pwForm = form;
    return form;
  }

  function merkeTokenImPasswortmanager(token) {
    if (!document.body) return; // Skript läuft vor <body>, kann noch nicht
    const form = pwFormular();
    form.querySelector('input[type=password]').value = token;
    if (form.requestSubmit) form.requestSubmit(); else form.submit();
  }

  function holeTokenAusPasswortmanager() {
    return new Promise((resolve) => {
      if (!document.body) { resolve(null); return; }
      const feld = pwFormular().querySelector('input[type=password]');
      // Autofill durch den Browser braucht einen Moment nach dem Einfügen ins DOM
      setTimeout(() => resolve(feld.value || null), 400);
    });
  }

  const setToken = (t) => {
    const val = t.trim();
    localStorage.setItem(TOKEN_KEY, val);
    merkeTokenImPasswortmanager(val);
  };

  // Beim Laden aufrufen, bevor getToken()/load() gebraucht wird: falls
  // localStorage keinen Token (mehr) hat, aus dem Passwortspeicher holen.
  async function restoreTokenFallback() {
    if (getToken()) return;
    const restored = await holeTokenAusPasswortmanager();
    if (restored) localStorage.setItem(TOKEN_KEY, restored);
  }

  function buildHeaders() {
    const h = { Accept: 'application/vnd.github.v3+json' };
    const t = getToken();
    if (t) h.Authorization = `token ${t}`;
    return h;
  }

  // ── Base64 helpers (UTF-8 safe) ────────────────────────────────────────
  function b64decode(str) {
    const bin   = atob(str.replace(/\s/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function b64encode(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    bytes.forEach(b => (bin += String.fromCharCode(b)));
    return btoa(bin);
  }

  // ── Empty data shape ───────────────────────────────────────────────────
  function emptyProgress() {
    return { sequenzen: {}, skalen: {}, akkorde: {}, fortschritt: {}, geuebt: {}, proGeuebt: {} };
  }

  // ── Load ───────────────────────────────────────────────────────────────
  async function load() {
    const url = `${API_BASE}/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`;
    try {
      // no-store: GitHub sendet Cache-Control mit max-age auf den Contents-
      // Endpoint – ohne das würde der Browser kurz aufeinanderfolgende
      // Aufrufe aus dem HTTP-Cache mit veralteter sha/Daten beantworten.
      const r = await fetch(url, { headers: buildHeaders(), cache: 'no-store' });

      if (r.status === 404) {
        // File not yet in repo – start with empty state
        return emptyProgress();
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);

      const data    = await r.json();
      const content = JSON.parse(b64decode(data.content));

      localStorage.setItem(SHA_KEY, data.sha);
      localStorage.setItem(CACHE_KEY, JSON.stringify(content));
      localStorage.removeItem(DIRTY_KEY);

      return content;
    } catch (err) {
      console.warn('[GitHubAPI] load failed – using local cache:', err.message);
      const cached = localStorage.getItem(CACHE_KEY);
      return cached ? JSON.parse(cached) : emptyProgress();
    }
  }

  // ── Save (serialized via _saving flag to prevent SHA conflicts) ────────
  let _saving = false;

  async function save(data) {
    // Always persist locally first
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));

    const token = getToken();
    if (!token) {
      localStorage.setItem(DIRTY_KEY, '1');
      return { ok: false, reason: 'no_token' };
    }
    if (!navigator.onLine) {
      localStorage.setItem(DIRTY_KEY, '1');
      return { ok: false, reason: 'offline' };
    }

    // Prevent concurrent saves: a second call while one is in-flight would
    // use the same SHA and get a 409/422 from GitHub.
    // Mark dirty so syncPending() retries after the current save completes.
    if (_saving) {
      localStorage.setItem(DIRTY_KEY, '1');
      return { ok: false, reason: 'busy' };
    }

    _saving = true;
    try {
      const sha     = localStorage.getItem(SHA_KEY);
      const content = b64encode(JSON.stringify(data, null, 2));
      const body    = { message: 'chore: update progress', content };
      if (sha) body.sha = sha;

      const r = await fetch(`${API_BASE}/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`, {
        method:  'PUT',
        headers: { ...buildHeaders(), 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });

      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${r.status}`);
      }

      const result = await r.json();
      localStorage.setItem(SHA_KEY, result.content.sha);
      localStorage.removeItem(DIRTY_KEY);
      return { ok: true };
    } catch (err) {
      console.warn('[GitHubAPI] save failed:', err.message);
      localStorage.setItem(DIRTY_KEY, '1');
      return { ok: false, reason: err.message };
    } finally {
      _saving = false;
    }
  }

  // ── Sync pending local changes ─────────────────────────────────────────
  async function syncPending() {
    if (!localStorage.getItem(DIRTY_KEY)) return null;
    if (!navigator.onLine || !getToken()) return null;
    if (_saving) return null; // In-flight save will clear dirty when it finishes

    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    // Refresh SHA before writing
    await load();
    return save(JSON.parse(cached));
  }

  return { load, save, syncPending, getToken, setToken, clearToken, emptyProgress, isDirty, restoreTokenFallback };
})();
