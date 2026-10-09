import { useEffect, useRef, useState } from "react";
import { loadGameReviews } from "@/lib/games/community-fetch";
import type { GameReviewFilters, GameReviewPage } from "@/lib/games/community";

/** Cursor-backed pages are fetched on demand; retain twelve pages for quick Back navigation. */
export function useReviewPages(appId: number, filters: GameReviewFilters, ready: boolean) {
  const query = `${appId}:${JSON.stringify(filters)}`;
  const cache = useRef<{ query: string; pages: Map<number, GameReviewPage>; cursors: string[]; summary?: GameReviewPage["summary"]; total?: number }>({ query, pages: new Map(), cursors: ["*"] });
  const [position, setPosition] = useState({ query, index: 0 });
  const index = position.query === query ? position.index : 0;
  const [result, setResult] = useState<{ key: string; page: GameReviewPage } | null>(null);
  const [failure, setFailure] = useState(""), [attempt, setAttempt] = useState(0);
  const key = `${query}:${index}`, page = result?.key === key ? result.page : null;
  if (cache.current.query !== query) cache.current = { query, pages: new Map(), cursors: ["*"] };
  useEffect(() => {
    if (!ready) return;
    const request = new AbortController(), own = cache.current, cursor = own.cursors[index];
    if (cursor === undefined) return;
    setFailure("");
    const held = own.pages.get(index);
    if (held) { setResult({ key, page: held }); return; }
    void loadGameReviews(appId, filters, cursor, request.signal).then(data => {
      if (request.signal.aborted || cache.current !== own) return;
      own.summary = data.summary ?? own.summary;
      own.total = data.total ?? own.total;
      data = { ...data, summary: own.summary, total: own.total };
      if (!data.reviews.length && index > 0) {
        const previous = own.pages.get(index - 1);
        if (previous) {
          const last = { ...previous, cursor: null };
          own.pages.set(index - 1, last); own.cursors.length = index;
          setPosition({ query, index: index - 1 }); setResult({ key: `${query}:${index - 1}`, page: last }); return;
        }
      }
      // A provider cursor that cycles cannot produce an endless Next action.
      if (data.cursor && own.cursors.slice(0, index + 1).includes(data.cursor)) data = { ...data, cursor: null };
      if (data.cursor) own.cursors[index + 1] = data.cursor;
      else own.cursors.length = index + 1;
      own.pages.set(index, data);
      if (own.pages.size > 12) { const farthest = [...own.pages.keys()].sort((a, b) => Math.abs(b - index) - Math.abs(a - index))[0]; own.pages.delete(farthest); }
      setResult({ key, page: data });
    }, () => { if (!request.signal.aborted) setFailure(key); });
    return () => request.abort();
  }, [key, ready, attempt]);
  const go = (next: number) => { if (next >= 0 && next < cache.current.cursors.length) setPosition({ query, index: next }); };
  return { page, index, busy: ready && !page && failure !== key, failed: failure === key, go, retry: () => setAttempt(n => n + 1), visited: cache.current.cursors.length };
}
