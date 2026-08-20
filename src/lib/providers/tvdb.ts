import { lruSet } from "@/lib/cache";
import { registerCache } from "@/lib/memory-profiler";
import { safeFetch as tauriFetch } from "@/lib/safe-fetch";
import { HARBOR_TVDB_BASE } from "@/lib/config/endpoints";

const BASE = "https://api4.thetvdb.com/v4";
const PROXY_V4 = `${HARBOR_TVDB_BASE}/api/tvdb/v4`;
const TOKEN_KEY = "harbor.tvdb.token.v1";
const TOKEN_TTL_MS = 23 * 60 * 60 * 1000;

function tvdbImg(v: unknown): string | undefined {
  if (typeof v !== "string" || !v) return undefined;
  if (v.startsWith("http")) return v;
  return `https://artworks.thetvdb.com${v.startsWith("/") ? "" : "/"}${v}`;
}

function isDisplayableName(s: string): boolean {
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    if (
      (c >= 0x3040 && c <= 0x30ff) ||
      (c >= 0x3400 && c <= 0x9fff) ||
      (c >= 0xac00 && c <= 0xd7af)
    )
      return false;
  }
  return true;
}

type TokenCache = { token: string; t: number; key: string };

type SearchHit = {
  tvdb_id?: string;
  name?: string;
  type?: string;
  series?: { id?: number; name?: string };
  movie?: { id?: number; name?: string };
};

function seriesIdFromRemote(data: SearchHit[]): number | null {
  const hit =
    data.find((h) => h.series?.id != null) ?? data.find((h) => h.type === "series") ?? data[0];
  const raw = hit?.series?.id ?? hit?.tvdb_id;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export type TvdbEpisode = {
  id: number;
  number: number;
  seasonNumber: number;
  absoluteNumber?: number;
  name?: string;
  overview?: string;
  aired?: string;
  runtime?: number;
  image?: string;
  imdbId?: string;
};

export type TvdbSeries = {
  id: number;
  name: string;
  slug?: string;
  overview?: string;
  network?: string;
  status?: string;
  firstAired?: string;
  lastAired?: string;
  averageRuntime?: number;
  aliases: string[];
  originalLanguage?: string;
  originalCountry?: string;
};

let tokenInflight: Promise<string | null> | null = null;
let cachedToken: TokenCache | null = null;

function loadCachedToken(): TokenCache | null {
  if (cachedToken) return cachedToken;
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    cachedToken = JSON.parse(raw) as TokenCache;
    return cachedToken;
  } catch {
    return null;
  }
}

function saveCachedToken(tc: TokenCache) {
  cachedToken = tc;
  try {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(tc));
  } catch {
    /* ignore */
  }
}

async function getToken(apiKey: string): Promise<string | null> {
  if (!apiKey) return null;
  const cached = loadCachedToken();
  if (cached && cached.key === apiKey && Date.now() - cached.t < TOKEN_TTL_MS) {
    return cached.token;
  }
  if (tokenInflight) return tokenInflight;
  tokenInflight = (async () => {
    try {
      const res = await tauriFetch(`${BASE}/login`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ apikey: apiKey }),
      });
      if (!res.ok) return null;
      const j = (await res.json()) as { data?: { token?: string } };
      const token = j?.data?.token;
      if (!token) return null;
      saveCachedToken({ token, t: Date.now(), key: apiKey });
      return token;
    } catch {
      return null;
    } finally {
      tokenInflight = null;
    }
  })();
  return tokenInflight;
}

const RESPONSE_CACHE_MAX = 200;
const responseCache = new Map<string, unknown>();
const responseInflight = new Map<string, Promise<unknown>>();

registerCache("tvdb:response", () => responseCache.size);

async function getJson<T>(apiKey: string, path: string): Promise<T | null> {
  const useProxy = !apiKey;
  const key = `${useProxy ? "proxy" : apiKey.slice(0, 6)}::${path}`;
  if (responseCache.has(key)) return responseCache.get(key) as T;
  const existing = responseInflight.get(key);
  if (existing) return existing as Promise<T | null>;
  const p = (async (): Promise<T | null> => {
    try {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        let url: string;
        let headers: Record<string, string>;
        if (useProxy) {
          url = `${PROXY_V4}${path}`;
          headers = { accept: "application/json" };
        } else {
          const token = await getToken(apiKey);
          if (!token) return null;
          url = `${BASE}${path}`;
          headers = { authorization: `Bearer ${token}`, accept: "application/json" };
        }
        try {
          const res = await tauriFetch(url, { headers });
          if (!useProxy && res.status === 401) {
            cachedToken = null;
            try {
              localStorage.removeItem(TOKEN_KEY);
            } catch {
              /* ignore */
            }
            if (attempt === 0) continue;
            return null;
          }
          if (res.status >= 500 && attempt === 0) {
            await new Promise((r) => setTimeout(r, 350));
            continue;
          }
          if (!res.ok) return null;
          const j = (await res.json()) as { data?: T };
          const data = (j?.data ?? null) as T | null;
          if (data !== null) lruSet(responseCache, key, data, RESPONSE_CACHE_MAX);
          return data;
        } catch {
          if (attempt === 0) {
            await new Promise((r) => setTimeout(r, 350));
            continue;
          }
          return null;
        }
      }
      return null;
    } finally {
      responseInflight.delete(key);
    }
  })();
  responseInflight.set(key, p as Promise<unknown>);
  return p;
}

export async function tvdbSeriesByImdb(apiKey: string, imdbId: string): Promise<number | null> {
  if (!imdbId.startsWith("tt")) return null;
  const data = await getJson<SearchHit[]>(apiKey, `/search/remoteid/${imdbId}`);
  if (!data) return null;
  return seriesIdFromRemote(data);
}

export async function tvdbSeriesByRemote(apiKey: string, remoteId: string): Promise<number | null> {
  if (!remoteId) return null;
  const data = await getJson<SearchHit[]>(apiKey, `/search/remoteid/${remoteId}`);
  if (!data) return null;
  return seriesIdFromRemote(data);
}

export async function tvdbSeries(apiKey: string, seriesId: number): Promise<TvdbSeries | null> {
  if (!seriesId) return null;
  const data = await getJson<any>(
    apiKey,
    `/series/${seriesId}/extended?meta=translations&short=false`,
  );
  if (!data) return null;
  const aliases: string[] = Array.from(
    new Set((data.aliases ?? []).map((a: any) => a?.name).filter(Boolean) as string[]),
  );
  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    overview: data.overview,
    network: data.originalNetwork?.name ?? data.latestNetwork?.name,
    status: data.status?.name,
    firstAired: data.firstAired,
    lastAired: data.lastAired,
    averageRuntime: data.averageRuntime,
    aliases,
    originalLanguage: data.originalLanguage,
    originalCountry: data.originalCountry,
  };
}

export type TvdbOrderType =
  | "aired"
  | "dvd"
  | "absolute"
  | "tvdbabsolute"
  | "alternate"
  | "regional";
export type TvdbSeasonTypeOption = { value: TvdbOrderType; label: string };

const ORDER_PRIORITY: TvdbOrderType[] = [
  "aired",
  "dvd",
  "absolute",
  "tvdbabsolute",
  "alternate",
  "regional",
];

function defaultOrderLabel(value: TvdbOrderType): string {
  const map: Record<TvdbOrderType, string> = {
    aired: "Aired Order",
    dvd: "DVD Order",
    absolute: "Absolute Order",
    tvdbabsolute: "TVDB Absolute Order",
    alternate: "Alternate Order",
    regional: "Regional Order",
  };
  return map[value];
}

export async function tvdbSeasonTypes(
  apiKey: string,
  seriesId: number,
): Promise<TvdbSeasonTypeOption[]> {
  if (!seriesId) return [];
  const data = await getJson<any>(apiKey, `/series/${seriesId}/extended?short=true`);
  const seasons = (data?.seasons ?? []) as any[];
  const labels = new Map<TvdbOrderType, string>();
  for (const s of seasons) {
    const slug = s?.type?.type as string | undefined;
    if (!slug) continue;
    const value = (slug === "official" ? "aired" : slug) as TvdbOrderType;
    if (!ORDER_PRIORITY.includes(value)) continue;
    if (!labels.has(value))
      labels.set(value, (s?.type?.name as string) || defaultOrderLabel(value));
  }
  if (labels.has("absolute")) labels.set("tvdbabsolute", defaultOrderLabel("tvdbabsolute"));
  return ORDER_PRIORITY.filter((v) => labels.has(v)).map((v) => ({
    value: v,
    label: labels.get(v)!,
  }));
}

export async function tvdbSeasonNames(
  apiKey: string,
  seriesId: number,
  typeSlug: string,
): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (!seriesId) return map;
  const data = await getJson<any>(apiKey, `/series/${seriesId}/extended?short=true`);
  const seasons = (data?.seasons ?? []) as any[];
  for (const s of seasons) {
    if (s?.type?.type !== typeSlug) continue;
    const num = typeof s.number === "number" ? s.number : null;
    const name = typeof s.name === "string" ? s.name.trim() : "";
    if (num != null && name && isDisplayableName(name)) map.set(num, name);
  }
  return map;
}

export async function tvdbEpisodes(
  apiKey: string,
  seriesId: number,
  season: number,
  lang?: string,
): Promise<TvdbEpisode[]> {
  if (!seriesId) return [];
  const langSeg = lang ? `&language=${lang}` : "";
  const data = await getJson<any>(
    apiKey,
    `/series/${seriesId}/episodes/default?season=${season}${langSeg}`,
  );
  const arr = data?.episodes ?? [];
  return (arr as any[])
    .filter((e) => typeof e.number === "number" && typeof e.seasonNumber === "number")
    .map((e) => ({
      id: e.id,
      number: e.number,
      seasonNumber: e.seasonNumber,
      name: e.name,
      overview: e.overview,
      aired: e.aired,
      runtime: e.runtime,
      image: tvdbImg(e.image),
      imdbId: undefined,
    }));
}

const ISO1_TO_TVDB: Record<string, string> = {
  en: "eng",
  es: "spa",
  fr: "fra",
  de: "deu",
  it: "ita",
  ja: "jpn",
  ko: "kor",
  ru: "rus",
  pt: "por",
  zh: "zho",
  ar: "ara",
  nl: "nld",
  pl: "pol",
  tr: "tur",
  sv: "swe",
  da: "dan",
  fi: "fin",
  no: "nor",
  cs: "ces",
  hu: "hun",
  el: "ell",
  he: "heb",
  th: "tha",
  vi: "vie",
  id: "ind",
  uk: "ukr",
  ro: "ron",
  hi: "hin",
};

export function tvdbLangFromIso1(iso1: string | null | undefined): string {
  const short = (iso1 ?? "").split("-")[0].toLowerCase();
  return ISO1_TO_TVDB[short] ?? "eng";
}

export async function tvdbEpisodesByType(
  apiKey: string,
  seriesId: number,
  seasonType: string,
  lang?: string,
): Promise<TvdbEpisode[]> {
  if (!seriesId) return [];
  const out: TvdbEpisode[] = [];
  const langSeg = lang ? `/${lang}` : "";
  for (let page = 0; page < 20; page++) {
    const data = await getJson<any>(
      apiKey,
      `/series/${seriesId}/episodes/${seasonType}${langSeg}?page=${page}`,
    );
    const arr = (data?.episodes ?? []) as any[];
    if (arr.length === 0) break;
    for (const e of arr) {
      if (typeof e.number !== "number") continue;
      out.push({
        id: e.id,
        number: e.number,
        seasonNumber: typeof e.seasonNumber === "number" ? e.seasonNumber : 0,
        absoluteNumber: typeof e.absoluteNumber === "number" ? e.absoluteNumber : undefined,
        name: e.name,
        overview: e.overview,
        aired: e.aired,
        runtime: e.runtime,
        image: tvdbImg(e.image),
      });
    }
    if (arr.length < 500) break;
  }
  return out;
}

export async function tvdbOrderTypeHasEpisodes(
  apiKey: string,
  seriesId: number,
  seasonType: string,
): Promise<boolean> {
  if (!seriesId) return false;
  const slug =
    seasonType === "aired" || seasonType === "absolute"
      ? "default"
      : seasonType === "tvdbabsolute"
        ? "absolute"
        : seasonType;
  const data = await getJson<any>(apiKey, `/series/${seriesId}/episodes/${slug}?page=0`);
  const arr = (data?.episodes ?? []) as any[];
  return arr.length > 0;
}

export async function tvdbEpisodesAbsolute(
  apiKey: string,
  seriesId: number,
  lang?: string,
): Promise<TvdbEpisode[]> {
  if (!seriesId) return [];
  const out: TvdbEpisode[] = [];
  const langSeg = lang ? `/${lang}` : "";
  for (let page = 0; page < 12; page++) {
    const data = await getJson<any>(apiKey, `/series/${seriesId}/episodes/absolute${langSeg}?page=${page}`);
    const arr = (data?.episodes ?? []) as any[];
    if (arr.length === 0) break;
    for (const e of arr) {
      if (typeof e.number !== "number") continue;
      out.push({
        id: e.id,
        number: e.number,
        seasonNumber: typeof e.seasonNumber === "number" ? e.seasonNumber : 0,
        absoluteNumber: typeof e.absoluteNumber === "number" ? e.absoluteNumber : undefined,
        name: e.name,
        overview: e.overview,
        aired: e.aired,
        runtime: e.runtime,
        image: tvdbImg(e.image),
        imdbId: undefined,
      });
    }
    if (arr.length < 500) break;
  }
  return out;
}
