import { lruSet } from "@/lib/cache";
import type { Meta } from "@/lib/cinemeta";
import { registerEvictable } from "@/lib/maintenance";
import { adultContentHidden } from "@/lib/addons-store/adult-filter";

const KITSU = "https://kitsu.io/api/edge";

type Img = { original?: string; large?: string; medium?: string; small?: string };

type KitsuAnimeAttrs = {
  slug?: string;
  canonicalTitle?: string;
  titles?: { en?: string; en_jp?: string; ja_jp?: string };
  synopsis?: string;
  description?: string;
  posterImage?: Img | null;
  coverImage?: Img | null;
  averageRating?: string | null;
  episodeCount?: number | null;
  episodeLength?: number | null;
  totalLength?: number | null;
  status?: string;
  subtype?: string;
  startDate?: string;
  endDate?: string;
  ageRating?: string;
  ageRatingGuide?: string;
  youtubeVideoId?: string | null;
  popularityRank?: number | null;
  ratingRank?: number | null;
};

type KitsuEpisodeAttrs = {
  canonicalTitle?: string;
  synopsis?: string;
  description?: string;
  thumbnail?: Img | null;
  number?: number;
  seasonNumber?: number;
  airdate?: string | null;
  length?: number | null;
};

type KitsuCharacterAttrs = {
  canonicalName?: string;
  names?: { en?: string };
  image?: Img | null;
  description?: string;
};

type Resource<T> = {
  id: string;
  type: string;
  attributes: T;
  relationships?: Record<
    string,
    { data?: { id: string; type: string } | Array<{ id: string; type: string }> }
  >;
};
type Doc<D, I = unknown> = { data: D; included?: Resource<I>[] };

const cache = new Map<string, { v: unknown; t: number }>();
const TTL = 30 * 60 * 1000;

registerEvictable("kitsu", (aggressive) => {
  if (aggressive) return cache.clear();
  const now = Date.now();
  for (const [k, e] of cache) if (now - e.t > TTL) cache.delete(k);
});

async function get<T>(path: string): Promise<T | null> {
  const url = `${KITSU}${path}`;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.t < TTL) return hit.v as T;
  try {
    const r = await fetch(url, { headers: { Accept: "application/vnd.api+json" } });
    if (!r.ok) return null;
    const j = (await r.json()) as T;
    cache.set(url, { v: j, t: Date.now() });
    return j;
  } catch {
    return null;
  }
}

export type KitsuEpisode = {
  id: number;
  number: number;
  seasonNumber: number;
  title: string;
  synopsis: string;
  thumbnail: string | null;
  thumbnailFallback?: string | null;
  airdate: string | null;
  length: number | null;
  streamId?: string;
  imdbId?: string;
  imdbSeason?: number;
  imdbEpisode?: number;
  filler?: boolean;
  absoluteNumber?: number;
  tvdbEpisodeId?: number;
  rating?: number;
  ratingIsImdb?: boolean;
  sourceMetaId?: string;
};

export type KitsuCharacter = {
  id: number;
  name: string;
  role: string;
  image: string | null;
  voiceActor: string | null;
  voiceActorId: number | null;
  voiceActorImage: string | null;
  language: string | null;
};

export type KitsuRelated = {
  role: string;
  meta: Meta;
};

export type KitsuAnimeDetail = {
  id: number;
  slug: string;
  title: string;
  synopsis: string;
  poster?: string;
  backdrop?: string;
  rating?: string;
  episodeCount?: number;
  episodeLength?: number;
  status?: string;
  subtype?: string;
  year?: string;
  startDate?: string;
  endDate?: string;
  ageRating?: string;
  ageRatingGuide?: string;
  trailerYtId?: string;
  popularityRank?: number;
  ratingRank?: number;
  genres: string[];
  genreSlugs: string[];
  categories: string[];
};

export type KitsuStudio = {
  id: number;
  name: string;
  role: string;
};

export type KitsuStreamer = {
  id: number;
  url: string;
  service: string;
  subtitles: string[];
  dubs: string[];
};

function pickImg(img?: Img | null): string | undefined {
  return img?.original ?? img?.large ?? img?.medium ?? img?.small ?? undefined;
}

function ratingToTen(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) return undefined;
  return (n / 10).toFixed(1);
}

export function parseKitsuId(metaId: string): number | null {
  const m = metaId.match(/^kitsu:(\d+)/);
  return m ? Number(m[1]) : null;
}

const COVER_CACHE_MAX = 800;
const coverCache = new Map<number, string | null>();

export async function kitsuCoverImage(id: number): Promise<string | null> {
  if (coverCache.has(id)) return coverCache.get(id)!;
  const j = await get<Doc<Resource<{ coverImage?: Img | null }>>>(
    `/anime/${id}?fields[anime]=coverImage`,
  );
  const img = j?.data?.attributes?.coverImage;
  const url = pickImg(img) ?? null;
  lruSet(coverCache, id, url, COVER_CACHE_MAX);
  return url;
}

type GenreAttrs = { name?: string; slug?: string; description?: string };
type CategoryAttrs = { title?: string; slug?: string; description?: string };

export async function kitsuAnime(id: number): Promise<KitsuAnimeDetail | null> {
  const j = await get<Doc<Resource<KitsuAnimeAttrs>, GenreAttrs | CategoryAttrs>>(
    `/anime/${id}?include=genres,categories`,
  );
  if (!j?.data) return null;
  const a = j.data.attributes;
  const startYear = a.startDate ? a.startDate.slice(0, 4) : undefined;
  const genres: string[] = [];
  const genreSlugs: string[] = [];
  const categories: string[] = [];
  for (const inc of j.included ?? []) {
    if (inc.type === "genres") {
      const g = inc.attributes as GenreAttrs;
      if (g.name) genres.push(g.name);
      if (g.slug) genreSlugs.push(g.slug);
    } else if (inc.type === "categories") {
      const c = inc.attributes as CategoryAttrs;
      if (c.title) categories.push(c.title);
    }
  }
  return {
    id: Number(j.data.id),
    slug: a.slug ?? "",
    title: a.titles?.en || a.canonicalTitle || a.titles?.en_jp || "Unknown",
    synopsis: a.synopsis || a.description || "",
    poster: pickImg(a.posterImage),
    backdrop: pickImg(a.coverImage),
    rating: ratingToTen(a.averageRating),
    episodeCount: a.episodeCount ?? undefined,
    episodeLength: a.episodeLength ?? undefined,
    status: a.status,
    subtype: a.subtype,
    year: startYear,
    startDate: a.startDate,
    endDate: a.endDate ?? undefined,
    ageRating: a.ageRating,
    ageRatingGuide: a.ageRatingGuide,
    trailerYtId: a.youtubeVideoId ?? undefined,
    popularityRank: a.popularityRank ?? undefined,
    ratingRank: a.ratingRank ?? undefined,
    genres,
    genreSlugs,
    categories,
  };
}

function attrsToMeta(id: string, a: KitsuAnimeAttrs): Meta {
  return {
    id: `kitsu:${id}`,
    type: a.subtype === "movie" ? "movie" : "series",
    name: a.titles?.en || a.canonicalTitle || a.titles?.en_jp || "Unknown",
    poster: pickImg(a.posterImage),
    background: pickImg(a.coverImage),
    description: a.synopsis || a.description || "",
    releaseInfo: a.startDate ? a.startDate.slice(0, 4) : undefined,
    imdbRating: ratingToTen(a.averageRating),
  };
}

export async function kitsuSimilarByGenres(
  genreSlugs: string[],
  excludeId: number,
  limit = 18,
): Promise<Meta[]> {
  if (genreSlugs.length === 0) return [];
  const slug = genreSlugs.slice(0, 4).join(",");
  const ageFilter = adultContentHidden() ? "&filter[ageRating]=G,PG,R" : "";
  const params = `filter[genres]=${encodeURIComponent(slug)}${ageFilter}&sort=-userCount&page[limit]=${limit + 6}`;
  const j = await get<Doc<Resource<KitsuAnimeAttrs>[]>>(`/anime?${params}`);
  if (!j?.data) return [];
  const out: Meta[] = [];
  for (const a of j.data) {
    if (Number(a.id) === excludeId) continue;
    out.push(attrsToMeta(a.id, a.attributes));
    if (out.length >= limit) break;
  }
  return out;
}

export async function kitsuStudios(id: number): Promise<KitsuStudio[]> {
  type ProdAttrs = { role?: string };
  type ProducerAttrs = { name?: string; slug?: string };
  const j = await get<Doc<Resource<ProdAttrs>[], ProducerAttrs>>(
    `/anime/${id}/anime-productions?include=producer&page[limit]=20`,
  );
  if (!j?.data) return [];
  const byId = new Map<string, Resource<ProducerAttrs>>();
  for (const inc of j.included ?? []) {
    if (inc.type === "producers") byId.set(inc.id, inc);
  }
  const out: KitsuStudio[] = [];
  for (const prod of j.data) {
    const ref = prod.relationships?.producer;
    const pid = ref && !Array.isArray(ref.data) ? ref.data?.id : undefined;
    if (!pid) continue;
    const p = byId.get(pid);
    if (!p) continue;
    out.push({
      id: Number(p.id),
      name: p.attributes.name || "Studio",
      role: prod.attributes.role || "production",
    });
  }
  return out;
}

export async function kitsuStreamingLinks(id: number): Promise<KitsuStreamer[]> {
  type LinkAttrs = { url?: string; subs?: string[]; dubs?: string[] };
  type StreamerAttrs = { siteName?: string };
  const j = await get<Doc<Resource<LinkAttrs>[], StreamerAttrs>>(
    `/anime/${id}/streaming-links?include=streamer&page[limit]=20`,
  );
  if (!j?.data) return [];
  const byId = new Map<string, Resource<StreamerAttrs>>();
  for (const inc of j.included ?? []) {
    if (inc.type === "streamers") byId.set(inc.id, inc);
  }
  const out: KitsuStreamer[] = [];
  for (const link of j.data) {
    const ref = link.relationships?.streamer;
    const sid = ref && !Array.isArray(ref.data) ? ref.data?.id : undefined;
    if (!sid || !link.attributes.url) continue;
    const s = byId.get(sid);
    if (!s) continue;
    out.push({
      id: Number(s.id),
      url: link.attributes.url,
      service: s.attributes.siteName || "Streaming",
      subtitles: link.attributes.subs ?? [],
      dubs: link.attributes.dubs ?? [],
    });
  }
  return out;
}

export async function kitsuEpisodes(id: number, limit = 60): Promise<KitsuEpisode[]> {
  const PAGE = 20;
  const out: KitsuEpisode[] = [];
  for (let offset = 0; offset < limit; offset += PAGE) {
    const size = Math.min(PAGE, limit - offset);
    const j = await get<Doc<Resource<KitsuEpisodeAttrs>[]>>(
      `/anime/${id}/episodes?page[limit]=${size}&page[offset]=${offset}&sort=number`,
    );
    if (!j?.data?.length) break;
    for (const ep of j.data) {
      const a = ep.attributes;
      out.push({
        id: Number(ep.id),
        number: a.number ?? 0,
        seasonNumber: a.seasonNumber ?? 1,
        title: a.canonicalTitle || `Episode ${a.number ?? "?"}`,
        synopsis: a.synopsis || a.description || "",
        thumbnail: pickImg(a.thumbnail) ?? null,
        airdate: a.airdate ?? null,
        length: a.length ?? null,
      });
    }
    if (j.data.length < size) break;
  }
  return out;
}

type AnimeCharAttrs = { role?: string };
type CastingAttrs = { locale?: string; notes?: string };
type PersonAttrs = { name?: string; image?: Img | null };

export async function kitsuCharacters(id: number, limit = 30): Promise<KitsuCharacter[]> {
  const j = await get<
    Doc<Resource<AnimeCharAttrs>[], KitsuCharacterAttrs | CastingAttrs | PersonAttrs>
  >(
    `/anime/${id}/anime-characters?include=character,castings.person&page[limit]=${Math.min(limit, 20)}&sort=role`,
  );
  if (!j?.data) return [];
  const charById = new Map<string, Resource<KitsuCharacterAttrs>>();
  const castingById = new Map<string, Resource<CastingAttrs>>();
  const personById = new Map<string, Resource<PersonAttrs>>();
  for (const inc of j.included ?? []) {
    if (inc.type === "characters") charById.set(inc.id, inc as Resource<KitsuCharacterAttrs>);
    else if (inc.type === "animeCastings") castingById.set(inc.id, inc as Resource<CastingAttrs>);
    else if (inc.type === "people") personById.set(inc.id, inc as Resource<PersonAttrs>);
  }

  const out: KitsuCharacter[] = [];
  for (const ac of j.data) {
    const charRef = ac.relationships?.character;
    const charId = charRef && !Array.isArray(charRef.data) ? charRef.data?.id : undefined;
    if (!charId) continue;
    const ch = charById.get(charId);
    if (!ch) continue;

    const castingsRef = ac.relationships?.castings;
    const castingIds: string[] = [];
    if (castingsRef && Array.isArray(castingsRef.data)) {
      for (const c of castingsRef.data) castingIds.push(c.id);
    }

    let chosen: Resource<CastingAttrs> | null = null;
    for (const cid of castingIds) {
      const c = castingById.get(cid);
      if (!c) continue;
      if ((c.attributes.locale || "").toLowerCase() === "ja") {
        chosen = c;
        break;
      }
      if (!chosen) chosen = c;
    }

    let va: Resource<PersonAttrs> | null = null;
    if (chosen) {
      const personRef = chosen.relationships?.person;
      const pid = personRef && !Array.isArray(personRef.data) ? personRef.data?.id : undefined;
      if (pid) va = personById.get(pid) ?? null;
    }

    out.push({
      id: Number(ch.id),
      name: ch.attributes.canonicalName || ch.attributes.names?.en || "Character",
      role: ac.attributes.role || "supporting",
      image: pickImg(ch.attributes.image) ?? null,
      voiceActor: va?.attributes.name ?? null,
      voiceActorId: va ? Number(va.id) : null,
      voiceActorImage: pickImg(va?.attributes.image ?? null) ?? null,
      language: chosen?.attributes.locale ?? null,
    });
  }
  return out;
}

export async function kitsuRelated(id: number): Promise<KitsuRelated[]> {
  type RelAttrs = { role?: string };
  type DestAttrs = KitsuAnimeAttrs;
  const j = await get<Doc<Resource<RelAttrs>[], DestAttrs>>(
    `/anime/${id}/media-relationships?include=destination&page[limit]=12`,
  );
  if (!j?.data) return [];
  const animeById = new Map<string, Resource<DestAttrs>>();
  for (const inc of j.included ?? []) {
    if (inc.type === "anime") animeById.set(inc.id, inc);
  }
  const out: KitsuRelated[] = [];
  for (const rel of j.data) {
    const ref = rel.relationships?.destination;
    const destId = ref && !Array.isArray(ref.data) ? ref.data?.id : undefined;
    if (!destId) continue;
    const a = animeById.get(destId);
    if (!a) continue;
    const at = a.attributes;
    out.push({
      role: rel.attributes.role || "related",
      meta: {
        id: `kitsu:${a.id}`,
        type: at.subtype === "movie" ? "movie" : "series",
        name: at.titles?.en || at.canonicalTitle || at.titles?.en_jp || "Unknown",
        poster: pickImg(at.posterImage),
        background: pickImg(at.coverImage),
        description: at.synopsis || at.description || "",
        releaseInfo: at.startDate ? at.startDate.slice(0, 4) : undefined,
        imdbRating: ratingToTen(at.averageRating),
      },
    });
  }
  return out;
}

const mainTvCache = new Map<number, number | null>();

export async function kitsuMainTvSeries(id: number): Promise<number | null> {
  if (mainTvCache.has(id)) return mainTvCache.get(id)!;
  const j = await get<
    Doc<Resource<{ role?: string }>[], { subtype?: string; episodeCount?: number }>
  >(`/anime/${id}/media-relationships?include=destination&page[limit]=20`);
  let best: number | null = null;
  let bestEps = -1;
  for (const inc of j?.included ?? []) {
    if (inc.type !== "anime" || inc.attributes?.subtype !== "TV") continue;
    const nid = Number(inc.id);
    const eps = Number(inc.attributes?.episodeCount ?? 0);
    if (Number.isFinite(nid) && nid !== id && eps > bestEps) {
      bestEps = eps;
      best = nid;
    }
  }
  mainTvCache.set(id, best);
  return best;
}
