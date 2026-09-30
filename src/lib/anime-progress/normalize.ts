import type { AnimeProgressIds } from "./types";

export type EpisodeRef = { season: number; episode: number };

export type EpisodeCatalog = {
  episodes: Set<string>;
  airDates: Map<string, number>;
  total: number | null;
};

export function episodeKey(season: number, episode: number): string {
  return `${season}:${episode}`;
}

export function parseEpisodeKey(key: string): EpisodeRef | null {
  const m = /^(\d+):(\d+)$/.exec(key);
  if (!m) return null;
  const season = Number(m[1]);
  const episode = Number(m[2]);
  if (!Number.isInteger(season) || !Number.isInteger(episode) || season < 0 || episode < 1) return null;
  return { season, episode };
}

const RECAP_RX = /\b(recap|recapitulation|summary|special|ova|ona|oav|extra|prologue|epilogue)\b/i;

/** Season 0 entries (specials/OVAs) are excluded by default. */
export function isSpecialEpisode(season: number, title?: string | null): boolean {
  if (season === 0) return true;
  if (title && RECAP_RX.test(title)) return true;
  return false;
}

export type CatalogOpts = {
  includeSpecials?: boolean;
  episodeTitle?: (season: number, episode: number) => string | null;
};

function orderedCatalog(catalog: EpisodeCatalog, opts: CatalogOpts): EpisodeRef[] {
  const include = opts.includeSpecials === true;
  return [...catalog.episodes]
    .map(parseEpisodeKey)
    .filter((e): e is EpisodeRef => !!e)
    .filter((e) => include || !isSpecialEpisode(e.season, opts.episodeTitle?.(e.season, e.episode)))
    .sort((a, b) => a.season - b.season || a.episode - b.episode);
}

/** First aired, non-special episode of the catalog, or null when empty. */
export function firstEpisode(catalog: EpisodeCatalog, opts: CatalogOpts = {}): EpisodeRef | null {
  return orderedCatalog(catalog, opts)[0] ?? null;
}

/** Next unwatched episode from an exact watched set (Trakt / Simkl). */
export function nextAfterExact(watched: Set<string>, catalog: EpisodeCatalog, opts: CatalogOpts = {}): EpisodeRef | null {
  const now = Date.now();
  for (const ep of orderedCatalog(catalog, opts)) {
    if (watched.has(episodeKey(ep.season, ep.episode))) continue;
    const air = catalog.airDates.get(episodeKey(ep.season, ep.episode));
    if (air != null && air > now) continue;
    return ep;
  }
  return null;
}

/** Next episode from a watched count (MAL / AniList): count + 1. */
export function nextAfterCount(watchedCount: number, catalog: EpisodeCatalog, opts: CatalogOpts = {}): EpisodeRef | null {
  if (!Number.isFinite(watchedCount) || watchedCount < 0) return null;
  const ordered = orderedCatalog(catalog, opts);
  if (ordered.length === 0) {
    const episode = Math.floor(watchedCount) + 1;
    return episode >= 1 ? { season: 1, episode } : null;
  }
  const idx = Math.floor(watchedCount);
  if (idx < 0 || idx >= ordered.length) return null;
  const pick = ordered[idx];
  const air = catalog.airDates.get(episodeKey(pick.season, pick.episode));
  if (air != null && air > Date.now()) return null;
  return pick;
}

export type CountNextStatus = "ok" | "completed" | "unreleased";

/**
 * Why `nextAfterCount` returned null, without re-deriving the answer: the count
 * can exhaust the aired catalog (a completed show) or land on an unaired
 * episode, and Continue Watching must report those two states differently.
 */
export function countNextStatus(watchedCount: number, catalog: EpisodeCatalog, opts: CatalogOpts = {}): CountNextStatus {
  if (!Number.isFinite(watchedCount) || watchedCount < 0) return "completed";
  const ordered = orderedCatalog(catalog, opts);
  if (ordered.length === 0) return "ok";
  const idx = Math.floor(watchedCount);
  if (idx >= ordered.length) return "completed";
  const pick = ordered[idx];
  const air = catalog.airDates.get(episodeKey(pick.season, pick.episode));
  return air != null && air > Date.now() ? "unreleased" : "ok";
}


/**
 * Canonical dedupe key shared across providers for the same anime. MAL comes
 * first because MAL, AniList (via idMal) and Simkl all carry MAL ids — the
 * MAL/AniList pair is the most common source of duplicate entries. AniList-only
 * ids follow, then trackers, then western ids.
 */
export function canonicalAnimeKey(ids: AnimeProgressIds, titles: string[], year: number | null): string {
  if (ids.mal != null) return `mal:${ids.mal}`;
  if (ids.kitsu != null) return `kitsu:${ids.kitsu}`;
  if (ids.anidb != null) return `anidb:${ids.anidb}`;
  if (ids.anilist != null) return `anilist:${ids.anilist}`;
  if (ids.trakt != null) return `trakt:${ids.trakt}`;
  if (ids.simkl != null) return `simkl:${ids.simkl}`;
  if (ids.imdb) return `imdb:${ids.imdb}`;
  if (ids.tmdb != null) return `tmdb:${ids.tmdb}`;
  const norm = (titles[0] ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
  return `title:${norm}:${year ?? "?"}`;
}

export function stremioCandidates(ids: AnimeProgressIds): string[] {
  const out: string[] = [];
  if (ids.kitsu != null) out.push(`kitsu:${ids.kitsu}`);
  if (ids.mal != null) out.push(`mal:${ids.mal}`);
  if (ids.anilist != null) out.push(`anilist:${ids.anilist}`);
  if (ids.anidb != null) out.push(`anidb:${ids.anidb}`);
  if (ids.imdb) out.push(ids.imdb);
  if (ids.tmdb != null) out.push(`tmdb:tv:${ids.tmdb}`);
  return out;
}
