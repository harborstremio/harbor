import { useCallback, useEffect, useMemo, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { useAuth } from "@/lib/auth";
import { useSettings } from "@/lib/settings";
import { useHideAnime } from "@/lib/anime-hide";
import { isAnimeCwItem, library, type LibraryItem } from "@/lib/stremio";
import { useTrakt } from "@/lib/trakt/provider";
import { fetchWatchlist } from "@/lib/trakt/watchlist";
import { fetchWatchedHistory, type HistoryItem } from "@/lib/trakt/history";
import { traktItemToMeta } from "@/lib/trakt/to-meta";
import type { TraktItem } from "@/lib/trakt/types";
import { useAnilist } from "@/lib/anilist/provider";
import { useMal } from "@/lib/mal/provider";
import { useSimkl } from "@/lib/simkl/provider";
import { useLetterboxd } from "@/lib/stremboxd/provider";
import { localEntryToMeta, useLocalLibrary, type LocalEntry } from "@/lib/local-library";
import {
  mediaServerConnections,
  subscribeMediaServerConnections,
} from "@/lib/media-server/connections";
import {
  mediaServerItems,
  mediaServerMetadata,
  putMediaServerMetadata,
} from "@/lib/media-server/index-store";
import { groupMediaServerTitles } from "@/lib/media-server/selectors";
import {
  readLocalEntries,
  subscribeWatchlist,
  type LocalEntry as SavedEntry,
} from "@/lib/watchlist";
import { useCustomLists } from "@/lib/custom-lists";
import { useMediaFavorites } from "@/lib/media-favorites";
import { useCharacterFavorites } from "@/lib/character-favorites";
import { useMangaFavorites } from "@/lib/manga-favorites";
import { parseTs, sortedGroups, type SortKey } from "@/views/library/shared";
import { filterLibrary, mergeWatchlist } from "@/views/library/watchlist-tab";
import { filterHistory, historyItemsToDated, mergeHistory } from "@/views/library/history-merge";
import { hydrateLibraryMeta } from "@/views/library/hydrate-meta";
import { useBpServiceFeed } from "./use-bp-library-services";
import type {
  BpLibEntry,
  BpLibFeed,
  BpLibSection,
  BpLibStatus,
  BpLibTab,
} from "./bp-library-types";

const CORE_TABS: Array<{ id: BpLibTab; label: string }> = [
  { id: "library", label: "Saved" },
  { id: "watchlist", label: "Watchlist" },
  { id: "history", label: "History" },
  { id: "local", label: "Local" },
  { id: "media-servers", label: "Media Servers" },
  { id: "lists", label: "My Lists" },
  { id: "favorites", label: "Favorites" },
];

export function useBpLibraryTabs(): Array<{ id: BpLibTab; label: string }> {
  const trakt = useTrakt();
  const anilist = useAnilist();
  const mal = useMal();
  const simkl = useSimkl();
  const letterboxd = useLetterboxd();

  return useMemo(() => {
    const out = [...CORE_TABS];
    if (trakt.isConnected) out.push({ id: "trakt", label: "Trakt" });
    if (anilist.isConnected) out.push({ id: "anilist", label: "AniList" });
    if (mal.isConnected) out.push({ id: "mal", label: "MyAnimeList" });
    if (simkl.isConnected) out.push({ id: "simkl", label: "Simkl" });
    if (letterboxd.isActive) out.push({ id: "letterboxd", label: "Letterboxd" });
    return out;
  }, [
    trakt.isConnected,
    anilist.isConnected,
    mal.isConnected,
    simkl.isConnected,
    letterboxd.isActive,
  ]);
}

function usable(i: LibraryItem): boolean {
  return (i.type as string) !== "other" && !i._id.startsWith("iptv:");
}

function worst(a: BpLibStatus, b: BpLibStatus): BpLibStatus {
  if (a === "loading" || b === "loading") return "loading";
  return a === "error" || b === "error" ? "error" : "ready";
}

function useStremioItems(enabled: boolean, reload: number) {
  const { authKey } = useAuth();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [status, setStatus] = useState<BpLibStatus>("loading");

  useEffect(() => {
    if (!enabled) return;
    if (!authKey) {
      setItems([]);
      setStatus("ready");
      return;
    }
    let alive = true;
    setStatus("loading");
    library(authKey)
      .then((li) => {
        if (!alive) return;
        setItems(li);
        setStatus("ready");
      })
      .catch(() => {
        if (alive) setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, [enabled, authKey, reload]);

  return { items, status, signedIn: Boolean(authKey) };
}

function useTraktItems(enabled: boolean, reload: number) {
  const { isConnected } = useTrakt();
  const [watchlist, setWatchlist] = useState<TraktItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [status, setStatus] = useState<BpLibStatus>("ready");

  useEffect(() => {
    if (!enabled || !isConnected) {
      setWatchlist([]);
      setHistory([]);
      setStatus("ready");
      return;
    }
    let alive = true;
    setStatus("loading");
    void Promise.allSettled([fetchWatchlist(), fetchWatchedHistory(200)]).then(([w, h]) => {
      if (!alive) return;
      if (w.status === "fulfilled") setWatchlist(w.value);
      if (h.status === "fulfilled") setHistory(h.value);
      setStatus(w.status === "rejected" && h.status === "rejected" ? "error" : "ready");
    });
    return () => {
      alive = false;
    };
  }, [enabled, isConnected, reload]);

  return { watchlist, history, status, connected: isConnected };
}

function useSavedEntries(): SavedEntry[] {
  const [entries, setEntries] = useState<SavedEntry[]>(() => readLocalEntries());
  useEffect(() => subscribeWatchlist(() => setEntries(readLocalEntries())), []);
  return entries;
}

// A scanned file that has not resolved to a tmdb/imdb id yet still belongs in
// the grid: the desktop Local tab lists it under "needs review".
function unresolvedMeta(file: LocalEntry): Meta {
  return {
    id: `local:${file.id}`,
    type: file.type === "show" ? "series" : "movie",
    name: file.title,
    poster: file.poster ?? undefined,
  };
}

function localFileEntries(files: LocalEntry[]): BpLibEntry[] {
  const by = new Map<string, BpLibEntry>();
  for (const file of files) {
    const base = localEntryToMeta(file) ?? unresolvedMeta(file);
    const meta: Meta = {
      ...base,
      releaseInfo: file.year != null ? String(file.year) : base.releaseInfo,
      imdbRating: file.rating != null ? String(file.rating) : base.imdbRating,
      runtime: file.runtime != null ? `${file.runtime} min` : base.runtime,
      genres: file.genres ?? base.genres,
    };
    const at = by.get(meta.id);
    if (!at) {
      by.set(meta.id, { key: meta.id, meta, date: file.addedAt || null });
      continue;
    }
    if (!at.meta.poster && meta.poster) at.meta = meta;
    if (meta.genres?.length) {
      at.meta = {
        ...at.meta,
        genres: [...new Set([...(at.meta.genres ?? []), ...meta.genres])],
      };
    }
    at.date = Math.max(at.date ?? 0, file.addedAt || 0);
  }
  return [...by.values()];
}

function useMediaServerEntries(reload: number): BpLibFeed {
  const { settings } = useSettings();
  const [feed, setFeed] = useState<BpLibFeed>({ entries: [], status: "loading", groups: [] });
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const connections = mediaServerConnections();
      const enabled = new Set(
        connections.filter((connection) => connection.enabled).map((connection) => connection.id),
      );
      const allItems = await mediaServerItems();
      const titles = groupMediaServerTitles(
        allItems.filter((item) => enabled.has(item.connectionId)),
      );
      const languageKey = `${settings.tmdbLanguage || "en"}:${(settings.tmdbImageLangs ?? []).join(",")}`;
      const entries = await Promise.all(
        titles.map(async (title) => {
          const key = `${title.key}:locale:${languageKey}`;
          const cached = await mediaServerMetadata<Meta>(key);
          const hydrated =
            cached ??
            (await hydrateLibraryMeta(title.key, title.kind, settings.tmdbKey).catch(() => null));
          if (!cached && hydrated) await putMediaServerMetadata(key, hydrated);
          return {
            key: title.key,
            meta: hydrated ?? {
              id: title.key,
              type: title.kind,
              name: title.fallbackTitle,
              releaseInfo: title.year ? String(title.year) : undefined,
            },
            date: title.addedAt ?? null,
            groups: title.connectionIds,
            libraries: title.libraryIds,
          };
        }),
      );
      const libraryNames = new Map<string, string>();
      for (const item of allItems) {
        if (enabled.has(item.connectionId))
          libraryNames.set(item.libraryId, item.libraryName || item.libraryId);
      }
      if (alive)
        setFeed({
          entries,
          status: "ready",
          groups: connections
            .filter((connection) => connection.enabled)
            .map((connection) => ({ id: connection.id, label: connection.name })),
          libraries: [...libraryNames].map(([id, label]) => ({ id, label })),
        });
    };
    void load().catch(() => {
      if (alive) setFeed((current) => ({ ...current, status: "error" }));
    });
    const unsubscribe = subscribeMediaServerConnections(() => void load());
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [reload, settings.tmdbKey, settings.tmdbLanguage, settings.tmdbImageLangs]);
  return feed;
}

export function useBpLibraryFeed(
  tab: BpLibTab,
): BpLibFeed & { refresh: () => void; signedIn: boolean } {
  const [reload, setReload] = useState(0);
  const refresh = useCallback(() => setReload((n) => n + 1), []);
  const { settings } = useSettings();
  const hideAnime = useHideAnime();
  const stremioTab = tab === "library" || tab === "watchlist" || tab === "history";
  const stremio = useStremioItems(stremioTab, reload);
  const trakt = useTraktItems(stremioTab || tab === "trakt", reload);
  const saved = useSavedEntries();
  const files = useLocalLibrary();
  const lists = useCustomLists();
  const favorites = useMediaFavorites();
  const characters = useCharacterFavorites();
  const manga = useMangaFavorites();
  const service = useBpServiceFeed(tab, reload);
  const mediaServers = useMediaServerEntries(reload);

  const keep = useMemo(
    () => stremio.items.filter((i) => usable(i) && !(hideAnime && isAnimeCwItem(i))),
    [stremio.items, hideAnime],
  );

  const feed = useMemo<BpLibFeed>(() => {
    if (tab === "library" || tab === "watchlist") {
      const merged = mergeWatchlist(
        saved,
        filterLibrary(keep, settings.libraryBookmarkedOnly, tab),
        trakt.watchlist,
      );
      return {
        entries: merged.map((m) => ({ key: m.key, meta: m.meta, date: m.date })),
        status: worst(stremio.status, trakt.status),
        groups: [],
      };
    }

    if (tab === "history") {
      const own = mergeHistory(filterHistory(keep), []);
      const seen = new Set(own.map((e) => e.key));
      const extra = historyItemsToDated(trakt.history).filter((e) => !seen.has(e.key));
      return {
        entries: [
          ...own.map((e) => ({ key: e.key, meta: e.meta, date: e.date, item: e.item })),
          ...extra.map((e) => ({ key: e.key, meta: e.meta, date: e.date })),
        ],
        status: worst(stremio.status, trakt.status),
        groups: [],
      };
    }

    if (tab === "local") {
      return { entries: localFileEntries(files), status: "ready", groups: [] };
    }

    if (tab === "media-servers") return mediaServers;

    if (tab === "lists") {
      const entries: BpLibEntry[] = [];
      for (const list of lists) {
        for (const item of list.items) {
          if (item.type === "manga") continue;
          entries.push({
            key: `${list.id}:${item.id}`,
            meta: { id: item.id, type: item.type, name: item.name, poster: item.poster },
            date: item.addedAt || null,
            group: list.id,
          });
        }
      }
      return {
        entries,
        status: "ready",
        groups: lists.map((l) => ({ id: l.id, label: l.name })),
      };
    }

    if (tab === "favorites") {
      return {
        entries: [...favorites.items.values()].map((e) => ({
          key: e.id,
          meta: { id: e.id, type: e.type, name: e.name, poster: e.poster },
          date: e.addedAt || null,
        })),
        status: "ready",
        groups: [],
        hidden: characters.items.size + manga.items.size,
      };
    }

    if (tab === "trakt") {
      const entries: BpLibEntry[] = [];
      for (const item of trakt.watchlist) {
        const meta = traktItemToMeta(item);
        if (!meta) continue;
        entries.push({
          key: `w:${meta.id}`,
          meta,
          date: parseTs(item.contextDate),
          group: "watchlist",
        });
      }
      for (const e of historyItemsToDated(trakt.history)) {
        entries.push({ key: `h:${e.key}`, meta: e.meta, date: e.date, group: "history" });
      }
      return {
        entries,
        status: trakt.status,
        groups: [
          { id: "watchlist", label: "Watchlist" },
          { id: "history", label: "History" },
        ],
      };
    }

    return service;
  }, [
    tab,
    keep,
    saved,
    files,
    lists,
    favorites,
    characters,
    manga,
    service,
    mediaServers,
    trakt.watchlist,
    trakt.history,
    trakt.status,
    stremio.status,
    settings.libraryBookmarkedOnly,
  ]);

  return { ...feed, refresh, signedIn: stremio.signedIn || trakt.connected };
}

export function buildBpSections(
  entries: BpLibEntry[],
  sort: SortKey,
  flat: boolean,
): BpLibSection[] {
  if (entries.length === 0) return [];
  if (sort === "recent") {
    if (flat || entries.every((e) => e.date == null)) {
      const items = [...entries].sort((a, b) => (b.date ?? -Infinity) - (a.date ?? -Infinity));
      return [{ label: "", items, total: items.length }];
    }
  }
  return sortedGroups(entries, sort).map((g) => ({ ...g, total: g.items.length }));
}

export function capBpSections(
  sections: BpLibSection[],
  limit: number,
): { sections: BpLibSection[]; shown: number } {
  const out: BpLibSection[] = [];
  let shown = 0;
  for (const s of sections) {
    if (shown >= limit) break;
    const items = s.items.slice(0, limit - shown);
    shown += items.length;
    out.push({ label: s.label, items, total: s.total });
  }
  return { sections: out, shown };
}
