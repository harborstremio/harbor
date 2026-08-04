/**
 * Tap-zone → page step for paged/horizontal reader modes.
 * Left third and right third of the page surface, swapped under RTL.
 */
export function pageStepForTap(xRatio: number, rtl: boolean): "prev" | "next" | null {
  if (xRatio < 0.35) return rtl ? "next" : "prev";
  if (xRatio > 0.65) return rtl ? "prev" : "next";
  return null;
}

/** Keyboard arrow that advances to the next page under the current reading direction. */
export function nextPageKey(rtl: boolean, horizontal: boolean): "ArrowLeft" | "ArrowRight" {
  if (!horizontal) return "ArrowRight";
  return rtl ? "ArrowLeft" : "ArrowRight";
}

export function prevPageKey(rtl: boolean, horizontal: boolean): "ArrowLeft" | "ArrowRight" {
  if (!horizontal) return "ArrowLeft";
  return rtl ? "ArrowRight" : "ArrowLeft";
}

/** Horizontal wheel/scroll sign: positive deltaY scrolls toward "next" content. */
export function horizontalScrollSign(rtl: boolean): 1 | -1 {
  return rtl ? -1 : 1;
}
