import { useCallback, useEffect, useRef, useState } from "react";

export type DiscoveryBatch<T, M> = { items: T[]; next: string; meta: M };
export function useMinecraftDiscovery<T extends { id: string }, M>(url: string, active: boolean, load: (url: string, signal: AbortSignal, refresh: boolean) => Promise<DiscoveryBatch<T, M>>, autoMore = true) {
  const [state, setState] = useState<{ url: string; items: T[]; next: string; meta?: M; busy: boolean; error: string }>({ url, items: [], next: "", busy: true, error: "" });
  const request = useRef<AbortController | null>(null), busy = useRef(false), failedUrl = useRef(url);
  const latest = useRef(state); latest.current = state;
  const fetchPage = useCallback((pageUrl: string, append: boolean, refresh = false) => {
    request.current?.abort(); const controller = new AbortController(); request.current = controller; busy.current = true; failedUrl.current = pageUrl;
    setState(previous => ({ url, items: append ? previous.items : [], next: "", meta: append ? previous.meta : undefined, busy: true, error: "" }));
    void load(pageUrl, controller.signal, refresh).then(batch => {
      if (controller.signal.aborted) return;
      setState(previous => {
        const items = Array.from(new Map([...(append ? previous.items : []), ...batch.items].map(item => [item.id, item])).values());
        return { url, items, next: batch.next === pageUrl || (append && items.length === previous.items.length) ? "" : batch.next, meta: batch.meta, busy: false, error: "" };
      });
    }).catch(error => { if (!controller.signal.aborted) setState(previous => ({ ...previous, busy: false, error: String(error) })); }).finally(() => { if (!controller.signal.aborted) busy.current = false; });
  }, [load, url]);
  useEffect(() => {
    if (active) {
      const previous = latest.current;
      if (previous.url !== url || (!previous.items.length && !previous.error)) fetchPage(url, false);
      else if (previous.busy) fetchPage(failedUrl.current, previous.items.length > 0);
    }
    return () => { request.current?.abort(); busy.current = false; };
  }, [url, active, fetchPage]);
  const more = useCallback(() => { if (active && !busy.current && state.url === url && state.next && !state.error) fetchPage(state.next, true); }, [active, state.url, state.next, state.error, url, fetchPage]);
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!active || !autoMore || state.busy || !state.next || state.error || !sentinel.current) return;
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) more(); }, { rootMargin: "240px" });
    observer.observe(sentinel.current); return () => observer.disconnect();
  }, [active, autoMore, state.busy, state.next, state.error, more]);
  return { ...state, items: state.url === url ? state.items : [], sentinel, more, retry: () => fetchPage(failedUrl.current, state.items.length > 0, true), refresh: () => fetchPage(url, false, true) };
}
