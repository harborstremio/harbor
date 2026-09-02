import { simklRequest } from "../client";

// SIMKL rule: never call /sync/all-items without first checking /sync/activities.
// This is a shared, briefly-cached read of the global `activities.all` watermark so the
// full-library readers (list-status, watchlist, history) can skip a full pull when nothing
// changed. On any failure it returns null and the caller falls back to pulling (fail-open).

let cachedAll: string | null = null;
let cachedAt = 0;
let inflight: Promise<string | null> | null = null;
const GATE_TTL_MS = 20000;

export async function currentActivitiesAll(): Promise<string | null> {
  const now = Date.now();
  if (cachedAll !== null && now - cachedAt < GATE_TTL_MS) return cachedAll;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const a = await simklRequest<{ all?: string }>("/sync/activities");
      if (a && typeof a.all === "string") {
        cachedAll = a.all;
        cachedAt = Date.now();
      }
    } catch {
      /* fail-open: caller pulls */
    } finally {
      inflight = null;
    }
    return cachedAll;
  })();
  return inflight;
}

export function resetActivitiesGate(): void {
  cachedAll = null;
  cachedAt = 0;
  inflight = null;
}
