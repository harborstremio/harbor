export const PORT_CARD_W = 320;
const GAP = 14;
const EDGE = 12;

export type Box = { left: number; top: number; right: number; bottom: number };
export type Spot = { left: number; top: number; origin: string; side: "left" | "right" | "top" | "bottom" };

export function placeBeside(
  anchor: Box,
  height: number,
  panel: Box | null,
  viewW: number,
  viewH: number,
  rtl: boolean,
  width = PORT_CARD_W,
): Spot {
  const top = Math.max(EDGE, Math.min(anchor.top, viewH - height - EDGE));
  const host = panel ?? anchor;
  const atRight = host.right + GAP;
  const atLeft = host.left - GAP - width;
  const fitsRight = atRight + width <= viewW - EDGE;
  const fitsLeft = atLeft >= EDGE;
  const sides = rtl
    ? [fitsLeft && "left", fitsRight && "right"]
    : [fitsRight && "right", fitsLeft && "left"];
  const side = sides.find(Boolean);
  if (side === "right") return { left: atRight, top, origin: "top left", side };
  if (side === "left") return { left: atLeft, top, origin: "top right", side };
  const below = anchor.bottom + GAP + height <= viewH - EDGE;
  const y = below ? anchor.bottom + GAP : Math.max(EDGE, anchor.top - GAP - height);
  const x = Math.max(EDGE, Math.min(anchor.left, viewW - width - EDGE));
  return { left: x, top: y, origin: below ? "top left" : "bottom left", side: below ? "bottom" : "top" };
}
