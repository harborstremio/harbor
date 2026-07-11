import { useAuth } from "@/lib/auth";
import { useSimkl } from "@/lib/simkl/provider";
import { fetchWatchlist as fetchSimklWatchlist } from "@/lib/simkl/watchlist";
import { library } from "@/lib/stremio";
import { useTrakt } from "@/lib/trakt/provider";
import { fetchWatchlist } from "@/lib/trakt/watchlist";
import { setWatchlistAggregate } from "@/lib/watchlist";
import { useEffect } from "react";

const STORE: { stremio: string[]; trakt: string[]; simkl: string[] } = {
  stremio: [],
  trakt: [],
  simkl: [],
};

function pushAggregate() {
  setWatchlistAggregate([...STORE.stremio, ...STORE.trakt, ...STORE.simkl]);
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
          if (it.removed) continue;
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
