import type { BridgeEpisode, BridgeMedia, BridgeSearchItem } from "./bridge";
import type { StreamPluginRequest } from "../types";

const SERIES_TYPES = new Set(["tvseries", "anime", "ova", "cartoon", "asiandrama"]);
const MOVIE_TYPES = new Set(["movie", "animemovie"]);
const NOISE = /\b(season|series|part|the|movie|dub|sub|subbed|dubbed|uncensored|bd|hd)\b/g;

export function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/\((19|20)\d{2}\)/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(NOISE, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokens(value: string): string[] {
  return normalizeTitle(value)
    .split(" ")
    .filter((t) => t.length > 1);
}

function overlap(a: string[], b: string[]): number {
  if (!a.length) return 0;
  const set = new Set(b);
  return a.filter((t) => set.has(t)).length / a.length;
}

/** How well a provider's name answers a query, highest first.
 *
 * The order a provider answers its own search in is its business -- newest first, or by its own idea
 * of relevance -- so a title the person typed in full can arrive below looser matches of the same
 * words. This is what lifts the one that was asked for to the front.
 *
 * The comparison is by token, which is what makes it indifferent to the furniture in a name: an
 * apostrophe, a year, a season range and a list of release notes all normalise away, so "India's Got
 * Latent" and "India Got Latent Season 2" score alike while "India" alone scores far below both. */
export function relevanceScore(name: string, query: string): number {
  const want = tokens(query);
  if (!want.length) return 0;
  const got = tokens(name);
  if (!got.length) return 0;
  const held = new Set(got);
  const ratio = want.filter((token) => held.has(token)).length / want.length;
  let score = Math.round(ratio * 1000);
  // A name that is exactly the title is the title; one that carries a page of release notes as well
  // is a looser answer to the same words, and belongs below the one that is not padded out.
  const extra = Math.max(0, got.length - want.length);
  if (ratio === 1) score += extra === 0 ? 500 : Math.max(50, 250 - extra * 4);
  return score;
}

function typeScore(itemType: string | null | undefined, reqType: "movie" | "series"): number {  const t = (itemType ?? "").toLowerCase();
  if (!t) return 0;
  const wantSeries = reqType === "series";
  if (wantSeries && SERIES_TYPES.has(t)) return 20;
  if (!wantSeries && MOVIE_TYPES.has(t)) return 20;
  if (wantSeries && MOVIE_TYPES.has(t)) return -40;
  if (!wantSeries && SERIES_TYPES.has(t)) return -40;
  return 0;
}

function yearScore(name: string, year: number | null): number {
  if (!year) return 0;
  const found = name.match(/\b(19|20)\d{2}\b/g);
  if (!found?.length) return 0;
  return found.some((y) => Math.abs(Number(y) - year) <= 1) ? 15 : -10;
}

export function rankCandidates(
  items: BridgeSearchItem[],
  req: StreamPluginRequest,
  limit: number,
): BridgeSearchItem[] {
  const want = normalizeTitle(req.title);
  const wantTokens = tokens(req.title);
  const scored = items
    .filter((item) => item && typeof item.url === "string" && item.url.length > 0)
    .map((item) => {
      const name = typeof item.name === "string" ? item.name : "";
      const got = normalizeTitle(name);
      const ratio = overlap(wantTokens, tokens(name));
      let score = ratio * 40;
      if (got && got === want) score += 100;
      else if (got && want && (got.includes(want) || want.includes(got))) score += 50;
      score += typeScore(item.type, req.type);
      score += yearScore(name, req.year);
      return { item, score, ratio };
    })
    .filter((c) => c.ratio >= 0.5 || c.score >= 100)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((c) => c.item);
}

export function yearRejects(media: BridgeMedia, req: StreamPluginRequest): boolean {
  if (!req.year || typeof media.year !== "number" || !media.year) return false;
  return Math.abs(media.year - req.year) > 1;
}

/** One episode of a season, by number.
 *
 * A provider that numbers some episodes leaves others unnumbered, and CloudStream shows those
 * under "No Season" -- they are a group of their own, not a second copy of every season. Letting
 * them answer a request for a specific season is what put a bonus episode's streams beside the
 * real one. Asking without a season still accepts them, which is how a provider that numbers
 * nothing at all is reached. */
function numbered(episodes: BridgeEpisode[], season: number | null, episode: number): BridgeEpisode[] {
  return episodes.filter((e) => e.episode === episode && (season == null || e.season === season));
}

/** The episodes a provider left unnumbered, which CloudStream shows under "No Season". They are a
 * season of their own, and the one to take when the season asked for has no such episode. */
function noSeason(episodes: BridgeEpisode[], episode: number): BridgeEpisode[] {
  return episodes.filter((e) => e.episode === episode && e.season == null);
}

export function pickEpisodes(media: BridgeMedia, req: StreamPluginRequest): string[] {
  const episodes = Array.isArray(media.episodes) ? media.episodes : [];
  if (req.type === "movie" || !episodes.length) {
    return media.playableData ? [media.playableData] : [];
  }
  const wanted = req.episode;
  const absolute = req.absoluteEpisode;
  // Some numbers address an episode by position rather than by its own numbering: an absolute
  // number always does, and a "No Season" row does because the list gives it one. The provider
  // numbered those episodes not at all, so nothing can match them by number and this is the only
  // way they can ever play. Both sides walk the unnumbered episodes in the order the provider gave
  // them, so a position means the same episode here as the row the person clicked.
  const positional = absolute != null || req.season == null || req.season === 0;
  let found: BridgeEpisode[] = [];
  if (wanted != null) found = numbered(episodes, req.season, wanted);
  if (!found.length && wanted != null) found = noSeason(episodes, wanted);
  // A season the provider never used is still worth matching by number alone, so a provider whose
  // numbering does not line up is not lost. Not while the number is addressing the No Season group
  // though: there it would hand back some numbered season's episode, which is the wrong episode
  // wearing the right number.
  if (!found.length && wanted != null && !positional) found = numbered(episodes, null, wanted);
  if (!found.length && absolute != null) found = numbered(episodes, null, absolute);
  const byPosition = positional ? (absolute ?? wanted) : null;
  if (!found.length && byPosition != null) {
    const unnumbered = episodes.filter((e) => e.season == null || e.episode == null);
    const at = unnumbered[byPosition - 1];
    if (at) found = [at];
  }
  const out: string[] = [];
  for (const e of found) {
    if (typeof e.data === "string" && e.data && !out.includes(e.data)) out.push(e.data);
    if (out.length >= 2) break;
  }
  return out;
}

export function identityKey(req: StreamPluginRequest): string {
  return `${req.type}|${normalizeTitle(req.title)}|${req.year ?? ""}`;
}
