import { useCallback, useEffect, useRef, useState } from "react";
import {
  EMPTY_ROW,
  ROW_MAX_PAGES,
  ROW_MIN_VISIBLE,
  SPECS,
  type RowState,
} from "@/views/anime/anime-rows";

const MAX_ITEMS = 80;

export type BpAnimeSpecs = {
  rowsByKey: Record<string, RowState>;
  loadMore: (key: string) => void;
  readyCount: number;
  itemCount: number;
};

function initRows(): Record<string, RowState> {
  const init: Record<string, RowState> = {};
  for (const s of SPECS) init[s.key] = EMPTY_ROW;
  return init;
}

export function useBpAnimeSpecs(): BpAnimeSpecs {
  const [rowsByKey, setRowsByKey] = useState<Record<string, RowState>>(initRows);
  const rowsRef = useRef(rowsByKey);
  const loadingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    rowsRef.current = rowsByKey;
  }, [rowsByKey]);

  // Fired flat, in SPECS order. Every fetcher lands on jikan's own 400ms queue
  // chain in call order anyway, so windowing these into batches with a gap
  // between them was a second serialiser that changed no request order and only
  // added dead time between the rows it was pacing.
  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      SPECS.map(async (s) => {
        try {
          const metas = await s.fetcher(1);
          if (cancelled) return;
          setRowsByKey((prev) => ({
            ...prev,
            [s.key]: { metas, page: 1, hasMore: metas.length >= ROW_MIN_VISIBLE, ready: true },
          }));
        } catch {
          if (cancelled) return;
          setRowsByKey((prev) => ({ ...prev, [s.key]: { ...EMPTY_ROW, ready: true } }));
        }
      }),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const loadMore = useCallback((key: string) => {
    if (loadingRef.current.has(key)) return;
    const spec = SPECS.find((s) => s.key === key);
    const row = rowsRef.current[key];
    if (!spec || !row || !row.hasMore || row.page >= ROW_MAX_PAGES) return;
    if (row.metas.length >= MAX_ITEMS) return;
    loadingRef.current.add(key);
    const next = row.page + 1;
    spec
      .fetcher(next)
      .then((more) => {
        setRowsByKey((prev) => {
          const cur = prev[key];
          if (!cur) return prev;
          const ids = new Set(cur.metas.map((m) => m.id));
          const fresh = more.filter((m) => !ids.has(m.id));
          return {
            ...prev,
            [key]: {
              ...cur,
              metas: [...cur.metas, ...fresh],
              page: next,
              hasMore: more.length >= ROW_MIN_VISIBLE && cur.metas.length + fresh.length < MAX_ITEMS,
            },
          };
        });
      })
      .catch(() => {})
      .finally(() => {
        loadingRef.current.delete(key);
      });
  }, []);

  let readyCount = 0;
  let itemCount = 0;
  for (const s of SPECS) {
    const r = rowsByKey[s.key];
    if (!r) continue;
    if (r.ready) readyCount += 1;
    itemCount += r.metas.length;
  }

  return { rowsByKey, loadMore, readyCount, itemCount };
}
