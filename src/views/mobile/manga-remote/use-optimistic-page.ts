import { useEffect, useState } from "react";
import type { TurnDir } from "./gesture-math";

const REVERT_MS = 700;

type Pending = { target: number; seq: number; dir: TurnDir };

export function useOptimisticPage(pageIndex: number, pageCount: number, chapterId: string, seq: number) {
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    setPending(null);
  }, [chapterId]);

  useEffect(() => {
    setPending((prev) => {
      if (!prev || seq <= prev.seq) return prev;
      const reached = prev.dir === "next" ? pageIndex >= prev.target : pageIndex <= prev.target;
      return reached ? null : prev;
    });
  }, [pageIndex, seq]);

  useEffect(() => {
    if (!pending) return;
    const id = window.setTimeout(() => setPending(null), REVERT_MS);
    return () => window.clearTimeout(id);
  }, [pending]);

  const advance = (dir: TurnDir) => {
    setPending((prev) => {
      const base = prev ? prev.target : pageIndex;
      const max = Math.max(0, pageCount - 1);
      const target = dir === "next" ? Math.min(base + 1, max) : Math.max(base - 1, 0);
      return { target, seq, dir };
    });
  };

  const displayPage = pending ? pending.target : pageIndex;
  return { displayPage, advance };
}
