import { ARABIC_ROWS } from "@/lib/arabic";
import type { Meta } from "@/lib/cinemeta";
import { useCallback, useEffect, useRef, useState } from "react";

const MAX_RAIL_PAGES = 8;
const MIN_PAGE_YIELD = 4;

export function useArabicRows(tmdbKey: string) {
  const [rows, setRows] = useState<Record<string, Meta[] | null>>({});
  const pagesRef = useRef<Record<string, number>>({});
  const exhaustedRef = useRef<Record<string, boolean>>({});
  const loadingRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    const initial: Record<string, Meta[] | null> = {};
    for (const row of ARABIC_ROWS) initial[row.id] = null;
    setRows(initial);
    pagesRef.current = {};
    exhaustedRef.current = {};
    loadingRef.current = {};

    for (const row of ARABIC_ROWS) {
      loadingRef.current[row.id] = true;
      row
        .fetch(tmdbKey, 1)
        .then((list) => {
          if (cancelled) return;
          pagesRef.current[row.id] = 1;
          if (list.length < MIN_PAGE_YIELD) exhaustedRef.current[row.id] = true;
          setRows((prev) => ({ ...prev, [row.id]: list }));
        })
        .catch(() => {
          if (cancelled) return;
          setRows((prev) => ({ ...prev, [row.id]: [] }));
        })
        .finally(() => {
          loadingRef.current[row.id] = false;
        });
    }
    return () => {
      cancelled = true;
    };
  }, [tmdbKey]);

  const loadMore = useCallback(
    (rowId: string) => {
      if (loadingRef.current[rowId]) return;
      if (exhaustedRef.current[rowId]) return;
      const cur = pagesRef.current[rowId] ?? 1;
      if (cur >= MAX_RAIL_PAGES) return;
      const def = ARABIC_ROWS.find((r) => r.id === rowId);
      if (!def) return;
      const next = cur + 1;
      loadingRef.current[rowId] = true;
      def
        .fetch(tmdbKey, next)
        .then((list) => {
          pagesRef.current[rowId] = next;
          if (list.length < MIN_PAGE_YIELD) exhaustedRef.current[rowId] = true;
          setRows((prev) => {
            const existing = prev[rowId] ?? [];
            const seen = new Set(existing.map((m) => m.id));
            const fresh = list.filter((m) => !seen.has(m.id));
            return { ...prev, [rowId]: [...existing, ...fresh] };
          });
        })
        .catch(() => {})
        .finally(() => {
          loadingRef.current[rowId] = false;
        });
    },
    [tmdbKey],
  );

  return { rows, loadMore };
}
