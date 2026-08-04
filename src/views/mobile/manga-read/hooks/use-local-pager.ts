import { useRef, useState } from "react";

function clamp(n: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(total - 1, n));
}

export function useLocalPager(chapterId: string, total: number, initialPage: number) {
  const [page, setPageRaw] = useState(() => clamp(initialPage, total));
  const seen = useRef(chapterId);

  if (seen.current !== chapterId) {
    seen.current = chapterId;
    setPageRaw(0);
  }

  const setPage = (n: number) => setPageRaw(clamp(n, total));

  return { page, setPage };
}
