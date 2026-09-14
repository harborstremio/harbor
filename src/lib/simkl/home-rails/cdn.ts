import { safeFetch } from "@/lib/safe-fetch";
import { SIMKL_APP_NAME, SIMKL_APP_VERSION, SIMKL_CLIENT_ID } from "../config";
import type { SimklItem } from "../types";

export interface SimklCdnItem {
  title: string;
  poster?: string;
  date: string;
  release_date?: string;
  ids?: {
    simkl_id?: number;
    slug?: string;
    tmdb?: string | number;
    imdb?: string;
    mal?: string | number;
    kitsu?: string | number;
  };
  episode?: {
    season?: number;
    episode?: number;
  };
}

const APP_QS = `client_id=${SIMKL_CLIENT_ID}&app-name=${SIMKL_APP_NAME}&app-version=${SIMKL_APP_VERSION}`;
const UA = `${SIMKL_APP_NAME}/${SIMKL_APP_VERSION}`;

let cachedTrending: SimklItem[] | null = null;
let cachedTrendingTime = 0;
const TRENDING_CACHE_DURATION = 60 * 60 * 1000;

export async function fetchSimklTrending(): Promise<SimklItem[]> {
  const now = Date.now();
  if (cachedTrending && now - cachedTrendingTime < TRENDING_CACHE_DURATION) {
    return cachedTrending;
  }

  const url = `https://data.simkl.in/discover/trending/today_100.json?${APP_QS}`;
  try {
    const res = await safeFetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return cachedTrending || [];
    const data = (await res.json()) as {
      tv?: any[];
      movies?: any[];
      anime?: any[];
    };

    const tv = data.tv || [];
    const movies = data.movies || [];
    const anime = data.anime || [];

    const items: SimklItem[] = [];
    const maxLen = Math.max(tv.length, movies.length, anime.length);

    for (let i = 0; i < maxLen; i++) {
      if (i < tv.length) {
        const x = tv[i];
        items.push({
          type: "show",
          title: x.title,
          year: x.release_date ? parseInt(x.release_date.split("/").pop() || "", 10) || null : null,
          ids: {
            simkl: x.ids?.simkl_id,
            imdb: x.ids?.imdb || undefined,
            tmdb: x.ids?.tmdb ? Number(x.ids.tmdb) : undefined,
            tvdb: x.ids?.tvdb ? Number(x.ids.tvdb) : undefined,
          },
        });
      }
      if (i < movies.length) {
        const x = movies[i];
        items.push({
          type: "movie",
          title: x.title,
          year: x.release_date ? parseInt(x.release_date.split("/").pop() || "", 10) || null : null,
          ids: {
            simkl: x.ids?.simkl_id,
            imdb: x.ids?.imdb || undefined,
            tmdb: x.ids?.tmdb ? Number(x.ids.tmdb) : undefined,
            tvdb: x.ids?.tvdb ? Number(x.ids.tvdb) : undefined,
          },
        });
      }
      if (i < anime.length) {
        const x = anime[i];
        items.push({
          type: x.anime_type === "movie" ? "movie" : "show",
          title: x.title,
          year: x.release_date ? parseInt(x.release_date.split("/").pop() || "", 10) || null : null,
          ids: {
            simkl: x.ids?.simkl_id,
            imdb: x.ids?.imdb || undefined,
            tmdb: x.ids?.tmdb ? Number(x.ids.tmdb) : undefined,
            mal: x.ids?.mal ? Number(x.ids.mal) : undefined,
            kitsu: x.ids?.kitsu ? Number(x.ids.kitsu) : undefined,
            anidb: x.ids?.anidb ? Number(x.ids.anidb) : undefined,
            tvdb: x.ids?.tvdb ? Number(x.ids.tvdb) : undefined,
          },
        });
      }
    }

    cachedTrending = items;
    cachedTrendingTime = now;
    return items;
  } catch (err) {
    console.error("Failed to fetch SIMKL trending CDN", err);
    return cachedTrending || [];
  }
}

let cachedCalendar: SimklCdnItem[] | null = null;
let cachedCalendarTime = 0;
const CALENDAR_CACHE_DURATION = 30 * 60 * 1000;

export async function fetchCdnCalendarCombined(): Promise<SimklCdnItem[]> {
  const now = Date.now();
  if (cachedCalendar && now - cachedCalendarTime < CALENDAR_CACHE_DURATION) {
    return cachedCalendar;
  }

  const fetchCatalog = async (catalog: "tv" | "anime"): Promise<SimklCdnItem[]> => {
    const url = `https://data.simkl.in/calendar/v2/${catalog}.json?${APP_QS}`;
    try {
      const res = await safeFetch(url, { headers: { "User-Agent": UA } });
      if (!res.ok) return [];
      return (await res.json()) as SimklCdnItem[];
    } catch {
      return [];
    }
  };

  const [tv, anime] = await Promise.all([fetchCatalog("tv"), fetchCatalog("anime")]);
  const combined = [...tv, ...anime];
  cachedCalendar = combined;
  cachedCalendarTime = now;
  return combined;
}

export function clearCdnCache() {
  cachedTrending = null;
  cachedTrendingTime = 0;
  cachedCalendar = null;
  cachedCalendarTime = 0;
}
