import { useCallback, useEffect, useRef, useState } from "react";

const HOLD_MS = 7000;

function cardFocused(): boolean {
  if (typeof document === "undefined") return false;
  const el = document.querySelector<HTMLElement>("[data-bp-focus='true']");
  if (!el) return false;
  if (el.closest("[data-bp-tile]") !== null) return true;
  return el.closest('[data-bp-row-key="sports-hero"]') !== null;
}

function reduced(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useBpSportsCycle(
  count: number,
  enabled: boolean,
): { index: number; bump: () => void } {
  const [index, setIndex] = useState(0);
  const [restart, setRestart] = useState(0);
  const countRef = useRef(count);
  countRef.current = count;

  useEffect(() => {
    if (count === 0 || index < count) return;
    setIndex(0);
  }, [count, index]);

  useEffect(() => {
    if (!enabled || count < 2) return;
    if (reduced()) return;

    let hold = 0;

    const advance = () => {
      if (cardFocused()) {
        hold = window.setTimeout(advance, HOLD_MS);
        return;
      }
      const total = countRef.current;
      if (total === 0) return;
      setIndex((at) => (at + 1) % total);
      hold = window.setTimeout(advance, HOLD_MS);
    };

    hold = window.setTimeout(advance, HOLD_MS);
    return () => {
      window.clearTimeout(hold);
    };
  }, [enabled, count, restart]);

  const bump = useCallback(() => setRestart((n) => n + 1), []);

  return { index, bump };
}
