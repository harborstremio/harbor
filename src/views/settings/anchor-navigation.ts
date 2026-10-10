import { useEffect, type RefObject } from "react";
import type { SubTabReg } from "./sub-tabs";

export type SettingsAnchorRequest = { anchor: string; tab?: string };

export function glideSettingsToTop(el: HTMLElement): () => void {
  const from = el.scrollTop;
  if (from <= 0) return () => {};
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    el.scrollTo({ top: 0 });
    return () => {};
  }
  const started = performance.now();
  let frame = 0;
  const step = (now: number) => {
    const p = Math.min(1, (now - started) / 420);
    const eased = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
    el.scrollTop = from * (1 - eased);
    if (p < 1) frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
  return () => cancelAnimationFrame(frame);
}

export function useSettingsAnchor(
  scrollRef: RefObject<HTMLElement | null>,
  tabsRef: RefObject<SubTabReg>,
  request: SettingsAnchorRequest | null,
  section: string,
  complete: (request: null) => void,
) {
  useEffect(() => {
    if (!request) return;
    let tries = 0;
    let timer = 0;
    const triedTabs = new Set<string>();
    const restoreTab = request.tab ?? tabsRef.current?.value;
    if (tabsRef.current) triedTabs.add(tabsRef.current.value);
    const retry = () => {
      if (tries++ < 30) timer = window.setTimeout(tryScroll, 50);
      else {
        if (!request.tab && restoreTab) tabsRef.current?.onChange(restoreTab);
        complete(null);
      }
    };
    const tryScroll = () => {
      const reg = tabsRef.current;
      // The requested tab may still be committing after its onChange call.
      // Never resolve a same-named anchor in the tab we are leaving.
      if (request.tab && (!reg || reg.section !== section || reg.value !== request.tab)) {
        retry();
        return;
      }
      const root = scrollRef.current;
      const el = root && Array.from(root.querySelectorAll<HTMLElement>("[id]")).find(
        (candidate) => candidate.id === request.anchor && candidate.getClientRects().length > 0,
      );
      if (el) {
        el.scrollIntoView({
          behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
          block: "start",
        });
        el.classList.remove("hset-jumped");
        void el.offsetWidth;
        el.classList.add("hset-jumped");
        window.setTimeout(() => el.classList.remove("hset-jumped"), 1400);
        complete(null);
        return;
      }
      // Older search entries without a tab can still find their exact section.
      // Explicit tab destinations must not wander into unrelated tabs.
      if (!request.tab && reg && reg.section === section && triedTabs.size < reg.tabs.length) {
        const next = reg.tabs.find((tab) => !triedTabs.has(tab.id));
        if (next) {
          triedTabs.add(next.id);
          if (next.id !== reg.value) {
            reg.onChange(next.id);
            tries = 0;
            timer = window.setTimeout(tryScroll, 50);
            return;
          }
        }
      }
      retry();
    };
    timer = window.setTimeout(tryScroll, 60);
    return () => window.clearTimeout(timer);
  }, [scrollRef, tabsRef, request, section, complete]);
}
