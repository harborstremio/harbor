export type WatchedByEntry = { p: string; t: number };
export type WatchedByMap = Record<string, WatchedByEntry>;

export const WATCHED_BY_MAX = 300;

/**
 * watchedby is the ONE section that merges per key instead of replacing whole, and the
 * difference is not tidiness, it is semantics. Two devices writing different mediaIds
 * never collide, and two devices writing the same mediaId genuinely do have a later
 * watcher, so last writer wins on t is correct here.
 *
 * t is a client clock, so skew can pick the wrong watcher. That is acceptable ONLY here:
 * the failure mode is Dad's face instead of Mum's on one card. It is never acceptable
 * for a layout section, where the failure mode is destroyed customisation with no undo.
 * Do not unify the two rules.
 */
export function normalizeWatchedBy(raw: unknown): WatchedByMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: WatchedByMap = {};
  for (const [mediaId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string") {
      if (value) out[mediaId] = { p: value, t: 0 };
      continue;
    }
    if (!value || typeof value !== "object") continue;
    const v = value as Record<string, unknown>;
    if (typeof v.p !== "string" || !v.p) continue;
    out[mediaId] = { p: v.p, t: typeof v.t === "number" ? v.t : 0 };
  }
  return out;
}

export function mergeWatchedBy(local: unknown, incoming: unknown): WatchedByMap {
  const a = normalizeWatchedBy(local);
  const b = normalizeWatchedBy(incoming);
  const out: WatchedByMap = { ...a };
  for (const [mediaId, entry] of Object.entries(b)) {
    const mine = out[mediaId];
    if (!mine || entry.t > mine.t) out[mediaId] = entry;
  }
  return capWatchedBy(out, WATCHED_BY_MAX);
}

/**
 * Eviction sorts by t. The store on disk today evicts in insertion order and early
 * returns when the value is unchanged, so it never re-inserts and can drop the most
 * recently watched title while keeping something from months ago.
 */
export function capWatchedBy(map: WatchedByMap, max: number): WatchedByMap {
  const keys = Object.keys(map);
  if (keys.length <= max) return map;
  keys.sort((x, y) => map[y].t - map[x].t);
  const out: WatchedByMap = {};
  for (const k of keys.slice(0, max)) out[k] = map[k];
  return out;
}
