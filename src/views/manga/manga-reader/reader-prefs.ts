import type { CSSProperties } from "react";
import type { ReaderBg, ReaderFit, ReaderPrefs } from "./reader-types";

export type { ReaderBg, ReaderFit, ReaderPrefs };

export const PREFS_KEY = "harbor.manga.reader.v1";

export const DEFAULT_PREFS: ReaderPrefs = {
  mode: "long",
  fit: "width",
  bg: "dark",
  zoom: 1,
  rtl: true,
  autoNextChapter: true,
  navPos: "stack-br",
  doubleGap: 8,
  flipSound: true,
  focusMode: false,
  hideChapterEndHint: false,
};

const MODES = new Set<ReaderPrefs["mode"]>(["long", "long-h", "paged", "double", "book"]);
const FITS = new Set<ReaderFit>(["width", "height", "original"]);
const BGS_OK = new Set<ReaderBg>(["dark", "gray", "light"]);

export function loadPrefs(): ReaderPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") as Partial<ReaderPrefs>;
    const next: ReaderPrefs = { ...DEFAULT_PREFS, ...raw };
    if (!MODES.has(next.mode)) next.mode = DEFAULT_PREFS.mode;
    if (!FITS.has(next.fit)) next.fit = DEFAULT_PREFS.fit;
    if (!BGS_OK.has(next.bg)) next.bg = DEFAULT_PREFS.bg;
    if (typeof next.zoom !== "number" || !Number.isFinite(next.zoom)) next.zoom = 1;
    next.zoom = Math.min(3, Math.max(0.5, next.zoom));
    next.rtl = !!next.rtl;
    next.autoNextChapter = next.autoNextChapter !== false;
    next.flipSound = next.flipSound !== false;
    next.focusMode = !!next.focusMode;
    next.hideChapterEndHint = !!next.hideChapterEndHint;
    if (typeof next.doubleGap !== "number" || !Number.isFinite(next.doubleGap)) {
      next.doubleGap = DEFAULT_PREFS.doubleGap;
    }
    return next;
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export const BG: Record<ReaderBg, string> = {
  dark: "bg-[#0b0b0d]",
  gray: "bg-neutral-800",
  light: "bg-neutral-100",
};

export const BG_HEX: Record<ReaderBg, string> = {
  dark: "#0b0b0d",
  gray: "#262626",
  light: "#f5f5f5",
};

export function pageStyle(fit: ReaderFit, zoom: number): CSSProperties {
  if (fit === "height")
    return { height: `${Math.round(94 * zoom)}vh`, width: "auto", maxWidth: "100%" };
  if (fit === "original") return { width: `${Math.round(zoom * 100)}%`, maxWidth: "none" };
  return { width: "100%", maxWidth: `${Math.round(880 * zoom)}px` };
}

export function doublePageStyle(fit: ReaderFit, zoom: number): CSSProperties {
  if (fit === "width") return { width: "100%", maxWidth: `${Math.round(440 * zoom)}px` };
  if (fit === "original") return { width: `${Math.round(zoom * 100)}%`, maxWidth: "none" };
  return { maxHeight: `${Math.round(92 * zoom)}vh`, maxWidth: "100%", width: "auto" };
}
