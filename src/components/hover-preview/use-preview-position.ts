import type { AnchorRect } from "@/lib/hover-preview/store";
import {
  GUTTER_PX,
  PANEL_W_COMPACT,
  PANEL_W_DEFAULT,
  PANEL_W_LARGE,
  POSTER_SCALE_DEFAULT_MIN,
  POSTER_SCALE_LARGE_MIN,
} from "@/lib/hover-preview/timing";

export type PanelPlacement = { left: number; top: number; originX: number; originY: number };

const NAV_CLEAR_PX = 64;

export function panelWidthFor(posterScale: number): number {
  if (posterScale < POSTER_SCALE_DEFAULT_MIN) return PANEL_W_COMPACT;
  if (posterScale < POSTER_SCALE_LARGE_MIN) return PANEL_W_DEFAULT;
  return PANEL_W_LARGE;
}

export function crownHeightFor(width: number): number {
  return Math.round((width * 9) / 16);
}

export function placePanel(
  rect: AnchorRect,
  panelW: number,
  panelH: number,
  topInset: number,
  mode: "over" | "side" = "over",
): PanelPlacement {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const edgeInset = Math.max(GUTTER_PX, NAV_CLEAR_PX);
  let left: number;
  if (mode === "side") {
    const toRight = rect.left + rect.width + GUTTER_PX;
    const toLeft = rect.left - panelW - GUTTER_PX;
    if (toRight + panelW <= window.innerWidth - GUTTER_PX) left = toRight;
    else if (toLeft >= edgeInset) left = toLeft;
    else left = Math.max(edgeInset, Math.min(cx - panelW / 2, window.innerWidth - panelW - edgeInset));
    left = Math.round(left);
  } else {
    left = Math.round(Math.max(edgeInset, Math.min(cx - panelW / 2, window.innerWidth - panelW - edgeInset)));
  }
  const maxTop = window.innerHeight - panelH - GUTTER_PX;
  const top = Math.round(
    maxTop < topInset ? Math.max(GUTTER_PX, maxTop) : Math.max(topInset, Math.min(cy - panelH / 2, maxTop)),
  );
  return { left, top, originX: Math.round(cx - left), originY: Math.round(cy - top) };
}
