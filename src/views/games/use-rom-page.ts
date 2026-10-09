import { useEffect, useRef, useState } from "react";
import { loadRomDiscoveryPage, readRomDiscoverySnapshot, type RomDiscoveryFilters } from "@/lib/games/rom-discovery";
import { loadRomSpotlight, readRomSpotlightSnapshot, type RomSpotlight } from "@/lib/games/rom-editorial";

type RomPage = Awaited<ReturnType<typeof loadRomDiscoveryPage>>;
type RomState = { key: string; page?: RomPage; busy: boolean; failed: boolean };
const spotlightPage = (page: RomSpotlight): RomPage => ({ ...page, nextOffset: null, platforms: [], genres: [], franchises: [] });
export function useRomPage(filters: RomDiscoveryFilters, active: boolean, spotlight = false) {
  const key = JSON.stringify({ filters, spotlight }), parameters = useRef(filters); parameters.current = filters;
  const [state, setState] = useState<RomState>({ key: "", busy: false, failed: false });
  const [attempt, setAttempt] = useState(0), lastAttempt = useRef(-1);
  const cache = useRef(new Map<string, RomPage>()), controller = useRef<AbortController | null>(null);
  const failedMore = useRef(false), pending = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!active) { controller.current?.abort(); return; }
    failedMore.current = false;
    const refresh = attempt !== lastAttempt.current; lastAttempt.current = attempt;
    const saved = cache.current.get(key);
    if (saved && !refresh) {
      setState({ key, page: saved, busy: false, failed: false });
      return () => controller.current?.abort();
    }
    const request = new AbortController(); controller.current = request;
    let received = false;
    setState(previous => ({ key, page: previous.key === key ? previous.page : saved, busy: true, failed: false }));
    const snapshot = spotlight ? readRomSpotlightSnapshot().then(page => page && spotlightPage(page)) : readRomDiscoverySnapshot(parameters.current);
    void snapshot.then(page => {
      if (page && !received && !request.signal.aborted) setState(previous => previous.page ? previous : { key, page, busy: true, failed: false });
    });
    const timer = setTimeout(() => {
      const response = spotlight ? loadRomSpotlight(request.signal).then(spotlightPage) : loadRomDiscoveryPage(parameters.current, 0, request.signal);
      void response.then(page => {
        received = true; if (request.signal.aborted) return;
        cache.current.set(key, page); if (cache.current.size > 20) cache.current.delete(cache.current.keys().next().value!);
        setState({ key, page, busy: false, failed: false });
      }, () => { received = true; if (!request.signal.aborted) setState(previous => ({ ...previous, busy: false, failed: true })); });
    }, filters.query ? 280 : 0);
    return () => { clearTimeout(timer); request.abort(); controller.current?.abort(); };
  }, [key, active, attempt]);
  const more = async () => {
    const previous = state.page;
    if (!active || pending.current && !pending.current.signal.aborted || state.key !== key || state.busy || !previous || previous.nextOffset === null) return false;
    const request = new AbortController(); controller.current?.abort(); controller.current = request;
    pending.current = request;
    setState(value => ({ ...value, busy: true, failed: false }));
    try {
      const next = await loadRomDiscoveryPage(filters, previous.nextOffset, request.signal);
      if (request.signal.aborted) return false;
      const page = { ...next, games: [...new Map([...previous.games, ...next.games].map(game => [game.igdbId, game])).values()], franchises: [...new Map([...previous.franchises, ...next.franchises].map(group => [`${group.kind}:${group.id}`, group])).values()] };
      cache.current.set(key, page); failedMore.current = false; setState({ key, page, busy: false, failed: false });
      return true;
    } catch { if (!request.signal.aborted) { failedMore.current = true; setState(value => ({ ...value, busy: false, failed: true })); } return false; }
    finally { if (pending.current === request) pending.current = null; }
  };
  return { page: state.key === key ? state.page : undefined, busy: state.key !== key || state.busy, failed: state.key === key && state.failed, more, retry: () => { if (failedMore.current) void more(); else setAttempt(value => value + 1); } };
}

