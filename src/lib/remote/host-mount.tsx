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
import { localEntryToMeta, useLocalLibrary } from "@/lib/local-library";
import {
  mediaServerConnections,
  subscribeMediaServerConnections,
} from "@/lib/media-server/connections";
import { mediaServerItems } from "@/lib/media-server/index-store";
import { groupMediaServerTitles } from "@/lib/media-server/selectors";
import { subscribeMediaServerSyncProgress } from "@/lib/media-server/sync";
import { hydrateLibraryMeta } from "@/views/library/hydrate-meta";
import { useMediaFavorites } from "@/lib/media-favorites";
import { useSimkl } from "@/lib/simkl/provider";
import { useAnilist } from "@/lib/anilist/provider";
import { useMal } from "@/lib/mal/provider";
import {
  buildRemoteSnapshot,
  dispatchRemoteCommand,
  setRemoteCastDiscovering,
  setRemoteCastDevices,
  setRemoteHostConfig,
  setRemoteHostName,
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

function useRemoteLocalLibrary(tmdbKey: string, localeKey: string): RemoteLibraryItem[] {
  const files = useLocalLibrary();
  const [items, setItems] = useState<RemoteLibraryItem[]>([]);
  useEffect(() => {
    let alive = true;
    const byId = new Map<
      string,
      {
        base: NonNullable<ReturnType<typeof localEntryToMeta>>;
        tmdbId?: number;
        imdbId?: string;
      }
    >();
    for (const file of files) {
      const meta = localEntryToMeta(file);
      if (meta) {
        const previous = byId.get(meta.id);
        byId.set(meta.id, {
          base: meta,
          tmdbId: file.tmdbId ?? previous?.tmdbId,
          imdbId: file.imdbId ?? previous?.imdbId,
        });
      }
    }
    void Promise.all(
      [...byId.values()].slice(0, LIBRARY_CAP).map(async ({ base, tmdbId, imdbId }) => {
        const type = base.type === "series" ? "series" : "movie";
        const hydrated = await hydrateLibraryMeta(base.id, type, tmdbKey || null).catch(() => null);
        return {
          id: hydrated?.id ?? base.id,
          type: hydrated?.type ?? base.type,
          tmdbId,
          imdbId,
          name: hydrated?.name || base.name,
          poster: hydrated?.poster || base.poster,
          background: hydrated?.background,
          local: true,
        } satisfies RemoteLibraryItem;
      }),
    ).then((next) => {
      if (alive) setItems(next);
    });
    return () => {
      alive = false;
    };
  }, [files, tmdbKey, localeKey]);
  return items;
}

function useRemoteMediaServers(
  enabled: boolean,
  tmdbKey: string,
  localeKey: string,
): RemoteLibraryItem[] {
  const [items, setItems] = useState<RemoteLibraryItem[]>([]);
  useEffect(() => {
    if (!enabled) {
      setItems([]);
      return;
    }
    let alive = true;
    const load = async () => {
      const connections = mediaServerConnections().filter((connection) => connection.enabled);
      const byConnection = new Map(connections.map((connection) => [connection.id, connection]));
      const titles = groupMediaServerTitles(
        (await mediaServerItems()).filter((item) => byConnection.has(item.connectionId)),
      ).slice(0, LIBRARY_CAP);
      const next = await Promise.all(
        titles.map(async (title) => {
          const canonicalId =
            title.identity.tmdbId != null
              ? `tmdb:${title.kind === "movie" ? "movie" : "tv"}:${title.identity.tmdbId}`
              : (title.identity.imdbId ?? title.key);
          const meta = await hydrateLibraryMeta(canonicalId, title.kind, tmdbKey || null).catch(
            () => null,
          );
          const providers = [
            ...new Set(
              title.connectionIds
                .map((id) => byConnection.get(id)?.provider)
                .filter((provider): provider is "jellyfin" | "emby" | "plex" => !!provider),
            ),
          ];
          return {
            id: meta?.id ?? canonicalId,
            type: meta?.type ?? title.kind,
            tmdbId: title.identity.tmdbId,
            imdbId: title.identity.imdbId,
            name: meta?.name || title.fallbackTitle,
            poster: meta?.poster,
            background: meta?.background,
            mediaServerProviders: providers,
          } satisfies RemoteLibraryItem;
        }),
      );
      if (alive) setItems(next);
    };
    void load().catch(() => {
      if (alive) setItems([]);
    });
    const unsubConnections = subscribeMediaServerConnections(() => void load());
    const unsubSync = subscribeMediaServerSyncProgress((progress) => {
      if (!progress.active) void load();
    });
    return () => {
      alive = false;
      unsubConnections();
      unsubSync();
    };
  }, [enabled, tmdbKey, localeKey]);
  return items;
}

function useHostLibrary(
  enabled: boolean,
  bookmarkedOnly: boolean,
  tmdbKey: string,
  localeKey: string,
): RemoteLibrary | null {
  const stremio = useStremioLibrary(enabled);
  const trakt = useTraktData(enabled);
  const local = useLocalWatchlist();
  const favorites = useFavoriteItems();
  const localLibrary = useRemoteLocalLibrary(tmdbKey, localeKey);
  const mediaServers = useRemoteMediaServers(enabled, tmdbKey, localeKey);
  return useMemo(() => {
    if (!enabled) return null;
    const bookmarks = stremio.filter((i) => isBookmark(i, bookmarkedOnly));
    const watched = stremio.filter(isWatched);
    return {
      watchlist: mergeWatchlist(local, bookmarks, trakt.watchlist),
      history: mergeHistory(watched, trakt.history),
      favorites,
      local: localLibrary,
      mediaServers,
    };
  }, [
    enabled,
    bookmarkedOnly,
    stremio,
    trakt.watchlist,
    trakt.history,
    local,
    favorites,
    localLibrary,
    mediaServers,
  ]);
}

/**
 * Host-side remote control plane. Mount only in the Tauri desktop shell.
 * Relays WS commands to the active player/cast binding and pushes snapshots.
 */
export function RemoteHostMount() {
  const { settings } = useSettings();
  const enabled = settings.serveWebUi || settings.remoteControlEnabled;
  const localeKey = `${settings.tmdbLanguage}:${settings.tmdbImageLangs.join(",")}:${settings.translateTitles}:${settings.translateDescriptions}`;
  const hostLibrary = useHostLibrary(
    enabled,
    settings.libraryBookmarkedOnly,
    settings.tmdbKey,
    localeKey,
  );
  const { authKey } = useAuth();
  const { isConnected: traktConnected } = useTrakt();
  const { isConnected: simklConnected } = useSimkl();
  const { isConnected: anilistConnected } = useAnilist();
  const { isConnected: malConnected } = useMal();
  const timerRef = useRef<number>(0);

  // Snapshot construction is synchronous, so keep its locale configuration current
  // during render instead of waiting for an effect that may run after a client joins.
  setRemoteHostConfig({
    tmdbKey: settings.tmdbKey,
    rpdbKey: settings.rpdbKey,
    tvdbKey: settings.tvdbKey,
    tmdbLanguage: settings.tmdbLanguage,
    tmdbImageLangs: settings.tmdbImageLangs,
    translateTitles: settings.translateTitles,
    translateDescriptions: settings.translateDescriptions,
  });

  useEffect(() => {
    if (isTauri && enabled) pushSnapshot();
  }, [settings.tmdbKey, settings.rpdbKey, settings.tvdbKey, localeKey, enabled]);

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
    if (!isTauri) return;
    void invoke<{ name: string }>("harbor_lan_identity")
      .then((id) => {
        setRemoteHostName(id.name);
        if (enabled) pushSnapshot();
      })
      .catch(() => {});
  }, [enabled]);

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
