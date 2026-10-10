import { startTransition, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  cachedSportsSnapshot,
  loadSportsSlices,
  reconcileSportsGames,
} from "@/lib/sports/hub-cache";
import { fetchHubSlice } from "@/lib/sports/hub-data";
import { readHubSourceSlice, saveHubSourceSlice } from "@/lib/sports/api-hub-cache";
import { sportsApiRevision, subscribeSportsApiCredentials } from "@/lib/sports/api-credentials";
import { hydrateSportsSlices } from "@/lib/sports/slice-storage";

export function useSportsHub(
  leagues: string[],
  day: string,
  active: boolean,
  refresh: number,
  mode: "day" | "upcoming" | "live",
) {
  const signature = leagues.join(",");
  const credentialRevision = useSyncExternalStore(subscribeSportsApiCredentials, sportsApiRevision);
  const request = `${signature}@${day}@${mode}@${credentialRevision}`;
  const keys = useMemo(
    () =>
      signature
        .split(",")
        .filter(Boolean)
        .map((key) => `${key}@${day}@${mode}`),
    [signature, day, mode],
  );
  const initial = useMemo(
    () => cachedSportsSnapshot(keys, readHubSourceSlice),
    [keys, credentialRevision],
  );
  const [result, setResult] = useState({ request, snapshot: initial });
  const lastRefresh = useRef(refresh);
  useEffect(() => {
    if (!active) return;
    const force = lastRefresh.current !== refresh;
    lastRefresh.current = refresh;
    let controller = new AbortController();
    let busy = false;
    let first = true;
    let alive = true;
    const run = async () => {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      controller = new AbortController();
      const bypassCache = first && force;
      first = false;
      try {
        await hydrateSportsSlices();
        if (!alive || controller.signal.aborted) return;
        await loadSportsSlices(
          keys,
          readHubSourceSlice,
          (key) => fetchHubSlice(key, controller.signal),
          (key, slice) => {
            if (sportsApiRevision() === credentialRevision) saveHubSourceSlice(key, slice);
          },
          (snapshot) => {
            if (!alive || sportsApiRevision() !== credentialRevision) return;
            startTransition(() =>
              setResult((previous) => ({
                request,
                snapshot: {
                  ...snapshot,
                  games:
                    previous.request === request
                      ? reconcileSportsGames(previous.snapshot.games, snapshot.games)
                      : snapshot.games,
                },
              })),
            );
          },
          controller.signal,
          5,
          bypassCache ? 0 : mode === "upcoming" ? 15 * 60_000 : 15_000,
        );
      } finally {
        busy = false;
      }
    };
    void run();
    const timer = window.setInterval(run, mode === "upcoming" ? 15 * 60_000 : 60_000);
    const visible = () => {
      if (document.visibilityState === "visible") void run();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      alive = false;
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [request, keys, mode, active, refresh]);
  return result.request === request ? result.snapshot : initial;
}
