import type { Meta } from "../../cinemeta";
import { get, IMG, effectiveTmdbLanguage } from "./tmdb-client";
import { loadStoredSettings } from "@/lib/settings/load";
import { pickLogo, fetchMovieAssets } from "./tmdb-images";
import { imageLangParam, imageLangRank } from "./tmdb-image-lang";
import { pickTrailers, type Video } from "./tmdb-trailers";
import type { PersonRef } from "./tmdb-people";
import { genresFromIds } from "./tmdb-meta-mappers";

export type CastEntry = {
  id: number;
  name: string;
  character: string;
  profilePath: string | null;
  order: number;
};

export type CrewEntry = {
  id: number;
  name: string;
  job: string;
  department: string;
  profilePath: string | null;
};

export type Season = {
  id: number;
  seasonNumber: number;
  name: string;
  overview: string;
  posterPath: string | null;
  episodeCount: number;
  airDate: string | null;
};

export type Episode = {
  id: number;
  episodeNumber: number;
  seasonNumber: number;
  name: string;
  overview: string;
  stillPath: string | null;
  stillUrl?: string;
  airDate: string | null;
  runtime: number | null;
  voteAverage: number | null;
  imdbRating?: number | null;
};

export type ExtraVideo = {
  ytId: string;
  name: string;
  type: string;
};

export type GalleryImages = {
  backdrops: string[];
  posters: string[];
  logos: string[];
};

export type TmdbDetail = {
  kind: "movie" | "tv";
  id: number;
  imdbId: string | null;
  title: string;
  originalTitle: string;
  tagline: string;
  overview: string;
  poster?: string;
  backdrop?: string;
  logo?: string;
  year?: string;
  rating?: string;
  voteCount: number;
  runtime?: string;
  status: string;
  genres: string[];
  genresRich?: Array<{ id: number; name: string }>;
  originalLanguage: string;
  spokenLanguages: string[];
  productionCountries: string[];
  productionCompanies: string[];
  networks: string[];
  productionCompaniesRich: Array<{ id: number; name: string }>;
  productionCountriesRich: Array<{ iso: string; name: string }>;
  spokenLanguagesRich: Array<{ iso: string; name: string }>;
  networksRich: Array<{ id: number; name: string }>;
  trailerYtId: string | null;
  trailerCandidates: string[];
  extraVideos: ExtraVideo[];
  gallery: GalleryImages;
  cast: CastEntry[];
  crew: CrewEntry[];
  directors: PersonRef[];
  writers: PersonRef[];
  creators: PersonRef[];
  producers: PersonRef[];
  composer: PersonRef[];
  cinematography: PersonRef[];
  editor: PersonRef[];
  recommendations: Meta[];
  similar: Meta[];
  collection?: { id: number; name: string } | null;
  seasons: Season[];
  numberOfSeasons: number;
  numberOfEpisodes: number;
  keywords: number[];
  firstAirDate?: string;
  lastAirDate?: string;
  releaseDate?: string;
  lastEpisodeAir?: { seasonNumber: number; airDate: string | null };
  budget?: number;
  revenue?: number;
  homepage?: string;
};

const WRITER_JOBS = new Set([
  "Writer",
  "Screenplay",
  "Story",
  "Teleplay",
  "Author",
  "Novel",
  "Original Story",
  "Original Series Creator",
]);
const PRODUCER_JOBS = new Set(["Producer", "Executive Producer"]);

type RawImageEntry = { file_path?: string; vote_average?: number };

function urlsFromImages(entries: RawImageEntry[] | undefined, size: string, max: number): string[] {
  if (!entries?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of [...entries].sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0))) {
    if (!e.file_path || seen.has(e.file_path)) continue;
    seen.add(e.file_path);
    out.push(`${IMG}/${size}${e.file_path}`);
    if (out.length >= max) break;
  }
  return out;
}

function buildGallery(images: any, heroLogo: string | undefined): GalleryImages {
  const logos = urlsFromImages(images?.logos, "w500", 12).filter((u) => u !== heroLogo);
  return {
    backdrops: urlsFromImages(images?.backdrops, "w780", 24),
    posters: urlsFromImages(images?.posters, "w342", 24),
    logos,
  };
}

const uniqByName = (entries: Array<{ id: number; name: string }>): PersonRef[] => {
  const seen = new Set<string>();
  const out: PersonRef[] = [];
  for (const e of entries) {
    if (seen.has(e.name)) continue;
    seen.add(e.name);
    out.push({ id: e.id, name: e.name });
  }
  return out;
};

export async function tmdbDetails(key: string, meta: Meta): Promise<TmdbDetail | null> {
  if (!key) return null;
  let kind: "movie" | "tv";
  let id: string;
  if (meta.id.startsWith("tmdb:movie:")) {
    kind = "movie";
    id = meta.id.slice("tmdb:movie:".length);
  } else if (meta.id.startsWith("tmdb:tv:")) {
    kind = "tv";
    id = meta.id.slice("tmdb:tv:".length);
  } else if (meta.id.startsWith("tt")) {
    const find = await get<any>(key, `find/${meta.id}`, { external_source: "imdb_id" });
    if (!find) return null;
    if (meta.type === "movie" && find.movie_results?.[0]) {
      kind = "movie";
      id = String(find.movie_results[0].id);
    } else if (meta.type === "series" && find.tv_results?.[0]) {
      kind = "tv";
      id = String(find.tv_results[0].id);
    } else {
      return null;
    }
  } else {
    return null;
  }

  const settings = loadStoredSettings();
  const metaLang = effectiveTmdbLanguage() || "en";
  const raw = await get<any>(key, `${kind}/${id}`, {
    append_to_response:
      "credits,aggregate_credits,recommendations,similar,videos,external_ids,images,keywords,translations",
    language: metaLang,
    include_image_language: imageLangParam(),
  });
  if (!raw) return null;

  const origLang = typeof raw.original_language === "string" ? raw.original_language : "";
  let logo = pickLogo(raw.images?.logos ?? [], origLang);
  let posterSource = raw.images?.posters;
  if (!logo && origLang && !imageLangParam().split(",").includes(origLang)) {
    const assets = await fetchMovieAssets(key, `tmdb:${kind}:${id}`, origLang);
    if (assets) {
      logo = pickLogo(assets.logos ?? [], origLang);
      posterSource = assets.posters ?? posterSource;
    }
  }
  const rawKeywords = raw.keywords?.keywords ?? raw.keywords?.results ?? [];
  const keywords: number[] = rawKeywords
    .map((k: any) => k?.id)
    .filter((id: unknown): id is number => typeof id === "number");

  const videos: Video[] = raw.videos?.results ?? [];
  const trailerCandidates = pickTrailers(videos);
  const trailerYtId = trailerCandidates[0] ?? null;
  const candidateSet = new Set(trailerCandidates);
  const extraVideos: ExtraVideo[] = videos
    .filter((v) => v.site === "YouTube" && !candidateSet.has(v.key))
    .slice(0, 12)
    .map((v) => ({ ytId: v.key, name: (v as any).name ?? v.type, type: v.type }));

  const gallery = buildGallery(raw.images, logo);

  const aggCast: any[] = raw.aggregate_credits?.cast ?? [];
  const flatCast: any[] = raw.credits?.cast ?? [];
  const castSrc = aggCast.length > 0 ? aggCast : flatCast;
  const cast: CastEntry[] = castSrc.map((c: any) => ({
    id: c.id,
    name: c.name,
    character:
      c.character ??
      (c.roles?.length
        ? c.roles
            .map((r: any) => r.character)
            .filter(Boolean)
            .join(", ")
        : ""),
    profilePath: c.profile_path ?? null,
    order: c.order ?? 999,
  }));

  const aggCrew: any[] = raw.aggregate_credits?.crew ?? [];
  const flatCrew: any[] = raw.credits?.crew ?? [];
  const crewSrc = aggCrew.length > 0 ? aggCrew : flatCrew;
  const crew: CrewEntry[] = crewSrc.map((c: any) => ({
    id: c.id,
    name: c.name,
    job: c.job ?? c.jobs?.[0]?.job ?? "",
    department: c.department ?? "",
    profilePath: c.profile_path ?? null,
  }));

  const jobsOf = (e: any): string[] =>
    e.jobs?.length ? e.jobs.map((j: any) => j.job).filter(Boolean) : e.job ? [e.job] : [];
  const byJob = (test: (job: string) => boolean) =>
    uniqByName(crewSrc.filter((c: any) => jobsOf(c).some(test)));

  const directors = byJob((j) => j === "Director");
  const writers = byJob((j) => WRITER_JOBS.has(j));
  const producers = byJob((j) => PRODUCER_JOBS.has(j));
  const composer = byJob((j) => j === "Original Music Composer" || j === "Music");
  const cinematography = byJob((j) => j === "Director of Photography" || j === "Cinematography");
  const editor = byJob((j) => j === "Editor");
  const creators: PersonRef[] = (raw.created_by ?? []).map((c: any) => ({
    id: c.id,
    name: c.name,
  }));

  const toMeta = (r: any): Meta => ({
    id: kind === "movie" ? `tmdb:movie:${r.id}` : `tmdb:tv:${r.id}`,
    type: kind === "movie" ? "movie" : "series",
    name: r.title ?? r.name,
    poster: r.poster_path ? `${IMG}/w342${r.poster_path}` : undefined,
    background: r.backdrop_path ? `${IMG}/w780${r.backdrop_path}` : undefined,
    description: r.overview,
    releaseInfo: (r.release_date ?? r.first_air_date)?.slice(0, 4),
    releaseDate: r.release_date ?? r.first_air_date,
    imdbRating: r.vote_average > 0 ? Number(r.vote_average).toFixed(1) : undefined,
    adult: r.adult,
    genres: genresFromIds(r.genre_ids, kind),
  });

  const recommendations: Meta[] = (raw.recommendations?.results ?? []).map(toMeta);
  const similar: Meta[] = (raw.similar?.results ?? []).map(toMeta);

  const seasons: Season[] = (raw.seasons ?? [])
    .filter((s: any) => s.season_number > 0 && (s.episode_count ?? 0) > 0)
    .sort((a: any, b: any) => a.season_number - b.season_number)
    .map((s: any) => ({
      id: s.id,
      seasonNumber: s.season_number,
      name: s.name,
      overview: s.overview ?? "",
      posterPath: s.poster_path ?? null,
      episodeCount: s.episode_count ?? 0,
      airDate: s.air_date ?? null,
    }));

  const runtime =
    kind === "movie"
      ? raw.runtime
        ? `${raw.runtime} min`
        : undefined
      : raw.episode_run_time?.[0]
        ? `${raw.episode_run_time[0]} min episodes`
        : seasons.length > 0
          ? `${seasons.length} season${seasons.length === 1 ? "" : "s"}`
          : undefined;

  let overview = raw.overview ?? "";
  let tagline = raw.tagline ?? "";
  if (!settings.translateDescriptions) {
    const enTrans = raw.translations?.translations?.find((t: any) => t.iso_639_1 === "en")?.data;
    if (enTrans?.overview) overview = enTrans.overview;
    if (enTrans?.tagline) tagline = enTrans.tagline;
  }

  let finalPosterPath = raw.poster_path;
  if (!settings.posterBaseUrl && posterSource?.length) {
    const best = [...posterSource].sort(
      (a: any, b: any) =>
        imageLangRank(b.iso_639_1, origLang) - imageLangRank(a.iso_639_1, origLang) ||
        (b.vote_average ?? 0) - (a.vote_average ?? 0),
    )[0];
    if (best) finalPosterPath = best.file_path;
  }

  return {
    kind,
    id: raw.id,
    imdbId: raw.external_ids?.imdb_id ?? null,
    title: settings.translateTitles
      ? raw.title || raw.name
      : raw.original_title || raw.original_name || raw.title || raw.name,
    originalTitle: raw.original_title ?? raw.original_name ?? "",
    tagline,
    overview,
    poster: finalPosterPath ? `${IMG}/w342${finalPosterPath}` : undefined,
    backdrop: raw.backdrop_path ? `${IMG}/original${raw.backdrop_path}` : undefined,
    logo,
    year: (raw.release_date ?? raw.first_air_date)?.slice(0, 4),
    rating: raw.vote_average > 0 ? Number(raw.vote_average).toFixed(1) : undefined,
    voteCount: raw.vote_count ?? 0,
    runtime,
    status: raw.status ?? "",
    genres: (raw.genres ?? []).map((g: any) => g.name),
    genresRich: (raw.genres ?? [])
      .filter((g: any) => typeof g?.id === "number" && g?.name)
      .map((g: any) => ({ id: g.id as number, name: g.name as string })),
    originalLanguage: (raw.original_language ?? "").toUpperCase(),
    spokenLanguages: (raw.spoken_languages ?? []).map((l: any) => l.english_name ?? l.name),
    productionCountries: (raw.production_countries ?? []).map((c: any) => c.name),
    productionCompanies: (raw.production_companies ?? []).map((c: any) => c.name),
    networks: (raw.networks ?? []).map((n: any) => n.name),
    productionCompaniesRich: (raw.production_companies ?? [])
      .filter((c: any) => typeof c?.id === "number")
      .map((c: any) => ({ id: c.id, name: c.name })),
    productionCountriesRich: (raw.production_countries ?? [])
      .filter((c: any) => typeof c?.iso_3166_1 === "string")
      .map((c: any) => ({ iso: c.iso_3166_1, name: c.name })),
    spokenLanguagesRich: (raw.spoken_languages ?? [])
      .filter((l: any) => typeof l?.iso_639_1 === "string")
      .map((l: any) => ({ iso: l.iso_639_1, name: l.english_name ?? l.name })),
    networksRich: (raw.networks ?? [])
      .filter((n: any) => typeof n?.id === "number")
      .map((n: any) => ({ id: n.id, name: n.name })),
    trailerYtId,
    trailerCandidates,
    extraVideos,
    gallery,
    cast,
    crew,
    directors,
    writers,
    creators,
    producers,
    composer,
    cinematography,
    editor,
    recommendations,
    similar,
    collection: raw.belongs_to_collection
      ? { id: raw.belongs_to_collection.id, name: raw.belongs_to_collection.name ?? "" }
      : null,
    seasons,
    numberOfSeasons: raw.number_of_seasons ?? 0,
    numberOfEpisodes: raw.number_of_episodes ?? 0,
    keywords,
    firstAirDate: raw.first_air_date,
    lastAirDate: raw.last_air_date,
    releaseDate: raw.release_date,
    lastEpisodeAir: raw.last_episode_to_air
      ? {
          seasonNumber: raw.last_episode_to_air.season_number,
          airDate: raw.last_episode_to_air.air_date ?? null,
        }
      : undefined,
    budget: raw.budget,
    revenue: raw.revenue,
    homepage: raw.homepage,
  };
}

export async function tmdbSeasonEpisodes(
  key: string,
  tvId: number,
  seasonNumber: number,
): Promise<Episode[]> {
  if (!key) return [];
  const data = await get<any>(key, `tv/${tvId}/season/${seasonNumber}`, {
    language: effectiveTmdbLanguage() || "en",
  });
  if (!data?.episodes) return [];
  return data.episodes.map((e: any) => ({
    id: e.id,
    episodeNumber: e.episode_number,
    seasonNumber: e.season_number,
    name: e.name ?? "",
    overview: e.overview ?? "",
    stillPath: e.still_path ?? null,
    airDate: e.air_date ?? null,
    runtime: e.runtime ?? null,
    voteAverage: e.vote_average ?? null,
  }));
}
