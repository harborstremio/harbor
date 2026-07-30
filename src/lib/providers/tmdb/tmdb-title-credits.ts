import { lruSet } from "../../cache";
import { get } from "./tmdb-client";

export type TitleCreditPerson = {
  id: number;
  name: string;
  profilePath: string | null;
  popularity: number;
  order?: number;
  job?: string;
};

export type TitleCredits = {
  cast: TitleCreditPerson[];
  crew: TitleCreditPerson[];
};

const CACHE_MAX = 300;
const cache = new Map<string, TitleCredits | null>();
const inflight = new Map<string, Promise<TitleCredits | null>>();

const KEEP_CAST = 24;
const KEEP_CREW = 12;

function cacheKey(kind: "movie" | "tv", id: number): string {
  return `${kind}:${id}`;
}

function toPerson(raw: any): TitleCreditPerson {
  return {
    id: raw.id,
    name: raw.name ?? "",
    profilePath: raw.profile_path ?? null,
    popularity: typeof raw.popularity === "number" ? raw.popularity : 0,
    order: typeof raw.order === "number" ? raw.order : undefined,
    job: typeof raw.job === "string" ? raw.job : undefined,
  };
}

function parse(raw: any): TitleCredits {
  const cast: TitleCreditPerson[] = (raw?.cast ?? [])
    .map(toPerson)
    .sort(
      (a: TitleCreditPerson, b: TitleCreditPerson) =>
        (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER),
    )
    .slice(0, KEEP_CAST);
  const crew: TitleCreditPerson[] = (raw?.crew ?? [])
    .filter((c: any) => c?.department === "Directing" || c?.department === "Writing")
    .map(toPerson)
    .slice(0, KEEP_CREW);
  return { cast, crew };
}

export function tmdbTitleCreditsCached(
  kind: "movie" | "tv",
  id: number,
): TitleCredits | null | undefined {
  return cache.get(cacheKey(kind, id));
}

export async function tmdbTitleCredits(
  key: string,
  kind: "movie" | "tv",
  id: number,
): Promise<TitleCredits | null> {
  if (!key) return null;
  const k = cacheKey(kind, id);
  const cached = cache.get(k);
  if (cached !== undefined) return cached;
  const pending = inflight.get(k);
  if (pending) return pending;
  const p = (async () => {
    const raw = await get<any>(key, `${kind}/${id}/credits`);
    const parsed = raw ? parse(raw) : null;
    lruSet(cache, k, parsed, CACHE_MAX);
    return parsed;
  })().finally(() => inflight.delete(k));
  inflight.set(k, p);
  return p;
}
