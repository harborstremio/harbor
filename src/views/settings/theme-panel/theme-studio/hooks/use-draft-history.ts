import { useCallback, useRef, useState } from "react";

import type { Draft } from "../studio-types";

type Updater = Draft | ((prev: Draft) => Draft);

const COALESCE_MS = 450;
const MAX_DEPTH = 120;

export function useDraftHistory(initial: () => Draft) {
  const [state, setState] = useState(() => ({
    draft: initial(),
    past: [] as Draft[],
    future: [] as Draft[],
  }));
  const lastPushAt = useRef(0);

  const setDraft = useCallback((updater: Updater) => {
    setState((s) => {
      const next = typeof updater === "function" ? (updater as (p: Draft) => Draft)(s.draft) : updater;
      if (next === s.draft) return s;
      const now = Date.now();
      const coalesce = s.past.length > 0 && now - lastPushAt.current < COALESCE_MS;
      lastPushAt.current = now;
      const past = coalesce ? s.past : [...s.past, s.draft].slice(-MAX_DEPTH);
      return { draft: next, past, future: [] };
    });
  }, []);

  const undo = useCallback(() => {
    lastPushAt.current = 0;
    setState((s) => {
      if (s.past.length === 0) return s;
      return {
        draft: s.past[s.past.length - 1],
        past: s.past.slice(0, -1),
        future: [...s.future, s.draft],
      };
    });
  }, []);

  const redo = useCallback(() => {
    lastPushAt.current = 0;
    setState((s) => {
      if (s.future.length === 0) return s;
      return {
        draft: s.future[s.future.length - 1],
        past: [...s.past, s.draft],
        future: s.future.slice(0, -1),
      };
    });
  }, []);

  return {
    draft: state.draft,
    setDraft,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}
