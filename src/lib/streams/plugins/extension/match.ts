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

function typeScore(itemType: string | null | undefined, reqType: "movie" | "series"): number {
  const t = (itemType ?? "").toLowerCase();
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

function numbered(episodes: BridgeEpisode[], season: number | null, episode: number): BridgeEpisode[] {
  return episodes.filter(
    (e) => e.episode === episode && (season == null || e.season == null || e.season === season),
  );
}

export function pickEpisodes(media: BridgeMedia, req: StreamPluginRequest): string[] {
  const episodes = Array.isArray(media.episodes) ? media.episodes : [];
  if (req.type === "movie" || !episodes.length) {
    return media.playableData ? [media.playableData] : [];
  }
  const wanted = req.episode;
  const absolute = req.absoluteEpisode;
  let found: BridgeEpisode[] = [];
  if (wanted != null) found = numbered(episodes, req.season, wanted);
  if (!found.length && wanted != null) found = numbered(episodes, null, wanted);
  if (!found.length && absolute != null) found = numbered(episodes, null, absolute);
  if (!found.length && absolute != null && episodes.every((e) => e.episode == null)) {
    const byIndex = episodes[absolute - 1];
    if (byIndex) found = [byIndex];
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
