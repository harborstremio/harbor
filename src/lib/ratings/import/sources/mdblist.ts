import type { RatingMediaType } from "@/lib/ratings/types";
import { safeFetch } from "@/lib/safe-fetch";
import { isRated, normalizeScore } from "../types";
import type {
  ExternalIds,
  ImportProgress,
  ImportSourceInput,
  ImportedRating,
  RatingsSource,
} from "../types";

const ENDPOINT = "https://api.mdblist.com/sync/ratings";
const PAGE_LIMIT = 1000;
const MAX_PAGES = 60;
const PAGE_GAP_MS = 250;
const TITLE_MAX = 300;
const TCONST = /^tt\d+$/;

type MdbIds = {
  imdb?: string | null;
  tmdb?: number | string | null;
  tvdb?: number | string | null;
  trakt?: number | string | null;
  kitsu?: number | string | null;
  mal?: number | string | null;
  mdblist?: string | null;
};

type MdbTitle = {
  title?: string | null;
  year?: number | string | null;
  ids?: MdbIds | null;
};

type MdbRow = MdbTitle & {
  rating?: number | string | null;
  rated_at?: string | null;
  movie?: MdbTitle | null;
  show?: MdbTitle | null;
};

type MdbPage = {
  movies?: MdbRow[] | null;
  shows?: MdbRow[] | null;
  seasons?: unknown[] | null;
  episodes?: unknown[] | null;
  pagination?: {
    offset?: number | null;
    has_more?: boolean | null;
    total_movies?: number | null;
    total_shows?: number | null;
  } | null;
  error?: string | null;
};

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function rowsOf(v: MdbRow[] | null | undefined): MdbRow[] {
  return Array.isArray(v) ? v : [];
}

function countOf(v: unknown): number {
  return Array.isArray(v) ? v.length : 0;
}

function pageRows(page: MdbPage): number {
  return (
    countOf(page.movies) + countOf(page.shows) + countOf(page.seasons) + countOf(page.episodes)
  );
}

function num(v: unknown): number | undefined {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function posInt(v: unknown): number | undefined {
  const n = num(v);
  return n !== undefined && Number.isInteger(n) && n > 0 ? n : undefined;
}

function tconst(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return TCONST.test(s) ? s : undefined;
}

function epochMs(v: unknown): number | undefined {
  if (typeof v !== "string" || !v.trim()) return undefined;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : undefined;
}

function idsOf(src: MdbIds | null | undefined): ExternalIds {
  const out: ExternalIds = {};
  if (!src) return out;
  const imdb = tconst(src.imdb);
  if (imdb) out.imdb = imdb;
  const tmdb = posInt(src.tmdb);
  if (tmdb) out.tmdb = tmdb;
  const tvdb = posInt(src.tvdb);
  if (tvdb) out.tvdb = tvdb;
  const trakt = posInt(src.trakt);
  if (trakt) out.trakt = trakt;
  const kitsu = posInt(src.kitsu);
  if (kitsu) out.kitsu = kitsu;
  const mal = posInt(src.mal);
  if (mal) out.mal = mal;
  const slug = typeof src.mdblist === "string" ? src.mdblist.trim() : "";
  if (slug) out.slug = slug;
  return out;
}

function titleOf(row: MdbRow, kind: "movie" | "show"): MdbTitle {
  const wrapped = kind === "movie" ? row.movie : row.show;
  return wrapped && typeof wrapped === "object" ? wrapped : row;
}

function mediaTypeOf(kind: "movie" | "show", ids: ExternalIds): RatingMediaType {
  if (ids.kitsu !== undefined || ids.mal !== undefined) return "anime";
  return kind === "movie" ? "movie" : "series";
}

function toRating(row: MdbRow, kind: "movie" | "show"): ImportedRating | null {
  const raw = num(row.rating);
  if (raw === undefined || !isRated(raw)) return null;
  const media = titleOf(row, kind);
  const title = typeof media.title === "string" ? media.title.trim().slice(0, TITLE_MAX) : "";
  if (!title) return null;
  const ids = idsOf(media.ids);
  const out: ImportedRating = {
    sourceId: "mdblist",
    score: normalizeScore(raw, "point10"),
    mediaType: mediaTypeOf(kind, ids),
    title,
    ids,
  };
  const year = posInt(media.year);
  if (year !== undefined) out.year = year;
  const ratedAt = epochMs(row.rated_at);
  if (ratedAt !== undefined) out.ratedAt = ratedAt;
  return out;
}

function dedupeKey(r: ImportedRating): string {
  const parts = [
    r.mediaType,
    r.ids.imdb ?? "",
    r.ids.tmdb ?? "",
    r.ids.trakt ?? "",
    r.title.toLowerCase(),
  ];
  return parts.join("|");
}

function collect(out: ImportedRating[], seen: Set<string>, r: ImportedRating | null): void {
  if (!r) return;
  const key = dedupeKey(r);
  if (seen.has(key)) return;
  seen.add(key);
  out.push(r);
}

function totalOf(page: MdbPage): number | undefined {
  const movies = num(page.pagination?.total_movies);
  const shows = num(page.pagination?.total_shows);
  if (movies === undefined || shows === undefined) return undefined;
  return movies + shows;
}

function morePages(page: MdbPage, rows: number): boolean {
  const flag = page.pagination?.has_more;
  if (flag === true) return true;
  if (flag === false) return false;
  return rows >= PAGE_LIMIT;
}

function offsetHonored(page: MdbPage, asked: number): boolean {
  const echoed = num(page.pagination?.offset);
  return echoed === undefined || echoed === asked;
}

async function getPage(apiKey: string, offset: number, signal?: AbortSignal): Promise<MdbPage> {
  const qs = new URLSearchParams({
    apikey: apiKey,
    offset: String(offset),
    limit: String(PAGE_LIMIT),
  });
  const res = await safeFetch(`${ENDPOINT}?${qs.toString()}`, { signal });
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      "MDBList rejected your API key. Copy a fresh key from mdblist.com/preferences and try again.",
    );
  }
  if (res.status === 429) {
    throw new Error(
      "MDBList daily API limit reached. Wait for your quota to reset, then run the import again.",
    );
  }
  if (res.status === 404) {
    throw new Error(
      "MDBList ratings sync is unavailable. That API is in beta and may have moved or been withdrawn.",
    );
  }
  if (!res.ok) throw new Error(`MDBList request failed with status ${res.status}.`);
  const text = await res.text();
  let json: MdbPage;
  try {
    json = JSON.parse(text) as MdbPage;
  } catch {
    throw new Error("MDBList returned a response Harbor could not read.");
  }
  const err = typeof json.error === "string" ? json.error.trim() : "";
  if (err) throw new Error(`MDBList error: ${err}`);
  return json;
}

async function fetchRatings(
  input: ImportSourceInput,
  onProgress: (p: Partial<ImportProgress>) => void,
  signal?: AbortSignal,
): Promise<ImportedRating[]> {
  onProgress({ phase: "auth" });
  const apiKey = input.apiKey?.trim() ?? "";
  if (!apiKey) {
    throw new Error("Enter your MDBList API key. You can copy it from mdblist.com/preferences.");
  }

  const out: ImportedRating[] = [];
  const seen = new Set<string>();
  let total: number | undefined;
  let offset = 0;

  onProgress({ phase: "fetch", fetched: 0 });

  for (let page = 0; page < MAX_PAGES; page += 1) {
    throwIfAborted(signal);
    const json = await getPage(apiKey, offset, signal);
    if (page === 0) total = totalOf(json);

    const movies = rowsOf(json.movies);
    const shows = rowsOf(json.shows);
    const before = out.length;
    for (const row of movies) collect(out, seen, toRating(row, "movie"));
    for (const row of shows) collect(out, seen, toRating(row, "show"));
    const rows = pageRows(json);
    const gained = out.length - before;

    onProgress({
      phase: "fetch",
      fetched: out.length,
      ...(total !== undefined ? { total } : {}),
      message: `Page ${page + 1}`,
    });

    if (rows === 0) break;
    if (!offsetHonored(json, offset)) break;
    if (!morePages(json, rows)) break;
    if (gained === 0 && json.pagination?.has_more !== true) break;
    offset += Math.min(rows, PAGE_LIMIT);
    await delay(PAGE_GAP_MS, signal);
  }

  return out;
}

export const mdblistSource: RatingsSource = {
  id: "mdblist",
  label: "MDBList",
  kind: "key",
  available: () => true,
  fetchRatings,
};
