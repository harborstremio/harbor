import type { Meta } from "@/lib/cinemeta";

import { buildKitsuEpisodes, mergeAniZipEpisodes, mergeTvdbEpisodes } from "@/lib/providers/anime-episode-build";
import { animeKitsuMeta } from "@/lib/providers/anime-kitsu-addon";
import { kitsuToTvdb, kitsuToImdb, externalToKitsu, kitsuToAnilist, aniZipByKitsuWithFallback } from "@/lib/providers/anime-mapping";
import { anilistFranchise, type AnilistFranchiseNode } from "@/lib/anilist/relations";
import { anilistArtById, anilistRecommendations } from "@/lib/anilist/browse";
import { enrichEpisodes } from "@/lib/providers/anime-episode-enrich";
import { fanartMovie, fanartTv } from "@/lib/providers/fanart";
import { fetchTvdbArtwork } from "@/lib/providers/tvdb-proxy";
import { tvdbEpisodesByType, tvdbEpisodesAbsolute, tvdbLangFromIso1 } from "@/lib/providers/tvdb";
import {
  kitsuAnime,
  kitsuCharacters,
  kitsuEpisodes,
  kitsuMainTvSeries,
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
  subtype?: string;
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
  heroBgPromise: Promise<string | undefined>;
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
const SIDE_ENTRY_SUBTYPES = new Set(["ova", "ona", "special", "music"]);

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
    subtype: rootAnime.subtype,
    isCurrent: true,
    isUpcoming: isAnimeUpcoming(rootAnime, now),
  });

  const visited = new Set<number>([rootId]);
  let relatedWave: Promise<{ id: number; related: Awaited<ReturnType<typeof kitsuRelated>> }[]> =
    Promise.all([kitsuRelated(rootId)]).then(([related]) => [{ id: rootId, related }]);
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
    const nextWave = Promise.all(
      newIds.map((id) => kitsuRelated(id).then((related) => ({ id, related }))),
    );
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
        subtype: a.subtype,
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
      description: n.description,
      releaseInfo: n.year != null ? String(n.year) : undefined,
      imdbRating: n.rating,
    },
    year: n.year ?? 0,
    startDate: n.startDate,
    episodeCount: n.episodes,
    subtype: n.format,
    isCurrent: false,
    isUpcoming: n.upcoming,
  }));

  const score = (e: FranchiseEntry) =>
    (e.isCurrent ? 1000 : 0) +
    (e.meta.id.startsWith("kitsu:") ? 4 : 0) +
    (e.startDate ? 2 : 0) +
    ((e.episodeCount ?? 0) > 0 ? 1 : 0);
  const ORD: Record<string, string> = {
    first: "1", second: "2", third: "3", fourth: "4", fifth: "5", sixth: "6", seventh: "7", eighth: "8",
  };
  const norm = (s: string) => {
    let x = s
      .trim()
      .replace(/^[A-Z][A-Z0-9]{1,5}:\s*/, "")
      .toLowerCase();
    for (const w in ORD) x = x.replace(new RegExp(`\\b${w}\\b`, "g"), ORD[w]);
    const seasonM = x.match(/(\d+)\s*(?:st|nd|rd|th)?\s*season|season\s*(\d+)/);
    const partM = x.match(/(\d+)\s*(?:st|nd|rd|th)?\s*(?:part|cour)|(?:part|cour)\s*(\d+)/);
    const seasonNum = seasonM ? seasonM[1] ?? seasonM[2] ?? "" : "";
    const partNum = partM ? partM[1] ?? partM[2] ?? "" : "";
    const trailNum = !seasonNum && !partNum ? x.match(/\s(\d{1,2})\s*$/)?.[1] ?? "" : "";
    const num = [seasonNum, partNum].filter(Boolean).join("p") || trailNum;
    const base = x
      .replace(/\d+\s*(?:st|nd|rd|th)?\s*(?:season|part|cour)|(?:season|part|cour)\s*\d+/g, " ")
      .replace(/\s+\d{1,2}\s*$/, " ")
      .replace(/[^a-z0-9]+/g, "")
      .replace(/ou/g, "o")
      .replace(/oo/g, "o")
      .replace(/uu/g, "u");
    return num ? `${base}#${num}` : base;
  };
  const byName = new Map<string, FranchiseEntry>();
  for (const e of [...items.values(), ...anilistEntries]) {
    const key = norm(e.meta.name);
    if (!key) continue;
    const prev = byName.get(key);
    if (!prev || score(e) > score(prev)) byName.set(key, e);
  }
  const survivors = Array.from(byName.values()).filter(
    (e) => e.isCurrent || e.isUpcoming || !!e.startDate || (e.episodeCount ?? 0) > 0,
  );
  const resolved: FranchiseEntry[] = [];
  const seenId = new Set<string>();
  for (const e of survivors) {
    let id = e.meta.id;
    if (parseKitsuId(id) == null) {
      const ext = id.match(/^(anilist|mal|anidb):(\d+)$/);
      if (ext) {
        const source = ext[1] === "mal" ? "myanimelist" : ext[1];
        const k = await externalToKitsu(source, Number(ext[2])).catch(() => null);
        if (k != null) id = `kitsu:${k}`;
      }
    }
    if (seenId.has(id)) continue;
    seenId.add(id);
    resolved.push(id === e.meta.id ? e : { ...e, meta: { ...e.meta, id } });
  }
  return resolved.sort((a, b) => {
    const ad = a.startDate ?? "9999";
    const bd = b.startDate ?? "9999";
    return ad.localeCompare(bd);
  });
}

export type FranchiseTag = { kind: "season" | "movie"; seasonNum: number; short: string };

const SHORT_SUBTYPES = new Set(["ona", "ova", "special", "music"]);

export function isFranchiseExtra(f: FranchiseEntry): boolean {
  if (f.meta.type === "movie") return true;
  const sub = (f.subtype ?? "").toLowerCase();
  if (SHORT_SUBTYPES.has(sub)) return true;
  const airingSeason = f.meta.type === "series" && (f.isCurrent || f.isUpcoming);
  return (f.episodeCount ?? 0) === 1 && !airingSeason;
}

export function franchiseTags(franchise: FranchiseEntry[]): FranchiseTag[] {
  let s = 0;
  return franchise.map((f) => {
    if (isFranchiseExtra(f)) {
      return { kind: "movie", seasonNum: 0, short: "MOV" };
    }
    s += 1;
    return { kind: "season", seasonNum: s, short: `S${s}` };
  });
}

const FRANCHISE_CAST_CACHE = new Map<string, CastEntry[]>();

export async function animeDetails(
  settings: Settings,
  meta: Meta,
): Promise<AnimeDetailResult | null> {
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

  let anime = await kitsuAnime(kitsuId);
  if (anime && SIDE_ENTRY_SUBTYPES.has((anime.subtype ?? "").toLowerCase())) {
    const mainTv = await kitsuMainTvSeries(kitsuId).catch(() => null);
    if (mainTv != null && mainTv !== kitsuId) {
      const mainAnime = await kitsuAnime(mainTv);
      if (mainAnime) {
        kitsuId = mainTv;
        anime = mainAnime;
      }
    }
  }
  const addonMeta = await animeKitsuMeta(`kitsu:${kitsuId}`).catch(() => null);
  if (!anime) return null;

  const franchisePromise = buildFranchise(kitsuId, anime).catch(() => [] as FranchiseEntry[]);

  const slugify = (s: string) =>
    s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const effectiveSlugs =
    anime.genreSlugs.length > 0 ? anime.genreSlugs : anime.genres.map(slugify).filter(Boolean);

  const [kitsuRawEpisodes, characters, related, studios, streamers, genreSimilar, aniZip, anilistRecs, tvdbEpsRaw] =
    await Promise.all([
      kitsuEpisodes(kitsuId, 100),
      kitsuCharacters(kitsuId, 30),
      kitsuRelated(kitsuId),
      kitsuStudios(kitsuId),
      kitsuStreamingLinks(kitsuId),
      effectiveSlugs.length > 0
        ? kitsuSimilarByGenres(effectiveSlugs, kitsuId, 34)
        : Promise.resolve([] as Meta[]),
      aniZipByKitsuWithFallback(kitsuId).catch(() => null),
      kitsuToAnilist(kitsuId)
        .then((aid) => (aid ? anilistRecommendations(aid) : []))
        .catch(() => [] as Meta[]),
      kitsuToTvdb(kitsuId)
        .then((tid) => {
          if (!tid) return null;
          const lang = tvdbLangFromIso1(settings.tmdbLanguage || settings.uiLanguage);
          return Promise.all([
            tvdbEpisodesByType(settings.tvdbKey ?? "", tid, "default", lang),
            tvdbEpisodesAbsolute(settings.tvdbKey ?? "", tid, lang)
          ]).then(([def, abs]) => {
            const all = [...def, ...abs];
            const unique = new Map(all.map(e => [e.id, e]));
            return Array.from(unique.values());
          });
        })
        .catch(() => null),
    ]);

  const episodes = buildKitsuEpisodes(addonMeta, kitsuRawEpisodes);
  mergeAniZipEpisodes(episodes, aniZip);
  mergeTvdbEpisodes(episodes, tvdbEpsRaw);

  let seriesImdb = aniZip?.mappings?.imdb_id ?? episodes.find((e) => e.imdbId)?.imdbId ?? null;
  if (!seriesImdb) seriesImdb = await kitsuToImdb(kitsuId).catch(() => null);

  if (seriesImdb?.startsWith("tt")) {
    for (const ep of episodes) {
      if (ep.thumbnailFallback) continue;
      const s = ep.imdbSeason ?? 1;
      const e = ep.imdbEpisode ?? ep.absoluteNumber ?? ep.number;
      ep.thumbnailFallback = `https://episodes.metahub.space/${seriesImdb}/${s}/${e}/w780.jpg`;
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
  const poolNames = new Set<string>();
  for (const m of [...anilistRecs, ...genreSimilar]) {
    const nameKey = m.name.trim().toLowerCase();
    if (franchiseIds.has(m.id) || poolSeen.has(m.id) || poolNames.has(nameKey)) continue;
    poolSeen.add(m.id);
    poolNames.add(nameKey);
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
    status: anime.status ? STATUS_LABELS[anime.status] ?? anime.status : "",
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

  const anilistArtPromise: Promise<{ banner?: string; cover?: string }> = kitsuToAnilist(kitsuId)
    .then((aid) => (aid ? anilistArtById(aid) : {}))
    .catch(() => ({}));

  const firstArtBatch = Promise.all([
    settings.tmdbKey
      ? tmdbAnimeLogo(settings.tmdbKey, anime.title, anime.year, kind).catch(() => null)
      : Promise.resolve(null),
    settings.fanartKey && kind === "tv" ? kitsuToTvdb(kitsuId).catch(() => null) : Promise.resolve(null),
    fetchTvdbArtwork({ kitsuId }).catch(() => null),
  ]);

  const heroBgPromise: Promise<string | undefined> = Promise.all([firstArtBatch, anilistArtPromise])
    .then(([[tmdbHit, , tvdbArt], aniArt]) =>
      aniArt.banner ?? anime.backdrop ?? tmdbHit?.backdrop ?? tvdbArt?.backgrounds?.[0],
    )
    .catch(() => anime.backdrop);

  const extrasPromise: Promise<AnimeDetailExtras> = (async () => {
    const [tmdbHit, tvdbId, tvdbArt] = await firstArtBatch;
    const aniArt = await anilistArtPromise;
    let logo: string | undefined = addonMeta?.logo ?? tvdbArt?.clearLogos?.[0] ?? tmdbHit?.logo ?? undefined;
    let poster = anime.poster;
    const backdrop = aniArt.banner ?? anime.backdrop;
    const gallery: string[] = [];
    const addBackdrop = (b?: string | null) => {
      if (b && !gallery.includes(b)) gallery.push(b);
    };
    addBackdrop(backdrop);
    addBackdrop(anime.backdrop);
    addBackdrop(tmdbHit?.backdrop);
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
      if (!logo && fa.logo) logo = fa.logo;
      if (fa.poster) poster = fa.poster;
      for (const b of fa.backdrops) addBackdrop(b);
    }
    for (const b of tvdbArt?.backgrounds ?? []) addBackdrop(b);
    const backdrops = gallery;
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

  return {
    detail,
    episodes,
    streamers,
    backdrops: anime.backdrop ? [anime.backdrop] : [],
    imdbId: addonMeta?.imdb_id,
    franchisePromise,
    enrichPromise,
    extrasPromise,
    heroBgPromise,
    kitsuId,
  };
}
