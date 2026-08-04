import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { discoverCastDevices } from "@/lib/cast";
import { getPlaybackPosition, subscribePlaybackClock } from "@/lib/player/playback-clock";
import { useSettings } from "@/lib/settings";
import { useAuth } from "@/lib/auth";
import { library, libraryMetaType, type LibraryItem } from "@/lib/stremio";
import { useTrakt } from "@/lib/trakt/provider";
import { fetchWatchlist } from "@/lib/trakt/watchlist";
import { fetchWatchedHistory, type HistoryItem } from "@/lib/trakt/history";
import { traktItemToMeta } from "@/lib/trakt/to-meta";
import type { TraktItem } from "@/lib/trakt/types";
import { readLocalEntries, subscribeWatchlist, type LocalEntry } from "@/lib/watchlist";
import { useMediaFavorites } from "@/lib/media-favorites";
import { useSimkl } from "@/lib/simkl/provider";
import { useAnilist } from "@/lib/anilist/provider";
import { useMal } from "@/lib/mal/provider";
import {
  buildRemoteSnapshot,
  dispatchRemoteCommand,
  setRemoteCastDiscovering,
  setRemoteCastDevices,
  setRemoteLibrary,
  setRemoteTrackers,
  subscribeRemoteSession,
} from "./session";
import {
  buildRemoteMangaState,
  dispatchMangaCommand,
  isMangaCommand,
  subscribeRemoteManga,
} from "./manga-session";
import { subscribeMangaBookmarks } from "@/lib/manga-bookmarks";
import { installTextEntryListeners } from "./text-entry";
import {
  REMOTE_PROTO,
  parseClientMessage,
  type RemoteLibrary,
  type RemoteLibraryItem,
  type RemoteServerMessage,
} from "./protocol";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

function broadcast(msg: RemoteServerMessage) {
  if (!isTauri) return;
  void invoke("remote_ws_broadcast", { payload: JSON.stringify(msg) }).catch(() => {});
}

function pushSnapshot() {
  broadcast({
    t: "snapshot",
    snapshot: { ...buildRemoteSnapshot(getPlaybackPosition()), manga: buildRemoteMangaState() },
  });
}

const SKIP_SNAPSHOT = new Set(["nav", "setText", "ping"]);

const LIBRARY_CAP = 60;

type Dated = { item: RemoteLibraryItem; date: number };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

function parseTs(s?: string | null): number {
  if (!s) return 0;
  const n = Date.parse(s);
  return Number.isNaN(n) ? 0 : n;
}

function idExists(map: Map<string, Dated>, id: string): boolean {
  for (const v of map.values()) if (v.item.id === id) return true;
  return false;
}

function isBookmark(i: LibraryItem, bookmarkedOnly: boolean): boolean {
  if (i.removed) return false;
  if (i.state?.flaggedWatched === 1) return false;
  if ((i.state?.timeOffset ?? 0) > 0) return false;
  if (bookmarkedOnly && i.temp) return false;
  return true;
}

function isWatched(i: LibraryItem): boolean {
  if (i.removed && !i.temp) return false;
  return i.state?.flaggedWatched === 1 || (i.state?.timeOffset ?? 0) > 0;
}

function capped(map: Map<string, Dated>): RemoteLibraryItem[] {
  return [...map.values()]
    .sort((a, b) => b.date - a.date)
    .slice(0, LIBRARY_CAP)
    .map((d) => d.item);
}

function mergeWatchlist(
  local: LocalEntry[],
  stremio: LibraryItem[],
  trakt: TraktItem[],
): RemoteLibraryItem[] {
  const byKey = new Map<string, Dated>();
  for (const i of stremio) {
    const item: RemoteLibraryItem = {
      id: i._id,
      type: libraryMetaType(i.type),
      name: i.name,
      poster: i.poster,
      background: i.background,
    };
    const key = `${i.type}:${norm(i.name ?? "")}`;
    const cur = byKey.get(key);
    if (!cur) byKey.set(key, { item, date: parseTs(i._mtime) });
    else if (!cur.item.id.startsWith("tt") && item.id.startsWith("tt"))
      byKey.set(key, { item, date: parseTs(i._mtime) });
  }
  for (const t of trakt) {
    const m = traktItemToMeta(t);
    if (!m) continue;
    const key = `${m.type}:${norm(m.name ?? "")}`;
    if (byKey.has(key)) continue;
    byKey.set(key, {
      item: { id: m.id, type: m.type, name: m.name, poster: m.poster, background: m.background },
      date: parseTs(t.contextDate),
    });
  }
  for (const e of local) {
    if (idExists(byKey, e.id)) continue;
    const key = e.name ? `${e.type}:${norm(e.name)}` : `local:${e.id}`;
    if (byKey.has(key)) continue;
    byKey.set(key, {
      item: { id: e.id, type: e.type, name: e.name || e.id, poster: e.poster },
      date: e.addedAt || 0,
    });
  }
  return capped(byKey);
}

function mergeHistory(stremio: LibraryItem[], trakt: HistoryItem[]): RemoteLibraryItem[] {
  const byId = new Map<string, Dated>();
  for (const i of stremio) {
    byId.set(i._id, {
      item: {
        id: i._id,
        type: libraryMetaType(i.type),
        name: i.name,
        poster: i.poster,
        background: i.background,
      },
      date: parseTs(i.state?.lastWatched ?? i._mtime),
    });
  }
  for (const h of trakt) {
    const id = h.type === "movie" ? h.imdb : h.showImdb;
    if (!id || byId.has(id)) continue;
    byId.set(id, {
      item: { id, type: h.type === "movie" ? "movie" : "series", name: h.title },
      date: parseTs(h.watchedAt),
    });
  }
  return capped(byId);
}

function useStremioLibrary(enabled: boolean): LibraryItem[] {
  const { authKey } = useAuth();
  const [items, setItems] = useState<LibraryItem[]>([]);
  useEffect(() => {
    if (!enabled || !authKey) {
      setItems([]);
      return;
    }
    let alive = true;
    library(authKey)
      .then((r) => {
        if (alive) setItems(r);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [enabled, authKey]);
  return items;
}

function useTraktData(enabled: boolean): { watchlist: TraktItem[]; history: HistoryItem[] } {
  const { isConnected } = useTrakt();
  const [watchlist, setWatchlist] = useState<TraktItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  useEffect(() => {
    if (!enabled || !isConnected) {
      setWatchlist([]);
      setHistory([]);
      return;
    }
    let alive = true;
    Promise.allSettled([fetchWatchlist(), fetchWatchedHistory(200)]).then((r) => {
      if (!alive) return;
      if (r[0].status === "fulfilled") setWatchlist(r[0].value);
      if (r[1].status === "fulfilled") setHistory(r[1].value);
    });
    return () => {
      alive = false;
    };
  }, [enabled, isConnected]);
  return { watchlist, history };
}

function useLocalWatchlist(): LocalEntry[] {
  const [entries, setEntries] = useState<LocalEntry[]>(() => readLocalEntries());
  useEffect(() => {
    const tick = () => setEntries(readLocalEntries());
    window.addEventListener("storage", tick);
    const unsub = subscribeWatchlist(tick);
    return () => {
      window.removeEventListener("storage", tick);
      unsub();
    };
  }, []);
  return entries;
}

function useFavoriteItems(): RemoteLibraryItem[] {
  const { items } = useMediaFavorites();
  return useMemo(
    () =>
      [...items.values()]
        .sort((a, b) => b.addedAt - a.addedAt)
        .slice(0, LIBRARY_CAP)
        .map((e) => ({ id: e.id, type: e.type, name: e.name, poster: e.poster })),
    [items],
  );
}

function useHostLibrary(enabled: boolean, bookmarkedOnly: boolean): RemoteLibrary | null {
  const stremio = useStremioLibrary(enabled);
  const trakt = useTraktData(enabled);
  const local = useLocalWatchlist();
  const favorites = useFavoriteItems();
  return useMemo(() => {
    if (!enabled) return null;
    const bookmarks = stremio.filter((i) => isBookmark(i, bookmarkedOnly));
    const watched = stremio.filter(isWatched);
    return {
      watchlist: mergeWatchlist(local, bookmarks, trakt.watchlist),
      history: mergeHistory(watched, trakt.history),
      favorites,
    };
  }, [enabled, bookmarkedOnly, stremio, trakt.watchlist, trakt.history, local, favorites]);
}

/**
 * Host-side remote control plane. Mount only in the Tauri desktop shell.
 * Relays WS commands to the active player/cast binding and pushes snapshots.
 */
export function RemoteHostMount() {
  const { settings } = useSettings();
  const enabled = settings.serveWebUi || settings.remoteControlEnabled;
  const hostLibrary = useHostLibrary(enabled, settings.libraryBookmarkedOnly);
  const { authKey } = useAuth();
  const { isConnected: traktConnected } = useTrakt();
  const { isConnected: simklConnected } = useSimkl();
  const { isConnected: anilistConnected } = useAnilist();
  const { isConnected: malConnected } = useMal();
  const timerRef = useRef<number>(0);

  useEffect(() => {
    setRemoteTrackers({
      trakt: traktConnected,
      simkl: simklConnected,
      stremio: !!authKey,
      anilist: anilistConnected,
      mal: malConnected,
    });
    if (isTauri && enabled) pushSnapshot();
  }, [traktConnected, simklConnected, anilistConnected, malConnected, authKey, enabled]);

  useEffect(() => {
    setRemoteLibrary(hostLibrary);
    if (isTauri && enabled) pushSnapshot();
  }, [hostLibrary, enabled]);

  useEffect(() => {
    if (!isTauri || !enabled) return;

    let cancelled = false;
    const unsubs: Array<() => void> = [];

    void listen<{ clientId: number; raw: string }>("remote://cmd", (e) => {
      const raw = e.payload?.raw;
      if (!raw) return;
      const msg = parseClientMessage(raw);
      if (!msg) {
        broadcast({ t: "error", message: "invalid message" });
        return;
      }
      if (msg.t === "hello") {
        broadcast({ t: "hello", proto: REMOTE_PROTO, server: "harbor-remote" });
        pushSnapshot();
        return;
      }
      if (msg.t === "cmd") {
        void (async () => {
          try {
            if (msg.command.action === "castDiscover") {
              setRemoteCastDiscovering(true);
              setRemoteCastDevices([]);
              try {
                const devices = await discoverCastDevices();
                setRemoteCastDevices(devices);
              } finally {
                setRemoteCastDiscovering(false);
              }
              pushSnapshot();
              return;
            }
            if (msg.command.action === "ping") {
              broadcast({ t: "pong", at: Date.now() });
              return;
            }
            if (isMangaCommand(msg.command.action)) {
              await dispatchMangaCommand(msg.command);
              return;
            }
            await dispatchRemoteCommand(msg.command);
            // nav/setText: focusin/out + 400ms tick cover textEntry; skip churn.
            if (!SKIP_SNAPSHOT.has(msg.command.action)) pushSnapshot();
          } catch (err) {
            const message = err instanceof Error ? err.message : "remote command failed";
            broadcast({ t: "error", message });
            pushSnapshot();
          }
        })();
      }
    }).then((u) => {
      if (cancelled) u();
      else unsubs.push(u);
    });

    void listen<{ action: string }>("remote://client", (e) => {
      if (e.payload?.action === "join") {
        broadcast({ t: "hello", proto: REMOTE_PROTO, server: "harbor-remote" });
        pushSnapshot();
      }
    }).then((u) => {
      if (cancelled) u();
      else unsubs.push(u);
    });

    unsubs.push(subscribeRemoteSession(() => pushSnapshot()));
    let mangaRaf = 0;
    const pushMangaCoalesced = () => {
      if (mangaRaf) return;
      mangaRaf = requestAnimationFrame(() => {
        mangaRaf = 0;
        pushSnapshot();
      });
    };
    unsubs.push(subscribeRemoteManga(pushMangaCoalesced));
    unsubs.push(subscribeMangaBookmarks(pushMangaCoalesced));
    unsubs.push(() => {
      if (mangaRaf) cancelAnimationFrame(mangaRaf);
    });
    unsubs.push(
      subscribePlaybackClock(() => {
        // throttle via shared interval below
      }),
    );

    const onFocusChange = () => pushSnapshot();
    document.addEventListener("focusin", onFocusChange);
    document.addEventListener("focusout", onFocusChange);
    unsubs.push(() => {
      document.removeEventListener("focusin", onFocusChange);
      document.removeEventListener("focusout", onFocusChange);
    });
    unsubs.push(installTextEntryListeners());

    setRemoteCastDiscovering(true);
    void discoverCastDevices()
      .then((devices) => {
        if (!cancelled) {
          setRemoteCastDevices(devices);
        }
      })
      .finally(() => {
        if (!cancelled) setRemoteCastDiscovering(false);
      });

    timerRef.current = window.setInterval(() => {
      pushSnapshot();
    }, 400);

    pushSnapshot();

    return () => {
      cancelled = true;
      window.clearInterval(timerRef.current);
      for (const u of unsubs) u();
    };
  }, [enabled]);

  return null;
}
