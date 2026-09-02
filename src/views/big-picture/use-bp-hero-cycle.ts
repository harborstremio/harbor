import { useEffect, useRef } from "react";
import type { Meta } from "@/lib/cinemeta";
import { seedBpMeta } from "./bp-focus-meta";

const HOLD_MS = 7000;

function cardFocused(): boolean {
  if (typeof document === "undefined") return false;
  const el = document.querySelector<HTMLElement>("[data-bp-focus='true']");
  return el !== null && el.closest("[data-bp-tile]") !== null;
}

function reduced(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useBpHeroCycle(pool: Meta[], enabled: boolean): void {
  const poolRef = useRef(pool);
  poolRef.current = pool;
  const atRef = useRef(0);

  useEffect(() => {
    if (!enabled || pool.length < 2) return;
    if (reduced()) return;

    let hold = 0;

    const advance = () => {
      if (cardFocused()) {
        hold = window.setTimeout(advance, HOLD_MS);
        return;
      }
      const list = poolRef.current;
      if (list.length === 0) return;
      atRef.current = (atRef.current + 1) % list.length;
      seedBpMeta(list[atRef.current]);
      hold = window.setTimeout(advance, HOLD_MS);
    };

    hold = window.setTimeout(advance, HOLD_MS);
    return () => {
      window.clearTimeout(hold);
    };
  }, [enabled, pool.length]);
}
