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
  const getToken  = ()  => localStorage.getItem(TOKEN_KEY);
  const setToken  = (t) => localStorage.setItem(TOKEN_KEY, t.trim());
  const clearToken = () => localStorage.removeItem(TOKEN_KEY);

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
    return { sequenzen: {}, skalen: {}, akkorde: {}, fortschritt: {} };
  }

  // ── Load ───────────────────────────────────────────────────────────────
  async function load() {
    const url = `${API_BASE}/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`;
    try {
      const r = await fetch(url, { headers: buildHeaders() });

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

  // ── Save ───────────────────────────────────────────────────────────────
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

    const sha     = localStorage.getItem(SHA_KEY);
    const content = b64encode(JSON.stringify(data, null, 2));
    const body    = { message: 'chore: update progress', content };
    if (sha) body.sha = sha;

    try {
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
    }
  }

  // ── Sync pending local changes ─────────────────────────────────────────
  async function syncPending() {
    if (!localStorage.getItem(DIRTY_KEY)) return null;
    if (!navigator.onLine || !getToken()) return null;

    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    // Refresh SHA before writing
    await load();
    return save(JSON.parse(cached));
  }

  return { load, save, syncPending, getToken, setToken, clearToken, emptyProgress };
})();
