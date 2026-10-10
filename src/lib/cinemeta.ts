import { withMetaCache } from "@/lib/cinemeta-cache";
import { safeFetch as fetch } from "@/lib/safe-fetch";

const CINEMETA = "https://v3-cinemeta.strem.io";

export type MetaType = "movie" | "series" | "channel" | "tv" | "anime" | "other" | "manga";

export function narrowMediaType(t: MetaType | string | undefined): "movie" | "series" {
  return t === "series" ? "series" : "movie";
}

export type AddonOrigin = { id: string; name: string; logo?: string; base?: string };

export type Meta = {
  id: string;
  type: MetaType;
  name: string;
  poster?: string;
  background?: string;
  logo?: string;
  description?: string;
  originalLanguage?: string;
  country?: string;
  malId?: number;
  animeFormat?: string;
  releaseInfo?: string;
  releaseDate?: string;
  inTheaters?: boolean;
  imdbRating?: string;
  adult?: boolean;
  providerBadge?: { name: string; logo: string; tint: string };
  sourceRank?: number;
  tmdbScore?: number;
  /** Resolution a plugin's own catalogue row claimed. A plugin row arrives as a poster with no
   * addon meta behind it, so this is the only field its quality can be carried in. */
  pluginQuality?: string;
  /** What a plugin wrote on its listing line beyond the title, read back out of it and kept. A
   * provider names a listing after everything it carries, so this is where its languages are: the
   * title has them cut off it, and nothing else in the payload states them. */
  /** What a plugin wrote on its listing line beyond the title, read back out of it and kept. A
   * provider names a listing after everything it carries, so this is where its languages are: the
   * title has them cut off it, and nothing else in the payload states them.
   *
   * `resolutions` is every tier the line names, best first — a line naming `2160p`, `4K` and `UHD`
   * is one tier, not three. `hdr` is null when the line said nothing, which is not a claim that the
   * file has none. */
  listingExtras?: {
    rest: string;
    languages: string[];
    quality: string[];
    resolutions: string[];
    hdr: string | null;
  };
  /** A year a plugin put on the listing line, when it wrote one. The addon meta carries its own
   * `releaseInfo`; this is for rows that have no addon meta behind them. */
  listingYear?: number;
  runtime?: string;
  genres?: string[];
  trailers?: Array<{ source: string; type?: string }>;
  trailerStreams?: Array<{ ytId?: string; title?: string }>;
  links?: Array<{ name: string; category: string; url: string }>;
  addonOrigin?: AddonOrigin;
  isCollection?: boolean;
  behaviorHints?: { defaultVideoId?: string | null };
  videos?: Array<{
    id?: string;
    season?: number;
    episode?: number;
    number?: number;
    released?: string;
    firstAired?: string;
    name?: string;
    title?: string;
    overview?: string;
    description?: string;
    thumbnail?: string;
    /** Episode length in minutes, when the source states one. */
    runtime?: number;
    streams?: Array<Record<string, unknown>>;
  }>;
};

export function persistableAddonOrigin(origin: unknown): AddonOrigin | undefined {
  if (!origin || typeof origin !== "object") return undefined;
  const value = origin as { id?: unknown; name?: unknown; logo?: unknown; base?: unknown };
  if (typeof value.id !== "string" || !value.id) return undefined;
  // The base is what a saved row is resolved and played through: an addon's manifest address, or
  // the plugin catalogue it came from. Without it a plugin row saved to the library loses which
  // plugin listed it, and playing it asks every plugin instead of that one.
  const base = typeof value.base === "string" && value.base ? value.base : undefined;
  return {
    id: value.id,
    name: typeof value.name === "string" && value.name ? value.name : value.id,
    logo: typeof value.logo === "string" ? value.logo : undefined,
    ...(base ? { base } : {}),
  };
}

export function hasEmbeddedStreams(videos: Meta["videos"]): boolean {
  return videos?.some((v) => Array.isArray(v.streams) && v.streams.length > 0) === true;
}

export function persistableVideos(videos: unknown): Meta["videos"] {
  if (!Array.isArray(videos) || videos.length === 0 || videos.length > 40) return undefined;
  const safe = videos
    .filter(
      (video): video is NonNullable<Meta["videos"]>[number] => !!video && typeof video === "object",
    )
    .map(({ streams: _streams, ...video }) => video);
  if (safe.length === 0) return undefined;
  try {
    if (JSON.stringify(safe).length > 64000) return undefined;
  } catch {
    return undefined;
  }
  return safe;
}

export function isAddonNativeMeta(meta: Meta): boolean {
  if (meta.type === "tv" || meta.type === "channel") return true;
  if (!meta.addonOrigin) return false;
  const id = meta.id || "";
  const resolvable =
    /^tt\d/.test(id) || id.startsWith("tmdb:") || id.startsWith("kitsu:") || id.startsWith("mal:");
  return !resolvable;
}

async function catalog(path: string): Promise<Meta[]> {
  const res = await fetch(`${CINEMETA}/catalog/${path}.json`);
  if (!res.ok) return [];
  const json = await res.json();
  return json.metas ?? [];
}

function cinemetaTopPath(type: "movie" | "series", genre?: string, skip = 0): string {
  const parts = [`${type}/top`];
  if (genre) parts.push(`genre=${encodeURIComponent(genre)}`);
  if (skip > 0) parts.push(`skip=${skip}`);
  return parts.join("/");
}

export const topMovies = (genre?: string, skip = 0) =>
  catalog(cinemetaTopPath("movie", genre, skip));

export const topSeries = (genre?: string, skip = 0) =>
  catalog(cinemetaTopPath("series", genre, skip));

export function cinemetaEnabled(): boolean {
  try {
    const raw = localStorage.getItem("harbor.settings");
    return raw ? JSON.parse(raw).cinemetaEnabled !== false : true;
  } catch {
    return true;
  }
}

export async function meta(
  type: "movie" | "series",
  id: string,
  force = false,
): Promise<Meta | null> {
  if (!force && !cinemetaEnabled()) return null;
  return withMetaCache(type, id, async () => {
    const res = await fetch(`${CINEMETA}/meta/${type}/${id}.json`);
    if (!res.ok) {
      const definitive = res.status >= 400 && res.status < 500 && res.status !== 429;
      return { value: null, cacheable: definitive };
    }
    const json = await res.json();
    return { value: json.meta ?? null, cacheable: true };
  });
}
