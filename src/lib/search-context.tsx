import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { MOVIE_GENRES } from "@/lib/feed/tags";
import { useParental } from "@/lib/parental";
import {
  detectIntent,
  searchAll,
  searchAnime,
  searchCinemeta,
  searchLiveTvChannels,
  type SearchResults,
} from "@/lib/search";
import { searchAddonCatalogs, searchAddonGroups, mergeMetas } from "@/lib/search-addons";
import { searchAddonIndex } from "@/lib/search-addon-index";
import { createSearchRequestGuard } from "@/lib/search-request-guard";
import { normalizeSearchQuery } from "@/lib/search-query";
import { gatherCatalogAddons, type Addon } from "@/lib/addons";
import { useAuth } from "@/lib/auth";
import { useSettings } from "@/lib/settings";

type SearchState = {
  open: boolean;
  query: string;
  results: SearchResults | null;
  status: "idle" | "typing" | "loading" | "done";
  recent: string[];
};

type SearchValue = SearchState & {
  setOpen: (open: boolean) => void;
  setQuery: (q: string) => void;
  clear: () => void;
  recordRecent: (q: string) => void;
  removeRecent: (q: string) => void;
  clearRecent: () => void;
};

const Ctx = createContext<SearchValue | null>(null);
const RECENT_KEY = "harbor.search.recent";
const MAX_RECENT = 8;
const TMDB_CACHE_TTL_MS = 60_000;
const SECONDARY_CACHE_TTL_MS = 60_000;
const MAX_CACHE_ENTRIES = 16;

type SearchCache<T> = Map<string, { expiresAt: number; result: T }>;

function cachedSearch<T>(
  cache: SearchCache<T>,
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  for (const [cacheKey, value] of cache) {
    if (value.expiresAt <= now) cache.delete(cacheKey);
  }
  const cached = cache.get(key);
  if (cached) return Promise.resolve(cached.result);
  return load().then((result) => {
    if (cache.size >= MAX_CACHE_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }
    cache.set(key, { expiresAt: Date.now() + ttlMs, result });
    return result;
  });
}

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string").slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function saveRecent(items: string[]): void {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, MAX_RECENT)));
  } catch {
    /* noop */
  }
}

export function SearchProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const { authKey } = useAuth();
  const { hiddenTabs } = useParental();
  const [open, setOpen] = useState(false);
  const [query, setQueryState] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [status, setStatus] = useState<SearchState["status"]>("idle");
  const [recent, setRecent] = useState<string[]>(() => loadRecent());
  const debounceRef = useRef<number | null>(null);
  const requestGuardRef = useRef(createSearchRequestGuard());
  const tmdbCacheRef = useRef(new Map<string, { expiresAt: number; result: SearchResults }>());
  const animeCacheRef = useRef(
    new Map<string, { expiresAt: number; result: Awaited<ReturnType<typeof searchAnime>> }>(),
  );
  const cinemetaCacheRef = useRef(
    new Map<string, { expiresAt: number; result: Awaited<ReturnType<typeof searchCinemeta>> }>(),
  );
  const addonsRef = useRef<{ key: string | null; addons: Addon[] } | null>(null);
  const ensureAddons = useCallback(async (): Promise<Addon[]> => {
    if (addonsRef.current && addonsRef.current.key === authKey) return addonsRef.current.addons;
    const a = await gatherCatalogAddons(authKey).catch(() => [] as Addon[]);
    addonsRef.current = { key: authKey, addons: a };
    return a;
  }, [authKey]);

  useEffect(() => {
    const onAddonsChanged = () => {
      addonsRef.current = null;
    };
    window.addEventListener("harbor:addons-changed", onAddonsChanged);
    return () => window.removeEventListener("harbor:addons-changed", onAddonsChanged);
  }, []);

  const excludeGenres = useMemo(() => {
    const ids: number[] = [];
    if (hiddenTabs.anime) ids.push(MOVIE_GENRES.Animation);
    return ids;
  }, [hiddenTabs.anime]);

  useEffect(() => {
    // Invalidate an already-running request before the debounce starts. Without
    // this, an older search can publish while the user is typing a new query.
    const id = requestGuardRef.current.begin();
    const trimmed = query.trim();
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (!trimmed) {
      setResults(null);
      setStatus("idle");
      return;
    }
    setResults(null);
    setStatus("typing");
    const animeAllowed = !hiddenTabs.anime;
    const liveTvAllowed = !hiddenTabs.liveTv && settings.iptvPlaylists.length > 0;
    debounceRef.current = window.setTimeout(() => {
      if (!requestGuardRef.current.isCurrent(id)) return;
      setStatus("loading");
      const liveTv = liveTvAllowed ? searchLiveTvChannels(trimmed, settings.iptvPlaylists) : [];
      const normalizedQuery = normalizeSearchQuery(trimmed);
      const tmdbCacheKey = [
        settings.tmdbKey,
        settings.tmdbLanguage,
        excludeGenres.join(","),
        normalizedQuery,
      ].join("\0");
      const tmdbPromise = cachedSearch(tmdbCacheRef.current, tmdbCacheKey, TMDB_CACHE_TTL_MS, () =>
        searchAll(settings.tmdbKey, trimmed, { excludeGenres }),
      );
      const animePromise = animeAllowed
        ? cachedSearch(animeCacheRef.current, normalizedQuery, SECONDARY_CACHE_TTL_MS, () =>
            searchAnime(trimmed),
          )
        : Promise.resolve([]);
      const addonsP = ensureAddons();
      const addonPromise = addonsP
        .then((a) => searchAddonCatalogs(a, trimmed))
        .catch(() => ({ movies: [], series: [] }));
      const addonGroupsPromise = addonsP.then((a) => searchAddonGroups(a, trimmed)).catch(() => []);
      const cinemetaPromise = cachedSearch(
        cinemetaCacheRef.current,
        normalizedQuery,
        SECONDARY_CACHE_TTL_MS,
        () => searchCinemeta(trimmed),
      ).catch(() => ({ movies: [], series: [] }));
      let tmdbResult: Awaited<typeof tmdbPromise> | null = null;
      const acc = {
        anime: [] as Awaited<typeof animePromise>,
        addon: { movies: [], series: [] } as Awaited<typeof addonPromise>,
        cine: { movies: [], series: [] } as Awaited<typeof cinemetaPromise>,
        groups: [] as Awaited<typeof addonGroupsPromise>,
      };
      const publish = () => {
        if (!requestGuardRef.current.isCurrent(id) || !tmdbResult) return;
        const mergedMovies = mergeMetas(
          mergeMetas(tmdbResult.movies, acc.addon.movies),
          acc.cine.movies,
        );
        const mergedSeries = mergeMetas(
          mergeMetas(tmdbResult.series, acc.addon.series),
          acc.cine.series,
        );
        const shown = new Set<string>([...mergedMovies, ...mergedSeries].map((m) => m.id));
        const dedupedGroups = acc.groups
          .map((g) => ({ ...g, metas: g.metas.filter((m) => !shown.has(m.id)) }))
          .filter((g) => g.metas.length > 0);
        setResults({
          ...tmdbResult,
          movies: mergedMovies,
          series: mergedSeries,
          liveTv,
          anime: acc.anime,
          addonGroups: dedupedGroups,
          addons: searchAddonIndex(trimmed),
        });
        setStatus("done");
      };
      tmdbPromise
        .then((r) => {
          tmdbResult = r;
          publish();
        })
        .catch(() => {
          // Other search providers remain useful when TMDB is temporarily
          // unavailable, so use an empty TMDB result as the publish baseline.
          tmdbResult = {
            query: trimmed,
            topMatch: null,
            people: [],
            movies: [],
            series: [],
            liveTv: [],
            anime: [],
            addonGroups: [],
            addons: [],
            intent: detectIntent(trimmed),
            tmdbUnavailable: true,
          };
          publish();
        });
      void animePromise.then((a) => {
        acc.anime = a;
        publish();
      });
      void addonPromise.then((a) => {
        acc.addon = a;
        publish();
      });
      void cinemetaPromise.then((c) => {
        acc.cine = c;
        publish();
      });
      void addonGroupsPromise.then((g) => {
        acc.groups = g;
        publish();
      });
    }, 180);

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [
    query,
    settings.tmdbKey,
    settings.tmdbLanguage,
    settings.iptvPlaylists,
    excludeGenres,
    hiddenTabs.anime,
    hiddenTabs.liveTv,
    ensureAddons,
  ]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = (e.key ?? "").toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const setQuery = useCallback((q: string) => setQueryState(q), []);

  const clear = useCallback(() => {
    setQueryState("");
    setResults(null);
    setStatus("idle");
  }, []);

  const recordRecent = useCallback((q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setRecent((prev) => {
      const next = [
        trimmed,
        ...prev.filter((p) => p.toLowerCase() !== trimmed.toLowerCase()),
      ].slice(0, MAX_RECENT);
      saveRecent(next);
      return next;
    });
  }, []);

  const removeRecent = useCallback((q: string) => {
    setRecent((prev) => {
      const next = prev.filter((p) => p !== q);
      saveRecent(next);
      return next;
    });
  }, []);

  const clearRecent = useCallback(() => {
    setRecent([]);
    saveRecent([]);
  }, []);

  const value = useMemo(
    () => ({
      open,
      setOpen,
      query,
      setQuery,
      results,
      status,
      recent,
      clear,
      recordRecent,
      removeRecent,
      clearRecent,
    }),
    [
      open,
      query,
      results,
      status,
      recent,
      setQuery,
      clear,
      recordRecent,
      removeRecent,
      clearRecent,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSearch(): SearchValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSearch outside SearchProvider");
  return v;
}
