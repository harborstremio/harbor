import { useEffect } from 'react';

type Dir = 'up' | 'down' | 'left' | 'right';

const SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
  '[data-focusable="true"]',
].join(', ');

const KEY_TO_DIR: Record<string, Dir> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  Up: 'up', Down: 'down', Left: 'left', Right: 'right',
  w: 'up', W: 'up', s: 'down', S: 'down', a: 'left', A: 'left', d: 'right', D: 'right',
};

const CODE_TO_DIR: Record<string, Dir> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
};

const KEYCODE_TO_DIR: Record<number, Dir> = {
  38: 'up', 40: 'down', 37: 'left', 39: 'right',
  19: 'up', 20: 'down', 21: 'left', 22: 'right',
  87: 'up', 83: 'down', 65: 'left', 68: 'right',
};

const CENTER_KEYCODES = new Set([13, 23, 32]);

// 4 = Android TV / Android WebView hardware BACK (KEYCODE_BACK)
const BACK_KEYCODES = new Set([27, 4, 461, 10009, 166]);
const BACK_KEYS = new Set(['Escape', 'Esc', 'BrowserBack', 'GoBack', 'Back']);

const MODAL_SELECTOR = '[role="dialog"], [aria-modal="true"]';
const LOCAL_KEYBOARD_SELECTOR = [
  '[role="listbox"]',
  '[role="menu"]',
  '[role="grid"]',
  '[role="tree"]',
  '[role="tablist"]',
].join(', ');

// FIX #3: was 5px — way too tight for TV-scale layouts where cards/rows
// are large and have padding/margins that create small axis offsets.
// A small tolerance rejected valid neighbors or accepted wrong ones,
// which is a big part of "moves through elements but doesn't know direction".
const AXIS_TOLERANCE = 24;

function isEditable(el: HTMLElement | null) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

function isVisible(el: HTMLElement) {
  if (!el.isConnected) return false;
  if (el.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  if (el.getClientRects().length === 0) return false;
  return true;
}

function isInNav(el: HTMLElement): boolean {
  return !!el.closest('[data-harbor-nav]');
}

function isInHero(el: HTMLElement): boolean {
  return !!el.closest('[data-tv-hero-zone]');
}

function zoneOf(el: HTMLElement): 'nav' | 'hero' | 'content' {
  if (isInNav(el)) return 'nav';
  if (isInHero(el)) return 'hero';
  return 'content';
}

// FIX #2: dedupe nested focusable matches. If a card wrapper AND one of
// its own descendants (e.g. an inner button, an <a> with a nested
// tabindex icon) both match SELECTOR, the old code treated them as two
// separate focus targets sitting almost on top of each other. That is
// exactly what causes "it moves between elements but doesn't understand
// left/right" — it's often hopping between a card and its own child.
// Rule: only the OUTERMOST matching element per DOM branch is kept.
function getFocusable(root: ParentNode = document): HTMLElement[] {
  const all = Array.from(root.querySelectorAll<HTMLElement>(SELECTOR)).filter(isVisible);
  return all.filter((el) => !all.some((other) => other !== el && other.contains(el)));
}

function getFocusableInZone(zone: 'nav' | 'hero' | 'content', root: ParentNode = document): HTMLElement[] {
  return getFocusable(root).filter((el) => zoneOf(el) === zone);
}

function getActiveModal(target: HTMLElement | null): HTMLElement | null {
  const owned = target?.closest<HTMLElement>(MODAL_SELECTOR);
  if (owned && isVisible(owned)) return owned;
  const visible = Array.from(document.querySelectorAll<HTMLElement>(MODAL_SELECTOR)).filter(isVisible);
  return visible[visible.length - 1] ?? null;
}

function isLocallyManaged(target: HTMLElement | null): boolean {
  return !!target?.closest(LOCAL_KEYBOARD_SELECTOR);
}

function getRect(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return {
    left: r.left, right: r.right, top: r.top, bottom: r.bottom,
    width: r.width, height: r.height,
    cx: r.left + r.width / 2, cy: r.top + r.height / 2,
  };
}

function overlap(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

function getDirection(e: KeyboardEvent): Dir | null {
  if (KEY_TO_DIR[e.key]) return KEY_TO_DIR[e.key];
  if (CODE_TO_DIR[e.code]) return CODE_TO_DIR[e.code];
  return KEYCODE_TO_DIR[e.keyCode] ?? null;
}

function isBackKey(e: KeyboardEvent): boolean {
  if (BACK_KEYS.has(e.key)) return true;
  if (BACK_KEYCODES.has(e.keyCode)) return true;
  return false;
}

function getInitialFocus(list: HTMLElement[]) {
  return list.find((el) => el.hasAttribute('data-tv-initial-focus')) ?? list[0] ?? null;
}

let focusStylesInjected = false;
function ensureFocusStyles() {
  if (focusStylesInjected || typeof document === 'undefined') return;
  focusStylesInjected = true;
  const style = document.createElement('style');
  style.setAttribute('data-tv-focus-styles', 'true');
  // FIX #1: removed `transform: scale(1.03)`.
  // getBoundingClientRect() reflects the element AFTER transforms are
  // applied. Scaling the focused element on every focus change means
  // its own rect (and therefore cx/cy/left/right used by findBest)
  // shifts slightly every time it becomes focused — which corrupts the
  // directional math for whatever gets focused next. This was the
  // single biggest cause of "arrow keys move focus but not in the
  // direction pressed". Outline/box-shadow are safe because they don't
  // affect layout or the geometry box used for hit-testing.
  style.textContent = `
    [data-tv-focused="true"] {
      outline: none !important;
      box-shadow: 0 0 0 4px var(--tv-focus-ring, #ffffff), 0 0 0 8px rgba(0,0,0,0.35) !important;
      transition: box-shadow 120ms ease;
      z-index: 20;
      position: relative;
    }
  `;
  document.head.appendChild(style);
}

let lastFocusedEl: HTMLElement | null = null;

function focusElement(el: HTMLElement) {
  ensureFocusStyles();
  if (lastFocusedEl && lastFocusedEl !== el) {
    lastFocusedEl.removeAttribute('data-tv-focused');
  }
  el.setAttribute('data-tv-focused', 'true');
  lastFocusedEl = el;

  el.focus({ preventScroll: true });
  if (isInHero(el)) {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    return;
  }
  el.scrollIntoView({
    block: 'center',
    inline: 'center',
    behavior: 'smooth',
  });
}

function findBest(focused: HTMLElement, candidates: HTMLElement[], dir: Dir): HTMLElement | null {
  const src = getRect(focused);
  let best: HTMLElement | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const el of candidates) {
    if (el === focused) continue;
    const dst = getRect(el);

    if (dir === 'right' && dst.cx <= src.cx + AXIS_TOLERANCE) continue;
    if (dir === 'left' && dst.cx >= src.cx - AXIS_TOLERANCE) continue;
    if (dir === 'down' && dst.cy <= src.cy + AXIS_TOLERANCE) continue;
    if (dir === 'up' && dst.cy >= src.cy - AXIS_TOLERANCE) continue;

    const horizontal = dir === 'left' || dir === 'right';

    const primary =
      dir === 'right' ? Math.max(0, dst.left - src.right) :
      dir === 'left' ? Math.max(0, src.left - dst.right) :
      dir === 'down' ? Math.max(0, dst.top - src.bottom) :
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

function getSpatialOrder(list: HTMLElement[]) {
  return [...list].sort((a, b) => {
    const ra = getRect(a);
    const rb = getRect(b);
    if (Math.abs(ra.top - rb.top) > 8) return ra.top - rb.top;
    return ra.left - rb.left;
  });
}

type TVNavigationOptions = {
  enabled?: boolean;
  wrap?: boolean;
  onBack?: () => boolean;
  onBackToNav?: () => void;
};

export function useKeyboardNavigation(options: TVNavigationOptions = {}) {
  const { enabled = true, wrap = true, onBack, onBackToNav } = options;

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;

      const target = e.target instanceof HTMLElement ? e.target : null;

      if (isEditable(target)) return;

      const activeModal = getActiveModal(target);

      if (isBackKey(e)) {
        if (activeModal) return;
        e.preventDefault();
        e.stopPropagation();
        const handled = onBack ? onBack() : false;
        if (!handled) {
          if (onBackToNav) {
            onBackToNav();
          } else {
            const nav = document.querySelector<HTMLElement>(
              '[data-harbor-nav] [data-focusable="true"], [data-harbor-nav] a[href], [data-harbor-nav] button'
            );
            if (nav) focusElement(nav);
          }
        }
        return;
      }

      const dir = getDirection(e);

      if (dir) {
        if (isLocallyManaged(target)) return;
        e.preventDefault();
        e.stopPropagation();

        const active =
          document.activeElement instanceof HTMLElement ? document.activeElement : null;

        const zone = active ? zoneOf(active) : 'content';
        const root = activeModal ?? document;
        const all = getFocusableInZone(zone, root);
        if (!all.length) return;

        if (!active || !all.includes(active)) {
          const first = getInitialFocus(all);
          if (first) focusElement(first);
          return;
        }

        if (zone === 'hero' && (dir === 'up' || dir === 'down')) {
          if (dir === 'down') {
            const contentItems = getFocusableInZone('content', root);
            const first = getInitialFocus(contentItems);
            if (first) focusElement(first);
          }
          return;
        }

        const best = findBest(active, all, dir);
        if (best) {
          focusElement(best);
          return;
        }

        if (wrap) {
          const ordered = getSpatialOrder(all);
          const idx = ordered.indexOf(active);
          if (idx >= 0) {
            const next =
              dir === 'down' || dir === 'right'
                ? ordered[idx + 1] ?? ordered[0]
                : ordered[idx - 1] ?? ordered[ordered.length - 1];
            if (next) focusElement(next);
          }
        }
        return;
      }

      const isCenter = CENTER_KEYCODES.has(e.keyCode) || e.key === 'Enter' || e.code === 'Enter';
      if (!isCenter) return;

      if (isLocallyManaged(target)) return;

      const active =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;

      if (!active || isEditable(active)) return;

      const nativeClickable = active.matches(
        'button, a[href], input[type="button"], input[type="submit"], input[type="checkbox"], input[type="radio"]'
      );

      if (e.key === ' ' && nativeClickable) return;
      if (e.key === 'Enter' && nativeClickable) return;

      e.preventDefault();
      e.stopPropagation();
      active.click();
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [enabled, wrap, onBack, onBackToNav]);
}
