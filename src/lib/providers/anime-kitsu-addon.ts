import { lruSet } from "@/lib/cache";
import { registerCache } from "@/lib/memory-profiler";
import { safeFetch } from "@/lib/safe-fetch";

const HOST = "https://anime-kitsu.strem.fun";
const TTL = 6 * 60 * 60 * 1000;
const NEG_TTL = 30 * 60 * 1000;
const CACHE_MAX = 300;

const cache = new Map<string, { v: AnimeKitsuMeta | null; t: number }>();
const inflight = new Map<string, Promise<AnimeKitsuMeta | null>>();

registerCache("anime-kitsu:meta", () => cache.size);

export type AnimeKitsuVideo = {
  id: string;
  title: string;
  released?: string;
  season: number;
  episode: number;
  thumbnail?: string;
  overview?: string;
  imdb_id?: string;
  imdbSeason?: number;
  imdbEpisode?: number;
};

export type AnimeKitsuMeta = {
  id: string;
  type: "series" | "movie";
  name: string;
  poster?: string;
  background?: string;
  logo?: string;
  description?: string;
  releaseInfo?: string;
  imdbRating?: string;
  imdb_id?: string;
  videos: AnimeKitsuVideo[];
};

type AddonMetaResponse = {
  meta?: {
    id?: string;
    type?: string;
    name?: string;
    poster?: string;
    background?: string;
    logo?: string;
    description?: string;
    releaseInfo?: string;
    imdbRating?: string;
    imdb_id?: string;
    videos?: AnimeKitsuVideo[];
  };
};

export async function animeKitsuMeta(metaId: string): Promise<AnimeKitsuMeta | null> {
  if (!metaId.startsWith("kitsu:") && !metaId.startsWith("mal:") && !metaId.startsWith("anilist:") && !metaId.startsWith("anidb:")) {
    return null;
  }
  const key = metaId;
  const hit = cache.get(key);
  // A miss is remembered too, on a shorter clock. This is the anime page's
  // steady-state hydration path: award and rail metas ship with no art on
  // purpose, so a title this addon does not carry was re-asked twice per tile
  // mount, for the life of the session, with nothing ever written down.
  if (hit && Date.now() - hit.t < (hit.v ? TTL : NEG_TTL)) return hit.v;
  const existing = inflight.get(key);
  if (existing) return existing;
  const p = (async () => {
    try {
      const seriesUrl = `${HOST}/meta/series/${encodeURIComponent(metaId)}.json`;
      const movieUrl = `${HOST}/meta/movie/${encodeURIComponent(metaId)}.json`;
      const r = await safeFetch(seriesUrl);
      let raw: AddonMetaResponse | null = null;
      if (r.ok) raw = (await r.json()) as AddonMetaResponse;
      if (!raw?.meta || !raw.meta.id) {
        const r2 = await safeFetch(movieUrl);
        if (r2.ok) raw = (await r2.json()) as AddonMetaResponse;
      }
      const m = raw?.meta;
      if (!m?.id) {
        lruSet(cache, key, { v: null, t: Date.now() }, CACHE_MAX);
        return null;
      }
      const out: AnimeKitsuMeta = {
        id: m.id,
        type: m.type === "movie" ? "movie" : "series",
        name: m.name ?? "",
        poster: m.poster,
        background: m.background,
        logo: m.logo,
        description: m.description,
        releaseInfo: m.releaseInfo,
        imdbRating: m.imdbRating,
        imdb_id: m.imdb_id,
        videos: m.videos ?? [],
      };
      lruSet(cache, key, { v: out, t: Date.now() }, CACHE_MAX);
      return out;
    } catch {
      lruSet(cache, key, { v: null, t: Date.now() }, CACHE_MAX);
      return null;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}
