const STORAGE_KEY = 'oof-account-seen';
const WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

export function hasRecentSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const seen = Number.parseInt(raw, 10);
    if (!Number.isFinite(seen) || Date.now() - seen > WINDOW_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function markSignedIn() {
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    /* storage unavailable */
  }
}

export function markSignedOut() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}
