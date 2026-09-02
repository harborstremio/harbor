import { SFX } from "@/lib/sfx";
import { bpSafeAreaPx } from "./bp-safe-area";
import { publishBpTarget } from "./bp-focus-meta";
import { markBpRingMoved } from "./bp-ring-motion";
import { readBpRowPosition } from "./bp-restore";
import { glideBpTrack } from "./bp-track-glide";
import { bpFirstVisible, bpStyleVisible as styleVisible } from "./bp-visible";
import {
  gridEscapes,
  gridStep,
  navigationMode,
  rankIndicesInDirection,
  toBpRect,
  type BpDir as LogicDir,
  type BpRect,
} from "./bp-logic";

export type BpDir = "up" | "down" | "left" | "right";
export type BpRevert = () => void;
export type Measured = { el: HTMLElement; rect: BpRect };

export const NO_REVERT: BpRevert = () => {};

const SEL = "[data-bp-focusable]:not([data-bp-disabled='true'])";
const MARK = "[data-bp-focus='true']";
const ROW = "[data-bp-row]";
const ROW_ATTR = "data-bp-row-focus";
const ROW_MARK = "[data-bp-row-focus]";
const CHROME = "[data-bp-top-bar]";
const HINT = "[data-bp-hint-bar]";
const CV = "content-visibility";

let interactionSeq = 0;

// The column a horizontal move left off at. Vertical entry no longer reads it:
// the nearest-centre scan that did threw the ring into whatever card happened to
// sit below, and per-row memory replaced it. Do not restore that scan, and do
// not delete the variable to satisfy noUnusedLocals either, because that turns
// setBpAnchorFrom into a silent no-op. The accessor below is its only read.
let anchorX: number | null = null;

export function bpAnchorX(): number | null {
  return anchorX;
}

export function resetBpAnchor(): void {
  anchorX = null;
}

// The engine cannot reach React state, so the active route is pushed to it.
let railRouteKey = "";

export function setBpRailRoute(key: string): void {
  railRouteKey = key;
}

// Read by a row that wants to seed its own remembered cell before the viewer
// has ever entered it. bpRailStep resolves the row memory against this key, so
// a seed written under any other key is silently ignored.
export function bpRailRoute(): string {
  return railRouteKey;
}

export function markBpInteracted(): void {
  interactionSeq += 1;
}

export function bpInteractionSeq(): number {
  return interactionSeq;
}

// A candidate that cannot accept focus must be rejected before it is chosen,
// otherwise focus() is silently refused and the ring desyncs from the caret.
// This is the half of that test that reads no geometry, so it runs first: a rect
// is a forced layout. It never looks at opacity, which is why an opacity-0
// focusable has to be taken out of the pool some other way.
function inertBlocked(el: HTMLElement): boolean {
  if (el.hidden) return true;
  if (el.matches(":disabled")) return true;
  return el.closest("[inert]") !== null;
}

function unskip(row: HTMLElement, touched: HTMLElement[]): void {
  if (row.style.getPropertyValue(CV) === "visible") return;
  row.style.setProperty(CV, "visible");
  touched.push(row);
}

function revertOf(touched: HTMLElement[]): BpRevert {
  if (touched.length === 0) return NO_REVERT;
  return () => {
    for (const row of touched) row.style.removeProperty(CV);
  };
}

// content-visibility:auto rows are skipped by the browser: their descendants
// report a 0x0 rect and refuse focus(). Lifting it for the length of one move
// is what keeps off-screen rows reachable at all.
export function revealBpRows(scope: HTMLElement): BpRevert {
  const touched: HTMLElement[] = [];
  if (scope.matches(ROW)) unskip(scope, touched);
  for (const row of scope.querySelectorAll<HTMLElement>(ROW)) unskip(row, touched);
  return revertOf(touched);
}

function revealAncestors(el: HTMLElement): BpRevert {
  const touched: HTMLElement[] = [];
  let row = el.closest<HTMLElement>(ROW);
  while (row) {
    unskip(row, touched);
    row = row.parentElement?.closest<HTMLElement>(ROW) ?? null;
  }
  return revertOf(touched);
}

export function measureFocusables(root: HTMLElement | null): Measured[] {
  if (!root) return [];
  const out: Measured[] = [];
  for (const el of root.querySelectorAll<HTMLElement>(SEL)) {
    if (inertBlocked(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    if (!styleVisible(el)) continue;
    out.push({ el, rect: toBpRect(r) });
  }
  return out;
}

export function bpFocusables(root: HTMLElement | null): HTMLElement[] {
  return measureFocusables(root).map((m) => m.el);
}

export function isBpFocusable(el: HTMLElement): boolean {
  return el.matches(SEL);
}

// The same test measureFocusables applies, for one element. A rail step needs
// to know only whether its origin is still real, and answering that by
// measuring every focusable on the page cost 240 rects and 240 computed styles
// per arrow press on home, which a TV stick feels.
export function isBpMeasurable(el: HTMLElement): boolean {
  if (!el.isConnected || !el.matches(SEL)) return false;
  if (inertBlocked(el)) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  return styleVisible(el);
}

export function rankMeasured(from: HTMLElement, pool: Measured[], dir: BpDir): HTMLElement[] {
  const self = pool.find((m) => m.el === from);
  const a = self ? self.rect : toBpRect(from.getBoundingClientRect());
  const others = pool.filter((m) => m.el !== from);
  const rects = others.map((m) => m.rect);
  return rankIndicesInDirection(a, rects, dir as LogicDir).map((at) => others[at].el);
}

// Cached for the length of one move. bpFirstVisible walks a document-wide
// querySelectorAll and runs a computed-style check per hit, and four call sites
// on the move path each asked for the bar independently, so a single arrow
// press paid for that walk four times. The cache is keyed on the interaction
// counter, which markBpInteracted bumps once per press, so it can never serve a
// stale bar across two moves. Playback mounts a second, hidden [data-bp-root]
// and a second [data-bp-top-bar] earlier in document order, which is exactly
// why the lookup has to go through bpFirstVisible rather than querySelector.
let chromeBarSeq = -1;
let chromeBarEl: HTMLElement | null = null;
let chromeBarInset = 0;

function bpChromeBar(): HTMLElement | null {
  if (chromeBarSeq === interactionSeq) {
    if (chromeBarEl === null || chromeBarEl.isConnected) return chromeBarEl;
  }
  chromeBarSeq = interactionSeq;
  chromeBarEl = bpFirstVisible(CHROME);
  chromeBarInset = 0;
  return chromeBarEl;
}

// One press from any depth reaches the nav, so the engine has to know whether
// the ring is already inside it and must not bounce back out.
export function bpInChrome(el: HTMLElement | null): boolean {
  const bar = bpChromeBar();
  return Boolean(bar && el && bar.contains(el));
}

export function splitBpChrome(pool: Measured[]): { page: Measured[]; chrome: Measured[] } {
  const bar = bpChromeBar();
  if (!bar) return { page: pool, chrome: [] };
  const page: Measured[] = [];
  const chrome: Measured[] = [];
  for (const m of pool) (bar.contains(m.el) ? chrome : page).push(m);
  return { page, chrome };
}

export function belowBpChrome(pool: Measured[]): Measured[] {
  const bar = bpChromeBar();
  if (!bar) return pool;
  const edge = bar.getBoundingClientRect().bottom;
  return pool.filter((m) => m.rect.y >= edge);
}

/**
 * The order the nav offers its cells to focus.
 *
 * `prefer` is the tab a row declared as its own destination, so Left out of a
 * movies row lands on Movies rather than on whichever tab is active. It only
 * reorders: an unknown or missing kind falls straight through to the active-tab
 * behaviour, and focusFirstOf walks the rest, so a stale value costs the press
 * nothing.
 */
export function bpChromeOrder(cells: HTMLElement[], prefer?: string): HTMLElement[] {
  const wanted = prefer ? cells.find((el) => el.dataset.bpTab === prefer) : undefined;
  const active = cells.find((el) => el.dataset.bpTabOn === "true");
  const head: HTMLElement[] = [];
  for (const el of [wanted, active]) {
    if (el && !head.includes(el)) head.push(el);
  }
  return head.length > 0 ? [...head, ...cells.filter((el) => !head.includes(el))] : cells;
}

function chromeInset(): number {
  const bar = bpChromeBar();
  if (!bar) return 0;
  // The rect is a forced layout, so it is remembered alongside the element for
  // the same one move rather than measured again per caller.
  if (chromeBarInset === 0) chromeBarInset = bar.getBoundingClientRect().height + 16;
  return chromeBarInset;
}

// The bottom twin of chromeInset, cached the same way and for the same reason.
//
// The bottom term used to reserve bpSafeAreaPx().y and nothing else. --bp-hint-h
// is 65px at 1140x641 with the 2 percent default overscan while safe-y alone is
// 13, so a focused cell settled 28px behind Harbor's own OK / Back footer and
// well inside its 180 percent scrim. Only bp-detail and bp-person reach the line
// that uses this: every other page returns at the self-rail guard below.
//
// The BAR'S TOP, never its height, because the reservation has to be per
// scroller. A dialog list is centred at max-h-80vh and its bottom edge lands
// within a pixel of the bar's top at 641px, so charging it the full bar height
// would reserve 65px of a panel the bar does not cover. Overlap answers both:
// it is the whole bar for a full-height page and zero or less for that dialog,
// where the safe area is then the floor. --bp-hint-h already carries safe-y, so
// the two are a max and never a sum.
let hintTopSeq = -1;
let hintTopPx = Number.POSITIVE_INFINITY;

function hintBarTop(): number {
  if (hintTopSeq === interactionSeq) return hintTopPx;
  hintTopSeq = interactionSeq;
  const bar = bpFirstVisible(HINT);
  hintTopPx = bar ? bar.getBoundingClientRect().top : Number.POSITIVE_INFINITY;
  return hintTopPx;
}

function bottomInset(pageBottom: number): number {
  return Math.max(bpSafeAreaPx().y, pageBottom - hintBarTop());
}

function centerScroll(el: HTMLElement): void {
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const behavior: ScrollBehavior = reduce ? "auto" : "smooth";

  // The ring's own rect, read ONCE for both axes. It used to be read twice,
  // once for the track and once for the page. A rect is a forced layout, and
  // this whole function was attributed at 3 to 6ms per press on a Fire TV Stick
  // 4K Max, with the press as a whole spending 45.5ms across 16.2 rect reads.
  // Nothing between the two reads moves the element, so the second was buying
  // an identical answer at full price.
  const e = el.getBoundingClientRect();

  // Horizontal is handled explicitly. scrollIntoView cannot be limited to one
  // axis, and using it here fought the surface's own row alignment.
  //
  // Never behavior:"smooth". That was rejected for the right reason, which is
  // that the browser owns a duration we cannot shorten, so the row was still
  // gliding under a ring that had already landed. What the old code then did
  // instead was jump in one frame, and it named the correct answer for the
  // vertical rail one line later without applying it here: it is ours to time.
  // glideBpTrack is that, on the axis ninety percent of presses travel along.
  // It snaps during a hold, so a held key costs exactly what it always did.
  const track = el.closest<HTMLElement>("[data-bp-scroll-x]");
  if (track) {
    const t = track.getBoundingClientRect();
    // A stale 0-width rect would compute a hugely negative left and snap the
    // track back to card one while the ring sits far along the row.
    if (e.width >= 2 && t.width >= 2) {
      const left = track.scrollLeft + (e.left - t.left) - (t.width - e.width) / 2;
      glideBpTrack(track, left, reduce === true);
    }
  }

  const page = el.closest<HTMLElement>("[data-bp-scroll-y]");
  if (!page) return;
  // A rail that translates itself carries data-bp-scroll-y on the rail element,
  // which is the direct parent of every [data-bp-rail-row] because bpRailStep
  // resolves a rail exactly that way. Driving it would fight the transform.
  //
  // This used to bail for anything inside a [data-bp-rail-row] at all, which
  // silently killed vertical scrolling on bp-detail and bp-person: they are the
  // two pages that put rail rows deeper inside a real overflow-y-auto scroller,
  // so the ring walked off the bottom of the screen with nothing moving. A mouse
  // wheel still worked, so it was invisible on desktop and total on a remote.
  if (e.height < 2) return;
  // Opt-in keep-centred surfaces (the onboarding decision column) hold the ring
  // in the vertical middle so the bottom row never lands under the fade.
  // scrollTo clamps to [0, max], so the first and last rows sit as close to
  // centre as the ends allow instead of leaving a void.
  //
  // Checked before the self-translating-rail guard below on purpose. A column
  // that opts in is asking to be driven, and once the taste grid gained rail
  // indices its rows became direct children of this scroller, which is exactly
  // the shape that guard refuses. The opt-in has to win or the surface freezes.
  if (page.hasAttribute("data-bp-center")) {
    const p = page.getBoundingClientRect();
    const mid = (p.top + chromeInset() + (p.bottom - bpSafeAreaPx().y)) / 2;
    const delta = e.top + e.height / 2 - mid;
    if (Math.abs(delta) > 1) page.scrollTo({ top: page.scrollTop + delta, behavior });
    return;
  }
  const railRow = el.closest<HTMLElement>("[data-bp-rail-row]");
  if (railRow && railRow.parentElement === page) return;
  // The page rect is read HERE, and separately inside the centred branch above,
  // rather than once before both. It used to be hoisted, and on home, anime,
  // shows, movies and discover the guard one line up returns on EVERY press, so
  // the rect was computed and thrown away every time. A rect is a forced layout
  // and this one lands on the rail, a permanently promoted 2280x14328 layer.
  // Do NOT hoist it back to save a line: the two readers are on branches that
  // are mutually exclusive, and the guards must keep their order (the comment
  // above records why data-bp-center has to be tested first).
  const p = page.getBoundingClientRect();
  const above = e.top - (p.top + chromeInset());
  const below = e.bottom - (p.bottom - bottomInset(p.bottom));
  const delta = above < 0 ? above - 24 : below > 0 ? below + 24 : 0;
  if (delta !== 0) page.scrollTo({ top: page.scrollTop + delta, behavior });
}

// The last ring and the rows it marked, so the common case clears them directly
// instead of walking the document. Two document-wide querySelectorAll ran on
// every arrow press to remove marks this module had just written itself.
//
// The queries are still the fallback and must stay: a portalled surface has no
// [data-bp-root] ancestor, and anything that marks an element without coming
// through here would otherwise leave a ring behind that makes currentBpFocus
// answer with the wrong element.
let lastRing: HTMLElement | null = null;
let lastRows: HTMLElement[] = [];

function clearMarks(keep: HTMLElement): void {
  const kept = new Set(rowsOf(keep));
  const fast =
    lastRing !== null &&
    lastRing !== keep &&
    lastRing.isConnected &&
    lastRing.getAttribute("data-bp-focus") === "true";
  if (fast && lastRing) {
    lastRing.removeAttribute("data-bp-focus");
    for (const row of lastRows) {
      if (!kept.has(row) && row.isConnected) row.removeAttribute(ROW_ATTR);
    }
  }
  // Cheap enough to verify: if anything else marked an element, these find it.
  const strays = document.querySelectorAll<HTMLElement>(MARK);
  if (strays.length > 1 || (strays.length === 1 && strays[0] !== keep)) {
    for (const prev of strays) if (prev !== keep) prev.removeAttribute("data-bp-focus");
  }
  if (!fast) {
    for (const row of document.querySelectorAll<HTMLElement>(ROW_MARK)) {
      if (!kept.has(row)) row.removeAttribute(ROW_ATTR);
    }
  }
  lastRing = keep;
  lastRows = [...kept];
}

/**
 * Every [data-bp-row] ancestor of an element, nearest first.
 *
 * All of them, not just the nearest: rows nest, and the containment rule in
 * bp-tokens exempts any row holding the ring, so marking only the innermost
 * would leave an outer row skipped around a row that is not.
 */
function rowsOf(el: HTMLElement | null): HTMLElement[] {
  const out: HTMLElement[] = [];
  let row = el?.closest<HTMLElement>(ROW) ?? null;
  while (row) {
    out.push(row);
    row = row.parentElement?.closest<HTMLElement>(ROW) ?? null;
  }
  return out;
}

export function applyBpFocus(el: HTMLElement, opts?: { silent?: boolean; dir?: BpDir }): boolean {
  if (!el.isConnected) return false;
  // Rollback may only undo what this call did. A candidate that is already the
  // ring reaches here from the seed pass and from recoverBpFocus, and stripping
  // its mark on a refused focus() left the page with nothing marked anywhere and
  // no replacement, which reads as a dead screen rather than a failed move.
  const owned = el.matches(MARK);
  // The row carries its own mark rather than the stylesheet asking
  // :has([data-bp-focus="true"]). Chromium re-checks a :has() against every
  // candidate subtree when the tested attribute changes anywhere, so on a rail
  // of twenty rows and 240 tiles each focus move cost a style recalc of the
  // whole rail, and a held direction key spent more time in style than it did
  // moving. An attribute the ring sets itself turns that scan into a match.
  const rows = rowsOf(el);
  const rowsOwned = rows.map((r) => r.hasAttribute(ROW_ATTR));
  el.setAttribute("data-bp-focus", "true");
  for (const row of rows) row.setAttribute(ROW_ATTR, "true");
  const revert = revealAncestors(el);
  // Reading a box flushes the pending recalc that un-skips this row. Without
  // the flush the element is still skipped content and focus() is a no-op.
  void el.getBoundingClientRect();
  el.focus({ preventScroll: true });
  const active = document.activeElement;
  const landed = active === el || el.contains(active);
  revert();
  // The old ring is only surrendered once the new one is proven, so a refused
  // candidate cannot leave the surface with nothing focused.
  if (!landed) {
    if (!owned) el.removeAttribute("data-bp-focus");
    rows.forEach((row, i) => {
      if (!rowsOwned[i]) row.removeAttribute(ROW_ATTR);
    });
    return false;
  }
  clearMarks(el);
  markBpRingMoved();
  publishBpTarget(el);
  centerScroll(el);
  if (!opts?.silent) SFX.navigate(opts?.dir ?? "right", "movie");
  return true;
}

export function focusFirstOf(
  candidates: HTMLElement[],
  opts?: { silent?: boolean; dir?: BpDir },
): HTMLElement | null {
  for (const el of candidates) {
    if (applyBpFocus(el, opts)) return el;
  }
  return null;
}

export function setBpFocus(el: HTMLElement | null, opts?: { silent?: boolean; dir?: BpDir }): boolean {
  if (!el) return false;
  if (applyBpFocus(el, opts)) return true;
  scheduleBpRecovery();
  return false;
}

export function currentBpFocus(root: HTMLElement | null): HTMLElement | null {
  if (!root) return null;
  const marks = root.querySelectorAll<HTMLElement>(MARK);
  // Surfaces park the ring attribute on plain wrappers. The engine has to
  // reason from a real focusable or every move starts from the wrong rect.
  for (const el of marks) {
    if (el.matches(SEL)) return el;
  }
  return marks.length > 0 ? marks[0] : null;
}

export function bpOverlayOpen(): boolean {
  if (typeof document === "undefined") return false;
  return document.querySelector("[data-bp-overlay]") !== null;
}

export function bpFocusScope(root: HTMLElement | null): HTMLElement | null {
  if (!root) return null;
  const dialogs = root.querySelectorAll<HTMLElement>("[data-bp-dialog]");
  return dialogs.length > 0 ? dialogs[dialogs.length - 1] : root;
}

function bpRoot(): HTMLElement | null {
  return bpFirstVisible("[data-bp-root]") ?? document.querySelector<HTMLElement>("[data-bp-root]");
}

// Nothing focused is a stuck screen, not a glitch. Any refused focus lands here
// on the next frame and puts the ring back on something real.
export function recoverBpFocus(root?: HTMLElement | null): boolean {
  if (bpOverlayOpen()) return false;
  const scope = bpFocusScope(root ?? bpRoot());
  if (!scope) return false;
  const marked = currentBpFocus(scope);
  const active = document.activeElement;
  if (marked && (marked === active || marked.contains(active))) return true;
  // The reveal has to outlive the focus attempt. Reverting between the measure
  // and the focus put every off-screen candidate back into skipped content, so
  // the pool this pass just built was already stale by the time it was used.
  const revert = revealBpRows(scope);
  try {
    const pool = bpFocusables(scope);
    const seed = scope.querySelector<HTMLElement>("[data-bp-autofocus='true']");
    const order: HTMLElement[] = [];
    for (const el of [marked, seed, ...pool]) {
      if (el && !order.includes(el)) order.push(el);
    }
    return focusFirstOf(order, { silent: true }) !== null;
  } finally {
    revert();
  }
}

let recoveryRaf = 0;

function scheduleBpRecovery(): void {
  if (typeof window === "undefined" || recoveryRaf) return;
  recoveryRaf = window.requestAnimationFrame(() => {
    recoveryRaf = 0;
    recoverBpFocus();
  });
}

export function focusBpTopBar(root: HTMLElement | null, prefer?: string): boolean {
  const base = root ?? bpRoot();
  if (!base) return false;
  // A dialog owns navigation while it is up; jumping behind it would strand it.
  if (bpFocusScope(base) !== base) return false;
  const bar = base.querySelector<HTMLElement>("[data-bp-top-bar]");
  if (!bar) return false;
  const cells = bpFocusables(bar);
  if (cells.length === 0) return false;
  resetBpAnchor();
  return focusFirstOf(bpChromeOrder(cells, prefer), { dir: "up" }) !== null;
}

// The only container a horizontal move can reach, or null when this move is not
// a rail step. candidatesFor narrows the page pool to exactly this before it
// ranks, so a caller that measures the track alone gets the identical candidate
// list from 11 rects instead of 271. Keep the rail branch below its only other
// reader: the two must never drift apart.
export function bpTrackScope(from: HTMLElement, dir: BpDir): HTMLElement | null {
  const rail = from.closest<HTMLElement>(ROW);
  const inGrid = from.closest("[data-bp-grid]") !== null;
  const mode = navigationMode({ inGrid, inRail: rail !== null, dir: dir as LogicDir });
  if (mode !== "rail" || !rail) return null;
  return from.closest<HTMLElement>("[data-bp-scroll-x]") ?? rail;
}

export function candidatesFor(from: HTMLElement, pool: Measured[], dir: BpDir): HTMLElement[] {
  const grid = from.closest<HTMLElement>("[data-bp-grid]");
  if (grid) {
    const cells = pool.filter((m) => grid.contains(m.el));
    const at = cells.findIndex((m) => m.el === from);
    const rtl = getComputedStyle(grid).direction === "rtl";
    const to = at < 0 ? -1 : gridStep(at, cells.map((m) => m.rect), dir as LogicDir, rtl);
    if (to >= 0) return [cells[to].el];
    if (!gridEscapes(dir as LogicDir, false)) return [];
    const outside = pool.filter((m) => !grid.contains(m.el));
    // rankMeasured measures `from` itself when the pool does not hold it, so
    // ranking an empty remainder buys nothing and costs a forced layout.
    return outside.length > 0 ? rankMeasured(from, outside, dir) : [];
  }

  // Horizontal stays inside the track it started in. Without this, Left/Right
  // in a chip strip leaks into whatever happens to sit below it.
  const track = bpTrackScope(from, dir);
  if (!track) return rankMeasured(from, pool, dir);
  return rankMeasured(from, pool.filter((m) => track.contains(m.el)), dir);
}

// A cell that leads a row rather than being content in it. Vertical entry steps
// over these so repeated Down reaches titles instead of stopping on an escape.
const LEAD_KEYS = ["label:", "bp-lead:"];

export function isBpLeadKey(key: string | undefined): boolean {
  return key !== undefined && LEAD_KEYS.some((p) => key.startsWith(p));
}

export type BpRailPick = { el: HTMLElement; revert: BpRevert };

/**
 * True when the origin sits in a rail that IS its own vertical scroller, so the
 * only way in or out of a row is a rail index.
 *
 * Same test centerScroll uses to refuse to drive the page: the rail row's parent
 * is the [data-bp-scroll-y] element. It answers true on home, anime, shows,
 * movies and discover, and false on bp-detail, bp-person and search, which put
 * rail rows deeper inside a real overflow-y-auto scroller alongside focusables
 * that are not rail rows. Those must keep the full page fallback, and the
 * comment in centerScroll records what breaking that looked like.
 *
 * A row whose index does not parse answers false too, so a malformed
 * data-bp-rail-row keeps the slow path rather than losing the move.
 */
export function bpInSelfRail(el: HTMLElement): boolean {
  const row = el.closest<HTMLElement>("[data-bp-rail-row]");
  const rail = row?.parentElement;
  if (!row || !rail) return false;
  if (!(Number(row.dataset.bpRailRow ?? -1) >= 0)) return false;
  return rail === el.closest<HTMLElement>("[data-bp-scroll-y]");
}

export function bpRailStep(from: HTMLElement, dir: BpDir): BpRailPick | null {
  const row = from.closest<HTMLElement>("[data-bp-rail-row]");
  const rail = row?.parentElement;
  if (!row || !rail) return null;

  const at = Number(row.dataset.bpRailRow ?? -1);
  if (at < 0) return null;
  const step = dir === "down" ? 1 : -1;

  for (let i = at + step; i >= 0; i += step) {
    const target = rail.querySelector<HTMLElement>(`[data-bp-rail-row="${i}"]`);
    if (!target) return null;
    const revert = revealBpRows(target);
    const cells = measureFocusables(target);
    if (cells.length === 0) {
      revert();
      continue;
    }
    const section = target.matches(ROW) ? target : target.querySelector<HTMLElement>(ROW);
    const rowKey = section?.dataset.bpRowKey ?? "";
    const wantKey = rowKey ? readBpRowPosition(railRouteKey, rowKey) : null;

    let best: Measured | undefined;
    if (wantKey) best = cells.find((c) => c.el.dataset.bpRestoreKey === wantKey);
    // Landing on a lead tile every time would mean repeated Down never reaches
    // content, so the first-card fallback steps over it. Both namespaces, from
    // one predicate: this used to test the "label:" prefix alone, so Discover's
    // five "bp-lead:" tiles were never skipped and every Down into a band parked
    // on "Genres, Surprise me" rather than on a genre. Do NOT add a second
    // string literal here when a third prefix appears; the two drifted once.
    if (!best) best = cells.find((c) => !isBpLeadKey(c.el.dataset.bpRestoreKey)) ?? cells[0];
    anchorX = best.rect.cx;
    return { el: best.el, revert };
  }
  return null;
}

export function setBpAnchorFrom(el: HTMLElement): void {
  const r = el.getBoundingClientRect();
  anchorX = r.left + r.width / 2;
}
