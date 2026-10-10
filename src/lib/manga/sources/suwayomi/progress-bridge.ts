import { pushChapterProgress } from "./sync";
import { decodeChapterId } from "./model";
import { soleSuwayomiBase, suwayomiBaseForSource } from "./auth-registry";

type Pending = { baseUrl: string; chapterId: string; page: number; totalPages: number; completed?: boolean };

const queue = new Map<string, Pending>();
const timers = new Map<string, number>();
const DEBOUNCE_MS = 1500;

let resolver: ((sourceId: string) => string | null) | null = null;

export function setSuwayomiBaseResolver(fn: (sourceId: string) => string | null): void {
  resolver = fn;
}

const AGG_SEP = "::";

function stripAggregate(chapterId: string): { harborId?: string; raw: string } {
  const i = chapterId.indexOf(AGG_SEP);
  if (i === -1) return { raw: chapterId };
  return { harborId: chapterId.slice(0, i), raw: chapterId.slice(i + AGG_SEP.length) };
}

function baseForChapter(rawChapterId: string, harborId?: string): string | null {
  const parsed = decodeChapterId(rawChapterId);
  if (parsed) {
    const bySource = suwayomiBaseForSource(parsed.sourceId);
    if (bySource) return bySource;
  }
  if (harborId && harborId !== "all" && resolver) {
    const viaHarbor = resolver(harborId);
    if (viaHarbor) return viaHarbor;
  }
  return soleSuwayomiBase() ?? null;
}

function flush(chapterId: string): void {
  const item = queue.get(chapterId);
  queue.delete(chapterId);
  timers.delete(chapterId);
  if (!item) return;
  void pushChapterProgress(item.baseUrl, item.chapterId, item.page, item.totalPages, item.completed).catch(() => {});
}

export function queueSuwayomiProgress(entry: {
  sourceId?: string;
  chapterId: string;
  page: number;
  totalPages: number;
  completed?: boolean;
}): void {
  if (!entry.chapterId) return;
  const { harborId, raw } = stripAggregate(entry.chapterId);
  if (!decodeChapterId(raw)) return;
  const baseUrl = baseForChapter(raw, harborId ?? entry.sourceId);
  if (!baseUrl) return;
  queue.set(raw, { baseUrl, chapterId: raw, page: entry.page, totalPages: entry.totalPages, completed: entry.completed });
  const existing = timers.get(raw);
  if (existing) window.clearTimeout(existing);
  timers.set(raw, window.setTimeout(() => flush(raw), DEBOUNCE_MS));
}

export function flushSuwayomiProgress(): void {
  for (const id of [...queue.keys()]) {
    const t = timers.get(id);
    if (t) window.clearTimeout(t);
    flush(id);
  }
}

if (typeof window !== "undefined") {
  const onLeave = () => flushSuwayomiProgress();
  window.addEventListener("pagehide", onLeave);
  window.addEventListener("beforeunload", onLeave);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushSuwayomiProgress();
  });
}
