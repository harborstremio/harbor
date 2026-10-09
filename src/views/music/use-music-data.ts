import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { errorText } from "@/components/music/music-connections/connection-row";
import { loadHomeRows } from "@/lib/music/catalog";
import { getLastFmStatus, type LastFmStatus } from "@/lib/music/lastfm";
import { loadMusicLibrary, type MusicLibrarySnapshot } from "@/lib/music/library";
import { loadFreshFromArtists } from "@/lib/music/sources";
import type { MusicCatalogRow, MusicTrack } from "@/lib/music/types";
import { CATALOG_REQUEST_TIMEOUT_MS, withTimeout } from "@/lib/progressive-rows";

export type MusicFeedStatus = "loading" | "ready" | "error";

type HomeEntry = { key: string; row: MusicCatalogRow };

export type MusicData = {
  homeRows: MusicCatalogRow[];
  homeStatus: MusicFeedStatus;
  homeError: string;
  library: MusicLibrarySnapshot | null;
  libraryStatus: MusicFeedStatus;
  libraryError: string;
  fresh: MusicTrack[];
  freshStatus: MusicFeedStatus;
  freshError: string;
  lastfm: LastFmStatus | null;
  reload: () => void;
  reloadFresh: () => void;
};

const HOME_TIMEOUT_MS = CATALOG_REQUEST_TIMEOUT_MS * 2;

export function useMusicData(recents: MusicTrack[]): MusicData {
  const [entries, setEntries] = useState<HomeEntry[]>([]);
  const [homeStatus, setHomeStatus] = useState<MusicFeedStatus>("loading");
  const [homeError, setHomeError] = useState("");
  const [library, setLibrary] = useState<MusicLibrarySnapshot | null>(null);
  const [libraryStatus, setLibraryStatus] = useState<MusicFeedStatus>("loading");
  const [libraryError, setLibraryError] = useState("");
  const [lastfm, setLastfm] = useState<LastFmStatus | null>(null);
  const [fresh, setFresh] = useState<MusicTrack[]>([]);
  const [freshStatus, setFreshStatus] = useState<MusicFeedStatus>("loading");
  const [freshError, setFreshError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [releaseRefresh, setReleaseRefresh] = useState(0);
  const reloadFresh = useCallback(() => setReleaseRefresh((value) => value + 1), []);
  useEffect(() => {
    const refresh = () => setReleaseRefresh((value) => value + 1);
    const timer = window.setInterval(refresh, 30 * 60 * 1000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  const generation = useRef(0);
  const recentsRef = useRef(recents);
  recentsRef.current = recents;

  useEffect(() => {
    const run = ++generation.current;
    const live = () => generation.current === run;
    setHomeStatus("loading");
    setHomeError("");
    setLibraryStatus("loading");
    setLibraryError("");

    withTimeout(loadHomeRows(attempt > 0), HOME_TIMEOUT_MS)
      .then((rows) => {
        if (!live()) return;
        setEntries(rows.map((row) => ({ key: row.id, row })));
        setHomeStatus("ready");
      })
      .catch((cause) => {
        if (!live()) return;
        setHomeError(errorText(cause));
        setHomeStatus("error");
      });

    withTimeout(loadMusicLibrary(), CATALOG_REQUEST_TIMEOUT_MS)
      .then((snapshot) => {
        if (!live()) return;
        setLibrary(snapshot);
        setLibraryStatus("ready");
      })
      .catch((cause) => {
        if (!live()) return;
        setLibraryError(errorText(cause));
        setLibraryStatus("error");
      });

    getLastFmStatus()
      .then((status) => {
        if (live()) setLastfm(status);
      })
      .catch(() => {
        if (live()) setLastfm({ connected: false, username: null });
      });

    return () => {
      generation.current += 1;
    };
  }, [attempt]);

  const historyKey = recents
    .slice(0, 50)
    .map((track) => track.id)
    .join("|");

  useEffect(() => {
    if (!historyKey) {
      setFresh([]);
      setFreshError("");
      setFreshStatus("ready");
      return;
    }
    let live = true;
    setFreshStatus("loading");
    setFreshError("");
    loadFreshFromArtists(recentsRef.current, 9, (tracks) => {
      if (live) setFresh(tracks);
    })
      .then((tracks) => {
        if (!live) return;
        setFresh(tracks);
        setFreshStatus("ready");
      })
      .catch((cause) => {
        if (!live) return;
        setFreshError(errorText(cause));
        setFreshStatus("error");
      });
    return () => {
      live = false;
    };
  }, [historyKey, attempt, releaseRefresh]);

  const homeRows = useMemo(() => entries.map((entry) => entry.row), [entries]);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  useEffect(() => {
    window.addEventListener("harbor:music-library-changed", reload);
    return () => window.removeEventListener("harbor:music-library-changed", reload);
  }, [reload]);

  return {
    homeRows,
    homeStatus,
    homeError,
    library,
    libraryStatus,
    libraryError,
    fresh,
    freshStatus,
    freshError,
    lastfm,
    reload,
    reloadFresh,
  };
}
