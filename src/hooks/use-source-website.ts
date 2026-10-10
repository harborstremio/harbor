import { useEffect, useRef, useState } from "react";
import { fetchWebsiteSource } from "@/lib/games/source-fetch";
import { sourceError, type GameSource } from "@/lib/games/sources";
export { useWebsiteMatches } from "./use-website-matches";

export function useSourceWebsite(source: GameSource, query: string, profile?: string) {
  const [state, setState] = useState({ entries: source.entries, next: null as number | null, loading: false, error: "" });
  const request = useRef<AbortController | null>(null), revision = useRef(0), pending = useRef(false);
  const run = async (page: number, append: boolean, current: number, signal: AbortSignal, refresh = false) => {
    if (!source.website) return false;
    pending.current = true; setState(previous => ({ ...previous, loading: true, error: "" }));
    try {
      const result = await fetchWebsiteSource(source.website, query, page, signal, refresh, profile);
      if (signal.aborted || current !== revision.current) return false;
      setState(previous => ({ entries: [...new Map([...(append ? previous.entries : []), ...result.entries].map(entry => [entry.id, entry])).values()], next: result.next, loading: false, error: "" }));
      return true;
    } catch (error) { if (!signal.aborted && current === revision.current) setState(previous => ({ ...previous, loading: false, error: sourceError(error) })); }
    finally { if (current === revision.current) pending.current = false; }
    return false;
  };
  useEffect(() => {
    const current = ++revision.current, controller = new AbortController(); request.current = controller;
    pending.current = true;
    setState({ entries: query.trim() ? [] : source.entries, next: null, loading: true, error: "" });
    const timer = setTimeout(() => void run(1, false, current, controller.signal), query.trim() ? 300 : 0);
    return () => { clearTimeout(timer); controller.abort(); revision.current++; pending.current = false; };
  }, [profile, source.id, source.checkedAt, source.website?.api, query]);
  return { ...state, retry: async () => {
    return !pending.current && request.current ? run(state.next ?? 1, !!state.next, revision.current, request.current.signal, true) : false;
  }, more: async () => {
    if (!state.next || pending.current || !request.current) return false;
    return run(state.next, true, revision.current, request.current.signal);
  } };
}
