export const REVS_KEY = "harbor.sync.revs";
export const ACCOUNT_KEY = "harbor.sync.account";
export const QUEUE_KEY = "harbor.sync.queue";
export const IDMAP_KEY = "harbor.sync.idmap";
export const SENT_KEY = "harbor.sync.sent";
export const LAST_PULL_KEY = "harbor.sync.lastPullAt";
export const PARKED_PREFIX = "harbor.sync.parked.";

export const SYNC_KEY_PREFIX = "harbor.sync.";

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    return parsed == null ? fallback : (parsed as T);
  } catch {
    return fallback;
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function syncKeys(): string[] {
  const out: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith(SYNC_KEY_PREFIX)) out.push(k);
    }
  } catch {
    return out;
  }
  return out;
}
