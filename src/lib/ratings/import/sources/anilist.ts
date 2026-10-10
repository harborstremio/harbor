import { AnilistApiError, anilistRequest } from "@/lib/anilist/client";
import { getSession, isAuthenticated } from "@/lib/anilist/session";
import type { RatingMediaType } from "@/lib/ratings/types";
import { isRated, normalizeScore, scoreIsValid } from "../types";
import type {
  ExternalIds,
  ImportProgress,
  ImportSourceInput,
  ImportedRating,
  RatingsSource,
  ScoreScale,
} from "../types";

const PER_CHUNK = 500;
const MAX_CHUNKS = 40;
const REQUEST_GAP_MS = 2000;
const HTTPS_URL = /^https:\/\/[^\s<>"']+$/;
const AUTH_HINT = /invalid token|unauthorized|unauthenticated|not authenticated/i;

const RECONNECT = "AniList rejected your session. Reconnect your AniList account in Settings.";
const NOT_CONNECTED = "AniList is not connected. Connect your AniList account in Settings.";

const VIEWER_QUERY = `query {
  Viewer {
    id
    mediaListOptions { scoreFormat }
    statistics { anime { count } manga { count } }
  }
}`;

const COLLECTION_QUERY = `query ($userId: Int!, $type: MediaType!, $chunk: Int!, $perChunk: Int!, $format: ScoreFormat) {
  MediaListCollection(userId: $userId, type: $type, chunk: $chunk, perChunk: $perChunk) {
    hasNextChunk
    lists {
      entries {
        score(format: $format)
        updatedAt
        media {
          id
          idMal
          title { english userPreferred romaji native }
          coverImage { extraLarge large }
          seasonYear
          startDate { year }
        }
      }
    }
  }
}`;

type MediaKind = "ANIME" | "MANGA";

type ViewerPayload = {
  id: number | null;
  mediaListOptions: { scoreFormat: string | null } | null;
  statistics: {
    anime: { count: number | null } | null;
    manga: { count: number | null } | null;
  } | null;
} | null;

type ViewerResponse = { Viewer: ViewerPayload };

type RawMedia = {
  id: number | null;
  idMal: number | null;
  title: {
    english: string | null;
    userPreferred: string | null;
    romaji: string | null;
    native: string | null;
  } | null;
  coverImage: { extraLarge: string | null; large: string | null } | null;
  seasonYear: number | null;
  startDate: { year: number | null } | null;
} | null;

type RawEntry = { score: number | null; updatedAt: number | null; media: RawMedia } | null;

type CollectionResponse = {
  MediaListCollection: {
    hasNextChunk: boolean | null;
    lists: Array<{ entries: RawEntry[] | null } | null> | null;
  } | null;
};

type ListCounts = { anime?: number; manga?: number };

type Ctx = {
  userId: number;
  token: string;
  format: string;
  scale: ScoreScale;
  onProgress: (p: Partial<ImportProgress>) => void;
  signal?: AbortSignal;
};

const SCORE_SCALES: Record<string, ScoreScale | undefined> = {
  POINT_100: "point100",
  POINT_10_DECIMAL: "point10decimal",
  POINT_10: "point10",
  POINT_5: "point5",
  POINT_3: "point3",
};

function scoreFormatOf(raw: string | null | undefined): { format: string; scale: ScoreScale } {
  const key = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  const scale = SCORE_SCALES[key];
  if (scale) return { format: key, scale };
  return { format: "POINT_100", scale: "point100" };
}

function positiveInt(n: number | null | undefined): number | undefined {
  return typeof n === "number" && Number.isInteger(n) && n > 0 ? n : undefined;
}

function titleOf(media: NonNullable<RawMedia>): string {
  const t = media.title;
  for (const candidate of [t?.english, t?.userPreferred, t?.romaji, t?.native]) {
    const s = typeof candidate === "string" ? candidate.trim() : "";
    if (s) return s.slice(0, 300);
  }
  return "";
}

function posterOf(media: NonNullable<RawMedia>): string | undefined {
  for (const candidate of [media.coverImage?.extraLarge, media.coverImage?.large]) {
    if (typeof candidate !== "string") continue;
    const url = candidate.trim();
    if (url.length <= 600 && HTTPS_URL.test(url)) return url;
  }
  return undefined;
}

function yearOf(media: NonNullable<RawMedia>): number | undefined {
  return positiveInt(media.seasonYear) ?? positiveInt(media.startDate?.year);
}

function ratedAtOf(updatedAt: number | null): number | undefined {
  if (typeof updatedAt !== "number" || !Number.isFinite(updatedAt) || updatedAt <= 0) return undefined;
  return Math.round(updatedAt) * 1000;
}

function toRating(
  entry: NonNullable<RawEntry>,
  mediaType: RatingMediaType,
  scale: ScoreScale,
): ImportedRating | null {
  const media = entry.media;
  if (!media) return null;
  const raw = entry.score;
  if (raw === null || raw === undefined || !isRated(raw)) return null;
  const score = normalizeScore(raw, scale);
  if (!scoreIsValid(score)) return null;
  const title = titleOf(media);
  if (!title) return null;
  const anilist = positiveInt(media.id);
  const mal = positiveInt(media.idMal);
  if (anilist === undefined && mal === undefined) return null;
  const ids: ExternalIds = {};
  if (anilist !== undefined) ids.anilist = anilist;
  if (mal !== undefined) ids.mal = mal;
  const rating: ImportedRating = { sourceId: "anilist", score, mediaType, title, ids };
  const poster = posterOf(media);
  if (poster) rating.poster = poster;
  const year = yearOf(media);
  if (year !== undefined) rating.year = year;
  const ratedAt = ratedAtOf(entry.updatedAt);
  if (ratedAt !== undefined) rating.ratedAt = ratedAt;
  return rating;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    let timer = 0;
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    timer = window.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function authFailed(e: AnilistApiError): boolean {
  return e.status === 401 || e.status === 403 || AUTH_HINT.test(e.body);
}

async function request<T>(
  query: string,
  variables: Record<string, unknown>,
  token: string,
): Promise<T> {
  try {
    return await anilistRequest<T>(query, variables, token);
  } catch (e) {
    if (e instanceof AnilistApiError && authFailed(e)) throw new Error(RECONNECT);
    throw e;
  }
}

function countsOf(me: ViewerPayload): ListCounts {
  const stats = me?.statistics;
  const out: ListCounts = {};
  const anime = stats?.anime?.count;
  const manga = stats?.manga?.count;
  if (typeof anime === "number" && Number.isFinite(anime)) out.anime = Math.max(0, Math.trunc(anime));
  if (typeof manga === "number" && Number.isFinite(manga)) out.manga = Math.max(0, Math.trunc(manga));
  return out;
}

async function collect(
  ctx: Ctx,
  kind: MediaKind,
  mediaType: RatingMediaType,
  out: ImportedRating[],
  counter: { scanned: number },
): Promise<void> {
  const label = kind === "ANIME" ? "Anime" : "Manga";
  const seen = new Set<number>();
  for (let chunk = 1; chunk <= MAX_CHUNKS; chunk += 1) {
    throwIfAborted(ctx.signal);
    if (chunk > 1) await wait(REQUEST_GAP_MS, ctx.signal);
    const data = await request<CollectionResponse>(
      COLLECTION_QUERY,
      {
        userId: ctx.userId,
        type: kind,
        chunk,
        perChunk: PER_CHUNK,
        format: ctx.format,
      },
      ctx.token,
    );
    const collection = data.MediaListCollection;
    for (const group of collection?.lists ?? []) {
      for (const entry of group?.entries ?? []) {
        if (!entry) continue;
        const mediaId = positiveInt(entry.media?.id);
        if (mediaId !== undefined) {
          if (seen.has(mediaId)) continue;
          seen.add(mediaId);
        }
        counter.scanned += 1;
        const rating = toRating(entry, mediaType, ctx.scale);
        if (rating) out.push(rating);
      }
    }
    ctx.onProgress({
      phase: "fetch",
      fetched: counter.scanned,
      message: `${label} list, chunk ${chunk}`,
    });
    if (!collection?.hasNextChunk) return;
  }
  throw new Error(`AniList kept paging past ${MAX_CHUNKS} chunks of your ${label.toLowerCase()} list. Import stopped.`);
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
  const session = getSession();
  if (!session || !session.accessToken) throw new Error(NOT_CONNECTED);
  if (Date.now() >= session.expiresAt) throw new Error(RECONNECT);

  const viewer = await request<ViewerResponse>(VIEWER_QUERY, {}, session.accessToken);
  const me = viewer.Viewer;
  const userId = positiveInt(me?.id) ?? positiveInt(session.userId);
  if (userId === undefined) throw new Error(RECONNECT);

  const { format, scale } = scoreFormatOf(me?.mediaListOptions?.scoreFormat);
  const counts = countsOf(me);
  const known = (counts.anime ?? 0) + (counts.manga ?? 0);
  const start: Partial<ImportProgress> = { phase: "fetch", fetched: 0 };
  if (known > 0) start.total = known;
  onProgress(start);

  const ctx: Ctx = { userId, token: session.accessToken, format, scale, onProgress, signal };
  const out: ImportedRating[] = [];
  const counter = { scanned: 0 };

  if (counts.anime !== 0) await collect(ctx, "ANIME", "anime", out, counter);
  if (counts.manga !== 0) {
    await wait(REQUEST_GAP_MS, signal);
    await collect(ctx, "MANGA", "manga", out, counter);
  }
  throwIfAborted(signal);
  return out;
}

export const anilistSource: RatingsSource = {
  id: "anilist",
  label: "AniList",
  kind: "session",
  available,
  fetchRatings,
};
