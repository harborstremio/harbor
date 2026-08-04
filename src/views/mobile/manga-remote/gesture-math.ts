export type TurnDir = "next" | "prev";

export const SLOP = 8;
export const TAP_SLOP = 10;
export const TAP_MS = 250;
export const DOUBLE_TAP_MS = 280;
export const TURN_FRAC = 0.28;
export const FLICK_VEL = 0.5;
export const FRICTION = 0.004;
export const RUBBER = 0.35;
export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 3;
export const EDGE_GUTTER = 28;

export function project(velocity: number, friction = FRICTION): number {
  if (friction <= 0) return 0;
  return (velocity * Math.abs(velocity)) / (2 * friction);
}

export function emaVel(previous: number, sample: number, alpha = 0.3): number {
  return alpha * sample + (1 - alpha) * previous;
}

export function readingDir(dx: number, _rtl: boolean): TurnDir {
  return dx < 0 ? "next" : "prev";
}

export function clampZoom(z: number): number {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(z * 100) / 100));
}
