import { useEffect, useRef, useState } from "react";
import type { GameSummary } from "@/lib/games/types";
import type { SavedReleaseResult } from "@/lib/games/saved-releases";
import { loadSavedReleases, type SavedReleaseRequest } from "@/lib/games/saved-releases-load";
import { useLiveRefresh } from "./use-live-refresh";

const BATCH = 12;

/** Callers key their view by profile; no saved membership or result crosses profiles. */
export function useSavedGameReleases(games: GameSummary[], active: boolean, request?: SavedReleaseRequest) {
  const [results, setResults] = useState<Record<string, SavedReleaseResult>>({});
  const [loading, setLoading] = useState(false), [limit, setLimit] = useState(BATCH), [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState<string[]>([]);
  const refresh = useLiveRefresh(active, 31 * 60_000);
  const lastRefresh = useRef(`${attempt}:${refresh}`), resultsRef = useRef(results);
  resultsRef.current = results;
  const membership = games.map(game => game.id).join("|");

  useEffect(() => {
    if (!active) { setLoading(false); setPending([]); return; }
    const revision = `${attempt}:${refresh}`, force = lastRefresh.current !== revision;
    const batch = games.slice(0, limit).filter(game => force || !resultsRef.current[game.id]);
    if (!batch.length) { setLoading(false); setPending([]); return; }
    const controller = new AbortController();
    setLoading(true); setPending(batch.map(game => game.id));
    void loadSavedReleases(batch, controller.signal, (id, result) => {
      setPending(values => values.filter(value => value !== id));
      setResults(previous => ({ ...previous, [id]: result.failed ? { ...previous[id], failed: true } : result }));
    }, request, undefined, force)
      .then(() => { if (!controller.signal.aborted) lastRefresh.current = revision; })
      .catch(() => {})
      .finally(() => { if (!controller.signal.aborted) { setLoading(false); setPending([]); } });
    return () => controller.abort();
  }, [active, membership, limit, attempt, refresh, request]);

  return {
    results, loading, pending, membership,
    checked: games.filter(game => results[game.id]).length,
    failed: games.some(game => results[game.id]?.failed),
    retry: () => setAttempt(value => value + 1),
    more: () => setLimit(value => value + BATCH),
  };
}
