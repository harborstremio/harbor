import { useCallback, useEffect, useRef } from "react";
import { SFX } from "@/lib/sfx";
import {
  readBpPosition,
  rememberBpPosition,
  rememberBpRowPosition,
  restoreKeyOf,
  rowKeyOf,
  scrollerOf,
} from "./bp-restore";
import { bpGuideHandledKey } from "./bp-guide-key";
import { isBpNavJumpKey } from "./bp-logic";
import { bpPressOff, bpPressOn } from "./bp-press";
import { bpSeeAllEnter, bpSeeAllExit, isBpRowSeeAll } from "./bp-row-see-all";
import { bpOnboardHandledKey } from "./onboarding/bp-onboard-key";
import { bpQueueHandledKey } from "./queue/bp-queue-key";
import {
  applyBpFocus,
  belowBpChrome,
  bpChromeOrder,
  bpFocusables,
  bpFocusScope,
  bpInSelfRail,
  bpInteractionSeq,
  bpOverlayOpen,
  bpRailStep,
  bpTrackScope,
  candidatesFor,
  currentBpFocus,
  bpInChrome,
  focusBpTopBar,
  focusFirstOf,
  isBpFocusable,
  isBpMeasurable,
  markBpInteracted,
  measureFocusables,
  rankMeasured,
  recoverBpFocus,
  resetBpAnchor,
  revealBpRows,
  setBpAnchorFrom,
  setBpFocus,
  setBpRailRoute,
  splitBpChrome,
  NO_REVERT,
  type BpDir,
  type BpRevert,
  type Measured,
} from "./bp-focus-core";

export {
  bpFocusables,
  bpFocusScope,
  bpOverlayOpen,
  currentBpFocus,
  focusBpTopBar,
  markBpInteracted,
  measureFocusables,
  rankMeasured,
  recoverBpFocus,
  resetBpAnchor,
  setBpFocus,
  type BpDir,
};

const SETTLE_WINDOW_MS = 6000;

type BpPick = { el: HTMLElement | null; revert: BpRevert };

function nudge(from: HTMLElement, dir: BpDir): void {
  // translate, never transform: the focus lift is a CSS transform and a Web
  // Animation on transform would replace it for the whole shake.
  const to =
    dir === "up" ? "0 6px" : dir === "down" ? "0 -6px" : dir === "left" ? "6px 0" : "-6px 0";
  if (!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    from.animate?.([{ translate: "0 0" }, { translate: to }, { translate: "0 0" }], {
      duration: 190,
      easing: "cubic-bezier(0.22,1,0.36,1)",
    });
  }
  SFX.hover();
}

function moveVertically(
  from: HTMLElement,
  root: HTMLElement,
  pool: Measured[],
  dir: BpDir,
  /**
   * The origin is on a rail that is its own scroller AND bpRailStep has already
   * run out of indices in this direction. See the reveal below.
   */
  railDead = false,
): BpPick {
  const { page, chrome } = splitBpChrome(pool);
  const fromChrome = chrome.some((m) => m.el === from);
  if (fromChrome && dir === "up") return { el: null, revert: NO_REVERT };

  const order = (ms: Measured[]): HTMLElement[] =>
    fromChrome ? rankMeasured(from, belowBpChrome(ms), dir) : candidatesFor(from, ms, dir);

  const near = focusFirstOf(order(page), { dir });
  if (near) return { el: near, revert: NO_REVERT };

  // Off-screen rows are skipped content and measure as nothing, so a dead
  // end is not proof there is no target. Pay for a full reveal only here.
  //
  // Except on a rail that is its own scroller, where the ONLY thing the reveal
  // can un-skip is another rail row, and a rail row is reachable only by index,
  // and bpRailStep has just proved there is no further index. So the second pass
  // is guaranteed to rebuild the same refused pool at full price: on home that
  // is 253 rects, 253 checkVisibility, a document-wide querySelectorAll, and an
  // inline content-visibility write plus its revert across all 25 rail rows,
  // which is two whole-rail style invalidations. Un-skipping wholesale is the
  // same poison bp-home's warmer doses one row at a time (long tasks 70 to 152
  // with containment off), and this press always ends in the nav or a nudge.
  //
  // The chrome fallback below is NOT skipped: Up out of row 0 reaching the top
  // bar is the whole reason this branch exists on that direction.
  const revert = railDead ? NO_REVERT : revealBpRows(root);
  // A reveal that un-skipped nothing leaves the identical tree, and revealBpRows
  // answers NO_REVERT exactly then, so the second measure would rebuild the pool
  // that just refused every candidate.
  const again = revert === NO_REVERT ? null : splitBpChrome(measureFocusables(root)).page;
  let el = again ? focusFirstOf(order(again), { dir }) : null;
  if (!el && !fromChrome && dir === "up") {
    el = focusFirstOf(bpChromeOrder(chrome.map((m) => m.el)), { dir });
  }
  return { el, revert };
}

// Eleven steps a second on a hold. Fast enough to cross a long row without
// waiting, slow enough that each step is a step the eye can follow.
const REPEAT_MIN_MS = 90;

export function useBpFocusRoot(params: {
  rootRef: React.RefObject<HTMLElement | null>;
  onBack: () => void;
  onOptions?: () => void;
  onTab?: (delta: number) => void;
  /**
   * A surface inside this root that steps by its own model, asked before
   * spatial navigation runs. A false return falls straight through, so nothing
   * is swallowed. This is the only sanctioned way to claim a direction: a
   * second window listener also fires, because stopPropagation does not stop a
   * sibling on the same object.
   */
  onDir?: (dir: BpDir) => boolean;
  enabled: boolean;
  routeKey: string;
}): { move: (dir: BpDir) => void; select: () => void } {
  const { rootRef, onBack, onOptions, onTab, onDir, enabled, routeKey } = params;
  const interactedRef = useRef(false);
  const repeatAtRef = useRef(0);
  const routeKeyRef = useRef(routeKey);
  routeKeyRef.current = routeKey;

  const remember = useCallback((el: HTMLElement) => {
    // A see-all is the way OUT of a row, never a position in it. Remembered, it
    // makes Down then Up return to the heading rather than to the card, and it
    // makes a route restore put the ring on a row heading on arrival.
    if (isBpRowSeeAll(el)) return;
    const key = restoreKeyOf(el);
    if (!key) return;
    rememberBpPosition(routeKeyRef.current, {
      key,
      scrollTop: scrollerOf(el)?.scrollTop ?? 0,
    });
    const rk = rowKeyOf(el);
    if (rk) rememberBpRowPosition(routeKeyRef.current, rk, key);
  }, []);

  const move = useCallback(
    (dir: BpDir) => {
      const root = bpFocusScope(rootRef.current);
      if (!root) return;
      interactedRef.current = true;
      markBpInteracted();

      const across = dir === "left" || dir === "right";
      let opening: BpRevert = NO_REVERT;
      let deep: BpRevert = NO_REVERT;
      let landed: HTMLElement | null = null;
      // Set only where bpRailStep answered null, never where it answered a pick
      // that focus() then refused: a refused pick means the index exists and the
      // reveal in moveVertically still has somewhere to look.
      let railMissed = false;

      // Apple's tvOS rule is that focus returns to the tab bar from anywhere
      // rather than by walking every row upward. Left already runs out at the
      // start of a row, so that dead end becomes the direct path to the nav:
      // one press from any depth instead of one per row.
      //
      // The row names the tab it belongs to, so Left out of a movies row lands
      // on Movies rather than on whichever tab is active. That is what replaced
      // the lead tile: the tile was Left, Left, Enter to reach Movies, and this
      // is Left, Enter, with the whole nav still reachable from the same
      // landing. A row with no data-bp-row-tab keeps the plain active-tab
      // behaviour. Read off the row rather than the cell so every card in the
      // row escapes to the same place.
      const toNav = (from: HTMLElement): HTMLElement | null => {
        if (dir !== "left" || bpInChrome(from)) return null;
        const tab = from.closest<HTMLElement>("[data-bp-row]")?.dataset.bpRowTab;
        return focusBpTopBar(root, tab) ? currentBpFocus(root) : null;
      };

      // Both ends of a row lead somewhere now. Left at the start reaches the
      // nav, Right at the end reaches the row's own see-all, and Left off that
      // see-all comes back to the cell it was pressed from rather than carrying
      // on to the nav: the only door onto it is one press, so the reverse press
      // has to undo exactly that one press.
      //
      // Shared by the fast path and the slow path because they answer
      // identically once the origin is known, and the two drifting apart is how
      // a surface ends up with Right behaving differently depending on whether
      // the ring was measurable that frame. The pool arrives as a thunk: neither
      // see-all branch reads it, and on the fast path building it is a
      // measureFocusables over the whole track.
      const stepAcross = (from: HTMLElement, pool: () => Measured[]): HTMLElement | null => {
        if (isBpRowSeeAll(from)) return bpSeeAllExit(from, dir);
        return (
          focusFirstOf(candidatesFor(from, pool(), dir), { dir }) ??
          bpSeeAllEnter(from, dir) ??
          toNav(from)
        );
      };

      try {
        const ring = currentBpFocus(root);
        const live = ring !== null && isBpMeasurable(ring);

        // Fast paths, before the page is measured at all. Measuring all 271
        // focusables costs 16ms on a settled TV stick and 1577ms over a subtree
        // the browser has not laid out yet, and no one move needs more than one
        // container. Each of these narrows to the container candidatesFor would
        // have filtered the page pool down to anyway, so the candidate list is
        // identical rather than an approximation.
        if (ring && live) {
          const grid = ring.closest<HTMLElement>("[data-bp-grid]");
          if (grid) {
            landed = focusFirstOf(candidatesFor(ring, measureFocusables(grid), dir), { dir });
            if (landed) return;
            // gridEscapes refuses horizontal, so a horizontal dead end inside a
            // grid is the whole answer and no page-wide pool can change it.
            // Vertical does escape, and that escape needs the rest of the page.
            if (across) {
              landed = toNav(ring);
              if (!landed) nudge(ring, dir);
              return;
            }
          }

          const track = bpTrackScope(ring, dir);
          if (track) {
            // Terminal on purpose. The slow path would narrow the page pool back
            // down to this same track and reach the identical dead end, so all
            // that is left after it is the two row escapes and the shake.
            landed = stepAcross(ring, () => measureFocusables(track));
            if (!landed) nudge(ring, dir);
            return;
          }

          // The home rail animates its transform, so cross-row geometry is in
          // flight for 420ms. Stepping by row index keeps vertical deterministic.
          if (!across) {
            const quick = bpRailStep(ring, dir);
            if (quick) {
              const ok = applyBpFocus(quick.el, { dir });
              quick.revert();
              if (ok) {
                landed = quick.el;
                return;
              }
            } else {
              railMissed = true;
            }
          }
        }

        // The mark and the browser's own focus can come apart: anything that
        // focuses a cell without going through applyBpFocus leaves the page
        // with a real activeElement and nothing marked. currentBpFocus then
        // answers null, every arrow press falls into the seed branch below, and
        // vertical navigation is dead while Left and Right still appear to work
        // because those are the browser moving between siblings. Adopting the
        // live activeElement as the origin is what keeps Down alive.
        const active = document.activeElement;
        const adopted =
          active instanceof HTMLElement && root.contains(active) && isBpFocusable(active)
            ? active
            : null;
        const marked = ring ?? adopted;
        // A ring parked on a skipped row measures as nothing. Treating that as
        // nothing focused seeds from the top of the page and throws the user
        // somewhere random, so prove the source is gone before giving up on it.
        // isBpMeasurable is the one-element form of the pool test, so asking it
        // here rather than checking the pool afterwards is what stops a lost
        // ring costing two full page measures instead of one.
        const lost = marked !== null && isBpFocusable(marked) && !isBpMeasurable(marked);
        if (lost) opening = revealBpRows(root);

        let pool = measureFocusables(root);
        if (pool.length === 0 && !lost) {
          opening = revealBpRows(root);
          pool = measureFocusables(root);
        }
        if (pool.length === 0) return;

        // An arrow press with nothing focused has to put the ring somewhere
        // rather than swallow the key and leave the screen stuck.
        const from = marked && pool.some((m) => m.el === marked) ? marked : null;
        if (!from) {
          const seed = root.querySelector<HTMLElement>("[data-bp-autofocus='true']");
          // Seeding answers "nothing is focused", not "go this way", so the nav
          // must stay out of it. The whole pool was offered here and the first
          // cell that accepted was the top bar, so a Down out of a detail hero
          // teleported into the nav the moment the ring left the pool.
          const { page } = splitBpChrome(pool);
          const all = (page.length > 0 ? page : pool).map((m) => m.el);
          const order = seed ? [seed, ...all.filter((el) => el !== seed)] : all;
          landed = focusFirstOf(order, { dir });
          return;
        }

        if (!across) {
          // Skipped when the fast path above already ran it: same origin, same
          // tree, and bpRailStep measures a whole row per candidate index.
          if (!(live && from === ring)) {
            const stepped = bpRailStep(from, dir);
            if (stepped) {
              const ok = applyBpFocus(stepped.el, { dir });
              stepped.revert();
              if (ok) {
                landed = stepped.el;
                return;
              }
            } else {
              railMissed = true;
            }
          }
          const picked = moveVertically(from, root, pool, dir, railMissed && bpInSelfRail(from));
          deep = picked.revert;
          landed = picked.el;
        } else {
          landed = stepAcross(from, () => pool);
        }

        if (!landed) nudge(from, dir);
      } finally {
        deep();
        opening();
        if (landed) {
          if (across) setBpAnchorFrom(landed);
          remember(landed);
        } else if (!currentBpFocus(root)) {
          // A press that lands nothing still has to leave a ring. The two paths
          // that give up without a nudge, an empty pool and a seed pass where
          // every candidate refused, otherwise swallow every later press and
          // the surface is stuck for good.
          recoverBpFocus(root);
        }
      }
    },
    [rootRef, remember],
  );

  const select = useCallback(() => {
    // Scoped, never raw root: an open dialog must not let Enter reach the row
    // behind it that still carries data-bp-focus.
    const root = bpFocusScope(rootRef.current);
    const el = currentBpFocus(root);
    if (!el) {
      recoverBpFocus(rootRef.current);
      return;
    }
    SFX.click();
    // Before the click, not after. The click may push a route that unmounts this
    // tile in the same task, in which case nothing is ever painted pressed and
    // the press costs nothing. When the route is a lazy chunk that has to load,
    // which is the case this exists for, the yield lets the pressed frame paint
    // and the wait stops reading as a dropped press.
    bpPressOn(el);
    el.click();
  }, [rootRef]);

  useEffect(() => {
    if (!enabled) return;
    void routeKey;

    let observer: MutationObserver | null = null;
    let raf = 0;
    const deadline = Date.now() + SETTLE_WINDOW_MS;
    const seq = bpInteractionSeq();
    interactedRef.current = false;
    resetBpAnchor();
    setBpRailRoute(routeKey);

    const saved = readBpPosition(routeKey);
    let restored = false;

    const attempt = () => {
      if (bpOverlayOpen() || bpInteractionSeq() !== seq) return;
      const root = bpFocusScope(rootRef.current);
      if (!root) return;
      const focused = currentBpFocus(root);

      if (!restored && saved) {
        const previous = root.querySelector<HTMLElement>(
          `[data-bp-restore-key="${CSS.escape(saved.key)}"]`,
        );
        if (previous) {
          const scroller = scrollerOf(previous);
          if (scroller) scroller.scrollTop = saved.scrollTop;
          // Only a landed restore may disarm the seed pass below. A remembered
          // key can resolve to an element that refuses focus.
          restored = setBpFocus(previous, { silent: true });
          // Route restore never goes through move(), so the per-row memory that
          // vertical entry reads would still be empty and the first Down then Up
          // would drop the ring on card one of the row just returned to.
          if (restored) {
            remember(previous);
            return;
          }
        }
      }

      if (focused && (interactedRef.current || restored || focused.dataset.bpAutofocus === "true")) {
        return;
      }
      const marked = root.querySelector<HTMLElement>("[data-bp-autofocus='true']");
      const target = marked ?? (focused ? null : bpFocusables(root)[0]);
      if (!target || target === focused) return;
      setBpFocus(target, { silent: true });
    };

    const tick = () => {
      raf = 0;
      attempt();
      if (Date.now() > deadline) observer?.disconnect();
    };

    const schedule = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(tick);
    };

    schedule();
    const root = bpFocusScope(rootRef.current);
    if (root) {
      observer = new MutationObserver(schedule);
      observer.observe(root, { childList: true, subtree: true });
    }
    const keepAlive = window.setInterval(() => {
      if (Date.now() > deadline) {
        window.clearInterval(keepAlive);
        return;
      }
      schedule();
    }, 400);

    return () => {
      window.clearInterval(keepAlive);
      if (raf) window.cancelAnimationFrame(raf);
      observer?.disconnect();
    };
  }, [enabled, routeKey, rootRef, interactedRef, remember]);

  // Recovery only ever ran when setBpFocus refused a candidate, so nothing
  // watched for the marked element being unmounted. A row re-rendering as its
  // catalog lands takes the ring with it: the mark count drops to zero, the
  // browser drops focus to whatever is left, and every later arrow press finds
  // no origin and re-seeds instead of moving. During a normal move there are
  // briefly two marks and never zero, so zero is only ever the broken state.
  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const onOut = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const root = bpFocusScope(rootRef.current);
        if (!root || bpOverlayOpen()) return;
        if (currentBpFocus(root)) return;
        recoverBpFocus(root);
      });
    };
    document.addEventListener("focusout", onOut, true);
    return () => {
      document.removeEventListener("focusout", onOut, true);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [rootRef, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const editing = (): boolean => {
      const active = document.activeElement as HTMLElement | null;
      return active?.tagName === "INPUT" || active?.tagName === "TEXTAREA";
    };
    const onKey = (e: KeyboardEvent) => {
      if (bpOverlayOpen()) return;
      const dirs: Record<string, BpDir> = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
      };
      const dir = dirs[e.key];
      if (dir) {
        e.preventDefault();
        e.stopPropagation();
        // The guide steps by time and channel index, which geometry cannot
        // reproduce. It declines whenever the ring is outside it or the move
        // would leave it, and that falls through to normal spatial nav.
        if (bpGuideHandledKey(dir)) return;
        // The queue steps by pool cursor, which is not a geometry the pool of
        // focusables can express: its deck is one full-screen cell with no
        // horizontal sibling to rank. It declines both vertical directions and
        // declines at either end of the run, so Up and Down still reach the
        // rail and a press with nowhere to go still gets the shake.
        if (bpQueueHandledKey(dir)) return;
        // Setup's held-Down jump to its action rail. The only handler here that
        // is given e.repeat, because a hold and a burst of taps are otherwise
        // identical. It declines every direction but Down, and declines that
        // one too unless the rail is genuinely the next thing.
        if (bpOnboardHandledKey(dir, e.repeat)) return;
        if (onDir?.(dir)) return;
        // A held remote key repeats about twenty times a second and every one
        // of those runs a full move: a reveal, a measure, and a :has() recalc
        // across the whole rail. The device cannot retire them at that rate, so
        // the queue grows faster than it drains and the app stops answering
        // until the key is released. Dropping a repeat costs one timestamp
        // compare, which is what lets the queue drain at all. Only repeats are
        // gated; a real press always moves in the frame it arrives.
        if (e.repeat) {
          const now = performance.now();
          if (now - repeatAtRef.current < REPEAT_MIN_MS) return;
          repeatAtRef.current = now;
        } else {
          repeatAtRef.current = performance.now();
        }
        move(dir);
        return;
      }
      if (isBpNavJumpKey(e.key) && !editing()) {
        e.preventDefault();
        e.stopPropagation();
        interactedRef.current = true;
        markBpInteracted();
        focusBpTopBar(rootRef.current);
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        if (editing()) return;
        e.preventDefault();
        e.stopPropagation();
        select();
        return;
      }
      if (e.key === "Escape" || e.key === "Backspace") {
        if (e.key === "Backspace" && editing()) return;
        e.preventDefault();
        e.stopPropagation();
        SFX.close();
        onBack();
        return;
      }
      if (e.key === "PageUp" || e.key === "PageDown") {
        e.preventDefault();
        e.stopPropagation();
        interactedRef.current = true;
        SFX.pageTurn(e.key === "PageDown" ? "next" : "prev");
        onTab?.(e.key === "PageDown" ? 1 : -1);
        return;
      }
      if ((e.key === "Tab" || e.key === "ContextMenu") && onOptions) {
        e.preventDefault();
        e.stopPropagation();
        SFX.open();
        onOptions();
      }
    };
    // The release. A press that survived its own click, anything that did not
    // navigate, hands the tile back on key up; bp-press has its own timeout for
    // the far commoner case where the route took the tile with it.
    const onUp = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") bpPressOff();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onUp, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onUp, true);
      bpPressOff();
    };
  }, [enabled, move, select, onBack, onOptions, onTab, onDir, rootRef]);

  return { move, select };
}
