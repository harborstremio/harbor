import { useEffect, useState, useSyncExternalStore } from "react";
import type { SportsGame, SportsMatchDetail } from "@/lib/sports/espn";
import { gameKey } from "@/lib/sports/hub-cache";
import { fetchGameSummary } from "@/lib/sports/provider";
import { sportsApiRevision, subscribeSportsApiCredentials } from "@/lib/sports/api-credentials";

const cache = new Map<string, { detail: SportsMatchDetail; at: number }>();
const inflight = new Map<string, Promise<SportsMatchDetail | null>>();
function load(game: SportsGame) {
  const key = detailKey(game);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 25_000) return Promise.resolve(hit.detail);
  if (inflight.has(key)) return inflight.get(key)!;
  const task = fetchGameSummary(game)
    .then((detail) => {
      if (detail) {
        cache.set(key, { detail, at: Date.now() });
        if (cache.size > 24) cache.delete(cache.keys().next().value!);
      }
      return detail;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, task);
  return task;
}
export function useMatchDetail(game: SportsGame, enabled = true) {
  useSyncExternalStore(subscribeSportsApiCredentials, sportsApiRevision);
  const key = detailKey(game);
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState<{
    key: string;
    detail: SportsMatchDetail | null;
    loading: boolean;
    failed: boolean;
  }>({ key: "", detail: null, loading: false, failed: false });
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let busy = false;
    const hit = cache.get(key);
    setState({ key, detail: hit?.detail ?? null, loading: !hit, failed: false });
    const run = async () => {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const detail = await load(game);
        if (active)
          setState((prior) => ({
            key,
            detail: detail ?? prior.detail,
            loading: false,
            failed: !detail,
          }));
      } catch {
        if (active) setState((prior) => ({ ...prior, loading: false, failed: true }));
      } finally {
        busy = false;
      }
    };
    void run();
    const timer = setInterval(() => {
      if (game.state === "in") void run();
    }, 30_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [key, enabled, refresh]);
  return {
    ...(state.key === key ? state : { detail: null, loading: enabled, failed: false }),
    retry: () => {
      cache.delete(key);
      setRefresh((n) => n + 1);
    },
  };
}

function detailKey(game: SportsGame) {
  return `${gameKey(game)}${game.source === "api-sports" ? `:${sportsApiRevision()}` : ""}`;
}
