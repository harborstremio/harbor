import { useEffect, useRef } from "react";
import { SFX } from "@/lib/sfx";
import {
  CENTER_KEYCODES,
  findBest,
  findClosestByY,
  getActiveModal,
  getDirection,
  getFocusable,
  getFocusableInZone,
  getInitialFocus,
  getNavCandidates,
  getNavFocusTarget,
  getSoundType,
  getSpatialOrder,
  hasLeftNeighborInRow,
  isBackKey,
  isEditable,
  isInHero,
  isInNav,
  isLocallyManaged,
  isSearchLikeField,
  navOwnsFocus,
  scrollNavItemIntoView,
  zoneOf,
  type Dir,
} from "./keyboard-navigation/geometry";

const TV_NAV_KEY: Record<Dir | "back", string> = {
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
  back: "Escape",
};

export function dispatchTvNav(action: Dir | "select" | "back" | "home"): void {
  if (typeof window === "undefined") return;
  const range = document.activeElement instanceof HTMLInputElement && document.activeElement.type === "range" && document.activeElement.hasAttribute("data-gamepad-adjusting") ? document.activeElement : null;
  if (range && (action === "left" || action === "right")) {
    const step = +range.step || 1, value = Math.max(+range.min, Math.min(+range.max, +range.value + (action === "left" ? -step : step)));
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(range, String(value));
    range.dispatchEvent(new Event("input", { bubbles: true })); range.dispatchEvent(new Event("change", { bubbles: true }));
    return;
  }
  if (range && action !== "select") { range.removeAttribute("data-gamepad-adjusting"); range.blur(); }
  if (action === "home") {
    const homeNav = document.querySelector('[data-harbor-nav="home"]');
    if (homeNav instanceof HTMLElement) homeNav.click();
    return;
  }
  if (action === "select") {
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (active && !isEditable(active)) active.click();
    return;
  }
  if (action === "back" && !window.dispatchEvent(new Event("harbor:local-back", { cancelable: true }))) return;
  const anchor = action !== "back" ? hoveredEl : null;
  const fromHover = !!anchor;
  if (anchor) {
    anchor.focus({ preventScroll: true });
    hoveredEl = null;
  }
  const key = TV_NAV_KEY[action];
  suppressFocusScroll = fromHover;
  window.dispatchEvent(
    new KeyboardEvent("keydown", { key, code: key, bubbles: true, cancelable: true }),
  );
  suppressFocusScroll = false;
}

let focusStylesInjected = false;
function ensureFocusStyles() {
  if (focusStylesInjected || typeof document === "undefined") return;
  focusStylesInjected = true;
  const style = document.createElement("style");
  style.setAttribute("data-tv-focus-styles", "true");
  style.textContent = `
    html:not([data-input-modality="pointer"]) [data-tv-focused="true"] {
      outline: none !important;
      box-shadow: 0 0 0 2px var(--color-canvas), 0 0 0 5px var(--tv-focus-ring, var(--color-accent)), 0 0 0 7px rgba(0,0,0,0.45) !important;
      transition: box-shadow 120ms ease;
      z-index: 20;
      position: relative;
    }
  `;
  document.head.appendChild(style);
}

let lastFocusedEl: HTMLElement | null = null;
let hoveredEl: HTMLElement | null = null;
let suppressFocusScroll = false;

export function tvFocus(el: HTMLElement) {
  focusElement(el);
}

export function tvHover(el: HTMLElement | null) {
  clearTvFocusRing();
  hoveredEl = el;
}

function clearTvFocusRing() {
  lastFocusedEl?.removeAttribute("data-tv-focused");
  lastFocusedEl = null;
}

type InputModality = "pointer" | "keys";
let inputModality: InputModality | null = null;
let lastPointerX: number | null = null;
let lastPointerY: number | null = null;

function reflectModality() {
  if (typeof document === "undefined" || !inputModality) return;
  document.documentElement.setAttribute("data-input-modality", inputModality);
}

function setKeysModality() {
  if (inputModality === "keys") return;
  inputModality = "keys";
  reflectModality();
}

function setPointerModality() {
  if (inputModality === "pointer") return;
  inputModality = "pointer";
  reflectModality();
  clearTvFocusRing();
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  if (active && !isEditable(active)) active.blur();
}

function notePointerMove(x: number, y: number) {
  const moved = lastPointerX !== null && (x !== lastPointerX || y !== lastPointerY);
  lastPointerX = x;
  lastPointerY = y;
  if (moved) setPointerModality();
}

function focusElement(el: HTMLElement) {
  ensureFocusStyles();
  if (lastFocusedEl && lastFocusedEl !== el) clearTvFocusRing();
  el.setAttribute("data-tv-focused", "true");
  lastFocusedEl = el;

  el.focus({ preventScroll: true });
  if (suppressFocusScroll) return;
  if (isInHero(el)) {
    const scroller = getScrollParent(el);
    if (scroller) scroller.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    return;
  }
  if (isInNav(el)) {
    scrollNavItemIntoView(el);
    return;
  }
  el.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
}

function getScrollParent(el: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const style = getComputedStyle(node);
    if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

let activeSearchEditEl: HTMLElement | null = null;

function enterSearchEditMode(el: HTMLElement) {
  activeSearchEditEl = el;
  el.setAttribute("data-search-editing", "true");
  el.focus({ preventScroll: true });
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const len = el.value.length;
    try {
      el.setSelectionRange(len, len);
    } catch {}
  }
}

function exitSearchEditMode() {
  const el = activeSearchEditEl;
  if (!el) return;
  activeSearchEditEl = null;
  el.removeAttribute("data-search-editing");
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.blur();
  focusElement(el);
}

type TVNavigationOptions = {
  enabled?: boolean;
  wrap?: boolean;
  arrows?: boolean;
  onBack?: () => boolean;
  onBackToNav?: () => void;
};

export function useKeyboardNavigation(options: TVNavigationOptions = {}) {
  const { enabled = true, wrap = true, arrows = true, onBack, onBackToNav } = options;

  const arrowsRef = useRef(arrows);
  arrowsRef.current = arrows;

  useEffect(() => {
    if (!enabled) {
      clearTvFocusRing();
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "Tab") setKeysModality();

      const target = e.target instanceof HTMLElement ? e.target : null;
      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const activeModal = getActiveModal(target);
      const editingSearch = activeSearchEditEl != null && activeSearchEditEl === active;

      if (isBackKey(e) && editingSearch) {
        e.preventDefault();
        e.stopPropagation();
        SFX.close();
        exitSearchEditMode();
        return;
      }

      if (editingSearch) return;

      const navSearch = isSearchLikeField(active) && navOwnsFocus(active);
      if (isEditable(active) && !navSearch) return;

      if (isBackKey(e)) {
        if (activeModal) return;
        e.preventDefault();
        SFX.close();
        const handled = onBack ? onBack() : false;
        if (!handled) {
          if (onBackToNav) {
            onBackToNav();
          } else {
            const nav = getNavFocusTarget();
            if (nav) focusElement(nav);
          }
        }
        return;
      }

      const dir = getDirection(e);

      if (dir) {
        setKeysModality();
        if (!arrowsRef.current) return;
        if (isLocallyManaged(target)) return;
        e.preventDefault();

        const root = activeModal ?? document;

        if (active && dir === "left" && !isInNav(active) && !hasLeftNeighborInRow(active, root)) {
          const toNav = findClosestByY(active, getNavCandidates(root));
          if (toNav) {
            SFX.navigate(dir, getSoundType(toNav));
            focusElement(toNav);
            return;
          }
        }

        if (active && dir === "right" && isInNav(active)) {
          const toContent = findClosestByY(active, getFocusable(root).filter((el) => !isInNav(el)));
          if (toContent) {
            SFX.navigate(dir, getSoundType(toContent));
            focusElement(toContent);
            return;
          }
        }

        const zone = active ? zoneOf(active) : "content";
        const all = getFocusableInZone(zone, root);
        if (!all.length) return;

        if (!active || !all.includes(active)) {
          const first = getInitialFocus(all);
          if (first) {
            SFX.navigate(dir, getSoundType(first));
            focusElement(first);
          }
          return;
        }

        if (zone === "hero" && (dir === "up" || dir === "down")) {
          if (dir === "down") {
            const contentItems = getFocusableInZone("content", root);
            const first = getInitialFocus(contentItems);
            if (first) {
              SFX.navigate(dir, getSoundType(first));
              focusElement(first);
            }
          }
          return;
        }

        const best = findBest(active, all, dir);
        if (best) {
          SFX.navigate(dir, getSoundType(best));
          focusElement(best);
          return;
        }

        if (wrap) {
          const ordered = getSpatialOrder(all);
          const idx = ordered.indexOf(active);
          if (idx >= 0) {
            const next =
              dir === "down" || dir === "right"
                ? ordered[idx + 1] ?? ordered[0]
                : ordered[idx - 1] ?? ordered[ordered.length - 1];
            if (next) {
              SFX.navigate(dir, getSoundType(next));
              focusElement(next);
            }
          }
        }
        return;
      }

      const isCenter = CENTER_KEYCODES.has(e.keyCode) || e.key === "Enter" || e.code === "Enter";
      if (navSearch && !editingSearch && !isCenter) {
        const wouldEditText =
          e.key.length === 1 ||
          e.key === "Backspace" ||
          e.key === "Delete" ||
          e.key === "Home" ||
          e.key === "End";
        if (wouldEditText) {
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }
      if (!isCenter) return;
      if (isLocallyManaged(target)) return;
      if (!active) return;

      if (navSearch) {
        e.preventDefault();
        SFX.open();
        enterSearchEditMode(active);
        return;
      }

      if (isEditable(active)) return;

      const nativeClickable = active.matches(
        'button, a[href], input[type="button"], input[type="submit"], input[type="checkbox"], input[type="radio"]',
      );

      if (e.key === " " && nativeClickable) return;
      if (e.key === "Enter" && nativeClickable) return;

      e.preventDefault();
      active.click();
    };

    const onPointerDown = () => {
      setPointerModality();
      if (activeSearchEditEl) {
        activeSearchEditEl.removeAttribute("data-search-editing");
        activeSearchEditEl = null;
      }
      if (lastFocusedEl) {
        lastFocusedEl.removeAttribute("data-tv-focused");
        lastFocusedEl = null;
      }
    };

    const onPointerMove = (e: PointerEvent) => notePointerMove(e.screenX, e.screenY);
    const onWheel = () => setPointerModality();

    window.addEventListener("keydown", onKeyDown, false);
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("wheel", onWheel, { capture: true, passive: true });
    return () => {
      window.removeEventListener("keydown", onKeyDown, false);
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("wheel", onWheel, true);
      if (activeSearchEditEl) {
        activeSearchEditEl.removeAttribute("data-search-editing");
        activeSearchEditEl = null;
      }
    };
  }, [enabled, wrap, onBack, onBackToNav]);
}
