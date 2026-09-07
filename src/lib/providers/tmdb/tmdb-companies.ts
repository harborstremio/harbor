import { lruSet } from "@/lib/cache";
import { get, IMG } from "./tmdb-client";

const COMPANY_CACHE_MAX = 500;
const companyCache = new Map<string, number | null>();
const companyInflight = new Map<string, Promise<number | null>>();

export async function tmdbCompanyIdByName(key: string, name: string): Promise<number | null> {
  if (!key || !name) return null;
  const k = name.trim().toLowerCase();
  if (companyCache.has(k)) return companyCache.get(k) ?? null;
  if (companyInflight.has(k)) return companyInflight.get(k)!;
  const p = (async () => {
    const data = await get<{ results?: Array<{ id: number; name: string }> }>(key, "search/company", {
      query: name,
    });
    const results = data?.results ?? [];
    const exact = results.find((r) => r.name.trim().toLowerCase() === k);
    const id = exact?.id ?? results[0]?.id ?? null;
    lruSet(companyCache, k, id, COMPANY_CACHE_MAX);
    return id;
  })().finally(() => companyInflight.delete(k));
  companyInflight.set(k, p);
  return p;
}

export type CompanyArt = { logo: string | null; backdrop: string | null; count: number; span: string };

const artCache = new Map<string, CompanyArt>();
const artInflight = new Map<string, Promise<CompanyArt>>();

const EMPTY_ART: CompanyArt = { logo: null, backdrop: null, count: 0, span: "" };

function yearOf(value: unknown): number | null {
  if (typeof value !== "string" || value.length < 4) return null;
  const n = Number(value.slice(0, 4));
  return Number.isFinite(n) && n > 1880 ? n : null;
}

export async function tmdbCompanyArt(
  key: string,
  id: number,
  mediaType: "movie" | "tv",
  brand: "studio" | "network" = "studio",
): Promise<CompanyArt> {
  if (!key || !id) return EMPTY_ART;
  const k = `${brand}:${id}:${mediaType}`;
  const hit = artCache.get(k);
  if (hit) return hit;
  const running = artInflight.get(k);
  if (running) return running;
  const p = (async () => {
    const [images, top] = await Promise.all([
      get<{ logos?: Array<{ file_path?: string }> }>(
        key,
        brand === "network" ? `network/${id}/images` : `company/${id}/images`,
        {},
      ).catch(() => null),
      get<{
        results?: Array<{ backdrop_path?: string; release_date?: string; first_air_date?: string }>;
        total_results?: number;
      }>(key, `discover/${mediaType}`, {
        [brand === "network" ? "with_networks" : "with_companies"]: String(id),
        sort_by: "popularity.desc",
        "vote_count.gte": "50",
      }).catch(() => null),
    ]);
    const logoPath = images?.logos?.find((l) => l.file_path)?.file_path ?? null;
    const results = top?.results ?? [];
    const backdropPath = results.find((r) => r.backdrop_path)?.backdrop_path ?? null;
    const years = results
      .map((r) => yearOf(r.release_date ?? r.first_air_date))
      .filter((y): y is number => y !== null);
    const span =
      years.length > 1
        ? `${Math.min(...years)} to ${Math.max(...years)}`
        : years.length === 1
          ? String(years[0])
          : "";
    const art: CompanyArt = {
      logo: logoPath ? `${IMG}/w500${logoPath}` : null,
      backdrop: backdropPath ? `${IMG}/w1280${backdropPath}` : null,
      count: top?.total_results ?? 0,
      span,
    };
    lruSet(artCache, k, art, COMPANY_CACHE_MAX);
    return art;
  })().finally(() => artInflight.delete(k));
  artInflight.set(k, p);
  return p;
}
