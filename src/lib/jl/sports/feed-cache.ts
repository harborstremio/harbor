import type { SportsGame } from "../../sports/espn-types.ts";

type Entry = { at: number; ttl: number; games: SportsGame[] };
type Load = () => Promise<{ games: SportsGame[]; ttl: number }>;

/** Shared in-memory scoreboard cache. A failed refresh preserves, and labels, the last success. */
export function createSportsFeedCache(now: () => number = Date.now) {
  const entries = new Map<string, Entry>();
  const inflight = new Map<string, Promise<SportsGame[]>>();
  return async (key: string, load: Load): Promise<SportsGame[]> => {
    const hit = entries.get(key);
    if (hit && now() - hit.at < hit.ttl) return hit.games;
    const running = inflight.get(key);
    if (running) return running;
    const request = Promise.resolve().then(load)
      .then(({ games, ttl }) => {
        entries.set(key, { at: now(), ttl, games });
        return games;
      })
      .catch(() => hit?.games.map((game) => ({ ...game, savedAt: game.savedAt ?? hit.at })) ?? [])
      .finally(() => inflight.delete(key));
    inflight.set(key, request);
    return request;
  };
}

/** Missing/malformed data is a failed refresh, not a successful empty schedule. */
export function scoreboardEvents(body: unknown): unknown[] {
  if (!body || typeof body !== "object" || !Array.isArray((body as { events?: unknown }).events)) {
    throw new Error("Sports schedule is unavailable");
  }
  return (body as { events: unknown[] }).events;
}
