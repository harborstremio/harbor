import type { VodEpisode, VodMovie, VodSeries } from "./vod";

export type VodLookupQuery = {
  type: "movie" | "series";
  title: string;
  year?: number | null;
  tmdbId?: number | null;
  season?: number | null;
  episode?: number | null;
};

const ARTICLE_SUFFIX_RE = /^(.*),\s*(the|a|an)$/i;

/** Equality key for titles: case, accents, punctuation and "&" are not identity. */
export function vodTitleKey(title: string): string {
  let s = title.trim();
  const suffix = s.match(ARTICLE_SUFFIX_RE);
  if (suffix) s = `${suffix[2]} ${suffix[1]}`;
  return s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function yearsAgree(wanted: number | null | undefined, offered: number | null | undefined) {
  if (wanted == null || offered == null) return null;
  return Math.abs(wanted - offered) <= 1;
}

/**
 * Provider movies that are this title. A TMDB id on both sides decides on its own; otherwise the
 * title must be equal and both years known and within one year, because a bare title is how a
 * remake or a same-named film gets played instead.
 */
export function matchVodMovies(movies: readonly VodMovie[], query: VodLookupQuery): VodMovie[] {
  if (query.type !== "movie") return [];
  const key = vodTitleKey(query.title);
  if (!key) return [];
  return movies.filter((m) => {
    if (query.tmdbId != null && m.tmdbId != null) return m.tmdbId === query.tmdbId;
    if (vodTitleKey(m.title) !== key) return false;
    return yearsAgree(query.year, m.year) === true;
  });
}

/**
 * Provider series that are this show. A year is checked whenever both sides carry one; a show
 * without a year on either side matches on its title alone.
 */
export function matchVodSeries(series: readonly VodSeries[], query: VodLookupQuery): VodSeries[] {
  if (query.type !== "series") return [];
  const key = vodTitleKey(query.title);
  if (!key) return [];
  return series.filter((s) => {
    if (query.tmdbId != null && s.tmdbId != null) return s.tmdbId === query.tmdbId;
    if (vodTitleKey(s.title) !== key) return false;
    return yearsAgree(query.year, s.year) !== false;
  });
}

/** Only an episode the provider numbered explicitly is ever picked. */
export function pickVodEpisode(
  episodes: readonly VodEpisode[],
  season: number | null | undefined,
  episode: number | null | undefined,
): VodEpisode | null {
  if (season == null || episode == null) return null;
  return (
    episodes.find((e) => e.numbered !== false && e.season === season && e.episode === episode) ??
    null
  );
}

const QUALITY_RULES: Array<[RegExp, string]> = [
  [/\b(2160p|4k|uhd)\b/i, "4K"],
  [/\b(1080p|fhd)\b/i, "1080p"],
  [/\b720p\b/i, "720p"],
  [/\b(480p|sd)\b/i, "SD"],
];

/** The quality a provider writes into an entry's name or category, if any. */
export function vodQualityLabel(...texts: Array<string | null | undefined>): string | null {
  const hay = texts.filter(Boolean).join(" ");
  for (const [rx, label] of QUALITY_RULES) if (rx.test(hay)) return label;
  return null;
}
