import { IMG, TMDB } from "@/lib/providers/tmdb/tmdb-client";
import { tmdbImdbCached } from "@/lib/providers/tmdb/tmdb-imdb-resolve";
import { safeFetch } from "@/lib/safe-fetch";
import { isRated, normalizeScore } from "../types";
import type { ImportProgress, ImportSourceInput, ImportedRating, RatingsSource } from "../types";

const SOURCE_ID = "tmdb" as const;
const PAGE_GAP_MS = 60;
const MAX_PAGES = 500;
const ENRICH_BATCH = 6;
const ENRICH_REPORT_EVERY = 100;
const TCONST = /^tt\d+$/;

const API_KEY_RE = /^[0-9a-f]{32}$/i;
const SESSION_RE = /^[0-9a-f]{40}$/i;
const JWT_RE = /^ey[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}$/;
const TOKEN_RE = /[A-Za-z0-9._-]{20,}/g;

const NEED_CREDENTIALS =
  "Add your TMDB credentials first. TMDB will not hand over your ratings for an API key alone. Paste the 32 character API key from themoviedb.org/settings/api together with a 40 character session ID, or paste a v4 access token you approved from your own account.";
const AUTH_REJECTED =
  "TMDB rejected these credentials. Reconnect your TMDB account: generate a fresh session ID, or approve a new v4 access token. The read-only v4 token on the API settings page cannot see your ratings.";

type Creds = { apiKey: string; bearer: string; sessionId: string };

type RatedKind = "movie" | "series";

type RatedItem = {
  id?: unknown;
  rating?: unknown;
  account_rating?: unknown;
  title?: unknown;
  name?: unknown;
  original_title?: unknown;
  original_name?: unknown;
  poster_path?: unknown;
  release_date?: unknown;
  first_air_date?: unknown;
};

type RatedPage = {
  total_pages?: unknown;
  total_results?: unknown;
  results?: RatedItem[];
};

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function num(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function positiveInt(v: unknown): number | undefined {
  const n = num(v);
  return n !== undefined && Number.isInteger(n) && n > 0 ? n : undefined;
}

function credentialsOf(input: ImportSourceInput): Creds {
  const blob = `${input.apiKey ?? ""} ${input.username ?? ""}`;
  const creds: Creds = { apiKey: "", bearer: "", sessionId: "" };
  for (const token of blob.match(TOKEN_RE) ?? []) {
    if (!creds.bearer && JWT_RE.test(token)) creds.bearer = token;
    else if (!creds.apiKey && API_KEY_RE.test(token)) creds.apiKey = token;
    else if (!creds.sessionId && SESSION_RE.test(token)) creds.sessionId = token;
  }
  return creds;
}

async function readJson<T>(res: Response, path: string): Promise<T> {
  const bytes = new Uint8Array(await res.arrayBuffer());
  let text: string;
  if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    text = await new Response(stream).text();
  } else {
    text = new TextDecoder("utf-8").decode(bytes);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`TMDB sent an unreadable response for ${path}.`);
  }
}

async function request<T>(
  creds: Creds,
  path: string,
  params: Record<string, string>,
  body: string | undefined,
  signal?: AbortSignal,
): Promise<T> {
  const url = new URL(`${TMDB}/${path}`);
  if (creds.apiKey) url.searchParams.set("api_key", creds.apiKey);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (creds.bearer) headers.Authorization = `Bearer ${creds.bearer}`;
  if (body) headers["Content-Type"] = "application/json;charset=utf-8";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    throwIfAborted(signal);
    const res = await safeFetch(url.toString(), {
      method: body ? "POST" : "GET",
      headers,
      body,
      signal,
    });
    if (res.status === 401 || res.status === 403) throw new Error(AUTH_REJECTED);
    if (res.status === 429 || res.status >= 500) {
      await sleep(800 * (attempt + 1));
      continue;
    }
    if (!res.ok) throw new Error(`TMDB returned ${res.status} for ${path}.`);
    return readJson<T>(res, path);
  }
  throw new Error(`TMDB is rate limiting or unavailable on ${path}. Try again in a minute.`);
}

async function sessionFromV4Token(creds: Creds, signal?: AbortSignal): Promise<string> {
  const out = await request<{ session_id?: unknown }>(
    creds,
    "authentication/session/convert/4",
    {},
    JSON.stringify({ access_token: creds.bearer }),
    signal,
  );
  const id = str(out.session_id);
  if (!id) throw new Error(AUTH_REJECTED);
  return id;
}

async function accountId(creds: Creds, signal?: AbortSignal): Promise<number> {
  const out = await request<{ id?: unknown }>(
    creds,
    "account",
    { session_id: creds.sessionId },
    undefined,
    signal,
  );
  const id = positiveInt(out.id);
  if (id === undefined) throw new Error(AUTH_REJECTED);
  return id;
}

function pathKind(kind: RatedKind): "movie" | "tv" {
  return kind === "movie" ? "movie" : "tv";
}

function ratedPath(account: number, kind: RatedKind): string {
  return `account/${account}/rated/${kind === "movie" ? "movies" : "tv"}`;
}

function ratedPage(
  creds: Creds,
  account: number,
  kind: RatedKind,
  page: number,
  signal?: AbortSignal,
): Promise<RatedPage> {
  return request<RatedPage>(
    creds,
    ratedPath(account, kind),
    { session_id: creds.sessionId, page: String(page), sort_by: "created_at.asc" },
    undefined,
    signal,
  );
}

function yearOf(v: unknown): number | undefined {
  const s = str(v).slice(0, 4);
  if (s.length !== 4) return undefined;
  const n = Number(s);
  return Number.isInteger(n) && n >= 1870 && n <= 2200 ? n : undefined;
}

function posterOf(v: unknown): string | undefined {
  const p = str(v);
  if (!p.startsWith("/")) return undefined;
  const url = `${IMG}/w500${p}`;
  return url.length <= 600 ? url : undefined;
}

function titleOf(item: RatedItem, kind: RatedKind): string {
  const primary = kind === "movie" ? str(item.title) : str(item.name);
  const fallback = kind === "movie" ? str(item.original_title) : str(item.original_name);
  return (primary || fallback).slice(0, 300);
}

function toRating(item: RatedItem, kind: RatedKind): ImportedRating | null {
  const tmdbId = positiveInt(item.id);
  if (tmdbId === undefined) return null;
  const raw = num(item.rating) ?? num(item.account_rating);
  if (raw === undefined || !isRated(raw)) return null;
  const title = titleOf(item, kind);
  if (!title) return null;
  const row: ImportedRating = {
    sourceId: SOURCE_ID,
    score: normalizeScore(raw, "tmdb"),
    mediaType: kind,
    title,
    ids: { tmdb: tmdbId },
  };
  const year = yearOf(kind === "movie" ? item.release_date : item.first_air_date);
  if (year !== undefined) row.year = year;
  const poster = posterOf(item.poster_path);
  if (poster) row.poster = poster;
  return row;
}

function collect(page: RatedPage, kind: RatedKind, out: ImportedRating[]): number {
  const results = Array.isArray(page.results) ? page.results : [];
  for (const item of results) {
    const row = toRating(item, kind);
    if (row) out.push(row);
  }
  return results.length;
}

async function externalImdbId(
  creds: Creds,
  kind: RatedKind,
  id: number,
  signal?: AbortSignal,
): Promise<string | null> {
  const out = await request<{ imdb_id?: unknown }>(
    creds,
    `${pathKind(kind)}/${id}/external_ids`,
    {},
    undefined,
    signal,
  );
  const imdb = str(out.imdb_id);
  return TCONST.test(imdb) ? imdb : null;
}

async function attachImdb(row: ImportedRating, creds: Creds, signal?: AbortSignal): Promise<void> {
  const id = row.ids.tmdb;
  if (typeof id !== "number") return;
  const kind: RatedKind = row.mediaType === "movie" ? "movie" : "series";
  const cached = tmdbImdbCached(`tmdb:${pathKind(kind)}:${id}`);
  if (typeof cached === "string" && TCONST.test(cached)) {
    row.ids.imdb = cached;
    return;
  }
  const imdb = await externalImdbId(creds, kind, id, signal).catch((err: unknown) => {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    return null;
  });
  if (imdb) row.ids.imdb = imdb;
}

async function enrichImdb(
  rows: ImportedRating[],
  creds: Creds,
  onProgress: (p: Partial<ImportProgress>) => void,
  fetched: number,
  signal?: AbortSignal,
): Promise<void> {
  if (rows.length === 0) return;
  let done = 0;
  let reported = 0;
  for (let i = 0; i < rows.length; i += ENRICH_BATCH) {
    throwIfAborted(signal);
    if (i > 0) await sleep(PAGE_GAP_MS);
    const slice = rows.slice(i, i + ENRICH_BATCH);
    await Promise.all(slice.map((row) => attachImdb(row, creds, signal)));
    done += slice.length;
    if (done - reported >= ENRICH_REPORT_EVERY || done >= rows.length) {
      reported = done;
      onProgress({
        phase: "fetch",
        fetched,
        message: `Matching IMDb ids ${Math.min(done, rows.length)} of ${rows.length}`,
      });
    }
  }
}

async function fetchRatings(
  input: ImportSourceInput,
  onProgress: (p: Partial<ImportProgress>) => void,
  signal?: AbortSignal,
): Promise<ImportedRating[]> {
  onProgress({ phase: "auth" });
  const creds = credentialsOf(input);
  if (!creds.apiKey && !creds.bearer) throw new Error(NEED_CREDENTIALS);
  if (!creds.sessionId) {
    if (!creds.bearer) throw new Error(NEED_CREDENTIALS);
    creds.sessionId = await sessionFromV4Token(creds, signal);
  }
  const account = await accountId(creds, signal);

  onProgress({ phase: "fetch", fetched: 0 });
  const kinds: RatedKind[] = ["movie", "series"];
  const heads: Array<{ kind: RatedKind; page: RatedPage }> = [];
  for (const kind of kinds) {
    throwIfAborted(signal);
    heads.push({ kind, page: await ratedPage(creds, account, kind, 1, signal) });
  }
  const total = heads.reduce((n, h) => n + (num(h.page.total_results) ?? 0), 0);
  onProgress({ phase: "fetch", fetched: 0, total });

  const out: ImportedRating[] = [];
  let fetched = 0;
  for (const head of heads) {
    fetched += collect(head.page, head.kind, out);
    onProgress({ phase: "fetch", fetched });
    const pages = Math.min(Math.max(num(head.page.total_pages) ?? 1, 1), MAX_PAGES);
    for (let p = 2; p <= pages; p += 1) {
      throwIfAborted(signal);
      await sleep(PAGE_GAP_MS);
      const page = await ratedPage(creds, account, head.kind, p, signal);
      fetched += collect(page, head.kind, out);
      onProgress({ phase: "fetch", fetched, message: `Page ${p} of ${pages}` });
    }
  }

  await enrichImdb(out, creds, onProgress, fetched, signal);
  return out;
}

export const tmdbSource: RatingsSource = {
  id: SOURCE_ID,
  label: "TMDB",
  kind: "key",
  available: () => true,
  fetchRatings,
};
