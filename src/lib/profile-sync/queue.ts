import { setItemWithRecovery } from "@/lib/storage-recovery";
import { QUEUE_KEY, readJson, removeKey } from "./keys";

export type QueueEntry = { key: string; clear?: true; value?: unknown };

type QueueFile = { since: number; items: QueueEntry[] };

const EMPTY: QueueFile = { since: 0, items: [] };

function read(): QueueFile {
  const raw = readJson<Partial<QueueFile>>(QUEUE_KEY, EMPTY);
  const items = Array.isArray(raw.items) ? raw.items.filter((i) => typeof i?.key === "string") : [];
  return { since: typeof raw.since === "number" ? raw.since : 0, items };
}

function write(file: QueueFile): void {
  if (file.items.length === 0) {
    removeKey(QUEUE_KEY);
    return;
  }
  setItemWithRecovery(QUEUE_KEY, JSON.stringify(file));
}

/**
 * Coalesced to the last value per key, never an append only log. Replaying six
 * intermediate row orders after a reconnect is how a layout visibly flickers through
 * states the user already moved past.
 */
function upsert(entry: QueueEntry): void {
  const file = read();
  const at = file.items.findIndex((i) => i.key === entry.key);
  if (at >= 0) file.items[at] = entry;
  else file.items.push(entry);
  if (!file.since) file.since = Date.now();
  write(file);
}

/**
 * The queue holds dirty KEYS, not values. The value is read fresh from its store at
 * flush time, which is what makes "drop it if it now matches the server" cheap and makes
 * replaying a stale intermediate ordering structurally impossible.
 */
export function enqueueDirty(key: string): void {
  upsert({ key });
}

export function enqueueClear(key: string): void {
  upsert({ key, clear: true });
}

export function queueEntries(): QueueEntry[] {
  return read().items;
}

export function queueSize(): number {
  return read().items.length;
}

export function queuedSince(): number | null {
  const file = read();
  return file.items.length > 0 && file.since > 0 ? file.since : null;
}

export function dropFromQueue(key: string): void {
  const file = read();
  const items = file.items.filter((i) => i.key !== key);
  if (items.length === file.items.length) return;
  write({ since: items.length === 0 ? 0 : file.since, items });
}

export function clearQueue(): void {
  removeKey(QUEUE_KEY);
}
