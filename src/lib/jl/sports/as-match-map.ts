import type { SportsGame, SportsSide } from "../../sports/espn.ts";
import { dayPath, toGames, type AsGame, type AsGet, type AsTeam } from "./as-core.ts";

/**
 * Find an ESPN game's AllSports match by sport, teams and date, so the Match Center can open
 * from a scoreboard game. Matching is by name only (the two feeds share no ids).
 */

/** ESPN's sport path prefix ("soccer/eng.1" → soccer) → AllSports sport. Others have no Match Center. */
const ESPN_SPORT: Record<string, string> = {
  soccer: "football",
  basketball: "basketball",
  football: "american-football",
  baseball: "baseball",
  hockey: "ice-hockey",
  rugby: "rugby",
  tennis: "tennis",
};

export function asSportForEspnPath(path: string | null | undefined): string | null {
  return ESPN_SPORT[(path ?? "").split("/")[0]] ?? null;
}

const STOP = new Set([
  "fc",
  "cf",
  "sc",
  "afc",
  "ac",
  "the",
  "club",
  "de",
  "cd",
  "ssc",
  "as",
  "us",
  "sv",
  "fk",
]);

/** "Atlético de Madrid" → "atletico madrid"; "Brighton & Hove Albion FC" → "brighton and hove albion". */
export function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w && !STOP.has(w))
    .join(" ");
}

const tokens = (s: string) => new Set(s.split(" ").filter(Boolean));

// Women's, youth and reserve sides share the club's name; they must never match the first team.
const SQUAD = /\b(women|w|u\d{2}|ii|b|reserves|youth)\b/;
const squadTag = (s: string) => SQUAD.exec(s)?.[1] ?? "";

/** How sure we are an ESPN side and an AllSports team are the same team, 0–1. */
export function sideScore(espn: SportsSide, as: AsTeam): number {
  const ours = [
    espn.name,
    [espn.location, espn.nickname].filter(Boolean).join(" "),
    espn.location ?? "",
  ]
    .map(normalizeName)
    .filter((s) => s.length >= 3);
  const theirs = [as.name, as.short].map(normalizeName).filter((s) => s.length >= 3);
  let best = 0;
  for (const a of ours)
    for (const b of theirs) {
      if (a === b) return 1;
      if (squadTag(a) !== squadTag(b)) continue;
      // "manchester united" vs "manchester united women" must not match: only whole-word containment
      // of a reasonably long name, scored below an exact match.
      if (
        (` ${a} `.includes(` ${b} `) || ` ${b} `.includes(` ${a} `)) &&
        Math.min(a.length, b.length) >= 5
      )
        best = Math.max(best, 0.85);
      const ta = tokens(a);
      const tb = tokens(b);
      const shared = [...ta].filter((w) => tb.has(w)).length;
      const jaccard = shared / (ta.size + tb.size - shared);
      if (jaccard >= 0.5) best = Math.max(best, 0.5 + jaccard * 0.3);
    }
  const sameSquad = squadTag(normalizeName(espn.name)) === squadTag(normalizeName(as.name));
  if (sameSquad && espn.abbr && as.code && espn.abbr.toUpperCase() === as.code.toUpperCase())
    best = Math.max(best, 0.6);
  return best;
}

const MAX_TIME_GAP = 12 * 3600_000;

/** The AllSports game for an ESPN game: both sides must match, the start within 12 hours. */
export function pickAsMatch(game: SportsGame, candidates: AsGame[]): AsGame | null {
  let best: { g: AsGame; score: number; gap: number } | null = null;
  for (const g of candidates) {
    const gap = game.startMs > 0 ? Math.abs(g.startMs - game.startMs) : 0;
    if (gap > MAX_TIME_GAP) continue;
    const straight = Math.min(sideScore(game.home, g.home), sideScore(game.away, g.away));
    // Neutral-site games are sometimes listed the other way round.
    const swapped = Math.min(sideScore(game.home, g.away), sideScore(game.away, g.home)) * 0.9;
    const score = Math.max(straight, swapped);
    if (score < 0.6) continue;
    if (!best || score > best.score || (score === best.score && gap < best.gap))
      best = { g, score, gap };
  }
  return best?.g ?? null;
}

/** The UTC days to look in: the game's own, then the neighbouring one nearest its start. */
export function searchDays(startMs: number): Date[] {
  const d = new Date(startMs);
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const near = new Date(day.getTime() + (d.getUTCHours() < 12 ? -1 : 1) * 24 * 3600_000);
  return [day, near];
}

/** Look the game up in AllSports' schedule for its day (and the next nearest day). */
export async function findAsMatch(
  get: AsGet,
  game: SportsGame,
  espnPath: string | null,
): Promise<AsGame | null> {
  const slug = asSportForEspnPath(espnPath);
  if (!slug || !(game.startMs > 0)) return null;
  for (const day of searchDays(game.startMs)) {
    const found = pickAsMatch(game, toGames(await get(dayPath(slug, day), 10 * 60_000), slug));
    if (found) return found;
  }
  return null;
}
