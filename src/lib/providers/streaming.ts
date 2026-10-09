import type { Meta } from "../cinemeta";
import type { Settings, StreamingService } from "../settings";
import { get } from "./tmdb/tmdb-client";

const IMG = "https://image.tmdb.org/t/p";

type Service = {
  id: number;
  providerIds?: number[];
  name: string;
  logo: string;
  tint: string;
  logoHeight?: number;
  logoFilter?: string;
};

const FORCE_WHITE = "brightness(0) invert(1)";

export const SERVICES: Record<StreamingService, Service> = {
  netflix: { id: 8, name: "Netflix", logo: "/services/netflix.svg", tint: "#E50914" },
  disney: {
    id: 337,
    name: "Disney+",
    logo: "/services/disney.svg",
    tint: "#0E47A1",
    logoHeight: 46,
    logoFilter: FORCE_WHITE,
  },
  hulu: { id: 15, name: "Hulu", logo: "/services/hulu.svg", tint: "#1CE783" },
  prime: { id: 9, providerIds: [9, 119], name: "Prime Video", logo: "/services/prime.svg", tint: "#00A8E1" },
  apple: { id: 350, name: "Apple TV+", logo: "/services/apple.svg", tint: "#FFFFFF" },
  max: { id: 1899, providerIds: [1899, 384], name: "Max", logo: "/services/max.svg", tint: "#9B6CFF" },
  paramount: {
    id: 531,
    providerIds: [531, 582, 1715, 1854],
    name: "Paramount+",
    logo: "/services/paramount.svg",
    tint: "#0064FF",
  },
  peacock: { id: 386, providerIds: [386, 387], name: "Peacock", logo: "/services/peacock.svg", tint: "#FF7112" },
  crunchyroll: { id: 283, name: "Crunchyroll", logo: "/services/crunchyroll.svg", tint: "#F47521" },
  amcplus: { id: 526, name: "AMC+", logo: "/services/amcplus.svg", tint: "#0A9BD8" },
  starz: { id: 43, name: "STARZ", logo: "/services/starz.svg", tint: "#FFFFFF" },
  shudder: { id: 99, name: "Shudder", logo: "/services/shudder.svg", tint: "#E4181C" },
  tubi: { id: 73, name: "Tubi", logo: "/services/tubi.svg", tint: "#7C3AED" },
  plutotv: { id: 300, name: "Pluto TV", logo: "/services/plutotv.svg", tint: "#2B2D7C" },
  roku: { id: 207, name: "The Roku Channel", logo: "/services/roku.svg", tint: "#662D91" },
  fubo: { id: 257, name: "Fubo", logo: "/services/fubo.svg", tint: "#FA4616" },
  mgmplus: { id: 34, providerIds: [34, 583, 636], name: "MGM+", logo: "/services/mgmplus.svg", tint: "#C6A15B" },
  philo: { id: 2383, name: "Philo", logo: "/services/philo.svg", tint: "#E5177E" },
  britbox: { id: 151, name: "BritBox", logo: "/services/britbox.svg", tint: "#163BD6" },
  acorntv: { id: 87, name: "Acorn TV", logo: "/services/acorntv.svg", tint: "#6E9F4B" },
  mubi: { id: 11, name: "MUBI", logo: "/services/mubi.svg", tint: "#2563C9" },
  curiositystream: { id: 190, name: "CuriosityStream", logo: "/services/curiositystream.svg", tint: "#0089CF" },
  kanopy: { id: 191, name: "Kanopy", logo: "/services/kanopy.png", tint: "#E4552A" },
  hoopla: { id: 212, name: "Hoopla", logo: "/services/hoopla.svg", tint: "#0077C8" },
  pbs: { id: 209, name: "PBS", logo: "/services/pbs.svg", tint: "#2638C4" },
  cw: { id: 83, name: "The CW", logo: "/services/cw.svg", tint: "#2BA84A" },
  hidive: { id: 430, name: "HIDIVE", logo: "/services/hidive.png", tint: "#00AEEF" },
};

export function providerIdsFor(svc: Service): string {
  const ids = svc.providerIds ?? [svc.id];
  return ids.join("|");
}

export function serviceBadge(svc: StreamingService): { name: string; logo: string; tint: string } {
  const s = SERVICES[svc];
  return { name: s.name, logo: s.logo, tint: s.tint };
}

type RawMovie = {
  id: number;
  title: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  vote_average?: number;
};

type RawSeries = {
  id: number;
  name: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  first_air_date?: string;
  vote_average?: number;
};

const poster = (p?: string | null) => (p ? `${IMG}/w342${p}` : undefined);
const back = (p?: string | null) => (p ? `${IMG}/w780${p}` : undefined);
const year = (s?: string) => (s ? s.slice(0, 4) : undefined);
const rating = (v?: number) => (v && v > 0 ? v.toFixed(1) : undefined);

async function discover<T>(
  key: string,
  kind: "movie" | "tv",
  providerIds: string,
  region: string,
): Promise<T[]> {
  const data = await get<{ results?: T[] }>(key, `discover/${kind}`, {
    with_watch_providers: providerIds,
    watch_region: region || "US",
    with_watch_monetization_types: "flatrate",
    "vote_count.gte": "300",
    sort_by: "popularity.desc",
  });
  return data?.results ?? [];
}

const POSTER_CAP = 40;

export async function servicePosters(
  key: string,
  service: StreamingService,
  region: string,
): Promise<string[]> {
  if (!key) return [];
  const providers = providerIdsFor(SERVICES[service]);
  const [movies, series] = await Promise.all([
    discover<RawMovie>(key, "movie", providers, region),
    discover<RawSeries>(key, "tv", providers, region),
  ]);
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (p?: string) => {
    if (!p || seen.has(p) || out.length >= POSTER_CAP) return;
    seen.add(p);
    out.push(p);
  };
  const max = Math.max(movies.length, series.length);
  for (let i = 0; i < max && out.length < POSTER_CAP; i += 1) {
    const m = movies[i];
    const s = series[i];
    if (m) push(poster(m.poster_path));
    if (s) push(poster(s.poster_path));
  }
  return out;
}

export type ServiceRow = { service: StreamingService; name: string; metas: Meta[] };

export async function streamingRows(settings: Settings): Promise<ServiceRow[]> {
  if (!settings.tmdbKey) return [];
  const enabled = (Object.keys(SERVICES) as StreamingService[]).filter((s) => settings.streaming[s]);
  const tasks = enabled.map(async (svc): Promise<ServiceRow> => {
    const { name } = SERVICES[svc];
    const providers = providerIdsFor(SERVICES[svc]);
    const [movies, series] = await Promise.all([
      discover<RawMovie>(settings.tmdbKey, "movie", providers, settings.region),
      discover<RawSeries>(settings.tmdbKey, "tv", providers, settings.region),
    ]);
    const movieMetas: Meta[] = movies.slice(0, 12).map((m) => ({
      id: `tmdb:movie:${m.id}`,
      type: "movie",
      name: m.title,
      poster: poster(m.poster_path),
      background: back(m.backdrop_path),
      description: m.overview,
      releaseInfo: year(m.release_date),
      releaseDate: m.release_date,
      imdbRating: rating(m.vote_average),
    }));
    const seriesMetas: Meta[] = series.slice(0, 12).map((s) => ({
      id: `tmdb:tv:${s.id}`,
      type: "series",
      name: s.name,
      poster: poster(s.poster_path),
      background: back(s.backdrop_path),
      description: s.overview,
      releaseInfo: year(s.first_air_date),
      releaseDate: s.first_air_date,
      imdbRating: rating(s.vote_average),
    }));
    const interleaved: Meta[] = [];
    const max = Math.max(movieMetas.length, seriesMetas.length);
    for (let i = 0; i < max; i++) {
      if (movieMetas[i]) interleaved.push(movieMetas[i]);
      if (seriesMetas[i]) interleaved.push(seriesMetas[i]);
    }
    return { service: svc, name, metas: interleaved };
  });
  const rows = await Promise.all(tasks);
  return rows.filter((r) => r.metas.length > 0);
}
