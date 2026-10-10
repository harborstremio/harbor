import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHideAnimeMetas } from "@/lib/anime-hide";
import type { Meta } from "@/lib/cinemeta";
import { MOVIE_GENRES } from "@/lib/feed/tags";
import { tmdbDiscover } from "@/lib/providers/tmdb";
import { useSettings } from "@/lib/settings";

export type BpGenreStatus = "loading" | "ready" | "no-key" | "failed" | "filtered" | "empty";
export type BpGenreFeed = {
  metas: Meta[];
  status: BpGenreStatus;
  more: () => void;
  retry: () => void;
};

function bpGenreId(genre: string): number | undefined {
  return MOVIE_GENRES[genre];
}

export function useBpGenreGrid(genre: string): BpGenreFeed {
  const { settings } = useSettings();
  const [metas, setMetas] = useState<Meta[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const pageRef = useRef(1);
  const busyRef = useRef(false);
  const doneRef = useRef(false);
  const id = bpGenreId(genre);

  const load = useMemo(() => {
    return async (page: number, reset: boolean) => {
      if (busyRef.current || doneRef.current) return;
      if (!settings.tmdbKey || id == null) {
        setLoading(false);
        return;
      }
      busyRef.current = true;
      try {
        const batch = await tmdbDiscover(settings.tmdbKey, "movie", {
          with_genres: String(id),
          "vote_count.gte": "180",
          sort_by: "popularity.desc",
          page: String(page),
        });
        if (batch.length === 0) {
          doneRef.current = true;
          // tmdb-client's get() swallows every network error, 401 and exhausted
          // retry and answers null, which arrives here as an empty page rather
          // than as a throw. A discover query on a real genre id with
          // vote_count.gte=180 sorted by popularity cannot legitimately be
          // empty on page one, so an empty first page means TMDB did not
          // answer. Later pages genuinely do run out.
          if (page === 1) setFailed(true);
        }
        setMetas((prev) => {
          const base = reset ? [] : prev;
          const seen = new Set(base.map((m) => m.id));
          const fresh: Meta[] = [];
          for (const m of batch) {
            if (seen.has(m.id)) continue;
            seen.add(m.id);
            fresh.push(m);
          }
          return fresh.length > 0 ? [...base, ...fresh] : base;
        });
      } catch {
        doneRef.current = true;
        setFailed(true);
      } finally {
        busyRef.current = false;
        setLoading(false);
      }
    };
  }, [settings.tmdbKey, id]);

  const restart = useCallback(() => {
    pageRef.current = 1;
    doneRef.current = false;
    setFailed(false);
    setLoading(true);
    void load(1, true);
  }, [load]);

  useEffect(() => {
    restart();
  }, [restart, genre]);

  // The page counter advances only when a load can actually start. It used to
  // advance first and then be swallowed by load()'s own busy guard, which SKIPS
  // that page for good, and the only reason nothing noticed is that the sentinel
  // was gated on there already being tiles.
  const more = () => {
    if (busyRef.current || doneRef.current) return;
    pageRef.current += 1;
    void load(pageRef.current, false);
  };

  const shown = useHideAnimeMetas(metas);

  // Order matters. A grid that already has content stays a grid even if a later
  // page comes back empty, otherwise scrolling to the bottom of a working shelf
  // replaces it with an error screen.
  const status: BpGenreStatus = shown.length > 0
    ? "ready"
    : loading
      ? "loading"
      : !settings.tmdbKey
        ? "no-key"
        : metas.length > 0
          ? "filtered"
          : failed
            ? "failed"
            : "empty";

  return { metas: shown, status, more, retry: restart };
}
