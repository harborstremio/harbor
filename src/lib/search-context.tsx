import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MOVIE_GENRES } from "@/lib/feed/tags";
import { metaLooksAnime } from "@/lib/anime-detect";
import { useParental } from "@/lib/parental";
import { searchAll, searchAnime, searchCinemeta, searchLiveTvChannels, type SearchResults } from "@/lib/search";
import { searchAddonCatalogs, searchAddonGroups, mergeMetas } from "@/lib/search-addons";
import { searchAddonIndex } from "@/lib/search-addon-index";
import { createSearchRequestGuard } from "@/lib/search-request-guard";
import { normalizeSearchQuery } from "@/lib/search-query";
import { searchManga } from "@/lib/manga/api";
import type { MangaSummary } from "@/lib/manga/model";
import { anilistCharacterSearch, type CharacterHit } from "@/lib/anilist/character";
import { gatherCatalogAddons, type Addon } from "@/lib/addons";
import { useAuth } from "@/lib/auth";
import { useSettings } from "@/lib/settings";
import { isMagnetInput, isDirectVideoUrl } from "@/lib/torrent/magnet";
import { useView, type Frame } from "@/lib/view";

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
  closeForNavigation: () => void;
  recordRecent: (q: string) => void;
  removeRecent: (q: string) => void;
  clearRecent: () => void;
  setAiHold: (hold: boolean) => void;
};

const Ctx = createContext<SearchValue | null>(null);
const RECENT_KEY = "harbor.search.recent";
const MAX_RECENT = 8;
const SOURCE_TIMEOUT_MS = 8000;
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

type TitledMeta = { name?: string; releaseInfo?: string };

function dedupeByTitle<T extends TitledMeta>(list: T[]): T[] {
  const seen = new Map<string, T[]>();
  const out: T[] = [];
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  for (const m of list) {
    const key = norm(m.name ?? "");
    if (!key) {
      out.push(m);
      continue;
    }
    const bucket = seen.get(key);
    if (!bucket) {
      seen.set(key, [m]);
      out.push(m);
      continue;
    }
    const year = (m.releaseInfo ?? "").slice(0, 4);
    const clashes = bucket.some((prev) => {
      const prevYear = (prev.releaseInfo ?? "").slice(0, 4);
      return !year || !prevYear || year === prevYear;
    });
    if (clashes) continue;
    bucket.push(m);
    out.push(m);
  }
  return out;
}

function normShow(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function sameShow(a: string, b: string): boolean {
  const x = normShow(a);
  return x.length > 0 && x === normShow(b);
}

function animeKindFromFormat(
  format: string | null,
  fallback: "movie" | "series",
): "movie" | "series" {
  const fmt = (format ?? "").toUpperCase();
  if (!fmt) return fallback;
  return fmt === "MOVIE" ? "movie" : "series";
}

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    const all = arr.filter((x): x is string => typeof x === "string");
    const clean = all
      .filter((x) => !isMagnetInput(x) && !isDirectVideoUrl(x))
      .slice(0, MAX_RECENT);
    if (clean.length !== all.length) {
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(clean));
      } catch {
        /* noop */
      }
    }
    return clean;
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
  const [aiHold, setAiHold] = useState(false);
  const [recent, setRecent] = useState<string[]>(() => loadRecent());
  const debounceRef = useRef<number | null>(null);
  const requestGuardRef = useRef(createSearchRequestGuard());
  const tmdbCacheRef = useRef<SearchCache<SearchResults | null>>(new Map());
  const animeCacheRef = useRef<SearchCache<Awaited<ReturnType<typeof searchAnime>>>>(new Map());
  const cinemetaCacheRef = useRef<SearchCache<Awaited<ReturnType<typeof searchCinemeta>>>>(new Map());
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
    const id = requestGuardRef.current.begin();
    const trimmed = query.trim();
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (!trimmed) {
      setResults(null);
      setStatus("idle");
      return;
    }
    if (aiHold) {
      setResults(null);
      setStatus("idle");
      return;
    }
    setResults(null);
    setStatus("typing");
    const animeAllowed = !hiddenTabs.anime && !settings.hideContent.anime;
    const mangaAllowed = settings.mangaEnabled && !settings.hideContent.manga;
    const franchiseAllowed = animeAllowed || mangaAllowed;
    const liveTvAllowed = !hiddenTabs.liveTv && settings.iptvPlaylists.length > 0;
    debounceRef.current = window.setTimeout(() => {
      if (!requestGuardRef.current.isCurrent(id)) return;
      setStatus("loading");
      const liveTv = liveTvAllowed ? searchLiveTvChannels(trimmed, settings.iptvPlaylists) : [];
      const guard = <T,>(p: Promise<T>, fallback: T): Promise<T> =>
        Promise.race([
          p.catch(() => fallback),
          new Promise<T>((resolve) => {
            window.setTimeout(() => resolve(fallback), SOURCE_TIMEOUT_MS);
          }),
        ]);
      const normalizedQuery = normalizeSearchQuery(trimmed);
      const tmdbCacheKey = [
        settings.tmdbKey,
        settings.tmdbLanguage,
        settings.translateTitles,
        excludeGenres.join(","),
        normalizedQuery,
      ].join("\0");
      const addonsP = ensureAddons();
      const tmdbPromise = guard<SearchResults | null>(
        cachedSearch(tmdbCacheRef.current, tmdbCacheKey, TMDB_CACHE_TTL_MS, () =>
          searchAll(settings.tmdbKey, trimmed, { excludeGenres }),
        ),
        null,
      );
      const animePromise = animeAllowed
        ? guard(
            cachedSearch(animeCacheRef.current, normalizedQuery, SECONDARY_CACHE_TTL_MS, () =>
              searchAnime(trimmed),
            ),
            [],
          )
        : Promise.resolve([]);
      const mangaPromise: Promise<MangaSummary[]> = mangaAllowed
        ? guard(searchManga(trimmed), [])
        : Promise.resolve([]);
      const charactersPromise: Promise<CharacterHit[]> = franchiseAllowed
        ? guard(anilistCharacterSearch(trimmed), [])
        : Promise.resolve([]);
      const addonPromise = guard(
        addonsP.then((a) => searchAddonCatalogs(a, trimmed)),
        { movies: [], series: [] },
      );
      const addonGroupsPromise = guard(
        addonsP.then((a) =>
          searchAddonGroups(a, trimmed, (g) => {
            acc.groups = [...acc.groups.filter((x) => x.id !== g.id), g];
            publish();
          }),
        ),
        [],
      );
      const cinemetaPromise = guard(
        cachedSearch(cinemetaCacheRef.current, normalizedQuery, SECONDARY_CACHE_TTL_MS, () =>
          searchCinemeta(trimmed),
        ),
        { movies: [], series: [] },
      );
      let tmdbResult: SearchResults | null = null;
      const acc = {
        anime: [] as Awaited<typeof animePromise>,
        manga: [] as MangaSummary[],
        characters: [] as CharacterHit[],
        addon: { movies: [], series: [] } as Awaited<typeof addonPromise>,
        cine: { movies: [], series: [] } as Awaited<typeof cinemetaPromise>,
        groups: [] as Awaited<typeof addonGroupsPromise>,
      };
      const publish = () => {
        if (!requestGuardRef.current.isCurrent(id)) return;
        const base: SearchResults = tmdbResult ?? {
          query: trimmed,
          topMatch: null,
          people: [],
          movies: [],
          series: [],
          liveTv: [],
          anime: [],
          manga: [],
          characters: [],
          addonGroups: [],
          addons: [],
          intent: null,
        };
        const animeTitleSet = new Set(acc.anime.map((a) => normShow(a.name)));
        const notAnimeDupe = (m: { name?: string }) =>
          animeTitleSet.size === 0 || !animeTitleSet.has(normShow(m.name ?? ""));
        const dropAnime = <T extends { id: string }>(list: T[]): T[] =>
          settings.hideContent.anime ? list.filter((m) => !metaLooksAnime(m)) : list;
        const mergedMovies = dropAnime(
          dedupeByTitle(mergeMetas(mergeMetas(base.movies, acc.addon.movies), acc.cine.movies)).filter(notAnimeDupe),
        );
        const mergedSeries = dropAnime(
          dedupeByTitle(mergeMetas(mergeMetas(base.series, acc.addon.series), acc.cine.series)).filter(notAnimeDupe),
        );
        const shown = new Set<string>([...mergedMovies, ...mergedSeries].map((m) => m.id));
        const dedupedGroups = acc.groups
          .map((g) => ({ ...g, metas: dropAnime(g.metas.filter((m) => !shown.has(m.id))) }))
          .filter((g) => g.metas.length > 0);
        const animeTop = acc.anime[0];
        const animeTopKind: "movie" | "series" = animeTop
          ? animeKindFromFormat(animeTop.format, base.topMatch?.kind ?? "series")
          : "series";
        const topMatch =
          animeTop && base.topMatch && sameShow(base.topMatch.meta.name, animeTop.name)
            ? {
                kind: animeTopKind,
                meta: {
                  id: animeTop.kitsuId
                    ? `kitsu:${animeTop.kitsuId}`
                    : animeTop.malId
                      ? `mal:${animeTop.malId}`
                      : `anilist:${animeTop.anilistId}`,
                  type: animeTopKind,
                  name: animeTop.name,
                  poster: animeTop.poster ?? base.topMatch.meta.poster,
                  background: animeTop.background ?? undefined,
                  description: animeTop.overview || undefined,
                  releaseInfo: animeTop.year ?? undefined,
                },
                popularity: base.topMatch.popularity,
                backdrop: animeTop.background ?? base.topMatch.backdrop,
                overview: animeTop.overview || base.topMatch.overview,
                voteAverage: base.topMatch.voteAverage,
              }
            : base.topMatch;
        setResults({
          ...base,
          topMatch: settings.hideContent.anime && topMatch && metaLooksAnime(topMatch.meta) ? null : topMatch,
          movies: mergedMovies,
          series: mergedSeries,
          liveTv,
          anime: acc.anime,
          manga: acc.manga,
          characters: acc.characters,
          addonGroups: dedupedGroups,
          addons: searchAddonIndex(trimmed),
        });
      };
      void tmdbPromise.then((r) => {
        tmdbResult = r;
        publish();
      });
      void animePromise.then((a) => {
        acc.anime = a;
        publish();
      });
      void mangaPromise.then((m) => {
        acc.manga = m;
        publish();
      });
      void charactersPromise.then((c) => {
        acc.characters = c
          .map((ch) => ({
            ...ch,
            anime: animeAllowed ? ch.anime : [],
            manga: mangaAllowed ? ch.manga : [],
          }))
          .filter((ch) => ch.anime.length + ch.manga.length > 0);
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
        // The guard resolves to [] on timeout. Streamed groups are already correct,
        // so an empty settle must never wipe what the user can already see.
        if (g.length === 0) return;
        acc.groups = g;
        publish();
      });
      void Promise.all([
        tmdbPromise,
        animePromise,
        mangaPromise,
        charactersPromise,
        addonPromise,
        cinemetaPromise,
        addonGroupsPromise,
      ]).then(() => {
        if (!requestGuardRef.current.isCurrent(id)) return;
        publish();
        setStatus("done");
      });
    }, 180);

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [query, aiHold, settings.tmdbKey, settings.tmdbLanguage, settings.translateTitles, settings.iptvPlaylists, excludeGenres, hiddenTabs.anime, settings.hideContent.anime, hiddenTabs.liveTv, settings.mangaEnabled, settings.hideContent.manga, authKey]);

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
    if (isMagnetInput(trimmed) || isDirectVideoUrl(trimmed)) return;
    setRecent((prev) => {
      const next = [trimmed, ...prev.filter((p) => p.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_RECENT);
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

  const { navDepth, rootFrame } = useView();
  const restoreDepth = useRef<number | null>(null);
  const restoreRoot = useRef<Frame | null>(null);
  const armed = useRef(false);

  const closeForNavigation = useCallback(() => {
    restoreDepth.current = navDepth;
    restoreRoot.current = rootFrame;
    armed.current = false;
    setOpen(false);
  }, [navDepth, rootFrame]);

  useEffect(() => {
    const mark = restoreDepth.current;
    if (mark == null) return;
    if (navDepth > mark) {
      armed.current = true;
      return;
    }
    if (armed.current && navDepth <= mark) {
      restoreDepth.current = null;
      armed.current = false;
      if (rootFrame === restoreRoot.current) setOpen(true);
      restoreRoot.current = null;
    }
  }, [navDepth, rootFrame]);

  useEffect(() => {
    if (!open) return;
    restoreDepth.current = null;
    restoreRoot.current = null;
    armed.current = false;
  }, [open]);

  const value = useMemo(
    () => ({ open, setOpen, query, setQuery, results, status, recent, clear, closeForNavigation, recordRecent, removeRecent, clearRecent, setAiHold }),
    [open, query, results, status, recent, setQuery, clear, closeForNavigation, recordRecent, removeRecent, clearRecent],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSearch(): SearchValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSearch outside SearchProvider");
  return v;
}
