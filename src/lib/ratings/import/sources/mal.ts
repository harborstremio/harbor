import { MalApiError, malRequest } from "@/lib/mal/client";
import { getSession, isAuthenticated } from "@/lib/mal/session";
import { isRated, normalizeScore, scoreIsValid } from "../types";
import type { ImportProgress, ImportSourceInput, ImportedRating, RatingsSource } from "../types";

type ListKind = "anime" | "manga";

type MalPicture = { medium?: string | null; large?: string | null } | null;

type MalStatus = { score?: number | null; updated_at?: string | null };

type MalNode = {
  id?: number | null;
  title?: string | null;
  main_picture?: MalPicture;
  start_date?: string | null;
  start_season?: { year?: number | null } | null;
  my_list_status?: MalStatus | null;
};

type MalRow = { node?: MalNode | null; list_status?: MalStatus | null };

type MalPage = { data?: MalRow[] | null; paging?: { next?: string | null } | null };

const PAGE_LIMIT = 1000;
const PAGE_GAP_MS = 700;
const RETRY_BASE_MS = 2000;
const MAX_RETRIES = 2;
const MAX_PAGES = 500;
const MAX_TITLE = 300;
const MAX_POSTER = 600;
const MIN_YEAR = 1800;

const HTTPS_URL = /^https:\/\/[^\s<>"']+$/;
const AUTH_MESSAGE = "MyAnimeList rejected the request. Reconnect your MyAnimeList account in Settings.";
const NO_SESSION_MESSAGE = "No MyAnimeList account connected. Connect MyAnimeList in Settings first.";

const FIELDS: Record<ListKind, string> = {
  anime: "list_status,start_season,start_date",
  manga: "list_status,start_date",
};

const LABEL: Record<ListKind, string> = {
  anime: "Anime",
  manga: "Manga",
};

function abortError(): DOMException {
  return new DOMException("Aborted", "AbortError");
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onAbort = () => {
      if (timer) clearTimeout(timer);
      reject(abortError());
    };
    timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function isPositiveInt(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n > 0;
}

function pickPoster(picture: MalPicture | undefined): string | undefined {
  const url = (picture?.large ?? picture?.medium ?? "").trim();
  if (!url || url.length > MAX_POSTER) return undefined;
  return HTTPS_URL.test(url) ? url : undefined;
}

function pickYear(node: MalNode | null | undefined): number | undefined {
  const season = node?.start_season?.year;
  if (isPositiveInt(season) && season > MIN_YEAR) return season;
  const parsed = Number(String(node?.start_date ?? "").slice(0, 4));
  return Number.isInteger(parsed) && parsed > MIN_YEAR ? parsed : undefined;
}

function pickRatedAt(updatedAt: string | null | undefined): number | undefined {
  if (!updatedAt) return undefined;
  const ms = Date.parse(updatedAt);
  return Number.isFinite(ms) ? ms : undefined;
}

export function toRating(row: MalRow, kind: ListKind): ImportedRating | null {
  const node = row.node;
  const status = row.list_status ?? node?.my_list_status ?? null;
  if (!node || !status) return null;

  const id = node.id;
  if (!isPositiveInt(id)) return null;

  const title = (node.title ?? "").trim();
  if (!title) return null;

  const raw = status.score;
  if (typeof raw !== "number" || !isRated(raw)) return null;

  const score = normalizeScore(raw, "point10");
  if (!scoreIsValid(score)) return null;

  return {
    sourceId: "mal",
    score,
    mediaType: kind === "anime" ? "anime" : "manga",
    title: title.slice(0, MAX_TITLE),
    year: pickYear(node),
    poster: pickPoster(node.main_picture),
    ids: { mal: id },
    ratedAt: pickRatedAt(status.updated_at),
  };
}

function pathFor(kind: ListKind, offset: number): string {
  const query = `fields=${FIELDS[kind]}&nsfw=true&limit=${PAGE_LIMIT}&offset=${offset}`;
  return `/users/@me/${kind}list?${query}`;
}

async function requestPage(kind: ListKind, offset: number, signal?: AbortSignal): Promise<MalPage> {
  const path = pathFor(kind, offset);
  for (let attempt = 0; ; attempt += 1) {
    throwIfAborted(signal);
    try {
      return await malRequest<MalPage>(path);
    } catch (err) {
      if (isAbort(err)) throw err;
      const status = err instanceof MalApiError ? err.status : 0;
      if (status === 401 || status === 403) throw new Error(AUTH_MESSAGE);
      const retryable = status === 429 || status >= 500;
      if (retryable && attempt < MAX_RETRIES) {
        await wait(RETRY_BASE_MS * 2 ** attempt, signal);
        continue;
      }
      throw err;
    }
  }
}

async function collect(
  kind: ListKind,
  out: ImportedRating[],
  onProgress: (p: Partial<ImportProgress>) => void,
  signal?: AbortSignal,
): Promise<void> {
  let offset = 0;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    throwIfAborted(signal);
    const data = await requestPage(kind, offset, signal);
    const rows = Array.isArray(data.data) ? data.data : [];
    for (const row of rows) {
      const rating = toRating(row, kind);
      if (rating) out.push(rating);
    }
    offset += rows.length;
    onProgress({
      phase: "fetch",
      fetched: out.length,
      message: `${LABEL[kind]} page ${page + 1}`,
    });
    if (rows.length === 0 || !data.paging?.next) return;
    await wait(PAGE_GAP_MS, signal);
  }
  throw new Error(`MyAnimeList kept paging past ${MAX_PAGES} pages of your ${kind} list. Import stopped.`);
}

function available(): boolean {
  return isAuthenticated();
}

async function fetchRatings(
  _input: ImportSourceInput,
  onProgress: (p: Partial<ImportProgress>) => void,
  signal?: AbortSignal,
): Promise<ImportedRating[]> {
  throwIfAborted(signal);
  onProgress({ phase: "auth" });
  if (!getSession()) throw new Error(NO_SESSION_MESSAGE);

  const out: ImportedRating[] = [];
  onProgress({ phase: "fetch", fetched: 0 });

  await collect("anime", out, onProgress, signal);
  await wait(PAGE_GAP_MS, signal);
  await collect("manga", out, onProgress, signal);

  throwIfAborted(signal);
  return out;
}

export const malSource: RatingsSource = {
  id: "mal",
  label: "MyAnimeList",
  kind: "session",
  available,
  fetchRatings,
};
