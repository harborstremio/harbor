export type KaraokeMotion = "smooth" | "instant";
export type KaraokeLineState = "past" | "current" | "upcoming";

export const KARAOKE_STEP_LIMIT = 3;
const ANCHOR = 0.36;

export type KaraokeMove = {
  from: number;
  to: number;
  trackChanged?: boolean;
  reducedMotion?: boolean;
};

export function karaokeScrollMotion(move: KaraokeMove): KaraokeMotion {
  if (move.reducedMotion || move.trackChanged) return "instant";
  if (!Number.isFinite(move.from) || !Number.isFinite(move.to)) return "instant";
  if (move.from < 0 || move.to < 0) return "instant";
  return Math.abs(move.to - move.from) <= KARAOKE_STEP_LIMIT ? "smooth" : "instant";
}

export function karaokeLineState(index: number, active: number): KaraokeLineState {
  if (active < 0 || index > active) return "upcoming";
  return index === active ? "current" : "past";
}

export type KaraokeView = {
  lineTop: number;
  lineHeight: number;
  viewHeight: number;
  maxScroll?: number;
  anchor?: number;
};

export function karaokeScrollTop(view: KaraokeView): number {
  const anchor =
    typeof view.anchor === "number" && view.anchor >= 0 && view.anchor <= 1 ? view.anchor : ANCHOR;
  const target = view.lineTop + view.lineHeight / 2 - view.viewHeight * anchor;
  if (!Number.isFinite(target)) return 0;
  const ceiling =
    typeof view.maxScroll === "number" && view.maxScroll > 0 ? view.maxScroll : Infinity;
  return Math.max(0, Math.min(target, ceiling));
}
