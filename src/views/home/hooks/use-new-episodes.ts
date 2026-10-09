import { useCallback, useEffect, useMemo, useState } from "react";
import {
  dismissEpisodes,
  isDismissed,
  newEpisodesFor,
  type NewEpisode,
} from "@/lib/new-episodes";
import type { LibraryItem } from "@/lib/stremio";

const MAX_SERIES = 40;
const MAX_CARDS = 60;

export function useNewEpisodes(items: LibraryItem[], enabled: boolean) {
  const [found, setFound] = useState<NewEpisode[]>([]);
  const [dismissedVer, setDismissedVer] = useState(0);

  const series = useMemo(
    () =>
      items
        .filter((i) => i.type === "series" && i._id.startsWith("tt"))
        .slice(0, MAX_SERIES),
    [items],
  );

  const signature = useMemo(
    () => series.map((s) => `${s._id}|${s.state?.lastWatched ?? s._mtime ?? ""}`).join(","),
    [series],
  );

  useEffect(() => {
    if (!enabled || series.length === 0) {
      setFound([]);
      return;
    }
    let cancelled = false;

    void Promise.all(series.map((s) => newEpisodesFor(s).catch(() => [])))
      .then((lists) => {
        if (cancelled) return;
        const flat = lists.flat();
        const seen = new Set<string>();
        const unique: NewEpisode[] = [];
        for (const ep of flat) {
          if (seen.has(ep.key)) continue;
          seen.add(ep.key);
          unique.push(ep);
        }
        unique.sort((a, b) => b.released - a.released);
        setFound(unique.slice(0, MAX_CARDS));
      })
      .catch(() => {
        if (!cancelled) setFound([]);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, signature, series.length]);

  const episodes = useMemo(() => {
    void dismissedVer;
    return found.filter((ep) => !isDismissed(ep.key));
  }, [found, dismissedVer]);

  const dismissOne = useCallback((key: string) => {
    dismissEpisodes([key]);
    setDismissedVer((v) => v + 1);
  }, []);

  const dismissAll = useCallback(() => {
    setFound((current) => {
      dismissEpisodes(current.map((ep) => ep.key));
      return current;
    });
    setDismissedVer((v) => v + 1);
  }, []);

  return { episodes, dismissOne, dismissAll };
}
