import { useEffect, useRef } from "react";
import type { MangaBookmark } from "@/lib/manga-bookmarks";
import type { RemoteMangaChapter, RemoteMangaState } from "./protocol";
import { registerRemoteManga, type RemoteMangaBinding } from "./manga-session";

type Params = {
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
  fit: RemoteMangaState["fit"];
  bg: RemoteMangaState["bg"];
  mode: RemoteMangaState["mode"];
  hasPrev: boolean;
  hasNext: boolean;
  turnPage: (dir: "next" | "prev") => void;
  setPage: (page: number, scroll?: number, vel?: number) => void;
  jumpChapter: (index: number) => void;
  zoomBy: (delta: number) => void;
  setZoom: (zoom: number) => void;
  pan: (dx: number, dy: number) => void;
  flipProgress: (p: number) => void;
  flipEnd: (commit: boolean, dir: "next" | "prev") => void;
  setRtl: (rtl: boolean) => void;
  setMode: (mode: RemoteMangaState["mode"]) => void;
  setPagesHidden: (hidden: boolean) => void;
  setFit: (fit: RemoteMangaState["fit"]) => void;
  setBg: (bg: RemoteMangaState["bg"]) => void;
  bookmarkCurrent: () => Omit<MangaBookmark, "id" | "name" | "createdAt">;
  jumpBookmark: (bm: MangaBookmark) => void;
  close: () => void;
  exitLocalReader: number;
};

export function useMangaRemoteBinding(params: Params) {
  const ref = useRef(params);
  ref.current = params;

  useEffect(() => {
    const next: RemoteMangaBinding = {
      mangaId: params.mangaId,
      title: params.title,
      cover: params.cover,
      pid: params.pid,
      chapterId: params.chapterId,
      chapterIndex: params.chapterIndex,
      chapterLabel: params.chapterLabel,
      chapters: params.chapters,
      pageIndex: params.pageIndex,
      pageCount: params.pageCount,
      spread: params.spread,
      pageUrls: params.pageUrls,
      zoom: params.zoom,
      canZoom: params.canZoom,
      rtl: params.rtl,
      fit: params.fit,
      bg: params.bg,
      mode: params.mode,
      hasPrev: params.hasPrev,
      hasNext: params.hasNext,
      turnPage: (dir) => ref.current.turnPage(dir),
      setPage: (page, scroll, vel) => ref.current.setPage(page, scroll, vel),
      jumpChapter: (index) => ref.current.jumpChapter(index),
      zoomBy: (delta) => ref.current.zoomBy(delta),
      setZoom: (zoom) => ref.current.setZoom(zoom),
      pan: (dx, dy) => ref.current.pan(dx, dy),
      flipProgress: (p) => ref.current.flipProgress(p),
      flipEnd: (commit, dir) => ref.current.flipEnd(commit, dir),
      setRtl: (rtl) => ref.current.setRtl(rtl),
      setMode: (mode) => ref.current.setMode(mode),
      setPagesHidden: (hidden) => ref.current.setPagesHidden(hidden),
      setFit: (fit) => ref.current.setFit(fit),
      setBg: (bg) => ref.current.setBg(bg),
      bookmarkCurrent: () => ref.current.bookmarkCurrent(),
      jumpBookmark: (bm) => ref.current.jumpBookmark(bm),
      close: () => ref.current.close(),
      exitLocalReader: params.exitLocalReader,
    };
    registerRemoteManga(next);
  }, [
    params.mangaId,
    params.chapterId,
    params.chapterIndex,
    params.chapterLabel,
    params.chapters,
    params.pageIndex,
    params.pageCount,
    params.spread.join(","),
    params.zoom,
    params.canZoom,
    params.rtl,
    params.fit,
    params.bg,
    params.mode,
    params.hasPrev,
    params.hasNext,
    params.exitLocalReader,
  ]);

  useEffect(() => {
    return () => {
      registerRemoteManga(null);
    };
  }, []);
}
