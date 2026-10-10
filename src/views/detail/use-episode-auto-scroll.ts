import { useCallback, useEffect, useRef } from "react";
import { useSettings } from "@/lib/settings";

export type AutoScrollTarget = { episode: number; id?: number | null; first: boolean } | null;

type Target = NonNullable<AutoScrollTarget>;

// Lazily sized rows and late episode reloads move the target after the first jump, so it stays pinned until the user takes over.
const HOLD_MS = 15_000;

// Module-level so a pin survives the episode list remounting; tied to the page scroller so a new visit never inherits it.
let pin: { scope: string; root: HTMLElement; until: number } | null = null;

function findEpisode(root: HTMLElement, t: Target): HTMLElement | null {
  const byId = t.id != null ? root.querySelector<HTMLElement>(`[data-epid="${t.id}"]`) : null;
  return byId ?? root.querySelector<HTMLElement>(`[data-ep="${t.episode}"]`);
}

function showListTop(root: HTMLElement | null) {
  const list = root?.querySelector<HTMLElement>("[data-episodes], [data-anime-episodes]");
  if (!root || !list) return;
  const off = list.getBoundingClientRect().top - root.getBoundingClientRect().top - 90;
  if (off < 0) root.scrollTop += off;
}

// Scrolls to the first unwatched episode once per season shown; call the returned markPicked() before a user season change.
export function useEpisodeAutoScroll({
  scrollRef,
  scopeKey,
  seasonKey,
  target,
  ready,
  beforeScroll,
}: {
  scrollRef: React.RefObject<HTMLElement | null>;
  scopeKey: string;
  seasonKey: string;
  target: AutoScrollTarget;
  ready: boolean;
  beforeScroll?: (episode: number, id?: number | null) => void;
}) {
  const { settings } = useSettings();
  const enabled = settings.episodeAutoScroll;
  const centered = settings.episodeLayout !== "strip";
  const doneRef = useRef<string | null>(null);
  const pickedRef = useRef(false);
  const userRef = useRef(false);
  const holdRef = useRef<{ until: number; target: Target } | null>(null);
  const beforeRef = useRef(beforeScroll);
  beforeRef.current = beforeScroll;
  const centeredRef = useRef(centered);
  centeredRef.current = centered;

  useEffect(() => {
    userRef.current = false;
    holdRef.current = null;
  }, [scopeKey]);

  const align = useCallback((): boolean => {
    const hold = holdRef.current;
    const root = scrollRef.current;
    if (!hold || !root) return false;
    if (performance.now() > hold.until) {
      holdRef.current = null;
      return false;
    }
    const el = findEpisode(root, hold.target);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const rr = root.getBoundingClientRect();
    const off = centeredRef.current
      ? r.top + r.height / 2 - (rr.top + rr.height / 2)
      : r.top < rr.top
        ? r.top - rr.top
        : r.bottom > rr.bottom
          ? r.bottom - rr.bottom
          : 0;
    if (Math.abs(off) > 2) root.scrollTop += off;
    // Horizontal strips keep their own scroller; nudge it without moving the page again.
    const strip = el.closest<HTMLElement>(".overflow-x-auto");
    if (strip) {
      const sr = strip.getBoundingClientRect();
      const dx = r.left + r.width / 2 - (sr.left + sr.width / 2);
      if (Math.abs(dx) > 2) strip.scrollLeft += dx;
    }
    return true;
  }, [scrollRef]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !enabled) return;
    const release = () => {
      userRef.current = true;
      holdRef.current = null;
      pin = null;
    };
    const ro = new ResizeObserver(() => {
      if (holdRef.current) align();
    });
    ro.observe(root);
    for (const child of Array.from(root.children)) ro.observe(child);
    const mo = new MutationObserver(() => {
      if (holdRef.current) requestAnimationFrame(() => void align());
    });
    mo.observe(root, { childList: true, subtree: true });
    const opts = { passive: true, capture: true } as const;
    root.addEventListener("wheel", release, opts);
    root.addEventListener("touchstart", release, opts);
    root.addEventListener("pointerdown", release, opts);
    window.addEventListener("keydown", release, true);
    return () => {
      ro.disconnect();
      mo.disconnect();
      root.removeEventListener("wheel", release, opts);
      root.removeEventListener("touchstart", release, opts);
      root.removeEventListener("pointerdown", release, opts);
      window.removeEventListener("keydown", release, true);
    };
  }, [scrollRef, enabled, align]);

  useEffect(() => {
    if (!enabled || !ready) return;
    const key = `${scopeKey}|${seasonKey}`;
    const hold = holdRef.current;
    const now = performance.now();
    const root = scrollRef.current;
    const pinned = pin != null && pin.scope === scopeKey && pin.root === root && now < pin.until;
    const holding = (hold != null && now < hold.until) || pinned;
    const picked = pickedRef.current;
    const fresh = doneRef.current !== key;
    if (!fresh && !holding) return;
    // Watched data can arrive late, so an entry with nothing to jump to stays open for a later target.
    if (!target || target.first) {
      if (fresh && picked) {
        doneRef.current = key;
        pickedRef.current = false;
        holdRef.current = null;
        pin = null;
        // A picked season with nothing to jump to starts from its top, not the previous season's offset.
        showListTop(root);
      }
      return;
    }
    if (!fresh && hold && hold.target.episode === target.episode && hold.target.id === target.id)
      return;
    doneRef.current = key;
    pickedRef.current = false;
    // On entry a remembered or user scroll position wins; a reload while still pinned does not count as one.
    if (!picked && !holding && (userRef.current || (root?.scrollTop ?? 0) > 240)) return;
    if (!root) return;
    beforeRef.current?.(target.episode, target.id);
    const until = pinned && !picked ? pin!.until : now + HOLD_MS;
    holdRef.current = { until, target };
    pin = { scope: scopeKey, root, until };
    let tries = 0;
    const run = () => {
      if (!holdRef.current) return;
      if (!align() && tries++ < 60) requestAnimationFrame(run);
    };
    requestAnimationFrame(run);
  }, [enabled, ready, scopeKey, seasonKey, target, scrollRef, align]);

  return useCallback(() => {
    pickedRef.current = true;
    holdRef.current = null;
  }, []);
}
