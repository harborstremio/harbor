import { safeFetch } from "@/lib/safe-fetch";
import { leaguePath, type SportsGame } from "@/lib/sports/espn";
import { gameKey, parseStorySummary, type StorySummary } from "./game-story";

const BASE = "https://site.api.espn.com/apis/site/v2/sports";
const LIVE_TTL_MS = 20_000;
const DONE_TTL_MS = 10 * 60_000;

type Entry = { at: number; ttl: number; summary: StorySummary | null };
const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<StorySummary | null>>();

/**
 * One game's ESPN summary as story facts, shared by Game Stories and Sports alerts. Live games
 * are re-read every 20 s at most; finished ones every ten minutes. Null when ESPN has none.
 */
export function fetchStorySummary(game: SportsGame): Promise<StorySummary | null> {
  const path = leaguePath(game.league);
  if (!path || !/^\d{1,12}$/.test(game.id)) return Promise.resolve(null);
  const key = gameKey(game);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return Promise.resolve(hit.summary);
  const running = inflight.get(key);
  if (running) return running;
  const p = safeFetch(`${BASE}/${path}/summary?event=${game.id}`)
    .then(async (res) => (res.ok ? parseStorySummary(await res.json(), game.league) : null))
    .then((summary) => {
      cache.set(key, {
        at: Date.now(),
        ttl: game.state === "in" ? LIVE_TTL_MS : DONE_TTL_MS,
        summary,
      });
      return summary;
    })
    .catch(() => hit?.summary ?? null)
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}
