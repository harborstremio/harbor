import { t } from "@/lib/i18n";
import { setRatingsLocalBulk } from "@/lib/ratings/store";
import { socialPost } from "@/lib/social/client";
import { upsertRating } from "@/lib/social/ratings-api";
import type { MyRating, RatingMediaType, RatingTarget } from "@/lib/ratings/types";

export type BulkRatingItem = RatingTarget & { score: number; review?: string };
export type BulkProgress = (written: number, failed: number, note?: string) => void;

const MAX_CHUNK = 200;
const MIN_CHUNK = 25;
const SINGLE_GAP_MS = 1100;
const RETRY_WAIT_MS = 3000;
const SLOW_DOWN_WAIT_MS = 6000;
const ITEM_KEY_CAP = 200;
const TITLE_CAP = 300;
const REVIEW_CAP = 4000;
const POSTER_CAP = 600;
const DEAD_CHUNKS = 3;
const DEAD_ITEMS = 6;
const POSTER_RE = /^https:\/\/[^\s<>"']+$/i;
const MEDIA_TYPES = new Set<string>(["movie", "series", "anime", "manga"]);
const NOT_DEPLOYED = new Set([404, 405, 501]);

type Wire = {
  itemKey: string;
  mediaType: RatingMediaType;
  score: number;
  review?: string;
  title: string;
  poster?: string;
};

type BulkReply = { written?: number; failed?: Array<{ itemKey?: string; error?: string }> };

type Acc = { written: number; failed: number; note?: string };

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function statusOf(e: unknown): number {
  return (e as { status?: number })?.status ?? 0;
}

function addNote(acc: Acc, note: string): void {
  acc.note = acc.note ? `${acc.note} ${note}` : note;
}

function cleanPoster(raw: string | undefined): string | undefined {
  const s = raw?.trim();
  return s && s.length <= POSTER_CAP && POSTER_RE.test(s) ? s : undefined;
}

function toWire(item: BulkRatingItem): Wire | null {
  const itemKey = item.itemKey?.trim() ?? "";
  if (!itemKey || itemKey.length > ITEM_KEY_CAP) return null;
  if (!MEDIA_TYPES.has(item.mediaType)) return null;
  const score = Math.round(item.score);
  if (!Number.isFinite(score) || score < 1 || score > 10) return null;
  const review = item.review?.trim().slice(0, REVIEW_CAP);
  return {
    itemKey,
    mediaType: item.mediaType,
    score,
    review: review || undefined,
    title: (item.title ?? "").replace(/\s+/g, " ").trim().slice(0, TITLE_CAP),
    poster: cleanPoster(item.poster),
  };
}

function prepare(items: BulkRatingItem[]): { wire: Wire[]; rejected: number } {
  const byKey = new Map<string, Wire>();
  let rejected = 0;
  for (const item of items) {
    const w = toWire(item);
    if (!w) {
      rejected += 1;
      continue;
    }
    byKey.set(w.itemKey, w);
  }
  return { wire: [...byKey.values()], rejected };
}

function toLocal(w: Wire, at: number): MyRating {
  return { ...w, updatedAt: at };
}

async function sendChunk(chunk: Wire[], acc: Acc): Promise<void> {
  const reply = await socialPost<BulkReply>("/social/ratings/bulk", { items: chunk });
  const written = Math.max(0, Math.min(chunk.length, Number(reply.written) || 0));
  const rejects = Array.isArray(reply.failed) ? reply.failed : [];
  if (rejects.length > 0) console.warn("[ratings-import] server rejected", rejects.slice(0, 5));
  acc.written += written;
  acc.failed += chunk.length - written;
}

async function bulkPhase(
  list: Wire[],
  acc: Acc,
  report: () => void,
  signal?: AbortSignal,
): Promise<{ next: number; fallback: boolean }> {
  let i = 0;
  let size = MAX_CHUNK;
  let tries = 0;
  let dead = 0;
  while (i < list.length) {
    if (signal?.aborted) return { next: list.length, fallback: false };
    const chunk = list.slice(i, i + size);
    try {
      await sendChunk(chunk, acc);
      i += chunk.length;
      tries = 0;
      dead = 0;
      report();
      continue;
    } catch (e) {
      const status = statusOf(e);
      if (NOT_DEPLOYED.has(status)) return { next: i, fallback: true };
      if (status === 401 || status === 403) {
        acc.failed += list.length - i;
        report();
        return { next: list.length, fallback: false };
      }
      if (status === 413 && size > MIN_CHUNK) {
        size = Math.max(MIN_CHUNK, Math.floor(size / 2));
        tries = 0;
        continue;
      }
      tries += 1;
      if (tries <= (status === 429 ? 5 : 2)) {
        await sleep(status === 429 ? SLOW_DOWN_WAIT_MS : RETRY_WAIT_MS);
        continue;
      }
      acc.failed += chunk.length;
      i += chunk.length;
      tries = 0;
      dead += 1;
      report();
      if (dead >= DEAD_CHUNKS) {
        acc.failed += list.length - i;
        addNote(acc, t("The server stopped responding, the rest stayed on this device."));
        report();
        return { next: list.length, fallback: false };
      }
    }
  }
  return { next: list.length, fallback: false };
}

async function sendOne(w: Wire): Promise<"ok" | "rejected" | "unreachable"> {
  for (let tries = 0; tries < 3; tries += 1) {
    try {
      await upsertRating(w);
      return "ok";
    } catch (e) {
      const status = statusOf(e);
      if (status === 429) {
        await sleep(SLOW_DOWN_WAIT_MS);
        continue;
      }
      if (status >= 400 && status < 500) return "rejected";
      await sleep(RETRY_WAIT_MS);
    }
  }
  return "unreachable";
}

async function singlePhase(
  list: Wire[],
  from: number,
  acc: Acc,
  report: () => void,
  signal?: AbortSignal,
): Promise<void> {
  let dead = 0;
  for (let i = from; i < list.length; i += 1) {
    if (signal?.aborted) return;
    const outcome = await sendOne(list[i]);
    if (outcome === "ok") acc.written += 1;
    else acc.failed += 1;
    dead = outcome === "unreachable" ? dead + 1 : 0;
    report();
    if (dead >= DEAD_ITEMS) {
      acc.failed += list.length - i - 1;
      addNote(acc, t("The server stopped responding, the rest stayed on this device."));
      report();
      return;
    }
    if (i < list.length - 1) await sleep(SINGLE_GAP_MS);
  }
}

export async function importRatingsBulk(
  items: Array<RatingTarget & { score: number; review?: string }>,
  onProgress: BulkProgress,
  signal?: AbortSignal,
): Promise<{ written: number; failed: number }> {
  const { wire, rejected } = prepare(items);
  const acc: Acc = { written: 0, failed: rejected };
  const report = () => onProgress(acc.written, acc.failed, acc.note);
  if (wire.length === 0) {
    report();
    return { written: acc.written, failed: acc.failed };
  }

  const at = Date.now();
  const persisted = setRatingsLocalBulk(wire.map((w) => toLocal(w, at)));
  if (!persisted) addNote(acc, t("Local storage is full, these ratings live on your account only."));
  report();

  const phase = await bulkPhase(wire, acc, report, signal);
  if (phase.fallback) {
    addNote(acc, t("Bulk upload is not live yet, sending one rating per second."));
    report();
    await singlePhase(wire, phase.next, acc, report, signal);
  }
  return { written: acc.written, failed: acc.failed };
}
