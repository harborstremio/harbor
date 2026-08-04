import {
  addMangaBookmark,
  listMangaBookmarks,
  removeMangaBookmark,
  type MangaBookmark,
} from "@/lib/manga-bookmarks";
import type { RemoteCommand, RemoteMangaChapter, RemoteMangaState } from "./protocol";

export { subscribeMangaBookmarks } from "@/lib/manga-bookmarks";

export type RemoteMangaBinding = {
  mangaId: string;
  title: string;
  cover: string | null;
  pid: string;
  chapterId: string;
  chapterIndex: number;
  chapterLabel: string;
  chapters: RemoteMangaChapter[];
  pageIndex: number;
  pageCount: number;
  spread: number[];
  pageUrls: string[];
  zoom: number;
  canZoom: boolean;
  rtl: boolean;
  mode: RemoteMangaState["mode"];
  hasPrev: boolean;
  hasNext: boolean;
  turnPage: (dir: "next" | "prev") => void;
  setPage: (page: number) => void;
  jumpChapter: (index: number) => void;
  zoomBy: (delta: number) => void;
  setZoom: (zoom: number) => void;
  pan: (dx: number, dy: number) => void;
  flipProgress: (p: number) => void;
  flipEnd: (commit: boolean, dir: "next" | "prev") => void;
  setRtl: (rtl: boolean) => void;
  bookmarkCurrent: () => Omit<MangaBookmark, "id" | "name" | "createdAt">;
  jumpBookmark: (bm: MangaBookmark) => void;
  close: () => void;
};

type Listener = () => void;

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.1;
const clampZoom = (z: number) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(z * 100) / 100));

let binding: RemoteMangaBinding | null = null;
let stateSeq = 0;
const listeners = new Set<Listener>();

function notify(): void {
  for (const l of listeners) l();
}

export function subscribeRemoteManga(cb: Listener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function registerRemoteManga(next: RemoteMangaBinding | null): void {
  binding = next;
  if (next) stateSeq += 1;
  notify();
}

export function isMangaCommand(action: string): boolean {
  return action.startsWith("manga");
}

export function buildRemoteMangaState(): RemoteMangaState | null {
  const b = binding;
  if (!b) return null;
  const bookmarks = listMangaBookmarks(b.pid)
    .filter((x) => x.mangaId === b.mangaId)
    .map((bm) => ({
      id: bm.id,
      chapterId: bm.chapterId,
      chapterLabel: bm.chapterLabel,
      page: bm.page,
      totalPages: bm.totalPages,
      name: bm.name,
      createdAt: bm.createdAt,
    }));
  return {
    open: true,
    seq: stateSeq,
    mangaId: b.mangaId,
    title: b.title,
    cover: b.cover,
    chapterId: b.chapterId,
    chapterIndex: b.chapterIndex,
    chapterLabel: b.chapterLabel,
    chapters: b.chapters,
    pageIndex: b.pageIndex,
    pageCount: b.pageCount,
    spread: b.spread,
    pageUrls: b.pageUrls,
    zoom: b.zoom,
    canZoom: b.canZoom,
    rtl: b.rtl,
    mode: b.mode,
    hasPrev: b.hasPrev,
    hasNext: b.hasNext,
    bookmarks,
  };
}

export async function dispatchMangaCommand(command: RemoteCommand): Promise<void> {
  const b = binding;
  if (!b) return;
  switch (command.action) {
    case "mangaTurnPage":
      b.turnPage(command.dir);
      return;
    case "mangaSetPage":
      b.setPage(command.page);
      return;
    case "mangaJumpChapter":
      if (command.index >= 0 && command.index < b.chapters.length) b.jumpChapter(command.index);
      return;
    case "mangaZoomIn":
      b.zoomBy(ZOOM_STEP);
      return;
    case "mangaZoomOut":
      b.zoomBy(-ZOOM_STEP);
      return;
    case "mangaSetZoom":
      b.setZoom(clampZoom(command.zoom));
      return;
    case "mangaPan":
      b.pan(command.dx, command.dy);
      return;
    case "mangaFlipProgress":
      b.flipProgress(command.p);
      return;
    case "mangaFlipEnd":
      b.flipEnd(command.commit, command.dir);
      return;
    case "mangaSetRtl":
      b.setRtl(command.rtl);
      return;
    case "mangaBookmark": {
      const base = b.bookmarkCurrent();
      addMangaBookmark(b.pid, command.page != null ? { ...base, page: command.page } : base);
      return;
    }
    case "mangaJumpBookmark": {
      const bm = listMangaBookmarks(b.pid).find((x) => x.id === command.id);
      if (bm) b.jumpBookmark(bm);
      return;
    }
    case "mangaBookmarkRemove":
      removeMangaBookmark(b.pid, command.id);
      return;
    case "mangaCloseReader":
      b.close();
      return;
    default:
      return;
  }
}
