// Anonymous, per-device installation id. Used to associate push subscriptions
// and reminder schedules with an install (not a person). Generated once and
// stored locally; contains no personal data.

const KEY = 'forge_install_id';

export function getInstallId() {
  if (typeof localStorage === 'undefined') return 'unknown';
  let id = null;
  try { id = localStorage.getItem(KEY); } catch { /* ignore */ }
  if (!id) {
    id = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `inst_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    try { localStorage.setItem(KEY, id); } catch { /* ignore */ }
  }
  return id;
}

// The user's IANA timezone (e.g. "America/New_York"). DST-aware on the server.
export function getTimezone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; }
  catch { return 'UTC'; }
}
