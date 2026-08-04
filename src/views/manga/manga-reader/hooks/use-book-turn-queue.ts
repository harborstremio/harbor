import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { BookApi } from "../book-view";

const FLIP_MS = 320;

type QueueState = {
  busyUntil: number;
  pending: "next" | "prev" | null;
  timer: number | undefined;
};

function fire(bookApi: RefObject<BookApi | null>, state: QueueState, dir: "next" | "prev") {
  const api = bookApi.current;
  if (!api) return;
  if (dir === "next") api.next();
  else api.prev();
  state.busyUntil = performance.now() + FLIP_MS;
  window.clearTimeout(state.timer);
  state.timer = window.setTimeout(() => {
    const pending = state.pending;
    if (pending) {
      state.pending = null;
      fire(bookApi, state, pending);
    }
  }, FLIP_MS + 10);
}

export function useBookTurnQueue(bookApi: RefObject<BookApi | null>) {
  const queue = useRef<QueueState>({ busyUntil: 0, pending: null, timer: undefined });

  useEffect(() => {
    const state = queue.current;
    return () => window.clearTimeout(state.timer);
  }, []);

  return useCallback(
    (dir: "next" | "prev") => {
      const state = queue.current;
      if (performance.now() < state.busyUntil) {
        state.pending = dir;
        return;
      }
      fire(bookApi, state, dir);
    },
    [bookApi],
  );
}
