/**
 * Persisted per-server ordering of Suwayomi sources in the All-Extensions view.
 *
 * Stored as an ordered list of source ids per server base URL. A source that has
 * been given an explicit position keeps it across refreshes; sources not in the
 * list keep their natural (alphabetical) position. Stores an in-memory revision
 * plus a subscription set so the browse view can re-sort live when the user
 * reorders (mirrors the lang-filter module's shape).
 */

const STORAGE_KEY = "harbor.manga.suwayomi-source-order.v1";

let revision = 0;
const listeners = new Set<() => void>();

export function suwayomiSourceOrderRevision(): number {
  return revision;
}

export function loadSuwayomiSourceOrder(baseUrl: string): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
    const list = (parsed as Record<string, unknown>)[baseUrl];
    if (!Array.isArray(list)) return [];
    return list.filter((v): v is string => typeof v === "string" && v.trim() !== "");
  } catch {
    return [];
  }
}

export function saveSuwayomiSourceOrder(baseUrl: string, order: string[]): void {
  const sanitized = order.filter((v): v is string => typeof v === "string" && v.trim() !== "");
  let next: Record<string, string[]>;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    next =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? Object.fromEntries(
            Object.entries(parsed as Record<string, unknown>).filter((e): e is [string, string[]] =>
              Array.isArray(e[1]),
            ),
          )
        : {};
    if (sanitized.length > 0) next[baseUrl] = sanitized;
    else delete next[baseUrl];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    return;
  }
  revision++;
  for (const cb of listeners) cb();
}

export function subscribeSuwayomiSourceOrder(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Reorders an array of sources by a persisted order of source ids. */
export function applySuwayomiSourceOrder<T extends { id: string }>(
  sources: T[],
  order: string[],
): T[] {
  if (order.length === 0) return sources;
  const used = Array.from({ length: sources.length }, () => false);
  const out: T[] = [];
  for (const id of order) {
    const idx = sources.findIndex((s, i) => !used[i] && s.id === id);
    if (idx === -1) continue;
    used[idx] = true;
    out.push(sources[idx]);
  }
  sources.forEach((s, i) => {
    if (!used[i]) out.push(s);
  });
  return out;
}
