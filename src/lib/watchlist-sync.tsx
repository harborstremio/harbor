import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { library } from "@/lib/stremio";
import { fetchWatchlist } from "@/lib/trakt/watchlist";
import type { TraktItem } from "@/lib/trakt/types";
import { useTrakt } from "@/lib/trakt/provider";
import { fetchWatchlist as fetchSimklWatchlist } from "@/lib/simkl/watchlist";
import { useSimkl } from "@/lib/simkl/provider";
import { setWatchlistAggregate } from "@/lib/watchlist";

const STORE: { stremio: string[]; trakt: string[]; simkl: string[] } = {
  stremio: [],
  trakt: [],
  simkl: [],
};

function pushAggregate() {
  setWatchlistAggregate([...STORE.stremio, ...STORE.trakt, ...STORE.simkl]);
}

export function setStremioAggregate(ids: string[]): void {
  STORE.stremio = ids;
  pushAggregate();
}

export async function refreshWatchlistAggregates(
  authKey: string | null,
  traktConnected: boolean,
  simklConnected: boolean,
  isCurrent: () => boolean = () => true,
): Promise<TraktItem[]> {
  const jobs: Array<Promise<void>> = [];
  const nextStore = { ...STORE };
  if (authKey) {
    jobs.push(
      library(authKey)
        .then((items) => {
          if (!isCurrent()) return;
          nextStore.stremio = items.filter((i) => !i.removed && !i.temp).map((i) => i._id);
        })
        .catch(() => {}),
    );
  } else {
    nextStore.stremio = [];
  }
  let traktItems: TraktItem[] = [];
  if (traktConnected) {
    jobs.push(
      fetchWatchlist()
        .then((items) => {
          if (!isCurrent()) return;
          traktItems = items;
          const ids: string[] = [];
          for (const t of items) {
            if (t.ids.imdb) ids.push(t.ids.imdb);
            if (t.ids.tmdb) {
              ids.push(t.type === "movie" ? `tmdb:movie:${t.ids.tmdb}` : `tmdb:tv:${t.ids.tmdb}`);
            }
          }
          nextStore.trakt = ids;
        })
        .catch(() => {}),
    );
  } else {
    nextStore.trakt = [];
  }
  if (simklConnected) {
    jobs.push(
      fetchSimklWatchlist()
        .then((items) => {
          if (!isCurrent()) return;
          const ids: string[] = [];
          for (const it of items) {
            if (it.ids.imdb) ids.push(it.ids.imdb);
            if (it.ids.tmdb) {
              ids.push(
                it.type === "movie" ? `tmdb:movie:${it.ids.tmdb}` : `tmdb:tv:${it.ids.tmdb}`,
              );
            }
          }
          nextStore.simkl = ids;
        })
        .catch(() => {}),
    );
  } else {
    nextStore.simkl = [];
  }
  await Promise.all(jobs);
  if (isCurrent()) {
    Object.assign(STORE, nextStore);
    pushAggregate();
  }
  return traktItems;
}

export function WatchlistSync() {
  const { authKey } = useAuth();
  const { isConnected: traktConnected } = useTrakt();
  const { isConnected: simklConnected } = useSimkl();

  useEffect(() => {
    if (!authKey) {
      STORE.stremio = [];
      pushAggregate();
      return;
    }
    let cancelled = false;
    library(authKey)
      .then((items) => {
        if (cancelled) return;
        const ids: string[] = [];
        for (const it of items) {
          if (it.removed || it.temp) continue;
          ids.push(it._id);
        }
        STORE.stremio = ids;
        pushAggregate();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authKey]);

  useEffect(() => {
    if (!traktConnected) {
      STORE.trakt = [];
      pushAggregate();
      return;
    }
    let cancelled = false;
    fetchWatchlist()
      .then((items) => {
        if (cancelled) return;
        const ids: string[] = [];
        for (const t of items) {
          if (t.ids.imdb) ids.push(t.ids.imdb);
          if (t.ids.tmdb) {
            ids.push(t.type === "movie" ? `tmdb:movie:${t.ids.tmdb}` : `tmdb:tv:${t.ids.tmdb}`);
          }
        }
        STORE.trakt = ids;
        pushAggregate();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [traktConnected]);

  useEffect(() => {
    if (!simklConnected) {
      STORE.simkl = [];
      pushAggregate();
      return;
    }
    let cancelled = false;
    fetchSimklWatchlist()
      .then((items) => {
        if (cancelled) return;
        const ids: string[] = [];
        for (const it of items) {
          if (it.ids.imdb) ids.push(it.ids.imdb);
          if (it.ids.tmdb) {
            ids.push(it.type === "movie" ? `tmdb:movie:${it.ids.tmdb}` : `tmdb:tv:${it.ids.tmdb}`);
          }
        }
        STORE.simkl = ids;
        pushAggregate();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [simklConnected]);

  return null;
}
