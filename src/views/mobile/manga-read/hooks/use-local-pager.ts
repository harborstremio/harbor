import { useEffect, useRef, useState } from "react";

const FOLLOW_IDLE_MS = 1200;

function clamp(n: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(total - 1, n));
}

export function useLocalPager(chapterId: string, total: number, snapshotPage: number) {
  const [page, setPageRaw] = useState(() => clamp(snapshotPage, total));
  const seen = useRef(chapterId);
  const lastLocal = useRef(0);
  const pageRef = useRef(page);
  pageRef.current = page;

  if (seen.current !== chapterId) {
    seen.current = chapterId;
    lastLocal.current = 0;
    setPageRaw(clamp(snapshotPage, total));
  }

  const setPage = (n: number) => {
    lastLocal.current = performance.now();
    setPageRaw(clamp(n, total));
  };

  useEffect(() => {
    const target = clamp(snapshotPage, total);
    if (target === pageRef.current) return;
    if (performance.now() - lastLocal.current < FOLLOW_IDLE_MS) return;
    setPageRaw(target);
  }, [snapshotPage, chapterId, total]);

  return { page, setPage };
}
