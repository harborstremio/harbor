import type { DownloadGame } from "./transfers";

export type DownloadCompletionKind = "http" | "torrent";
export type DownloadCompletionRecord = { id: string; profile: string; name: string; status: string; updatedAt: number; game?: DownloadGame };
type CompletionStorage = Pick<Storage, "getItem" | "setItem">;
export const DOWNLOAD_COMPLETION_PREFIX = "harbor.games.download-notified.v1.";
const MAX_IDS = 2_000, MAX_BYTES = 600_000;
const identity = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 256 && !/[\x00-\x1f\x7f]/.test(value);
const statuses = new Set(["queued", "connecting", "retrying", "downloading", "checking", "pausing", "paused", "canceling", "canceled", "complete", "failed"]);
const keyOf = (kind: DownloadCompletionKind, id: string) => JSON.stringify([kind, id]);

/** Lists establish a baseline. Only a later native transition can claim a notification. */
export function createDownloadCompletionTracker(profile: string, storage: CompletionStorage | null = null) {
  const observed = new Map<string, { status: string; updatedAt: number }>();
  const claimed = new Set<string>();
  const key = DOWNLOAD_COMPLETION_PREFIX + profile;
  const restore = () => {
    try {
      const raw = storage?.getItem(key);
      if (!raw || raw.length > MAX_BYTES) return;
      const value = JSON.parse(raw);
      if (value?.version !== 1 || !Array.isArray(value.ids) || value.ids.length > MAX_IDS) return;
      for (const id of value.ids) {
        if (typeof id !== "string" || id.length > 550) continue;
        const parts = JSON.parse(id);
        if (Array.isArray(parts) && parts.length === 2 && ["http", "torrent"].includes(parts[0]) && identity(parts[1])) claimed.add(id);
      }
    } catch { /* A damaged or unavailable local cache must not break transfers. */ }
  };
  const persist = () => {
    while (claimed.size > MAX_IDS) claimed.delete(claimed.values().next().value!);
    let serialized = JSON.stringify({ version: 1, ids: [...claimed] });
    while (serialized.length > MAX_BYTES && claimed.size > 1) {
      claimed.delete(claimed.values().next().value!);
      serialized = JSON.stringify({ version: 1, ids: [...claimed] });
    }
    try { storage?.setItem(key, serialized); } catch { /* Retain session deduplication when storage is unavailable. */ }
  };
  const claim = (id: string) => {
    restore();
    if (claimed.has(id)) return false;
    claimed.add(id); persist();
    return true;
  };
  const valid = (kind: DownloadCompletionKind, record: DownloadCompletionRecord) => identity(profile) && ["http", "torrent"].includes(kind) && record?.profile === profile && identity(record.id) && statuses.has(record.status) && Number.isFinite(record.updatedAt) && record.updatedAt >= 0;
  const remember = (id: string, record: DownloadCompletionRecord) => {
    observed.delete(id); observed.set(id, { status: record.status, updatedAt: record.updatedAt });
    while (observed.size > MAX_IDS) observed.delete(observed.keys().next().value!);
  };
  restore();
  return {
    seed(kind: DownloadCompletionKind, records: DownloadCompletionRecord[]) {
      restore();
      let changed = false;
      for (const record of records) {
        if (!valid(kind, record)) continue;
        const id = keyOf(kind, record.id);
        // Events received while a list was in flight are newer evidence than that list.
        if (observed.has(id)) continue;
        remember(id, record);
        if (record.status === "complete" && !claimed.has(id)) { claimed.add(id); changed = true; }
      }
      if (changed) persist();
    },
    observe<T extends DownloadCompletionRecord>(kind: DownloadCompletionKind, record: T): T | null {
      if (!valid(kind, record)) return null;
      const id = keyOf(kind, record.id), previous = observed.get(id);
      if (previous && record.updatedAt < previous.updatedAt) return null;
      remember(id, record);
      // An unknown complete record may be restored history, never a fresh finish.
      if (record.status !== "complete" || previous?.status === "complete") return null;
      const first = claim(id);
      return previous && first ? record : null;
    },
  };
}

export type DownloadCompletionFeed = {
  listen: (kind: DownloadCompletionKind, receive: (record: DownloadCompletionRecord) => void) => Promise<() => void>;
  list: (kind: DownloadCompletionKind) => Promise<DownloadCompletionRecord[]>;
};

/** Subscribe before taking each baseline so small downloads cannot fall between them. */
export function watchDownloadCompletions(profile: string, feed: DownloadCompletionFeed, storage: CompletionStorage | null, notify: (kind: DownloadCompletionKind, record: DownloadCompletionRecord) => Promise<unknown>) {
  const tracker = createDownloadCompletionTracker(profile, storage), stops: (() => void)[] = [];
  let current = true;
  for (const kind of ["http", "torrent"] as const) {
    void feed.listen(kind, record => {
      if (!current) return;
      const completed = tracker.observe(kind, record);
      if (completed) void notify(kind, completed).catch(() => {});
    }).then(async stop => {
      if (!current) { stop(); return; }
      stops.push(stop);
      const records = await feed.list(kind);
      if (current) tracker.seed(kind, records);
    }).catch(() => { /* Failed discovery must not invent completions or stop another engine. */ });
  }
  return () => { current = false; for (const stop of stops) stop(); };
}
