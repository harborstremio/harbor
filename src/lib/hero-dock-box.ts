/** Gap below the hero over which the rows fade back in. */
export const HERO_FADE_PX = 96;
const MIN_H = 220;
const MAX_H = 560;

export type HeroBox = { left: number; top: number; width: number; height: number };

/** The hero box for a content area: full width, 16:9 where it fits, never taller than ~46% of the window. */
export function heroBoxFor(area: { left: number; top: number; width: number }, viewportH: number, topOffset: number): HeroBox {
  const byWidth = (area.width * 9) / 16;
  const height = Math.round(Math.max(MIN_H, Math.min(MAX_H, byWidth, viewportH * 0.46)));
  return { left: Math.round(area.left), top: Math.round(area.top + topOffset), width: Math.round(area.width), height };
}
