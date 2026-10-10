import { useCallback, useEffect, useRef, useState } from "react";

export type AcquireState = "idle" | "loading" | "done" | "error";

export function useAcquireState(fn: () => Promise<void>): {
  state: AcquireState;
  run: (e?: { stopPropagation?: () => void }) => void;
} {
  const [state, setState] = useState<AcquireState>("idle");
  const stateRef = useRef<AcquireState>(state);
  stateRef.current = state;
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current != null) window.clearTimeout(timer.current);
    },
    [],
  );

  const run = useCallback((e?: { stopPropagation?: () => void }) => {
    e?.stopPropagation?.();
    if (stateRef.current === "loading" || stateRef.current === "done") return;
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    setState("loading");
    void (async () => {
      try {
        await fnRef.current();
        setState("done");
      } catch {
        setState("error");
        timer.current = window.setTimeout(() => setState("idle"), 2200);
      }
    })();
  }, []);

  return { state, run };
}
