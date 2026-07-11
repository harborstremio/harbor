import { anilistFranchise, type AnilistFranchiseNode } from "@/lib/anilist/relations";
import type { Meta } from "@/lib/cinemeta";
import { buildKitsuEpisodes, mergeAniZipEpisodes } from "@/lib/providers/anime-episode-build";
import { enrichEpisodes } from "@/lib/providers/anime-episode-enrich";
import { animeKitsuMeta } from "@/lib/providers/anime-kitsu-addon";
import { kitsuToTvdb, kitsuToImdb, externalToKitsu } from "@/lib/providers/anime-mapping";
import { aniZipByKitsu } from "@/lib/providers/anizip";
import { fanartMovie, fanartTv } from "@/lib/providers/fanart";
import {
  kitsuAnime,
  kitsuCharacters,
  kitsuEpisodes,
  kitsuRelated,
  kitsuSimilarByGenres,
  kitsuStreamingLinks,
  kitsuStudios,
  parseKitsuId,
  type KitsuEpisode,
  type KitsuStreamer,
} from "@/lib/providers/kitsu";
import { tmdbAnimeLogo, tmdbDetails } from "@/lib/providers/tmdb";
import type { CastEntry, TmdbDetail } from "@/lib/providers/tmdb";
import type { Settings } from "@/lib/settings";

export type FranchiseEntry = {
  meta: Meta;
  year: number;
  startDate?: string;
  episodeCount?: number;
  isCurrent: boolean;
  isUpcoming: boolean;
};

export type AnimeDetailExtras = Partial<TmdbDetail>;

export type AnimeDetailResult = {
  detail: TmdbDetail;
  episodes: KitsuEpisode[];
  streamers: KitsuStreamer[];
  backdrops: string[];
  imdbId?: string;
  franchisePromise: Promise<FranchiseEntry[]>;
  enrichPromise: Promise<KitsuEpisode[]>;
  extrasPromise: Promise<AnimeDetailExtras>;
  kitsuId: number;
};

function emptyDetail(kind: "movie" | "tv"): TmdbDetail {
  return {
    kind,
    id: 0,
    imdbId: null,
    title: "",
    originalTitle: "",
    tagline: "",
    overview: "",
    voteCount: 0,
    status: "",
    genres: [],
    originalLanguage: "",
    spokenLanguages: [],
    productionCountries: [],
    productionCompanies: [],
    networks: [],
    productionCompaniesRich: [],
    productionCountriesRich: [],
    spokenLanguagesRich: [],
    networksRich: [],
    trailerYtId: null,
    trailerCandidates: [],
    extraVideos: [],
    gallery: { backdrops: [], posters: [], logos: [] },
    cast: [],
    crew: [],
    directors: [],
    writers: [],
    creators: [],
    producers: [],
    composer: [],
    cinematography: [],
    editor: [],
    recommendations: [],
    similar: [],
    seasons: [],
    numberOfSeasons: 0,
    numberOfEpisodes: 0,
    keywords: [],
  };
}

const STATUS_LABELS: Record<string, string> = {
  current: "Currently Airing",
  finished: "Finished Airing",
  tba: "TBA",
  unreleased: "Unreleased",
  upcoming: "Upcoming",
};

const STUDIO_ROLE_RANK: Record<string, number> = {
  studio: 0,
  production: 1,
  licensor: 2,
};

const FRANCHISE_ROLES = new Set(["sequel", "prequel", "parent_story"]);
const FRANCHISE_MAX_DEPTH = 3;

function makeFranchiseMeta(id: number, anime: import("./kitsu").KitsuAnimeDetail): Meta {
  return {
    id: `kitsu:${id}`,
    type: anime.subtype === "movie" ? "movie" : "series",
    name: anime.title,
    poster: anime.poster,
    background: anime.backdrop,
    description: anime.synopsis,
    releaseInfo: anime.year,
    imdbRating: anime.rating,
  };
}

function isAnimeUpcoming(anime: import("./kitsu").KitsuAnimeDetail | null, now: number): boolean {
  if (!anime) return false;
  const status = (anime.status ?? "").toLowerCase();
  if (status === "unreleased" || status === "upcoming" || status === "tba") return true;
  if (anime.startDate) {
    const t = new Date(anime.startDate).getTime();
    if (Number.isFinite(t) && t > now) return true;
  }
  return false;
}

async function buildFranchise(
  rootId: number,
  rootAnime: import("./kitsu").KitsuAnimeDetail,
): Promise<FranchiseEntry[]> {
  const now = Date.now();
  const anilistPromise = anilistFranchise(rootId).catch(() => [] as AnilistFranchiseNode[]);
  const items = new Map<number, FranchiseEntry>();
  items.set(rootId, {
    meta: makeFranchiseMeta(rootId, rootAnime),
    year: parseInt(rootAnime.year ?? "", 10) || 0,
    startDate: rootAnime.startDate,
    episodeCount: rootAnime.episodeCount,
    isCurrent: true,
    isUpcoming: isAnimeUpcoming(rootAnime, now),
  });

  const visited = new Set<number>([rootId]);
  let relatedWave: Promise<{ id: number; related: Awaited<ReturnType<typeof kitsuRelated>> }[]> = Promise.all([
    kitsuRelated(rootId),
  ]).then(([related]) => [{ id: rootId, related }]);
  let depth = 0;

  while (depth < FRANCHISE_MAX_DEPTH) {
    const relatedLists = await relatedWave;
    const newIds: number[] = [];
    for (const { related } of relatedLists) {
      for (const r of related) {
        if (!FRANCHISE_ROLES.has(r.role.toLowerCase())) continue;
        const m = parseKitsuId(r.meta.id);
        if (!m || items.has(m) || visited.has(m)) continue;
        if (!newIds.includes(m)) newIds.push(m);
      }
    }
    if (newIds.length === 0) break;
    for (const id of newIds) visited.add(id);
    const nextWave = Promise.all(newIds.map((id) => kitsuRelated(id).then((related) => ({ id, related }))));
    const animes = await Promise.all(newIds.map((id) => kitsuAnime(id)));
    const alive = new Set<number>();
    for (let i = 0; i < newIds.length; i++) {
      const id = newIds[i];
      const a = animes[i];
      if (!a) continue;
      items.set(id, {
        meta: makeFranchiseMeta(id, a),
        year: parseInt(a.year ?? "", 10) || 0,
        startDate: a.startDate,
        episodeCount: a.episodeCount,
        isCurrent: false,
        isUpcoming: isAnimeUpcoming(a, now),
      });
      alive.add(id);
    }
    if (alive.size === 0) break;
    relatedWave = nextWave.then((lists) => lists.filter((l) => alive.has(l.id)));
    depth++;
  }

  const rootAnilist = await anilistPromise;
  const siblingIds = [...items.values()]
    .filter((e) => !e.isCurrent)
    .sort((a, b) => (a.year || 9999) - (b.year || 9999))
    .map((e) => parseKitsuId(e.meta.id))
    .filter((x): x is number => x != null)
    .slice(0, 2);
  const siblingBatches = await Promise.all(
    siblingIds.map((id) => anilistFranchise(id).catch(() => [] as AnilistFranchiseNode[])),
  );
  const anilistById = new Map<number, AnilistFranchiseNode>();
  for (const n of [rootAnilist, ...siblingBatches].flat()) anilistById.set(n.id, n);
  const anilistNodes = [...anilistById.values()];
  const anilistEntries: FranchiseEntry[] = anilistNodes.map((n) => ({
    meta: {
      id: `anilist:${n.id}`,
      type: n.type,
      name: n.name,
      poster: n.poster,
      background: n.banner,
      releaseInfo: n.year != null ? String(n.year) : undefined,
      imdbRating: n.rating,
    },
    year: n.year ?? 0,
    startDate: n.startDate,
    episodeCount: n.episodes,
    isCurrent: false,
    isUpcoming: n.upcoming,
  }));

  const score = (e: FranchiseEntry) =>
    (e.isCurrent ? 1000 : 0) +
    (e.meta.id.startsWith("kitsu:") ? 4 : 0) +
    (e.startDate ? 2 : 0) +
    ((e.episodeCount ?? 0) > 0 ? 1 : 0);
  const ORD: Record<string, string> = {
    first: "1",
    second: "2",
    third: "3",
    fourth: "4",
    fifth: "5",
    sixth: "6",
    seventh: "7",
    eighth: "8",
  };
  const norm = (s: string) => {
    let x = s.trim().toLowerCase();
    for (const w in ORD) x = x.replace(new RegExp(`\\b${w}\\b`, "g"), ORD[w]);
    const m = x.match(/(\d+)\s*(?:st|nd|rd|th)?\s*season|season\s*(\d+)/);
    const num = m ? (m[1] ?? m[2]) : "";
    const base = x.replace(/\d+\s*(?:st|nd|rd|th)?\s*season|season\s*\d+/g, " ").replace(/[^a-z0-9]+/g, "");
    return num ? `${base}#${num}` : base;
  };
  const byName = new Map<string, FranchiseEntry>();
  for (const e of [...items.values(), ...anilistEntries]) {
    const key = norm(e.meta.name);
    if (!key) continue;
    const prev = byName.get(key);
    if (!prev || score(e) > score(prev)) byName.set(key, e);
  }
  return Array.from(byName.values()).sort((a, b) => {
    const ad = a.startDate ?? "9999";
    const bd = b.startDate ?? "9999";
    return ad.localeCompare(bd);
  });
}

export type FranchiseTag = { kind: "season" | "movie"; seasonNum: number; short: string };

export function franchiseTags(franchise: FranchiseEntry[]): FranchiseTag[] {
  let s = 0;
  return franchise.map((f) => {
    if (f.meta.type === "movie" || (f.episodeCount ?? 0) === 1) {
      return { kind: "movie", seasonNum: 0, short: "MOV" };
    }
    s += 1;
    return { kind: "season", seasonNum: s, short: `S${s}` };
  });
}

const FRANCHISE_CAST_CACHE = new Map<string, CastEntry[]>();

export async function animeDetails(settings: Settings, meta: Meta): Promise<AnimeDetailResult | null> {
  let kitsuId = parseKitsuId(meta.id);
  if (kitsuId == null) {
    const ext: Array<[string, string]> = [
      ["mal:", "myanimelist"],
      ["anilist:", "anilist"],
      ["anidb:", "anidb"],
    ];
    for (const [prefix, source] of ext) {
      if (meta.id.startsWith(prefix)) {
        const n = parseInt(meta.id.slice(prefix.length), 10);
        if (Number.isFinite(n)) kitsuId = await externalToKitsu(source, n);
        break;
      }
    }
  }
  if (kitsuId == null) return null;

  const [anime, addonMeta] = await Promise.all([
    kitsuAnime(kitsuId),
    animeKitsuMeta(`kitsu:${kitsuId}`).catch(() => null),
  ]);
  if (!anime) return null;

  const franchisePromise = buildFranchise(kitsuId, anime).catch(() => [] as FranchiseEntry[]);

  const slugify = (s: string) =>
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const effectiveSlugs = anime.genreSlugs.length > 0 ? anime.genreSlugs : anime.genres.map(slugify).filter(Boolean);

  const [kitsuRawEpisodes, characters, related, studios, streamers, genreSimilar, aniZip] = await Promise.all([
    kitsuEpisodes(kitsuId, 100),
    kitsuCharacters(kitsuId, 30),
    kitsuRelated(kitsuId),
    kitsuStudios(kitsuId),
    kitsuStreamingLinks(kitsuId),
    effectiveSlugs.length > 0 ? kitsuSimilarByGenres(effectiveSlugs, kitsuId, 34) : Promise.resolve([] as Meta[]),
    aniZipByKitsu(kitsuId).catch(() => null),
  ]);

  const episodes = buildKitsuEpisodes(addonMeta, kitsuRawEpisodes);
  mergeAniZipEpisodes(episodes, aniZip);

  let seriesImdb = aniZip?.mappings?.imdb_id ?? episodes.find((e) => e.imdbId)?.imdbId ?? null;
  if (!seriesImdb) seriesImdb = await kitsuToImdb(kitsuId).catch(() => null);

  if (seriesImdb?.startsWith("tt")) {
    for (const ep of episodes) {
      const abs = ep.absoluteNumber ?? ep.number;
      ep.thumbnailFallback = `https://episodes.metahub.space/${seriesImdb}/1/${abs}/w780.jpg`;
    }
  }

  const kind: "movie" | "tv" = anime.subtype === "movie" ? "movie" : "tv";

  const toCast = (chars: typeof characters): CastEntry[] =>
    chars.map((c, i) => ({
      id: c.id,
      name: c.name,
      character: c.voiceActor ?? (c.role === "main" ? "Main" : "Supporting"),
      profilePath: c.image ?? null,
      order: i,
    }));
  const cast: CastEntry[] = toCast(characters);
  const castKeys = [meta.id, `kitsu:${kitsuId}`];
  if (cast.length > 0) for (const k of castKeys) FRANCHISE_CAST_CACHE.set(k, cast);

  const franchiseIds = new Set<string>([meta.id, `kitsu:${kitsuId}`]);
  for (const r of related) franchiseIds.add(r.meta.id);

  const similarPool: Meta[] = [];
  const poolSeen = new Set<string>();
  for (const m of genreSimilar) {
    if (franchiseIds.has(m.id) || poolSeen.has(m.id)) continue;
    poolSeen.add(m.id);
    similarPool.push(m);
  }
  const moreLikeThis = similarPool.slice(0, 14);
  const youMightLike = similarPool.slice(14, 28);

  const sortedStudios = [...studios].sort((a, b) => {
    const ra = STUDIO_ROLE_RANK[a.role] ?? 9;
    const rb = STUDIO_ROLE_RANK[b.role] ?? 9;
    return ra - rb;
  });
  const productionCompanies = Array.from(new Set(sortedStudios.map((s) => s.name)));
  const networks = Array.from(new Set(streamers.map((s) => s.service)));

  const detail: TmdbDetail = {
    ...emptyDetail(kind),
    id: anime.id,
    imdbId: addonMeta?.imdb_id ?? null,
    title: anime.title,
    originalTitle: anime.title,
    overview: anime.synopsis,
    poster: anime.poster,
    backdrop: anime.backdrop,
    year: anime.year,
    rating: meta.imdbRating ?? anime.rating,
    voteCount: anime.popularityRank ?? 0,
    runtime: anime.episodeLength ? `${anime.episodeLength}m` : undefined,
    status: anime.status ? (STATUS_LABELS[anime.status] ?? anime.status) : "",
    genres: anime.genres,
    originalLanguage: "ja",
    spokenLanguages: ["Japanese"],
    productionCountries: ["Japan"],
    productionCompanies,
    networks,
    trailerYtId: anime.trailerYtId ?? null,
    trailerCandidates: anime.trailerYtId ? [anime.trailerYtId] : [],
    gallery: { backdrops: anime.backdrop ? [anime.backdrop] : [], posters: [], logos: [] },
    cast,
    recommendations: moreLikeThis,
    similar: youMightLike,
    numberOfEpisodes: anime.episodeCount ?? 0,
    numberOfSeasons: kind === "tv" ? 1 : 0,
    firstAirDate: anime.startDate,
    lastAirDate: anime.endDate,
  };

  const enrichPromise = enrichEpisodes(episodes, settings, kitsuId, seriesImdb)
    .then(() => episodes)
    .catch(() => episodes);

  const extrasPromise: Promise<AnimeDetailExtras> = (async () => {
    const [tmdbHit, tvdbId] = await Promise.all([
      settings.tmdbKey
        ? tmdbAnimeLogo(settings.tmdbKey, anime.title, anime.year, kind).catch(() => null)
        : Promise.resolve(null),
      settings.fanartKey && kind === "tv" ? kitsuToTvdb(kitsuId).catch(() => null) : Promise.resolve(null),
    ]);
    let logo: string | undefined;
    let backdrop = anime.backdrop;
    let poster = anime.poster;
    let backdrops: string[] = anime.backdrop ? [anime.backdrop] : [];
    if (tmdbHit) {
      if (tmdbHit.logo) logo = tmdbHit.logo;
      if (tmdbHit.backdrop) {
        backdrop = tmdbHit.backdrop;
        backdrops = [tmdbHit.backdrop];
      }
    }
    const fanartPromise =
      settings.fanartKey && kind === "movie" && tmdbHit?.tmdbId
        ? fanartMovie(settings.fanartKey, tmdbHit.tmdbId).catch(() => null)
        : settings.fanartKey && kind === "tv" && tvdbId
          ? fanartTv(settings.fanartKey, tvdbId).catch(() => null)
          : Promise.resolve(null);
    const tmdbFullPromise =
      settings.tmdbKey && tmdbHit?.tmdbId
        ? tmdbDetails(settings.tmdbKey, {
            id: `tmdb:${kind === "movie" ? "movie" : "tv"}:${tmdbHit.tmdbId}`,
            type: kind === "movie" ? "movie" : "series",
            name: anime.title,
          } as Meta).catch(() => null)
        : Promise.resolve(null);
    const [fa, fullRaw] = await Promise.all([fanartPromise, tmdbFullPromise]);
    if (fa) {
      if (fa.logo) logo = fa.logo;
      if (fa.backdrops.length > 0) {
        backdrop = fa.backdrops[0];
        backdrops = fa.backdrops;
      }
      if (fa.poster) poster = fa.poster;
    }
    let tmdbFull: TmdbDetail | null = null;
    if (fullRaw) {
      const ay = Number(anime.year);
      const ty = Number(fullRaw.year);
      if (!Number.isFinite(ay) || !Number.isFinite(ty) || Math.abs(ty - ay) <= 1) tmdbFull = fullRaw;
    }
    const patch: AnimeDetailExtras = {
      logo,
      backdrop,
      poster,
      imdbId: addonMeta?.imdb_id ?? tmdbFull?.imdbId ?? null,
      extraVideos: tmdbFull?.extraVideos ?? [],
      gallery: {
        backdrops: Array.from(new Set([...backdrops, ...(tmdbFull?.gallery.backdrops ?? [])])),
        posters: tmdbFull?.gallery.posters ?? [],
        logos: tmdbFull?.gallery.logos ?? [],
      },
      crew: tmdbFull?.crew ?? [],
      directors: tmdbFull?.directors ?? [],
      writers: tmdbFull?.writers ?? [],
      creators: tmdbFull?.creators ?? [],
      producers: tmdbFull?.producers ?? [],
      composer: tmdbFull?.composer ?? [],
      cinematography: tmdbFull?.cinematography ?? [],
      editor: tmdbFull?.editor ?? [],
      keywords: tmdbFull?.keywords ?? [],
    };
    if (cast.length === 0) {
      let fallback: CastEntry[] | undefined;
      for (const k of castKeys) {
        const c = FRANCHISE_CAST_CACHE.get(k);
        if (c?.length) {
          fallback = c;
          break;
        }
      }
      if (!fallback && tmdbFull?.cast?.length) {
        fallback = tmdbFull.cast;
        for (const k of castKeys) FRANCHISE_CAST_CACHE.set(k, tmdbFull.cast);
      }
      if (fallback) patch.cast = fallback;
    }
    return patch;
  })().catch(() => ({}) as AnimeDetailExtras);

  const franchiseResult = (async () => {
    const [franchise, extras] = await Promise.all([franchisePromise, extrasPromise]);
    if (extras.logo) for (const f of franchise) if (!f.meta.logo) f.meta.logo = extras.logo;
    return franchise;
  })();

  return {
    detail,
    episodes,
    streamers,
    backdrops: anime.backdrop ? [anime.backdrop] : [],
    imdbId: addonMeta?.imdb_id,
    franchisePromise: franchiseResult,
    enrichPromise,
    extrasPromise,
    kitsuId,
  };
}
