import { bigPictureChromeState } from "./bp-logic";

export const BP_WHO_ROW_MAX = 6;

/**
 * Balanced rows, never a ragged last row of one. Seven profiles read as four and
 * three, not six and one, and the second row keeps the same centre line as the
 * first so the D-pad's Down lands where the eye already is.
 */
export function bpWhoRows<T>(items: readonly T[]): T[][] {
  if (items.length === 0) return [];
  if (items.length <= BP_WHO_ROW_MAX) return [items.slice()];
  const rows = Math.ceil(items.length / BP_WHO_ROW_MAX);
  const per = Math.ceil(items.length / rows);
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += per) out.push(items.slice(i, i + per));
  return out;
}

// The face shrinks rather than the surface scrolling. A scroller here would be a
// trap: centerScroll in bp-focus-core returns early for anything inside a
// [data-bp-rail-row], so a rail that overflows can never be scrolled to.
export function bpWhoFaceSize(count: number): string {
  if (count <= 6) return "clamp(120px, 11vw, 190px)";
  if (count <= 12) return "clamp(96px, 8.6vw, 150px)";
  return "clamp(76px, 6.8vw, 118px)";
}

export function bpWhoNameSize(count: number): string {
  if (count <= 6) return "clamp(15px, 2.1vh, 24px)";
  if (count <= 12) return "clamp(14px, 1.85vh, 20px)";
  return "clamp(12.5px, 1.55vh, 17px)";
}

/**
 * Whether Big Picture keeps running with a kid profile active. Asked of the same
 * pure function the shell uses, so this answer changes by itself the day
 * bp-logic learns about the TV shell. Do not cache it in a module constant.
 */
export function bpWhoKidStaysInBigPicture(): boolean {
  return bigPictureChromeState({
    active: true,
    kidProfileActive: true,
    playbackOpen: false,
  }).mounted;
}

/**
 * Whether leaving Big Picture lands on a real screen. The desktop entry renders
 * the whole app inside #root and Big Picture portals to document.body on top of
 * it, so #root always has children there. The Android TV entry renders only
 * BpTvSound, GamepadRunner and the portal, so #root is empty and
 * exitBigPicture() would leave a black screen with nothing to come back to.
 */
export function bpWhoExitHasHost(): boolean {
  if (typeof document === "undefined") return false;
  const root = document.getElementById("root");
  return root !== null && root.childElementCount > 0;
}

/**
 * bp-shell force-exits Big Picture the moment a kid profile becomes active. On
 * the TV entry that exit has nowhere to go, so selecting a kid here would black
 * the screen. Allowed either when the shell now keeps kids inside Big Picture,
 * or when there is a host to exit into.
 */
export function bpWhoKidSelectable(): boolean {
  return bpWhoKidStaysInBigPicture() || bpWhoExitHasHost();
}

export function bpWhoPrefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function bpWhoTileKey(profileId: string): string {
  return `who:${profileId}`;
}
