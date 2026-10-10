import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { BookApi } from "../book-view";

const FLIP_MS = 320;

export function useBookTurnQueue(bookApi: RefObject<BookApi | null>) {
  const busyUntil = useRef(0);
  const pending = useRef<{ dir: "next" | "prev"; n: number } | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const fire = useCallback(
    (dir: "next" | "prev") => {
      const api = bookApi.current;
      if (!api) {
        pending.current = null;
        return;
      }
      if (dir === "next") api.next();
      else api.prev();
      busyUntil.current = performance.now() + FLIP_MS;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        const p = pending.current;
        pending.current = null;
        if (!p) return;
        if (p.n > 1) pending.current = { dir: p.dir, n: p.n - 1 };
        fire(p.dir);
      }, FLIP_MS + 10);
    },
    [bookApi],
  );

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return useCallback(
    (dir: "next" | "prev") => {
      if (performance.now() < busyUntil.current) {
        const p = pending.current;
        if (p && p.dir === dir) pending.current = { dir, n: p.n + 1 };
        else pending.current = { dir, n: 1 };
        return;
      }
      fire(dir);
    },
    [fire],
  );
}
