import { stableCardNavigationRect } from "@/lib/poster-backdrop-expansion";

export type Dir = "up" | "down" | "left" | "right";

const SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
  '[data-focusable="true"]',
].join(", ");

const KEY_TO_DIR: Record<string, Dir> = {
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  Up: "up", Down: "down", Left: "left", Right: "right",
};

const CODE_TO_DIR: Record<string, Dir> = {
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
};

const KEYCODE_TO_DIR: Record<number, Dir> = {
  38: "up", 40: "down", 37: "left", 39: "right",
  19: "up", 20: "down", 21: "left", 22: "right",
};

export const CENTER_KEYCODES = new Set([13, 23, 32]);
const BACK_KEYCODES = new Set([27, 4, 461, 10009, 166]);
const BACK_KEYS = new Set(["Escape", "Esc", "BrowserBack", "GoBack", "Back"]);
const AXIS_TOLERANCE = 24;

const MODAL_SELECTOR = '[role="dialog"], [aria-modal="true"]';
const LOCAL_KEYBOARD_SELECTOR = [
  '[role="listbox"]',
  '[role="menu"]',
  '[role="grid"]',
  '[role="tree"]',
  '[role="tablist"]',
].join(", ");

export function isEditable(el: HTMLElement | null) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

export function isSearchLikeField(el: HTMLElement | null) {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  if (!(el instanceof HTMLInputElement)) return false;
  const type = (el.getAttribute("type") || "text").toLowerCase();
  const role = (el.getAttribute("role") || "").toLowerCase();
  const inputMode = (el.getAttribute("inputmode") || "").toLowerCase();
  const textEntryTypes = new Set(["text", "search", "email", "url", "tel", "password"]);
  return (
    textEntryTypes.has(type) ||
    role === "searchbox" ||
    inputMode === "search" ||
    inputMode === "text"
  );
}

export function navOwnsFocus(el: HTMLElement | null): boolean {
  return !!el && el.hasAttribute("data-tv-focused");
}

export function isVisible(el: HTMLElement) {
  if (!el.isConnected) return false;
  if (el.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || parseFloat(style.opacity) === 0) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  if (el.getClientRects().length === 0) return false;
  return true;
}

const ONSCREEN_MARGIN = 320;

export function isOnScreen(el: HTMLElement, margin = ONSCREEN_MARGIN): boolean {
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return false;
  const vw = window.innerWidth || document.documentElement.clientWidth;
  const vh = window.innerHeight || document.documentElement.clientHeight;
  if (r.right <= -margin || r.bottom <= -margin || r.left >= vw + margin || r.top >= vh + margin) {
    return false;
  }
  let node = el.parentElement;
  const clips = /(auto|scroll|hidden|clip)/;
  while (node && node !== document.body) {
    const s = window.getComputedStyle(node);
    if (clips.test(s.overflowX) || clips.test(s.overflowY)) {
      const cr = node.getBoundingClientRect();
      if (
        r.right <= cr.left - margin ||
        r.left >= cr.right + margin ||
        r.bottom <= cr.top - margin ||
        r.top >= cr.bottom + margin
      ) {
        return false;
      }
    }
    node = node.parentElement;
  }
  return true;
}

export function isInNav(el: HTMLElement): boolean {
  return !!el.closest("[data-harbor-nav]");
}

export function isInHero(el: HTMLElement): boolean {
  return !!el.closest("[data-tv-hero-zone]");
}

export function zoneOf(el: HTMLElement): "nav" | "hero" | "content" {
  if (isInNav(el)) return "nav";
  if (isInHero(el)) return "hero";
  return "content";
}

export function getSoundType(el: HTMLElement): "light" | "movie" {
  if (isInNav(el)) return "light";
  if (el.closest('[role="dialog"], [role="menu"], [role="tablist"], [role="switch"], form')) return "light";
  const container = el.closest('[data-media-card], [data-tv-hero-zone]');
  if (container || el.querySelector("img")) return "movie";
  return "light";
}

export function getFocusable(root: ParentNode = document): HTMLElement[] {
  const all = Array.from(root.querySelectorAll<HTMLElement>(SELECTOR)).filter(
    (el) => isVisible(el) && !el.closest("[data-tv-skip]") && (zoneOf(el) === "nav" || isOnScreen(el)),
  );
  return all.filter((el) => !all.some((other) => other !== el && other.contains(el)));
}

export function getFocusableInZone(
  zone: "nav" | "hero" | "content",
  root: ParentNode = document,
): HTMLElement[] {
  return getFocusable(root).filter((el) => zoneOf(el) === zone);
}

export function getNavCandidates(root: ParentNode = document): HTMLElement[] {
  return getFocusable(root).filter(isInNav);
}

const NAV_FOCUS_SELECTOR =
  "[data-harbor-nav], [data-tv-nav-zone] button, [data-harbor-sidebar] button, [data-tv-nav-zone] a[href], [data-harbor-sidebar] a[href], [data-tv-nav-zone] [data-focusable='true'], [data-harbor-sidebar] [data-focusable='true']";

export function getNavFocusTarget(): HTMLElement | null {
  const navItems = Array.from(document.querySelectorAll<HTMLElement>(NAV_FOCUS_SELECTOR)).filter(
    (el) => isVisible(el) && isInNav(el) && !el.closest("[data-tv-skip]"),
  );
  return (
    navItems.find(
      (el) =>
        el.matches('[data-active], [aria-current="page"]') ||
        !!el.closest('[data-active], [aria-current="page"]'),
    ) ??
    navItems[0] ??
    null
  );
}

export function scrollNavItemIntoView(el: HTMLElement, mode: "center" | "nearest" = "center") {
  const sidebarRoot =
    el.closest<HTMLElement>("[data-harbor-sidebar]") ?? el.closest<HTMLElement>("[data-tv-nav-zone]");
  if (!sidebarRoot) return;

  let scroller: HTMLElement | null = el.parentElement;
  while (scroller) {
    if (scroller.scrollHeight > scroller.clientHeight + 1) break;
    if (scroller === sidebarRoot) {
      scroller = null;
      break;
    }
    scroller = scroller.parentElement;
  }

  if (!scroller && sidebarRoot.scrollHeight > sidebarRoot.clientHeight + 1) {
    scroller = sidebarRoot;
  }
  if (!scroller) return;

  const itemRect = el.getBoundingClientRect();
  const scrollerRect = scroller.getBoundingClientRect();

  if (mode === "center") {
    const itemCenter = itemRect.top + itemRect.height / 2;
    const scrollerCenter = scrollerRect.top + scrollerRect.height / 2;
    scroller.scrollTo({ top: scroller.scrollTop + itemCenter - scrollerCenter, behavior: "smooth" });
    return;
  }

  const edgePadding = 12;
  if (itemRect.top < scrollerRect.top + edgePadding) {
    scroller.scrollBy({ top: itemRect.top - scrollerRect.top - edgePadding, behavior: "smooth" });
  } else if (itemRect.bottom > scrollerRect.bottom - edgePadding) {
    scroller.scrollBy({ top: itemRect.bottom - scrollerRect.bottom + edgePadding, behavior: "smooth" });
  }
}

export function getActiveModal(target: HTMLElement | null): HTMLElement | null {
  const owned = target?.closest<HTMLElement>(MODAL_SELECTOR);
  if (owned && isVisible(owned)) return owned;
  const visible = Array.from(document.querySelectorAll<HTMLElement>(MODAL_SELECTOR)).filter(isVisible);
  return visible[visible.length - 1] ?? null;
}

export function isLocallyManaged(target: HTMLElement | null): boolean {
  return !!target?.closest(LOCAL_KEYBOARD_SELECTOR);
}

function getRect(el: HTMLElement) {
  const cell = el.closest<HTMLElement>("[data-tv-nav-base-width]");
  const r = cell?.getBoundingClientRect() ?? el.getBoundingClientRect();
  const baseWidth = cell ? Number(cell.dataset.tvNavBaseWidth) : undefined;
  const rtl = cell ? window.getComputedStyle(cell).direction === "rtl" : false;
  return stableCardNavigationRect(r, baseWidth, rtl);
}

function overlap(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

export function findClosestByY(from: HTMLElement, candidates: HTMLElement[]): HTMLElement | null {
  const src = getRect(from);
  let best: HTMLElement | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const el of candidates) {
    if (el === from) continue;
    const dst = getRect(el);
    const score = Math.abs(dst.cy - src.cy) * 10 + Math.abs(dst.cx - src.cx);
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best;
}

export function hasLeftNeighborInRow(active: HTMLElement, root: ParentNode = document): boolean {
  const src = getRect(active);
  return getFocusable(root).some((el) => {
    if (el === active || isInNav(el)) return false;
    const dst = getRect(el);
    const sameRow = Math.abs(dst.cy - src.cy) < Math.max(24, src.height * 0.6);
    return sameRow && dst.cx < src.cx - 8;
  });
}

export function getDirection(e: KeyboardEvent): Dir | null {
  if (KEY_TO_DIR[e.key]) return KEY_TO_DIR[e.key];
  if (CODE_TO_DIR[e.code]) return CODE_TO_DIR[e.code];
  return KEYCODE_TO_DIR[e.keyCode] ?? null;
}

export function isBackKey(e: KeyboardEvent): boolean {
  if (BACK_KEYS.has(e.key)) return true;
  if (BACK_KEYCODES.has(e.keyCode)) return true;
  return false;
}

export function getInitialFocus(list: HTMLElement[]) {
  return list.find((el) => el.hasAttribute("data-tv-initial-focus")) ?? list[0] ?? null;
}

export function findBest(focused: HTMLElement, candidates: HTMLElement[], dir: Dir): HTMLElement | null {
  const src = getRect(focused);
  const horizontal = dir === "left" || dir === "right";
  const rowSlop = Math.max(24, src.height * 0.6);
  let best: HTMLElement | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const el of candidates) {
    if (el === focused) continue;
    const dst = getRect(el);

    if (dir === "right" && dst.cx <= src.cx + AXIS_TOLERANCE) continue;
    if (dir === "left" && dst.cx >= src.cx - AXIS_TOLERANCE) continue;
    if (dir === "down" && dst.cy <= src.cy + AXIS_TOLERANCE) continue;
    if (dir === "up" && dst.cy >= src.cy - AXIS_TOLERANCE) continue;

    if (horizontal && Math.abs(dst.cy - src.cy) >= rowSlop) continue;

    const primary =
      dir === "right" ? Math.max(0, dst.left - src.right) :
      dir === "left" ? Math.max(0, src.left - dst.right) :
      dir === "down" ? Math.max(0, dst.top - src.bottom) :
      Math.max(0, src.top - dst.bottom);

    const secondary = horizontal ? Math.abs(dst.cy - src.cy) : Math.abs(dst.cx - src.cx);

    const axisOverlap = horizontal
      ? overlap(src.top, src.bottom, dst.top, dst.bottom)
      : overlap(src.left, src.right, dst.left, dst.right);

    const overlapBonus = axisOverlap > 0 ? axisOverlap * 10 : 0;
    const score = primary * 10 + secondary * 3 - overlapBonus;

    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best;
}

export function getSpatialOrder(list: HTMLElement[]) {
  return [...list].sort((a, b) => {
    const ra = getRect(a);
    const rb = getRect(b);
    if (Math.abs(ra.top - rb.top) > 8) return ra.top - rb.top;
    return ra.left - rb.left;
  });
}
