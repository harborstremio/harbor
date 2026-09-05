import {
  ArrowUp,
  BookOpen,
  Bookmark,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Database,
  ExternalLink,
  Heart,
  LayoutGrid,
  Library,
  List,
  Loader2,
  RefreshCw,
  Search,
  Settings,
  X,
} from "lucide-react";
import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import "./ebook-hero.css";
import "./ebook-showcase.css";
import { NavArrow } from "@/components/nav-arrow";
import { CoverImg } from "@/components/cover-img";
import { Poster } from "@/components/poster";
import { EBookBook3D } from "./ebook/ebook-book3d";
import { Row } from "@/components/row";
import { emitListToast } from "@/components/lists/list-toast";
import { NytMark } from "@/components/icons/nyt-mark";
import { NYT_ATTRIBUTION, type NytList } from "@/lib/ebook/nyt";
import { isNytPlaceholder } from "@/lib/ebook/nyt-rail";
import { nytRailItems, nytRankFor } from "@/lib/ebook/nyt-rail";
import { nytBestsellerFor } from "@/lib/ebook/nyt-match";
import { useNytAvailability, useNytList, useNytSnapshot, useResolveNytBooks } from "@/lib/ebook/use-nyt";
import { useAnilist } from "@/lib/anilist/provider";
import { useT, useUiLanguage } from "@/lib/i18n";
import {
  EBOOK_CATEGORIES,
  browsePopularEBooks,
  dedupeEBooks,
  eBooksMatch,
  ebookAdaptations,
  ebookDetail,
  mergeEBookMetadata,
  searchEBooks,
  type EBook,
  type EBookAdaptation,
  type EBookAdaptations,
  type EBookCategoryGroup,
} from "@/lib/ebook/api";
import {
  applyEBookBrowseFilters,
  EBOOK_FILTER_GENRES,
  ebookMatchesGenre,
  ebookSourceBrowseTag,
  type EBookBrowseLanguage,
  type EBookBrowseSort,
  type EBookBrowseStatus,
} from "@/lib/ebook/browse-filters";
import {
  buildSourceEBookCollections,
  eBookCollectionCacheScope,
  markSourceEBookAwardsResolved,
  preferredEBookPopular,
  readSourceEBookCollections,
  sourceEBookAwardsAreFresh,
  streamSourceEBookAwardMatches,
  writeSourceEBookCollections,
} from "@/lib/ebook/collections";
import { booksBySameAuthor } from "@/lib/ebook/universes";
import {
  favoriteEBooks,
  ebookInLibrary,
  ebookIsFavorite,
  ebookLibrary,
  toggleEBookFavorite,
  toggleEBookLibrary,
} from "@/lib/ebook/library";
import { loadEBookProgress, loadEBookResume, saveEBookResume } from "@/lib/ebook/reader-state";
import {
  listEBookProviders,
  loadSourceEBookCatalogPage,
  loadSourceEBookPage,
  prefetchSourceEBookContent,
  searchSourceEBookCatalog,
  sourceEBookChapters,
  sourceEBookContent,
  sourceEBookDetail,
  type EBookChapter,
  type EBookChapterContent,
  type EBookCursor,
  type EBookProvider,
  ebookProviderIcon,
} from "@/lib/ebook/providers";
import { subscribeEBookExtensions } from "@/lib/ebook/extensions";
import { subscribeEBookSources } from "@/lib/ebook/sources";
import {
  fetchEBookListCollection,
  flushPendingEBookTracking,
  getEBookTracking,
} from "@/lib/ebook/tracking";
import { useScrollMemory, useView } from "@/lib/view";
import { useProfiles } from "@/lib/profiles";
import { usePageVisible } from "@/lib/visibility";
import { openUrl } from "@/lib/window";
import { EBookSourcesView } from "./ebook/ebook-sources-panel";
import { EBookSetup } from "./ebook/ebook-setup";
import { EBookReader } from "./ebook/ebook-reader";
import { EBookWheelMenu, type EBookWheelTarget } from "./ebook/ebook-wheel-menu";
import { MangaRail } from "./manga/manga-rail";

type Rail = {
  title: string;
  subtitle: string;
  items: EBook[] | null;
  resumeReading?: boolean;
  hideEmpty?: boolean;
  onEndReached?: () => void;
  loadingMore?: boolean;
  mark?: ReactNode;
};

type EBookBrowseType = EBookCategoryGroup | "All";
type EBookTitleLanguage = "auto" | "en" | "ar" | "original";

const EBookTitleLanguageContext = createContext<EBookTitleLanguage>("auto");
const EBookCardMenuContext = createContext<
  (ebook: EBook, event: ReactMouseEvent<HTMLElement>) => void
>(() => {});

function ebookTitleForLanguage(ebook: EBook, language: EBookTitleLanguage): string {
  if (language === "auto" || language === "original") return ebook.title;
  const candidates = [ebook.title, ...(ebook.altTitle?.split("|") ?? [])]
    .map((title) => title.trim())
    .filter(Boolean);
  const match =
    language === "ar"
      ? candidates.find((title) => /[\u0600-\u06ff]/.test(title))
      : candidates.find(
          (title) =>
            /[a-z]/i.test(title) && !/[\u0600-\u06ff\u3040-\u30ff\u3400-\u9fff]/.test(title),
        );
  return match ?? ebook.title;
}

type EBookVolumeGroup = {
  volume: string;
  label: string;
  number?: number;
  chapters: EBookChapter[];
};

function labelNumber(value: string): number | undefined {
  const digits = "٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹";
  const match = value
    .replace(/[٠-٩۰-۹]/g, (digit) => String(digits.indexOf(digit) % 10))
    .match(/\d+(?:\.\d+)?/);
  const number = match ? Number(match[0]) : NaN;
  return Number.isFinite(number) ? number : undefined;
}

function updateSourceItems(current: EBook[] | null, incoming: EBook[], replace = false): EBook[] {
  const byId = new Map<string, EBook>();
  for (const ebook of [...(current ?? []), ...incoming].flatMap((item) => item.books ?? [item])) {
    if (!replace && byId.has(ebook.id)) continue;
    byId.set(ebook.id, ebook);
  }
  return dedupeEBooks([...byId.values()]);
}

function scheduleEBookBackground(run: () => void, delay = 1_200): () => void {
  let idleHandle: number | undefined;
  const idleWindow = window as typeof window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  };
  const timer = window.setTimeout(() => {
    if (idleWindow.requestIdleCallback)
      idleHandle = idleWindow.requestIdleCallback(run, { timeout: 2_500 });
    else run();
  }, delay);
  return () => {
    window.clearTimeout(timer);
    if (idleHandle !== undefined) idleWindow.cancelIdleCallback?.(idleHandle);
  };
}

export function EBookView() {
  const t = useT();
  const { ebookId, openEBook, topKind } = useView();
  const listScrollRef = useRef<HTMLElement | null>(null);
  useScrollMemory("ebook", listScrollRef, !ebookId);
  const { activeId } = useProfiles();
  const { isConnected, session } = useAnilist();
  const uiLanguage = useUiLanguage();
  const [sourceItems, setSourceItems] = useState<EBook[] | null>(null);
  const [sourceCatalogItems, setSourceCatalogItems] = useState<EBook[] | null>(null);
  const [awardSourceItems, setAwardSourceItems] = useState<EBook[]>([]);
  const [providers, setProviders] = useState<EBookProvider[]>([]);
  const [sourcesReady, setSourcesReady] = useState(false);
  const [providerId, setProviderId] = useState("");
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EBook[] | null>(null);
  const [categoryGroup, setCategoryGroup] = useState<EBookBrowseType>("All");
  const [appliedCategoryGroup, setAppliedCategoryGroup] = useState<EBookBrowseType>("All");
  const [category, setCategory] = useState("");
  const [appliedCategory, setAppliedCategory] = useState("");
  const [titleLanguage, setTitleLanguage] = useState<EBookTitleLanguage>("auto");
  const [browseStatus, setBrowseStatus] = useState<EBookBrowseStatus>("any");
  const [browseLanguage, setBrowseLanguage] = useState<EBookBrowseLanguage>("any");
  const [browseSort, setBrowseSort] = useState<EBookBrowseSort>("popular");
  const [appliedBrowseStatus, setAppliedBrowseStatus] = useState<EBookBrowseStatus>("any");
  const [appliedBrowseLanguage, setAppliedBrowseLanguage] = useState<EBookBrowseLanguage>("any");
  const [appliedBrowseSort, setAppliedBrowseSort] = useState<EBookBrowseSort>("popular");
  const [selected, setSelected] = useState<EBook | null>(null);
  const [wheelTarget, setWheelTarget] = useState<EBookWheelTarget | null>(null);
  const [readIntent, setReadIntent] = useState<string | null>(null);
  const [saved, setSaved] = useState<EBook[]>(() => ebookLibrary());
  const [favorites, setFavorites] = useState<EBook[]>(() => favoriteEBooks());
  const [resumeVersion, setResumeVersion] = useState(0);
  const [screen, setScreen] = useState<"browse" | "collections" | "shelf" | "sources">("browse");
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [popular, setPopular] = useState<EBook[] | null>(null);
  const [metadataVersion, setMetadataVersion] = useState(0);
  const [collectionsRefreshing, setCollectionsRefreshing] = useState(false);
  const searchSeq = useRef(0);
  const searchTimer = useRef<number | undefined>(undefined);
  const sourceSeq = useRef(0);
  const providerIdRef = useRef("");
  const cursorRef = useRef<EBookCursor>({});
  const loadingMoreRef = useRef(false);
  const browseTagRef = useRef<string | undefined>(ebookSourceBrowseTag("any", "popular"));
  const awardSearchScopesRef = useRef(new Set<string>());
  const needsPopularMetadata = sourceCatalogItems !== null && sourceCatalogItems.length === 0;
  const openCardMenu = useCallback((ebook: EBook, event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setWheelTarget({ ebook, x: event.clientX, y: event.clientY });
  }, []);
  const collectionScope = eBookCollectionCacheScope(
    providerId,
    providers.map((provider) => provider.id),
  );
  const cachedCollections = useMemo(
    () => readSourceEBookCollections(collectionScope),
    [collectionScope],
  );
  const cachedAwardBooks = useMemo(
    () =>
      cachedCollections
        .filter((collection) => collection.kind === "award")
        .flatMap((collection) => collection.books),
    [cachedCollections],
  );
  const liveCollections = useMemo(
    () =>
      buildSourceEBookCollections([
        ...(sourceCatalogItems ?? []),
        ...cachedAwardBooks,
        ...awardSourceItems,
      ]),
    [awardSourceItems, cachedAwardBooks, sourceCatalogItems],
  );
  const resolvedCollections = useMemo(() => {
    const collections = new Map(cachedCollections.map((collection) => [collection.id, collection]));
    for (const collection of liveCollections) collections.set(collection.id, collection);
    return [...collections.values()];
  }, [cachedCollections, liveCollections]);
  const collectionBooks = useMemo(
    () => resolvedCollections.flatMap((collection) => collection.books),
    [resolvedCollections],
  );
  const seriesCollections = useMemo(
    () => resolvedCollections.filter((collection) => collection.kind === "series"),
    [resolvedCollections],
  );
  const catalogCollections = useMemo(
    () => resolvedCollections.filter((collection) => collection.kind === "catalog"),
    [resolvedCollections],
  );
  const awardCollections = useMemo(
    () => resolvedCollections.filter((collection) => collection.kind === "award"),
    [resolvedCollections],
  );
  const collectionsLoading =
    resolvedCollections.length === 0 && (sourceCatalogItems === null || collectionsRefreshing);
  const currentItems = useMemo(() => {
    const items = new Map<string, EBook>();
    for (const ebook of sourceItems ?? [])
      for (const book of ebook.books ?? [ebook]) items.set(book.id, ebook);
    for (const ebook of collectionBooks)
      for (const book of ebook.books ?? [ebook]) items.set(book.id, ebook);
    return items;
  }, [collectionBooks, sourceItems]);
  const displaySaved = useMemo(
    () => saved.map((ebook) => currentItems.get(ebook.id) ?? mergeEBookMetadata([ebook], [])[0]),
    [currentItems, saved],
  );
  const displayFavorites = useMemo(
    () =>
      favorites.map((ebook) => currentItems.get(ebook.id) ?? mergeEBookMetadata([ebook], [])[0]),
    [currentItems, favorites],
  );
  const continueBookmarks = useMemo(() => {
    const candidates = new Map<string, EBook>();
    for (const ebook of [
      ...(sourceItems ?? []),
      ...(sourceCatalogItems ?? []),
      ...(results ?? []),
      ...displaySaved,
      ...displayFavorites,
    ])
      candidates.set(ebook.id, ebook);
    return [...candidates.values()]
      .map((ebook) => ({ ebook, resume: loadEBookResume(activeId ?? "default", ebook.id) }))
      .filter((item) => item.resume !== null)
      .sort((left, right) => right.resume!.updatedAt - left.resume!.updatedAt)
      .map((item) => item.ebook);
  }, [
    activeId,
    displayFavorites,
    displaySaved,
    results,
    resumeVersion,
    sourceCatalogItems,
    sourceItems,
  ]);
  const loadedSourceCandidates = useMemo(() => {
    const candidates = new Map<string, EBook>();
    for (const item of [
      ...(sourceItems ?? []),
      ...(sourceCatalogItems ?? []),
      ...(results ?? []),
    ]) {
      for (const book of item.books ?? [item]) {
        if (book.source === "source") candidates.set(book.id, book);
      }
    }
    return [...candidates.values()];
  }, [results, sourceCatalogItems, sourceItems]);
  const mergeResolvedSources = useCallback((books: EBook[]) => {
    setSourceItems((current) => updateSourceItems(current, books, true));
    setSourceCatalogItems((current) => updateSourceItems(current, books, true));
    setResults((current) => (current ? updateSourceItems(current, books, true) : current));
  }, []);
  useEffect(() => {
    const preventNativeMenu = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-ebook-page]")) event.preventDefault();
    };
    document.addEventListener("contextmenu", preventNativeMenu, true);
    return () => document.removeEventListener("contextmenu", preventNativeMenu, true);
  }, []);
  const loadAnilistLibrary = useCallback(() => {
    if (!isConnected || !session) {
      return;
    }
    void flushPendingEBookTracking()
      .then(() => fetchEBookListCollection(session.userId))
      .catch(() => {});
  }, [isConnected, session]);

  useEffect(loadAnilistLibrary, [loadAnilistLibrary]);

  useEffect(() => {
    if (!needsPopularMetadata) return;
    let active = true;
    const cancel = scheduleEBookBackground(() => {
      void browsePopularEBooks()
        .catch(() => [])
        .then((allTime) => {
          if (active) setPopular(allTime);
        });
    }, 600);
    return () => {
      active = false;
      cancel();
    };
  }, [metadataVersion, needsPopularMetadata, uiLanguage]);

  useEffect(() => {
    const refresh = () => setMetadataVersion((version) => version + 1);
    window.addEventListener("harbor:ebook-metadata", refresh);
    return () => window.removeEventListener("harbor:ebook-metadata", refresh);
  }, []);

  useEffect(() => {
    if (liveCollections.length) writeSourceEBookCollections(collectionScope, liveCollections);
  }, [collectionScope, liveCollections]);

  const loadSources = useCallback((requestedProvider?: string, requestedTag?: string) => {
    const seq = ++sourceSeq.current;
    cursorRef.current = {};
    setHasMore(false);
    setSourceItems(null);
    setSourceCatalogItems(null);
    setAwardSourceItems([]);
    void listEBookProviders()
      .then((list) => {
        if (seq !== sourceSeq.current) return null;
        setProviders(list);
        setSourcesReady(true);
        const requested = requestedProvider ?? providerIdRef.current;
        const selected = list.some((source) => source.id === requested)
          ? requested
          : (list[0]?.id ?? "");
        providerIdRef.current = selected;
        setProviderId(selected);
        setSelectedProviderId(selected);
        return loadSourceEBookPage(
          undefined,
          selected,
          {},
          {
            onSource: (items) => {
              if (seq === sourceSeq.current) {
                setSourceItems((current) => updateSourceItems(current, items));
                setSourceCatalogItems((current) => updateSourceItems(current, items));
              }
            },
            onMetadata: (items) => {
              if (seq === sourceSeq.current) {
                setSourceItems((current) => updateSourceItems(current, items, true));
                setSourceCatalogItems((current) => updateSourceItems(current, items, true));
              }
            },
          },
          requestedTag ?? browseTagRef.current,
        );
      })
      .then((page) => {
        if (!page || seq !== sourceSeq.current) return;
        cursorRef.current = page.cursor;
        setHasMore(page.hasMore);
        void page.enriched.then((items) => {
          if (seq === sourceSeq.current)
            setSourceItems((current) => updateSourceItems(current, items, true));
          if (seq === sourceSeq.current)
            setSourceCatalogItems((current) => updateSourceItems(current, items, true));
        });
      })
      .catch(() => {
        if (seq === sourceSeq.current) {
          setProviders([]);
          setSourcesReady(true);
          setSourceItems([]);
          setSourceCatalogItems([]);
        }
      });
  }, []);

  const sourceCatalogReady = sourceCatalogItems !== null;
  useEffect(() => {
    if (screen !== "collections" || !providerId || !sourceCatalogReady) return;
    const seq = sourceSeq.current;
    let active = true;
    setCollectionsRefreshing(true);
    void (async () => {
      const loadCatalog = async () => {
        let nextCursor = { ...cursorRef.current };
        const known = new Set(
          (sourceCatalogItems ?? [])
            .flatMap((ebook) => ebook.books ?? [ebook])
            .map((ebook) => ebook.id),
        );
        for (let pageIndex = 0; pageIndex < 4; pageIndex++) {
          const page = await loadSourceEBookCatalogPage(
            providerId,
            nextCursor,
            browseTagRef.current,
          );
          if (!active || seq !== sourceSeq.current) return;
          const fresh = page.items.filter((ebook) => !known.has(ebook.id));
          if (!fresh.length) break;
          fresh.forEach((ebook) => known.add(ebook.id));
          nextCursor = page.cursor;
          cursorRef.current = page.cursor;
          setHasMore(page.hasMore);
          setSourceCatalogItems((current) => updateSourceItems(current, fresh));
          setSourceItems((current) => updateSourceItems(current, fresh));
          if (!page.hasMore) break;
        }
      };
      const loadAwards = async () => {
        if (
          sourceEBookAwardsAreFresh(collectionScope) ||
          awardSearchScopesRef.current.has(collectionScope)
        )
          return;
        awardSearchScopesRef.current.add(collectionScope);
        try {
          await streamSourceEBookAwardMatches(
            [...(sourceCatalogItems ?? []), ...cachedAwardBooks],
            (title) => searchSourceEBookCatalog(title, providerId),
            (books) => {
              if (active && seq === sourceSeq.current)
                setAwardSourceItems((current) => updateSourceItems(current, books));
            },
          );
          if (active && seq === sourceSeq.current) markSourceEBookAwardsResolved(collectionScope);
        } finally {
          awardSearchScopesRef.current.delete(collectionScope);
        }
      };
      await Promise.all([loadCatalog(), loadAwards()]);
    })()
      .catch(() => {})
      .finally(() => {
        if (active && seq === sourceSeq.current) setCollectionsRefreshing(false);
      });
    return () => {
      active = false;
    };
  }, [cachedAwardBooks, collectionScope, providerId, screen, sourceCatalogReady]);

  useEffect(() => {
    loadSources();
    const sources = subscribeEBookSources(loadSources);
    const extensions = subscribeEBookExtensions(loadSources);
    return () => {
      window.clearTimeout(searchTimer.current);
      sources();
      extensions();
    };
  }, [loadSources, metadataVersion, uiLanguage]);

  useEffect(() => {
    const update = () => {
      setSaved(ebookLibrary());
      setFavorites(favoriteEBooks());
    };
    window.addEventListener("harbor:ebook-library", update);
    return () => window.removeEventListener("harbor:ebook-library", update);
  }, []);

  useEffect(() => {
    const update = () => setResumeVersion((version) => version + 1);
    window.addEventListener("harbor:ebook-resume", update);
    return () => window.removeEventListener("harbor:ebook-resume", update);
  }, []);

  useEffect(() => {
    if (!ebookId) {
      setSelected(null);
      return;
    }
    const cached =
      currentItems.get(ebookId) ??
      [...displayFavorites, ...displaySaved].find((ebook) => ebook.id === ebookId);
    setSelected(cached ?? null);
    const source = ebookId.startsWith("source:");
    void (source ? sourceEBookDetail(ebookId) : ebookDetail(ebookId))
      .then((detail) => {
        if (!detail) return;
        setSelected((current) => {
          if (!current?.books?.length) return detail;
          const books = current.books.map((book) => (book.id === detail.id ? detail : book));
          if (current.id !== detail.id) return { ...current, books };
          return { ...detail, books };
        });
      })
      .catch(() => {});
  }, [currentItems, ebookId, displayFavorites, displaySaved, uiLanguage]);

  useEffect(() => {
    const onBack = (event: Event) => {
      if (topKind !== "ebook") return;
      if (ebookId) {
        event.preventDefault();
        openEBook();
      } else if (screen !== "browse") {
        event.preventDefault();
        setScreen("browse");
      }
    };
    window.addEventListener("harbor:local-back", onBack);
    return () => window.removeEventListener("harbor:local-back", onBack);
  }, [ebookId, openEBook, screen, topKind]);

  const search = (value: string) => {
    const wasSearching = query.trim().length >= 2;
    setQuery(value);
    const seq = ++searchSeq.current;
    window.clearTimeout(searchTimer.current);
    if (value.trim().length < 2) {
      setResults(null);
      if (wasSearching) loadSources();
      return;
    }
    cursorRef.current = {};
    setHasMore(false);
    setResults(null);
    searchTimer.current = window.setTimeout(() => {
      void loadSourceEBookPage(
        value.trim(),
        providerId,
        {},
        {
          onSource: (items) => {
            if (seq === searchSeq.current)
              setResults((current) => updateSourceItems(current, items));
          },
          onMetadata: (items) => {
            if (seq === searchSeq.current)
              setResults((current) => updateSourceItems(current, items, true));
          },
        },
        browseTagRef.current,
      )
        .then((page) => {
          if (seq === searchSeq.current) {
            cursorRef.current = page.cursor;
            setHasMore(page.hasMore);
            void page.enriched.then((items) => {
              if (seq === searchSeq.current)
                setResults((current) => updateSourceItems(current, items, true));
            });
          }
        })
        .catch(() => {
          if (seq === searchSeq.current) setResults([]);
        });
    }, 300);
  };

  const staleStreakRef = useRef(0);
  const loadFailRef = useRef(0);
  const loadMore = useCallback(() => {
    if (!hasMore || loadingMoreRef.current) return;
    const sourceId = sourceSeq.current;
    const searchId = searchSeq.current;
    const term = query.trim().length >= 2 ? query.trim() : undefined;
    const current = term ? results : sourceItems;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    void loadSourceEBookPage(
      term,
      providerId,
      cursorRef.current,
      {
        onSource: (items) => {
          if (sourceId !== sourceSeq.current || searchId !== searchSeq.current) return;
          if (term) setResults((currentItems) => updateSourceItems(currentItems, items));
          else {
            setSourceItems((currentItems) => updateSourceItems(currentItems, items));
            setSourceCatalogItems((currentItems) => updateSourceItems(currentItems, items));
          }
        },
        onMetadata: (items) => {
          if (sourceId !== sourceSeq.current || searchId !== searchSeq.current) return;
          if (term) setResults((currentItems) => updateSourceItems(currentItems, items, true));
          else setSourceItems((currentItems) => updateSourceItems(currentItems, items, true));
        },
      },
      browseTagRef.current,
    )
      .then((page) => {
        if (sourceId !== sourceSeq.current || searchId !== searchSeq.current) return;
        cursorRef.current = page.cursor;
        const known = new Set(
          (current ?? []).flatMap((ebook) => ebook.books ?? [ebook]).map((ebook) => ebook.id),
        );
        const fresh = page.items.filter((ebook) => !known.has(ebook.id));
        loadFailRef.current = 0;
        staleStreakRef.current = fresh.length > 0 ? 0 : staleStreakRef.current + 1;
        setHasMore(page.hasMore && staleStreakRef.current < 3);
        const bare = mergeEBookMetadata(fresh, []);
        if (term) setResults((items) => updateSourceItems(items, bare));
        else setSourceItems((items) => updateSourceItems(items, bare));
        void page.enriched.then((items) => {
          if (sourceId !== sourceSeq.current || searchId !== searchSeq.current) return;
          if (term) setResults((currentItems) => updateSourceItems(currentItems, items, true));
          else setSourceItems((currentItems) => updateSourceItems(currentItems, items, true));
        });
      })
      .catch(() => {
        loadFailRef.current += 1;
        if (loadFailRef.current >= 3) setHasMore(false);
      })
      .finally(() => {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      });
  }, [hasMore, providerId, query, results, sourceItems]);

  const wheelMenu = wheelTarget ? (
    <EBookWheelMenu
      target={wheelTarget}
      profile={activeId ?? "default"}
      onClose={() => setWheelTarget(null)}
      onOpenDetails={(ebook) => openEBook(ebook.id)}
      onStartReading={(ebook) => {
        setReadIntent(ebook.id);
        openEBook(ebook.id);
      }}
    />
  ) : null;

  const bestsellerList = useNytList();
  useResolveNytBooks(bestsellerList, 15);
  useNytAvailability();

  if (ebookId) {
    return (
      <EBookDetails
        ebook={selected}
        sourceCandidates={loadedSourceCandidates}
        onSourcesResolved={mergeResolvedSources}
        profile={activeId ?? "default"}
        autoRead={readIntent === ebookId}
        onAutoReadConsumed={() => setReadIntent(null)}
        onBack={() => openEBook()}
        onOpen={(item) => openEBook(String(item.id))}
      />
    );
  }

  if (screen === "sources") {
    return (
      <main
        data-ebook-page
        className="bg-canvas flex-1 overflow-y-auto overflow-x-hidden px-12 pb-16 pt-24"
      >
        <EBookSourcesView onBack={() => setScreen("browse")} />
      </main>
    );
  }

  if (!sourcesReady) {
    return <main data-ebook-page className="bg-canvas flex-1" />;
  }

  if (providers.length === 0) {
    return <EBookSetup onSetup={() => setScreen("sources")} />;
  }

  if (screen === "collections") {
    return (
      <main
        data-ebook-page
        className="bg-canvas flex-1 overflow-y-auto overflow-x-hidden px-12 pb-16 pt-24"
      >
        <button
          type="button"
          onClick={() => setScreen("browse")}
          className="mb-7 inline-flex items-center gap-1.5 rounded-full border border-edge-soft bg-canvas/40 px-4 py-2 text-[14px] text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
        >
          <ChevronLeft size={18} />
          {t("Back")}
        </button>
        <h1 className="mb-8 font-display text-[32px] font-medium tracking-tight text-ink">
          {t("Collections")}
        </h1>
        <div className="flex flex-col gap-9">
          {seriesCollections.length > 0 && (
            <section className="flex flex-col gap-9">
              <h2 className="font-display text-[24px] font-medium tracking-tight text-ink">
                {t("Book Series")}
              </h2>
              {seriesCollections.map((collection) => (
                <MangaRail
                  key={`series:${collection.name}`}
                  title={collection.name}
                  subtitle={t("{count} books from this source", { count: collection.books.length })}
                  items={collection.books}
                  onOpen={(book) => openEBook(book.id)}
                />
              ))}
            </section>
          )}
          {catalogCollections.length > 0 && (
            <section className="flex flex-col gap-9">
              <h2 className="font-display text-[24px] font-medium tracking-tight text-ink">
                {t("From the Installed Source")}
              </h2>
              {catalogCollections.map((collection) => (
                <MangaRail
                  key={collection.id}
                  title={collection.id === "catalog:popular" ? t("Most Popular") : collection.name}
                  subtitle={
                    collection.id === "catalog:popular"
                      ? t("Popular titles from the installed source")
                      : collection.subtitle
                  }
                  items={collection.books}
                  onOpen={(book) => openEBook(book.id)}
                />
              ))}
            </section>
          )}
          {awardCollections.length > 0 && (
            <section className="flex flex-col gap-9">
              <h2 className="font-display text-[24px] font-medium tracking-tight text-ink">
                {t("Award Winners")}
              </h2>
              {awardCollections.map((collection) => (
                <MangaRail
                  key={collection.id}
                  title={
                    collection.id === "award:hugo"
                      ? t("Hugo Award Winners")
                      : collection.id === "award:nebula"
                        ? t("Nebula Award Winners")
                        : collection.id === "award:booker"
                          ? t("Booker Prize Winners")
                          : collection.id === "award:pulitzer-fiction"
                            ? t("Pulitzer Prize for Fiction")
                            : collection.name
                  }
                  subtitle={
                    collection.id === "award:hugo"
                      ? t("Landmark winners in science fiction and fantasy")
                      : collection.id === "award:nebula"
                        ? t("Awarded by science-fiction and fantasy writers")
                        : collection.id === "award:booker"
                          ? t("Celebrated works of literary fiction")
                          : collection.id === "award:pulitzer-fiction"
                            ? t("Distinguished fiction honored by the Pulitzer Prize")
                            : collection.subtitle
                  }
                  award
                  items={collection.books}
                  onOpen={(book) => openEBook(book.id)}
                />
              ))}
            </section>
          )}
          {collectionsLoading && resolvedCollections.length === 0 && (
            <p className="text-[14px] text-ink-muted">{t("Loading book collections…")}</p>
          )}
          {!collectionsLoading && resolvedCollections.length === 0 && (
            <p className="text-[14px] text-ink-muted">
              {t("No collections were found in the installed source catalog.")}
            </p>
          )}
        </div>
      </main>
    );
  }

  if (screen === "shelf") {
    return (
      <EBookTitleLanguageContext.Provider value={titleLanguage}>
        <EBookCardMenuContext.Provider value={openCardMenu}>
          <main
            data-ebook-page
            className="bg-canvas flex-1 overflow-y-auto overflow-x-hidden px-12 pb-16 pt-24"
          >
            <button
              type="button"
              onClick={() => setScreen("browse")}
              className="mb-7 inline-flex items-center gap-1.5 rounded-full border border-edge-soft bg-canvas/40 px-4 py-2 text-[14px] text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
            >
              <ChevronLeft size={18} />
              {t("Back")}
            </button>
            <div className="mb-8 flex items-end justify-between gap-6">
              <div>
                <h1 className="font-display text-[32px] font-medium tracking-tight text-ink">
                  {t("Shelf")}
                </h1>
                <p className="mt-1 text-[14px] text-ink-muted">
                  {displaySaved.length
                    ? t("{count} books saved to your shelf", { count: displaySaved.length })
                    : t("Books you add to your shelf will appear here.")}
                </p>
              </div>
            </div>
            {displaySaved.length ? (
              <EBookGrid
                items={displaySaved}
                loadingMore={false}
                hasMore={false}
                onEndReached={() => {}}
                onOpen={(ebook) => openEBook(String(ebook.id))}
                resumeProfile={activeId ?? "default"}
                hideZeroProgress
              />
            ) : (
              <div className="grid min-h-[320px] place-items-center rounded-3xl border border-dashed border-edge-soft bg-elevated/20 px-8 text-center">
                <div className="flex max-w-sm flex-col items-center">
                  <span className="mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-elevated text-accent ring-1 ring-edge-soft">
                    <Library size={27} />
                  </span>
                  <h2 className="text-[19px] font-semibold text-ink">
                    {t("Your shelf is waiting")}
                  </h2>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-ink-muted">
                    {t("Open the wheel menu on any eBook and choose Add to Shelf.")}
                  </p>
                </div>
              </div>
            )}
          </main>
          {wheelMenu}
        </EBookCardMenuContext.Provider>
      </EBookTitleLanguageContext.Provider>
    );
  }

  const matchesCategory = (ebook: EBook) => {
    const wanted = appliedCategory || (appliedCategoryGroup === "All" ? "" : appliedCategoryGroup);
    if (!wanted) return true;
    const categories = appliedCategory
      ? [appliedCategory]
      : [appliedCategoryGroup, ...EBOOK_CATEGORIES[appliedCategoryGroup as EBookCategoryGroup]];
    return categories.some((item) => ebookMatchesGenre(ebook.genres, item));
  };
  const filteredSourceItems = sourceItems
    ? applyEBookBrowseFilters(sourceItems, {
        status: appliedBrowseStatus,
        language: appliedBrowseLanguage,
        sort: appliedBrowseSort,
      })
    : sourceItems;
  const catalog = filteredSourceItems?.filter(matchesCategory) ?? filteredSourceItems;
  const filteredResults = results
    ? applyEBookBrowseFilters(results, {
        status: appliedBrowseStatus,
        language: appliedBrowseLanguage,
        sort: appliedBrowseSort,
      }).filter(matchesCategory)
    : results;
  const popularBooks = preferredEBookPopular(sourceCatalogItems, popular);
  const featuredBooks = (popularBooks ?? []).filter(
    (ebook) => ebook.cover && !/(?:^|\/)default(?:\.[a-z0-9]+)?(?:[?#]|$)/i.test(ebook.cover),
  );
  const bestsellerItems = nytRailItems(bestsellerList);
  const bestsellerHero = (bestsellerItems ?? []).filter((ebook) => ebook.cover).slice(0, 5);
  const heroBooks = bestsellerHero.length >= 3 ? bestsellerHero : featuredBooks.slice(0, 5);
  const refreshing = query.trim().length >= 2 ? results === null : sourceItems === null;
  const rails: Rail[] =
    query.trim().length >= 2
      ? []
      : [
          ...(displayFavorites.length
            ? [
                {
                  title: t("Favorites"),
                  subtitle: t("Stories you love"),
                  items: displayFavorites.filter((item) => item.source === "source"),
                },
              ]
            : []),
          ...(continueBookmarks.length
            ? [
                {
                  title: t("Continue your bookmarks"),
                  subtitle: t("Resume from your saved reading position"),
                  items: continueBookmarks,
                  resumeReading: true,
                },
              ]
            : []),
          ...(bestsellerItems && bestsellerItems.length
            ? [
                {
                  title: "New York Times Bestsellers",
                  subtitle: NYT_ATTRIBUTION,
                  items: bestsellerItems,
                  mark: <NytMark />,
                },
              ]
            : []),
          {
            title: t("Popular eBooks"),
            subtitle: sourceCatalogItems?.length
              ? t("Popular titles from the installed source")
              : t("Popular titles from book metadata"),
            items: popularBooks,
          },
        ];

  return (
    <EBookTitleLanguageContext.Provider value={titleLanguage}>
      <EBookCardMenuContext.Provider value={openCardMenu}>
      <main
        ref={listScrollRef}
        data-ebook-page
        className="bg-canvas flex-1 overflow-y-auto overflow-x-hidden pb-20"
      >
        <EBookLibraryHero
          ebooks={heroBooks}
          bestsellers={bestsellerList}
          onOpen={(ebook) => {
            if (isNytPlaceholder(String(ebook.id))) {
              emitListToast("Not available in your sources yet");
              return;
            }
            openEBook(String(ebook.id));
          }}
        />

        <div className="flex w-full flex-col gap-9 px-12 pt-8">
          {rails.map((rail) => (
            <EBookRail
              key={`${rail.title}:${providerId}`}
              {...rail}
              profile={activeId ?? "default"}
              onOpen={(ebook) => {
                if (isNytPlaceholder(String(ebook.id))) {
                  emitListToast("Not available in your sources yet");
                  return;
                }
                if (rail.resumeReading) setReadIntent(ebook.id);
                openEBook(String(ebook.id));
              }}
            />
          ))}
          <div className="mb-9 mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setScreen("collections")}
                className="group flex h-full min-h-[84px] items-center gap-4 rounded-2xl border border-edge-soft bg-elevated/40 px-6 py-4 text-start transition-all duration-300 hover:bg-elevated/70 active:scale-[0.99]"
              >
                <span className="relative grid h-12 w-16 shrink-0 place-items-center">
                  <span className="absolute h-10 w-7 -translate-x-2.5 -rotate-[18deg] overflow-hidden rounded-[5px] bg-elevated shadow-[0_4px_10px_-4px_rgba(0,0,0,0.6)] ring-1 ring-edge-soft transition-transform duration-300 ease-out group-hover:-translate-x-4 group-hover:-rotate-[28deg]">
                    {collectionBooks[1]?.cover && (
                      <CoverImg
                        src={collectionBooks[1].cover}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                  </span>
                  <span className="absolute h-10 w-7 translate-x-2.5 rotate-[18deg] overflow-hidden rounded-[5px] bg-raised shadow-[0_4px_10px_-4px_rgba(0,0,0,0.6)] ring-1 ring-edge-soft transition-transform duration-300 ease-out group-hover:translate-x-4 group-hover:rotate-[28deg]">
                    {collectionBooks[2]?.cover && (
                      <CoverImg
                        src={collectionBooks[2].cover}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                  </span>
                  <span className="absolute h-10 w-7 overflow-hidden rounded-[5px] bg-gradient-to-br from-accent to-accent/60 shadow-[0_6px_14px_-4px_rgba(0,0,0,0.7)] ring-1 ring-white/10 transition-transform duration-300 ease-out group-hover:-translate-y-1">
                    {collectionBooks[0]?.cover && (
                      <CoverImg
                        src={collectionBooks[0].cover}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                  </span>
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[15.5px] font-semibold text-ink">{t("Collections")}</span>
                  <span className="truncate text-[13px] text-ink-muted">
                    {t("Shelves built from your installed source catalog")}
                  </span>
                </div>
                <ChevronRight
                  size={22}
                  className="shrink-0 text-ink-subtle transition-transform group-hover:translate-x-1"
                />
              </button>
              <button
                type="button"
                onClick={() => setScreen("shelf")}
                className="group flex h-full min-h-[84px] items-center gap-4 rounded-2xl border border-edge-soft bg-elevated/40 px-6 py-4 text-start transition-all duration-300 hover:bg-elevated/70 active:scale-[0.99]"
              >
                <span className="relative flex h-12 w-16 shrink-0 items-end justify-center gap-0.5 pb-2">
                  {[0, 1, 2, 3].map((index) => {
                    const book = displaySaved[index];
                    return (
                      <span
                        key={book?.id ?? index}
                        className={`relative overflow-hidden rounded-[3px] bg-raised ring-1 ring-edge-soft transition-transform duration-300 group-hover:-translate-y-1 ${index % 2 ? "h-9 w-3.5" : "h-10 w-4"}`}
                      >
                        {book?.cover && (
                          <CoverImg
                            src={book.cover}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        )}
                      </span>
                    );
                  })}
                  <span className="absolute inset-x-0 bottom-1 h-1 rounded-full bg-accent shadow-[0_3px_8px_-2px_rgba(0,0,0,0.7)]" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[15.5px] font-semibold text-ink">{t("Shelf")}</span>
                  <span className="truncate text-[13px] text-ink-muted">
                    {displaySaved.length
                      ? t("{count} books saved", { count: displaySaved.length })
                      : t("Books you save will appear here")}
                  </span>
                </div>
                <ChevronRight
                  size={22}
                  className="shrink-0 text-ink-subtle transition-transform group-hover:translate-x-1"
                />
              </button>
            </div>
            <div className="mb-[-1rem] mt-1">
              <h2 className="text-[22px] font-medium tracking-tight text-ink">
                {t("Browse eBooks")}
              </h2>
              <p className="text-[13px] text-ink-subtle">
                {providers.find((source) => source.id === providerId)?.name ??
                  t("Installed sources")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="contents">
                <label className="flex h-12 min-w-0 max-w-sm flex-1 items-center gap-3 rounded-2xl border border-edge-soft bg-elevated/45 px-4 text-ink-muted focus-within:border-edge focus-within:bg-elevated/70">
                  <Search size={18} />
                  <input
                    value={query}
                    onChange={(event) => search(event.target.value)}
                    placeholder={t("Search eBooks")}
                    className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-subtle"
                  />
                </label>
                <button
                  type="button"
                  aria-label={t("Refresh eBook source")}
                  title={t("Refresh source")}
                  disabled={refreshing}
                  onClick={() => (query.trim().length >= 2 ? search(query) : loadSources())}
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-ink-muted ring-1 ring-inset ring-edge-soft transition-colors hover:bg-white/[0.10] hover:text-ink disabled:pointer-events-none disabled:opacity-60"
                >
                  <RefreshCw
                    size={17}
                    className={refreshing ? "animate-spin motion-reduce:animate-none" : ""}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => setScreen("sources")}
                  aria-label={t("Manage eBook sources")}
                  title={t("Manage eBook sources")}
                  className="order-3 me-2 flex items-center gap-2 rounded-lg border border-edge-soft bg-elevated/40 px-3 py-2 text-[13px] text-ink transition-colors hover:bg-elevated/70"
                >
                  <Settings size={20} className="text-ink" />
                </button>
              </div>
              <div className="order-2">
                <EBookBrowseDropdown
                  label={t("Titles")}
                  value={titleLanguage}
                  options={[
                    { id: "auto", label: t("Auto") },
                    { id: "en", label: t("English") },
                    { id: "ar", label: t("Arabic") },
                    { id: "original", label: t("Original") },
                  ]}
                  onSelect={(value) => setTitleLanguage(value as EBookTitleLanguage)}
                />
              </div>
              <div
                className="order-1 ms-auto flex w-fit max-w-full flex-wrap items-center gap-2 rounded-2xl bg-elevated/30 p-2 ring-1 ring-edge-soft/50"
                aria-label={t("Filter eBooks")}
              >
                <EBookBrowseDropdown
                  label={t("Type")}
                  value={categoryGroup}
                  options={[
                    { id: "All", label: t("All") },
                    { id: "Fiction", label: t("Fiction") },
                    { id: "Non-fiction", label: t("Non-fiction") },
                  ]}
                  onSelect={(value) => {
                    setCategoryGroup(value as EBookBrowseType);
                    setCategory("");
                  }}
                />
                <EBookBrowseDropdown
                  label={t("Catalog")}
                  value={selectedProviderId}
                  badge={providers
                    .find((source) => source.id === selectedProviderId)
                    ?.name?.charAt(0)}
                  options={providers.map((source) => ({
                    id: source.id,
                    label: source.name,
                    icon: ebookProviderIcon(source.id),
                  }))}
                  onSelect={setSelectedProviderId}
                />
                <EBookBrowseDropdown
                  label={t("Genre")}
                  value={category}
                  options={[
                    { id: "", label: t("All genres") },
                    ...Array.from(
                      new Set(
                        categoryGroup !== "All"
                          ? [
                              ...EBOOK_CATEGORIES[categoryGroup],
                              ...(categoryGroup === "Fiction" ? EBOOK_FILTER_GENRES : []),
                            ]
                          : [...Object.values(EBOOK_CATEGORIES).flat(), ...EBOOK_FILTER_GENRES],
                      ),
                    ).map((item) => ({ id: item, label: t(item) })),
                  ]}
                  onSelect={setCategory}
                />
                <EBookBrowseDropdown
                  label={t("Status")}
                  value={browseStatus}
                  options={[
                    { id: "any", label: t("Any") },
                    { id: "ongoing", label: t("Ongoing") },
                    { id: "completed", label: t("Completed") },
                    { id: "hiatus", label: t("Hiatus") },
                  ]}
                  onSelect={(value) => setBrowseStatus(value as EBookBrowseStatus)}
                />
                <EBookBrowseDropdown
                  label={t("Language")}
                  value={browseLanguage}
                  options={[
                    { id: "any", label: t("Any") },
                    { id: "chinese", label: t("Chinese") },
                    { id: "korean", label: t("Korean") },
                    { id: "japanese", label: t("Japanese") },
                  ]}
                  onSelect={(value) => setBrowseLanguage(value as EBookBrowseLanguage)}
                />
                <EBookBrowseDropdown
                  label={t("Sort by")}
                  value={browseSort}
                  options={[
                    { id: "name", label: t("Name") },
                    { id: "popular", label: t("Popular") },
                    { id: "chapters", label: t("Chapters") },
                    { id: "rating", label: t("Rating") },
                    { id: "trending", label: t("Trending") },
                  ]}
                  onSelect={(value) => setBrowseSort(value as EBookBrowseSort)}
                />
                <button
                  type="button"
                  onClick={() => {
                    const tag = ebookSourceBrowseTag(browseStatus, browseSort);
                    setAppliedCategoryGroup(categoryGroup);
                    setAppliedCategory(category);
                    setAppliedBrowseStatus(browseStatus);
                    setAppliedBrowseLanguage(browseLanguage);
                    setAppliedBrowseSort(browseSort);
                    browseTagRef.current = tag;
                    setQuery("");
                    setResults(null);
                    loadSources(selectedProviderId, tag);
                  }}
                  className="flex h-10 items-center gap-2 rounded-full bg-ink px-5 text-[13.5px] font-semibold text-canvas transition-transform hover:scale-[1.02] active:scale-[0.97]"
                >
                  {t("Apply")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const tag = ebookSourceBrowseTag("any", "popular");
                    setCategoryGroup("All");
                    setAppliedCategoryGroup("All");
                    setCategory("");
                    setAppliedCategory("");
                    setBrowseStatus("any");
                    setAppliedBrowseStatus("any");
                    setBrowseLanguage("any");
                    setAppliedBrowseLanguage("any");
                    setBrowseSort("popular");
                    setAppliedBrowseSort("popular");
                    browseTagRef.current = tag;
                    setQuery("");
                    setResults(null);
                    loadSources(selectedProviderId, tag);
                  }}
                  className="flex h-10 items-center gap-2 rounded-full border border-edge-soft bg-canvas/50 px-4 text-[13.5px] font-semibold text-ink transition-colors hover:border-edge hover:bg-canvas/70 active:scale-[0.97]"
                >
                  {t("Reset")}
                </button>
              </div>
            </div>
            <EBookGrid
              items={query.trim().length >= 2 ? filteredResults : catalog}
              loadingMore={loadingMore}
              hasMore={hasMore}
              onEndReached={loadMore}
              onOpen={(ebook) => openEBook(String(ebook.id))}
            />
          </div>
        </main>
        {wheelMenu}
      </EBookCardMenuContext.Provider>
    </EBookTitleLanguageContext.Provider>
  );
}

function EBookBrowseDropdown({
  label,
  value,
  options,
  badge,
  onSelect,
}: {
  label: string;
  value: string;
  options: Array<{ id: string; label: string; icon?: string }>;
  badge?: string;
  onSelect: (id: string) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState<Record<string, boolean>>({});
  const ref = useRef<HTMLDivElement>(null);
  const active = options.find((option) => option.id === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-10 items-center gap-2 rounded-full border border-edge-soft bg-canvas/50 ps-3 pe-3.5 text-start transition-colors hover:border-edge hover:bg-canvas/70"
      >
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
          {label}
        </span>
        {active?.icon && !broken[active.id] ? (
          <img
            src={active.icon}
            alt=""
            draggable={false}
            onError={() => setBroken((prev) => ({ ...prev, [active.id]: true }))}
            className="h-[18px] w-[18px] shrink-0 rounded-[5px] object-contain"
          />
        ) : (
          badge && (
            <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] bg-elevated text-[10px] font-bold text-ink-subtle ring-1 ring-edge-soft">
              {badge.toLocaleUpperCase()}
            </span>
          )
        )}
        <span className="max-w-[180px] truncate text-[13.5px] font-medium text-ink">
          {active?.label ?? t("None")}
        </span>
        <ChevronDown
          size={14}
          className={`text-ink-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute start-0 z-40 mt-2 max-h-72 min-w-full overflow-y-auto rounded-lg bg-elevated p-1.5 ring-1 ring-edge-soft shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]">
          {options.map((option) => (
            <button
              key={option.id || "all"}
              type="button"
              onClick={() => {
                onSelect(option.id);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-[13px] transition-colors hover:bg-elevated ${
                option.id === value ? "text-ink" : "text-ink-muted"
              }`}
            >
              <span className="w-4">{option.id === value && <Check size={14} />}</span>
              {option.icon && !broken[option.id] && (
                <img
                  src={option.icon}
                  alt=""
                  draggable={false}
                  onError={() => setBroken((prev) => ({ ...prev, [option.id]: true }))}
                  className="h-4 w-4 shrink-0 rounded-[4px] object-contain"
                />
              )}
              <span className="whitespace-nowrap">{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const EBOOK_HERO_ROTATE_MS = 9000;

function heroSubject(value: string): string {
  return value.split("--")[0].split(",")[0].trim();
}

function EBookLibraryHero({
  ebooks,
  bestsellers,
  onOpen,
}: {
  ebooks: EBook[];
  bestsellers?: NytList | null;
  onOpen: (ebook: EBook) => void;
}) {
  const t = useT();
  const titleLanguage = useContext(EBookTitleLanguageContext);
  const openMenu = useContext(EBookCardMenuContext);
  const [active, setActive] = useState(0);
  const [shown, setShown] = useState(0);
  const [visible, setVisible] = useState(true);
  const [paused, setPaused] = useState(false);
  const pageVisible = usePageVisible();
  const current = ebooks[shown];
  const loading = ebooks.length === 0;
  const currentTitle = current ? ebookTitleForLanguage(current, titleLanguage) : "";
  const authors = current?.authors.filter(Boolean).slice(0, 2).join(", ") ?? "";
  const snapshot = useNytSnapshot();
  const listRank = current ? nytRankFor(bestsellers ?? null, current) : null;
  const anyMatch = current ? nytBestsellerFor(snapshot, current) : null;
  const rank = listRank ?? anyMatch?.book ?? null;
  const rankList = listRank ? null : (anyMatch?.list ?? null);
  const weeksLabel =
    rank && rank.weeksOnList > 0
      ? rank.weeksOnList === 1
        ? "1 week on the list"
        : `${rank.weeksOnList} weeks on the list`
      : "";
  const meta = current
    ? [weeksLabel, current.year ? String(current.year) : "", ...current.genres.map(heroSubject)]
        .map((value) => value.trim())
        .filter(Boolean)
        .filter((value, index, all) => all.indexOf(value) === index)
        .filter((value) => !authors.toLowerCase().includes(value.toLowerCase()))
        .slice(0, 3)
    : [];

  useEffect(() => {
    if (paused || ebooks.length < 2 || !pageVisible) return;
    const id = window.setInterval(
      () => setActive((index) => (index + 1) % ebooks.length),
      EBOOK_HERO_ROTATE_MS,
    );
    return () => window.clearInterval(id);
  }, [paused, ebooks.length, pageVisible]);

  useEffect(() => {
    if (active >= ebooks.length) setActive(0);
  }, [ebooks.length, active]);

  useEffect(() => {
    if (active === shown) return;
    setVisible(false);
    const timer = window.setTimeout(() => {
      setShown(active);
      setVisible(true);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [active, shown]);

  const fade: CSSProperties = {
    transition:
      "opacity 420ms cubic-bezier(0.22,1,0.36,1), transform 420ms cubic-bezier(0.22,1,0.36,1)",
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(14px)",
  };

  return (
    <section
      className="group ebook-library-hero"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onContextMenu={(event) => current && openMenu(current, event)}
    >
      <div className="ebook-hero-library-photo" aria-hidden="true">
        <img src="/ebook-hero-open-books.png" alt="" draggable={false} decoding="async" />
      </div>

      <div className="ebook-hero-paper">
        <svg
          className="ebook-hero-paper-shape"
          viewBox="0 0 1120 520"
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M0 0H790C930 0 1005 54 984 118C965 176 858 160 852 216C846 269 975 268 996 332C1018 399 933 467 806 520H0Z" />
        </svg>

        <div className="ebook-hero-copy" style={fade}>
          <span className="ebook-hero-kicker">
            {rank
              ? rankList
                ? `#${rank.rank} New York Times Bestseller · ${rankList.displayName}`
                : `#${rank.rank} New York Times Bestseller`
              : t("Featured book")}
          </span>
          {loading && (
            <div className="ebook-hero-skeleton">
              <span className="harbor-shimmer ebook-hero-sk-title" />
              <span className="harbor-shimmer ebook-hero-sk-title is-short" style={{ "--ai-delay": "90ms" } as CSSProperties} />
              <span className="harbor-shimmer ebook-hero-sk-byline" style={{ "--ai-delay": "180ms" } as CSSProperties} />
              <span className="harbor-shimmer ebook-hero-sk-line" style={{ "--ai-delay": "260ms" } as CSSProperties} />
              <span className="harbor-shimmer ebook-hero-sk-line is-short" style={{ "--ai-delay": "330ms" } as CSSProperties} />
              <span className="harbor-shimmer ebook-hero-sk-meta" style={{ "--ai-delay": "400ms" } as CSSProperties} />
              <span className="harbor-shimmer ebook-hero-sk-button" style={{ "--ai-delay": "470ms" } as CSSProperties} />
            </div>
          )}
          {!loading && <h1>{currentTitle}</h1>}
          {authors && <p className="ebook-hero-byline">{authors}</p>}
          {current?.description && <p>{current.description}</p>}
          {meta.length > 0 && (
            <div className="ebook-hero-meta">
              {meta.map((part, index) => (
                <Fragment key={part}>
                  {index > 0 && <i aria-hidden>·</i>}
                  <span>{part}</span>
                </Fragment>
              ))}
            </div>
          )}
          {current && (
            <button type="button" onClick={() => onOpen(current)}>
              {t("Read now")}
            </button>
          )}
        </div>

        <div className="ebook-hero-showcase" style={fade}>
          <div className="ebook-hero-book-shadow" aria-hidden="true" />
          {loading && <span className="harbor-shimmer ebook-hero-sk-book" />}
          <div className="ebook-hero-book-object">
            {current && (
              <EBookBook3D
                cover={current.cover}
                seed={`ebook-hero:${current.id}`}
                title={currentTitle}
                author={authors || undefined}
                text={current.description}
                imprint={current.providerName}
                scale={1.9}
                thickness={13}
              />
            )}
          </div>
        </div>
      </div>

      {ebooks.length > 1 && (
        <>
          <NavArrow
            dir="left"
            onClick={() => setActive((index) => (index - 1 + ebooks.length) % ebooks.length)}
            label={t("Previous featured book")}
            size={38}
            className="absolute start-2 top-1/2 z-20 h-14 w-14 -translate-y-1/2 opacity-25 group-hover:opacity-100"
          />
          <NavArrow
            dir="right"
            onClick={() => setActive((index) => (index + 1) % ebooks.length)}
            label={t("Next featured book")}
            size={38}
            className="absolute end-2 top-1/2 z-20 h-14 w-14 -translate-y-1/2 opacity-25 group-hover:opacity-100"
          />
          <div className="ebook-hero-stepper">
            {ebooks.map((ebook, index) => (
              <button
                key={ebook.id}
                type="button"
                onClick={() => setActive(index)}
                aria-label={t("Show featured book {number}: {title}", {
                  number: index + 1,
                  title: ebook.title,
                })}
                aria-current={index === active ? "true" : undefined}
                className={index === active ? "is-active" : ""}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function EBookDetailDropdown({
  options,
  selected,
  onSelect,
  buttonLabel,
}: {
  options: Array<{ id: string; label: string; icon?: string }>;
  selected: string;
  onSelect: (id: string) => void;
  buttonLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = options.find((option) => option.id === selected) ?? options[0];
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-12 items-center gap-2.5 rounded-full bg-white/[0.06] px-6 text-[15px] font-semibold text-ink ring-1 ring-inset ring-edge-soft transition-colors duration-150 hover:bg-white/[0.10] active:scale-[0.98]"
      >
        {active?.icon ? (
          <img src={active.icon} alt="" className="h-5 w-5 shrink-0 rounded object-contain" />
        ) : (
          buttonLabel && <Database size={16} className="text-ink-subtle" />
        )}
        <span>{buttonLabel ? `${buttonLabel} · ${active?.label}` : active?.label}</span>
        <ChevronDown
          size={16}
          className={`text-ink-subtle transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 max-h-80 min-w-60 overflow-y-auto rounded-lg bg-elevated p-1.5 ring-1 ring-edge-soft shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                onSelect(option.id);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-[14px] transition-colors ${
                option.id === selected ? "bg-raised text-ink" : "text-ink-muted hover:bg-raised"
              }`}
            >
              {option.id === selected ? (
                <Check size={15} className="text-accent" />
              ) : (
                <span className="w-[15px]" />
              )}
              {option.icon && (
                <img src={option.icon} alt="" className="h-5 w-5 shrink-0 rounded object-contain" />
              )}
              <span className="truncate">{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EBookRail({
  title,
  subtitle,
  items,
  onOpen,
  onEndReached,
  loadingMore,
  hideEmpty,
  resumeReading,
  profile,
  mark,
}: Rail & { onOpen: (ebook: EBook) => void; profile?: string; mark?: ReactNode }) {
  const t = useT();
  if (items?.length === 0)
    return hideEmpty ? null : <p className="text-[14px] text-ink-muted">{t("No eBooks found.")}</p>;
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="flex items-center gap-2.5 text-[20px] font-semibold tracking-tight text-ink">
          {mark}
          {title}
        </h2>
        <p className="text-[13px] text-ink-subtle">{subtitle}</p>
      </div>
      <Row min={144} shape="portrait" scrollKey={`ebook:${title}`} onEndReached={onEndReached}>
        {items === null
          ? Array.from({ length: 8 }, (_, index) => (
              <div
                key={index}
                className="harbor-shimmer relative aspect-[2/3]"
                style={{ "--ai-delay": `${index * 80}ms`, borderRadius: 12 } as CSSProperties}
              />
            ))
          : items.map((ebook) => (
              <EBookCard
                key={ebook.id}
                ebook={ebook}
                onOpen={onOpen}
                resumeProfile={resumeReading && profile ? profile : undefined}
              />
            ))}
      </Row>
      {loadingMore && <Loader2 size={18} className="animate-spin text-ink-subtle" />}
    </section>
  );
}

function EBookGrid({
  items,
  loadingMore,
  hasMore,
  onEndReached,
  onOpen,
  resumeProfile,
  hideZeroProgress,
}: {
  items: EBook[] | null;
  loadingMore: boolean;
  hasMore: boolean;
  onEndReached: () => void;
  onOpen: (ebook: EBook) => void;
  resumeProfile?: string;
  hideZeroProgress?: boolean;
}) {
  const t = useT();
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = sentinel.current;
    if (!element || !hasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => entry?.isIntersecting && onEndReached(),
      { rootMargin: "800px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasMore, onEndReached]);

  if (items?.length === 0)
    return <p className="py-10 text-center text-[14px] text-ink-muted">{t("No eBooks found.")}</p>;
  return (
    <section>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-4 gap-y-7">
        {items === null
          ? Array.from({ length: 12 }, (_, index) => (
              <div key={index}>
                <div
                  className="harbor-shimmer relative aspect-[2/3]"
                  style={{ "--ai-delay": `${index * 70}ms`, borderRadius: 12 } as CSSProperties}
                />
                <div
                  className="harbor-shimmer relative mt-3 h-3.5 w-4/5"
                  style={{ "--ai-delay": `${index * 70 + 60}ms`, borderRadius: 999 } as CSSProperties}
                />
                <div
                  className="harbor-shimmer relative mt-2 h-3 w-2/5"
                  style={{ "--ai-delay": `${index * 70 + 120}ms`, borderRadius: 999 } as CSSProperties}
                />
              </div>
            ))
          : items.map((ebook) => (
              <EBookCard
                key={ebook.id}
                ebook={ebook}
                onOpen={onOpen}
                resumeProfile={resumeProfile}
                hideZeroProgress={hideZeroProgress}
              />
            ))}
      </div>
      <div ref={sentinel} className="h-4" />
      {loadingMore && (
        <div className="flex justify-center py-6">
          <Loader2 size={22} className="animate-spin text-ink-subtle motion-reduce:animate-none" />
        </div>
      )}
      {!hasMore && items && items.length > 0 && (
        <p className="py-6 text-center text-[12.5px] text-ink-subtle">
          {t("That is everything from this source.")}
        </p>
      )}
    </section>
  );
}

function useEBookReadStatus(ebook: EBook | null, profile: string) {
  const [, setVersion] = useState(0);
  const ebookId = ebook?.id;
  const resume = ebookId ? loadEBookResume(profile, ebookId) : null;
  const tracking = ebookId ? getEBookTracking(ebookId) : { status: "PLANNING", progress: 0 };
  const savedLine =
    ebookId && resume ? loadEBookProgress(profile, ebookId, `${resume.chapterId}:harbor`) : 0;
  const status =
    tracking.status === "COMPLETED" ||
    (resume?.chapterIndex !== undefined &&
      resume.totalChapters !== undefined &&
      resume.chapterIndex === resume.totalChapters - 1 &&
      (resume.chapterProgress ?? 0) >= 100)
      ? "read"
      : tracking.progress > 0 ||
          savedLine > 0 ||
          (resume?.chapterProgress ?? 0) > 0 ||
          (resume?.bookProgress ?? 0) > 0
        ? "partial"
        : null;

  useEffect(() => {
    if (!ebookId) return;
    const refresh = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (!detail || detail === ebookId) setVersion((version) => version + 1);
    };
    window.addEventListener("harbor:ebook-resume", refresh);
    window.addEventListener("harbor:ebook-tracking", refresh);
    return () => {
      window.removeEventListener("harbor:ebook-resume", refresh);
      window.removeEventListener("harbor:ebook-tracking", refresh);
    };
  }, [ebookId]);

  return status;
}

function EBookCard({
  ebook,
  onOpen,
  resumeProfile,
  hideZeroProgress = false,
}: {
  ebook: EBook;
  onOpen: (ebook: EBook) => void;
  resumeProfile?: string;
  hideZeroProgress?: boolean;
}) {
  const t = useT();
  const titleLanguage = useContext(EBookTitleLanguageContext);
  const openMenu = useContext(EBookCardMenuContext);
  const { activeId } = useProfiles();
  const profile = activeId ?? "default";
  const displayTitle = ebookTitleForLanguage(ebook, titleLanguage);
  const resume = resumeProfile ? loadEBookResume(resumeProfile, ebook.id) : null;
  const readStatus = useEBookReadStatus(ebook, profile);
  const chapterProgress = Math.max(0, Math.min(100, resume?.chapterProgress ?? 0));
  const fallbackBookProgress =
    resume?.chapterIndex !== undefined && resume.totalChapters
      ? ((resume.chapterIndex + chapterProgress / 100) / resume.totalChapters) * 100
      : 0;
  const bookProgress = Math.max(0, Math.min(100, resume?.bookProgress ?? fallbackBookProgress));
  const showResumeProgress =
    resume !== null && (!hideZeroProgress || chapterProgress > 0 || bookProgress > 0);
  const volumeDetail = resume?.volumeLabel?.startsWith("Volume ")
    ? t("Volume {number}", { number: resume.volumeLabel.slice("Volume ".length) })
    : resume?.volumeLabel;
  return (
    <button
      type="button"
      onClick={() => onOpen(ebook)}
      onContextMenu={(event) => openMenu(ebook, event)}
      className="group flex w-full min-w-0 flex-col gap-2 text-start"
    >
      <EBookBook3D
        cover={ebook.cover}
        seed={`ebook:${ebook.id}`}
        title={displayTitle}
        author={ebook.authors[0]}
        text={ebook.description}
        imprint={ebook.providerName}
        thickness={7}
        mode="lift"
        lazy
      >
        {readStatus && <EBookReadMark status={readStatus} />}
      </EBookBook3D>
      <p className="line-clamp-2 min-h-9 text-[13px] font-medium leading-snug text-ink">
        {displayTitle}
      </p>
      {ebook.authors.length > 0 && (
        <p className="-mt-1 line-clamp-1 text-[12px] leading-snug text-ink-muted">
          {ebook.authors.slice(0, 2).join(", ")}
        </p>
      )}
      <p className="text-[11.5px] text-ink-subtle">
        {[
          ebook.books?.length ? t("{count} books", { count: ebook.books.length }) : null,
          ebook.books
            ? t("{count} sources", { count: new Set(ebook.books.map((book) => book.source)).size })
            : null,
          ebook.year,
          ebook.volumes ? t("{count} vols", { count: ebook.volumes }) : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {showResumeProgress && (
        <div className="mt-0.5 flex w-full flex-col gap-2" aria-label={t("Reading progress")}>
          <EBookProgressSeeker
            label={t("Chapter")}
            value={chapterProgress}
            accent
            detail={resume.chapterLabel || resume.chapterTitle}
          />
          <EBookProgressSeeker
            label={t("Complete book")}
            value={bookProgress}
            detail={volumeDetail}
          />
        </div>
      )}
    </button>
  );
}

function EBookReadMark({ status }: { status: "read" | "partial" }) {
  const t = useT();
  const complete = status === "read";
  return (
    <span
      aria-label={complete ? t("Read") : t("Partially read")}
      title={complete ? t("Read") : t("Partially read")}
      className={`ebook-card-read-mark pointer-events-none absolute right-2 top-2 z-10 inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[9px] font-semibold uppercase tracking-[0.12em] shadow-lg backdrop-blur-md ${
        complete
          ? "border-accent/45 bg-accent/90 text-canvas shadow-accent/15"
          : "border-white/15 bg-canvas/80 text-white/85 shadow-black/30"
      }`}
    >
      {complete ? (
        <Check size={12} strokeWidth={2.5} />
      ) : (
        <span className="relative h-3 w-3 rounded-full border border-current/70">
          <span className="absolute inset-y-[2px] left-[2px] w-[3px] rounded-l-full bg-accent" />
        </span>
      )}
      {complete ? t("Read") : t("Reading")}
    </span>
  );
}

function EBookProgressSeeker({
  label,
  value,
  detail,
  accent = false,
}: {
  label: string;
  value: number;
  detail?: string;
  accent?: boolean;
}) {
  const percent = Math.round(value);
  return (
    <div
      className="group/progress w-full"
      title={`${label}: ${percent}%${detail ? ` · ${detail}` : ""}`}
    >
      <div className="mb-1 flex items-center justify-between gap-2 text-[9.5px] leading-none">
        <span className={accent ? "font-medium text-ink-muted" : "text-ink-subtle"}>{label}</span>
        <span className={accent ? "tabular-nums text-accent" : "tabular-nums text-ink-muted"}>
          {percent}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="relative h-1 overflow-visible rounded-full bg-raised"
      >
        <span
          className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ${
            accent ? "bg-accent" : "bg-ink-subtle/55"
          }`}
          style={{ width: `${percent}%` }}
        />
        <span
          aria-hidden
          className={`absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border transition-transform group-hover/progress:scale-125 ${
            accent
              ? "border-accent bg-canvas shadow-[0_0_0_2px_color-mix(in_srgb,var(--color-accent)_18%,transparent)]"
              : "border-ink-subtle bg-canvas"
          }`}
          style={{ left: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function EBookChapterSection({
  chapters,
  loading,
  volumeGroups,
  selectedVolume,
  onSelectVolume,
  sourceRoute,
  onRead,
}: {
  chapters: EBookChapter[] | null;
  loading: boolean;
  volumeGroups: EBookVolumeGroup[];
  selectedVolume: string | null;
  onSelectVolume: (volume: string) => void;
  sourceRoute: string | null;
  onRead: (chapter: EBookChapter) => void;
}) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("oldest");
  const [pagination, setPagination] = useState({ key: "", count: 30 });
  const [view, setView] = useState<"grid" | "list">(() =>
    typeof localStorage !== "undefined" &&
    localStorage.getItem("harbor.ebook.chapterview") === "list"
      ? "list"
      : "grid",
  );
  useEffect(() => localStorage.setItem("harbor.ebook.chapterview", view), [view]);
  const hasVolumes = volumeGroups.some((group) => group.volume);
  const selected = hasVolumes
    ? (volumeGroups.find((group) => group.volume === selectedVolume)?.chapters ?? [])
    : (volumeGroups[0]?.chapters ?? []);
  const ordered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const positioned = selected.length > 0 && selected.every((chapter) => chapter.position != null);
    const positionedNumbers = selected
      .map((chapter) => ({
        position: chapter.position,
        number: labelNumber(chapter.chapter ?? ""),
      }))
      .filter(
        (chapter): chapter is { position: number; number: number } =>
          chapter.position != null && chapter.number != null,
      )
      .sort((left, right) => left.position - right.position);
    const positionDirection =
      positionedNumbers.reduce(
        (direction, chapter, index) =>
          index ? direction + Math.sign(chapter.number - positionedNumbers[index - 1].number) : 0,
        0,
      ) < 0
        ? -1
        : 1;
    const items = selected
      .map((chapter, index) => ({ chapter, index }))
      .filter(
        ({ chapter }) =>
          !term ||
          chapter.title.toLowerCase().includes(term) ||
          chapter.chapter?.toLowerCase().includes(term),
      );
    items.sort((a, b) => {
      if (positioned)
        return (a.chapter.position! - b.chapter.position!) * positionDirection || a.index - b.index;
      const left = a.chapter.chapter ? labelNumber(a.chapter.chapter) : undefined;
      const right = b.chapter.chapter ? labelNumber(b.chapter.chapter) : undefined;
      if (left !== undefined && right !== undefined) return left - right || a.index - b.index;
      if (left !== undefined) return -1;
      if (right !== undefined) return 1;
      return (
        a.chapter.title.localeCompare(b.chapter.title, undefined, { numeric: true }) ||
        a.index - b.index
      );
    });
    return (sort === "newest" ? items.reverse() : items).map(({ chapter }) => chapter);
  }, [query, selected, sort]);
  const pageKey = `${sourceRoute}\0${selectedVolume}\0${sort}\0${view}\0${query}`;
  const visibleCount = pagination.key === pageKey ? pagination.count : 30;
  const rendered = ordered.slice(0, visibleCount);

  if (loading || chapters === null)
    return (
      <section className="flex flex-col gap-6">
        <h2 className="text-[22px] font-medium tracking-tight text-ink">{t("Chapters")}</h2>
        <div className="rounded-2xl border border-edge-soft bg-surface/40 px-6 py-14 text-center">
          <p className="flex items-center justify-center gap-2 text-[15px] text-ink-muted">
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />{" "}
            {t("Loading chapters...")}
          </p>
        </div>
      </section>
    );

  if (!chapters.length)
    return (
      <section className="flex flex-col gap-6">
        <h2 className="text-[22px] font-medium tracking-tight text-ink">{t("Chapters")}</h2>
        <div className="rounded-2xl border border-edge-soft bg-surface/40 px-6 py-14 text-center text-[15px] text-ink-muted">
          {t("This source returned no chapters for this title.")}
        </div>
      </section>
    );

  const volumePicker = hasVolumes && (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline gap-3">
        <h2 className="text-[22px] font-medium tracking-tight text-ink">{t("Volumes")}</h2>
        <span className="text-[15px] text-ink-subtle">
          {volumeGroups.filter((group) => group.volume).length}
        </span>
      </div>
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}
      >
        {volumeGroups.map((group) => (
          <button
            key={group.volume}
            type="button"
            aria-pressed={selectedVolume === group.volume}
            onClick={() => onSelectVolume(group.volume)}
            className={`group flex min-h-[68px] items-center gap-3 rounded-xl border px-4 py-3 text-start transition-colors ${
              selectedVolume === group.volume
                ? "border-accent/70 bg-accent/5"
                : "border-edge-soft bg-surface/60 hover:border-edge hover:bg-elevated/60"
            }`}
          >
            <BookOpen
              size={18}
              className={selectedVolume === group.volume ? "text-accent" : "text-ink-subtle"}
            />
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-semibold text-ink">
                {group.volume
                  ? group.number !== undefined && group.label === `Volume ${group.number}`
                    ? t("Volume {number}", { number: group.number })
                    : group.label
                  : t("Other")}
              </span>
              <span className="block text-[12px] text-ink-subtle">
                {t("{count} chapters", { count: group.chapters.length })}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );

  if (hasVolumes && selectedVolume === null)
    return (
      <section className="flex flex-col gap-5">
        {volumePicker}
        <div className="rounded-2xl border border-edge-soft bg-surface/40 px-6 py-14 text-center text-[15px] text-ink-muted">
          {t("Select a volume to see its chapters.")}
        </div>
      </section>
    );

  return (
    <section className="flex flex-col gap-5">
      {volumePicker}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <h2 className="text-[22px] font-medium tracking-tight text-ink">{t("Chapters")}</h2>
          <span className="text-[15px] text-ink-subtle">{selected.length}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-11 items-center gap-1 rounded-lg bg-canvas p-1 ring-1 ring-inset ring-edge-soft">
            {(
              [
                ["list", List],
                ["grid", LayoutGrid],
              ] as const
            ).map(([value, Icon]) => (
              <button
                key={value}
                type="button"
                aria-label={value === "list" ? t("List view") : t("Grid view")}
                onClick={() => setView(value)}
                className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                  view === value ? "bg-elevated text-ink" : "text-ink-subtle hover:text-ink"
                }`}
              >
                <Icon size={18} />
              </button>
            ))}
          </div>
          <div className="flex h-11 items-center gap-1 rounded-lg bg-canvas p-1 ring-1 ring-inset ring-edge-soft">
            {(["newest", "oldest"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setSort(value)}
                className={`h-9 rounded-lg px-4 text-[13px] font-medium capitalize transition-colors ${
                  sort === value ? "bg-elevated text-ink" : "text-ink-muted hover:text-ink"
                }`}
              >
                {value === "newest" ? t("Newest") : t("Oldest")}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative">
        <Search
          size={18}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-subtle"
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("Search chapters...")}
          className="h-11 w-full rounded-lg bg-canvas pl-11 pr-4 text-[14px] text-ink ring-1 ring-inset ring-edge-soft transition-colors placeholder:text-ink-subtle focus:ring-edge focus:outline-none"
        />
      </div>

      {ordered.length === 0 ? (
        <div className="rounded-2xl border border-edge-soft bg-surface/40 px-6 py-14 text-center text-[15px] text-ink-muted">
          {t("No chapters match your search.")}
        </div>
      ) : view === "list" ? (
        <div className="overflow-hidden rounded-2xl border border-edge-soft bg-surface/40">
          {rendered.map((chapter) => (
            <button
              key={chapter.id}
              type="button"
              onClick={() => onRead(chapter)}
              className="group flex min-h-[64px] w-full items-center justify-between gap-4 border-b border-edge-soft/60 px-5 py-3.5 text-start transition-colors last:border-b-0 hover:bg-elevated/40"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                {chapter.chapter && (
                  <span className="text-[12px] text-ink-subtle">
                    {t("Ch. {chapter}", { chapter: chapter.chapter })}
                  </span>
                )}
                <span className="truncate text-[16px] font-semibold text-ink">{chapter.title}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2.5">
                <EBookChapterMeta chapter={chapter} />
                <BookOpen
                  size={18}
                  className="shrink-0 text-ink-subtle transition-colors group-hover:text-accent"
                />
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}
        >
          {rendered.map((chapter) => (
            <button
              key={chapter.id}
              type="button"
              onClick={() => onRead(chapter)}
              className="group flex min-h-[64px] flex-col justify-between gap-2 rounded-lg bg-elevated px-4 py-3.5 text-start ring-1 ring-inset ring-edge-soft transition-colors hover:bg-raised"
            >
              <div className="flex flex-col gap-0.5">
                {chapter.chapter && (
                  <span className="text-[12px] text-ink-subtle">
                    {t("Ch. {chapter}", { chapter: chapter.chapter })}
                  </span>
                )}
                <span className="line-clamp-1 text-[15px] font-semibold text-ink">
                  {chapter.title}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <EBookChapterMeta chapter={chapter} />
                <BookOpen
                  size={16}
                  className="shrink-0 text-ink-subtle transition-colors group-hover:text-accent"
                />
              </div>
            </button>
          ))}
        </div>
      )}
      {visibleCount < ordered.length && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() =>
              setPagination((page) => ({
                key: pageKey,
                count: Math.min((page.key === pageKey ? page.count : 30) + 30, ordered.length),
              }))
            }
            className="flex h-11 items-center justify-center rounded-full border border-edge-soft bg-surface/60 px-6 text-[13.5px] font-semibold text-ink transition-colors hover:border-edge hover:bg-elevated"
          >
            {t("Show more chapters")}
            <span className="ms-2 text-[12px] font-normal text-ink-subtle">
              {t("{count} remaining", { count: ordered.length - visibleCount })}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setPagination({ key: pageKey, count: ordered.length })}
            className="h-9 rounded-full px-3 text-[12px] font-semibold text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
          >
            {t("Show all")}
          </button>
        </div>
      )}
    </section>
  );
}

function EBookChapterMeta({ chapter }: { chapter: EBookChapter }) {
  const t = useT();
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-ink-subtle">
      {chapter.publishAt && <span className="shrink-0">{chapter.publishAt}</span>}
      {chapter.publishAt && chapter.views !== undefined && <span aria-hidden>·</span>}
      {chapter.views !== undefined && (
        <span className="shrink-0">
          {t("{count} views", {
            count:
              typeof chapter.views === "number" ? chapter.views.toLocaleString() : chapter.views,
          })}
        </span>
      )}
    </span>
  );
}

function EBookInformation({ ebook }: { ebook: EBook }) {
  const t = useT();
  const [adaptations, setAdaptations] = useState<EBookAdaptations | null>(null);
  const [adaptationStatus, setAdaptationStatus] = useState<{
    id: string;
    state: "resolving";
  } | null>(null);
  const [adaptationChoices, setAdaptationChoices] = useState<{
    title: string;
    items: Array<{ id: string; title: string; cover?: string }>;
  } | null>(null);
  const { openManga, openMeta } = useView();

  useEffect(() => {
    let active = true;
    setAdaptations(null);
    setAdaptationStatus(null);
    setAdaptationChoices(null);
    void ebookAdaptations(ebook).then((value) => {
      if (active) setAdaptations(value);
    });
    return () => {
      active = false;
    };
  }, [ebook.id, ebook.anilistId, ebook.wikidataId]);

  const score =
    ebook.score == null
      ? null
      : ebook.score > 10
        ? `${(ebook.score / 10).toFixed(1)} / 10`
        : `${ebook.score.toFixed(1)} / 10`;
  const rows = [
    { label: t("Author"), value: ebook.authors.join(" · ") || t("Not available") },
    {
      label: t("First aired"),
      value: ebook.publishedAt || (ebook.year ? String(ebook.year) : t("Not available")),
    },
    { label: t("Status"), value: ebook.status || t("Not available") },
    { label: t("Genres"), value: ebook.genres.join(" · ") || t("Not available") },
    { label: t("Rating"), value: score || t("Not available") },
  ];
  const adaptationItems = adaptations
    ? [...adaptations.anime, ...adaptations.manga, ...adaptations.liveAction]
    : [];

  const openAdaptation = async (item: EBookAdaptation) => {
    if (item.kind === "anime" && item.anilistId) {
      openMeta(
        {
          id: `anilist:${item.anilistId}`,
          type: "anime",
          name: item.title,
          poster: item.poster,
          description: item.description,
          releaseInfo: item.year ? String(item.year) : undefined,
          animeFormat: item.format,
        },
        { exact: true },
      );
      return;
    }
    if (item.kind === "anime") {
      const { searchAnime } = await import("@/lib/search");
      const matches = await searchAnime(item.title).catch(() => []);
      const titleKey = item.title.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
      const match =
        matches.find(
          (candidate) =>
            candidate.name.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "") === titleKey,
        ) ?? matches[0];
      if (!match) return;
      const id = match.kitsuId
        ? `kitsu:${match.kitsuId}`
        : match.malId
          ? `mal:${match.malId}`
          : `anilist:${match.anilistId}`;
      openMeta(
        {
          id,
          type: "anime",
          name: match.name,
          poster: match.poster ?? item.poster,
          background: match.background ?? match.poster ?? item.poster,
          description: match.overview || item.description,
          releaseInfo: match.year ?? (item.year ? String(item.year) : undefined),
          imdbRating: match.score > 0 ? match.score.toFixed(1) : undefined,
          animeFormat: match.format ?? item.format,
        },
        { exact: true },
      );
      return;
    }
    if (item.kind === "manga") {
      setAdaptationStatus({ id: item.id, state: "resolving" });
      const { searchMangaAcrossSources } = await import("@/lib/manga/api");
      const normalizeTitle = (title: string) =>
        title
          .normalize("NFKD")
          .toLocaleLowerCase()
          .replace(/[^\p{L}\p{N}]+/gu, "");
      const queries = [
        item.title,
        ...(item.altTitles ?? []),
        ebook.title,
        ...(ebook.altTitle?.split("|") ?? []),
        ebook.seriesTitle,
      ]
        .map((title) => title?.trim() ?? "")
        .filter(Boolean)
        .filter(
          (title, index, all) =>
            all.findIndex((candidate) => normalizeTitle(candidate) === normalizeTitle(title)) ===
            index,
        )
        .slice(0, 8);
      const results = await Promise.all(
        queries.map((query) => searchMangaAcrossSources(query).catch(() => [])),
      );
      const wanted = new Set(queries.map(normalizeTitle));
      const matches = results.flat();
      const exactMatches = matches.filter(
        (candidate) =>
          wanted.has(normalizeTitle(candidate.title)) ||
          (candidate.altTitle != null && wanted.has(normalizeTitle(candidate.altTitle))),
      );
      const candidates = [
        ...new Map(
          (exactMatches.length ? exactMatches : matches).map((candidate) => [
            candidate.id,
            candidate,
          ]),
        ).values(),
      ].slice(0, 3);
      setAdaptationStatus(null);
      if (candidates.length === 1) {
        openManga(candidates[0].id);
        return;
      }
      if (candidates.length > 1) {
        setAdaptationChoices({ title: item.title, items: candidates });
      }
      return;
    }
    if (item.siteUrl) await openUrl(item.siteUrl);
  };

  return (
    <section className="pt-12">
      <h3 className="mb-6 text-[22px] font-medium tracking-tight text-ink">{t("Information")}</h3>
      <dl className="grid grid-cols-1 gap-x-12 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-col gap-1.5">
            <dt className="text-[12px] font-medium uppercase tracking-[0.18em] text-ink-subtle">
              {row.label}
            </dt>
            <dd className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[14.5px] text-ink">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-10 border-t border-border/60 pt-8">
        <h4 className="text-[12px] font-medium uppercase tracking-[0.18em] text-ink-subtle">
          {t("Adaptations")}
        </h4>
        {adaptations === null ? (
          <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {[0, 1, 2, 3, 4, 5].map((key) => (
              <div key={key}>
                <div className="aspect-[2/3] animate-pulse rounded-xl bg-surface-2" />
                <div className="mt-3 h-3.5 w-4/5 animate-pulse rounded-full bg-surface-2" />
                <div className="mt-2 h-3 w-2/5 animate-pulse rounded-full bg-surface-2" />
              </div>
            ))}
          </div>
        ) : adaptationItems.length ? (
          <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {adaptationItems.map((item) => {
              const itemStatus = adaptationStatus?.id === item.id ? adaptationStatus.state : null;
              const adaptationKind =
                item.kind === "liveAction"
                  ? t("Live action")
                  : item.kind === "anime"
                    ? t("Anime")
                    : t("Manga");
              const details = [
                adaptationKind,
                item.format?.replaceAll("_", " "),
                item.year ? String(item.year) : undefined,
                item.seasons ? t("{count} seasons", { count: item.seasons }) : undefined,
              ].filter(Boolean);
              return (
                <button
                  key={`${item.kind}:${item.id}`}
                  type="button"
                  onClick={() => void openAdaptation(item)}
                  disabled={itemStatus === "resolving"}
                  aria-busy={itemStatus === "resolving"}
                  aria-label={t("Open {type} adaptation: {title}", {
                    type: adaptationKind,
                    title: item.title,
                  })}
                  className="group min-w-0 text-left outline-none disabled:cursor-wait"
                >
                  <span className="relative flex aspect-[2/3] w-full items-center justify-center overflow-hidden rounded-xl bg-surface-2 shadow-[0_14px_34px_rgba(0,0,0,0.22)] ring-1 ring-white/8 transition duration-300 ease-out group-hover:-translate-y-1.5 group-hover:shadow-[0_20px_44px_rgba(0,0,0,0.34)] group-hover:ring-accent/45 group-focus-visible:ring-2 group-focus-visible:ring-accent">
                    {item.poster ? (
                      <img
                        src={item.poster}
                        alt={t("{title} adaptation poster", { title: item.title })}
                        className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.025]"
                        loading="lazy"
                      />
                    ) : (
                      <BookOpen className="h-8 w-8 text-ink-subtle" aria-hidden />
                    )}
                    <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-3 pb-3 pt-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/85">
                        {t("View {type}", { type: adaptationKind })}
                      </span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-white" aria-hidden />
                    </span>
                    {itemStatus === "resolving" && (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/55 backdrop-blur-[2px]">
                        <Loader2 className="h-6 w-6 animate-spin text-white" aria-hidden />
                      </span>
                    )}
                  </span>
                  <span className="mt-3 block min-w-0 px-0.5">
                    <span className="line-clamp-2 text-[14px] font-semibold leading-snug text-ink transition-colors group-hover:text-accent">
                      {item.title}
                    </span>
                    <span className="mt-1.5 block truncate text-[11.5px] text-ink-subtle">
                      {details.join(" · ")}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 text-[14px] text-ink-subtle">{t("No adaptations found.")}</p>
        )}
      </div>
      {adaptationChoices && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-6 backdrop-blur-md"
          role="presentation"
          onClick={() => setAdaptationChoices(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ebook-adaptation-picker-title"
            className="w-full max-w-3xl rounded-[28px] border border-white/10 bg-surface p-6 shadow-2xl sm:p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
                  {t("Manga adaptation")}
                </p>
                <h5
                  id="ebook-adaptation-picker-title"
                  className="mt-2 text-xl font-semibold text-ink"
                >
                  {t("Best Match for {title}", { title: adaptationChoices.title })}
                </h5>
              </div>
              <button
                type="button"
                onClick={() => setAdaptationChoices(null)}
                aria-label={t("Close Manga selection")}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-ink-muted transition hover:bg-white/10 hover:text-ink"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-3">
              {adaptationChoices.items.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  onClick={() => {
                    setAdaptationChoices(null);
                    openManga(choice.id);
                  }}
                  className="group min-w-0 text-left outline-none"
                >
                  <span className="flex aspect-[2/3] w-full items-center justify-center overflow-hidden rounded-2xl bg-surface-2 ring-1 ring-white/10 transition duration-200 group-hover:-translate-y-1 group-hover:ring-accent/60 group-focus-visible:ring-2 group-focus-visible:ring-accent">
                    {choice.cover ? (
                      <img
                        src={choice.cover}
                        alt={t("{title} poster", { title: choice.title })}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <BookOpen className="h-9 w-9 text-ink-subtle" aria-hidden />
                    )}
                  </span>
                  <span className="mt-3 block line-clamp-2 text-[14px] font-semibold leading-snug text-ink transition-colors group-hover:text-accent">
                    {choice.title}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function EBookDetails({
  ebook,
  sourceCandidates,
  onSourcesResolved,
  profile,
  autoRead,
  onAutoReadConsumed,
  onBack,
  onOpen,
}: {
  ebook: EBook | null;
  sourceCandidates: EBook[];
  onSourcesResolved: (books: EBook[]) => void;
  profile: string;
  autoRead: boolean;
  onAutoReadConsumed: () => void;
  onBack: () => void;
  onOpen: (ebook: EBook) => void;
}) {
  const detailBestsellers = useNytList();
  const detailSnapshot = useNytSnapshot();
  const detailRank = ebook
    ? (nytRankFor(detailBestsellers, ebook) ?? nytBestsellerFor(detailSnapshot, ebook)?.book ?? null)
    : null;
  const t = useT();
  const [saved, setSaved] = useState(() => (ebook ? ebookInLibrary(ebook.id) : false));
  const [favorite, setFavorite] = useState(() => (ebook ? ebookIsFavorite(ebook.id) : false));
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [descriptionClipped, setDescriptionClipped] = useState(false);
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const detailScrollRef = useRef<HTMLElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [authorBooks, setAuthorBooks] = useState<EBook[] | null>(null);
  const [recommendations, setRecommendations] = useState<EBook[] | null>(null);
  const [recommendationsError, setRecommendationsError] = useState(false);
  const [recommendationsAttempt, setRecommendationsAttempt] = useState(0);
  const [chapters, setChapters] = useState<EBookChapter[] | null>(null);
  const [sourceOptions, setSourceOptions] = useState<EBook[]>([]);
  const [sourceRoute, setSourceRoute] = useState<string | null>(null);
  const [selectedVolume, setSelectedVolume] = useState<string | null>(null);
  const [resolvingSource, setResolvingSource] = useState(false);
  const [reading, setReading] = useState<{
    chapter: EBookChapter;
    content: EBookChapterContent | null;
    error?: string;
  } | null>(null);
  const ebookId = ebook?.id;
  const readStatus = useEBookReadStatus(ebook, profile);
  const sourceKey = (ebook?.books ?? (ebook ? [ebook] : []))
    .filter((book) => book.source === "source")
    .map((book) => book.id)
    .join("\0");
  const sourceAliasKey = [
    ...(ebook?.sourceAliases ?? []),
    ...(ebook?.verifiedAliases ?? []),
    ...(ebook?.altTitle?.split("|") ?? []),
  ].join("\0");
  const genreKey = ebook?.genres.join("\0");
  const authorKey = ebook?.authors.join("\0");
  const sourceCandidateKey = sourceCandidates
    .map((book) => book.id)
    .sort()
    .join("\0");
  useEffect(() => {
    const element = detailScrollRef.current;
    if (!element) return;
    const update = () => setShowScrollTop(element.scrollTop > 600);
    update();
    element.addEventListener("scroll", update, { passive: true });
    return () => element.removeEventListener("scroll", update);
  }, [ebookId]);
  useEffect(() => setSaved(ebookId ? ebookInLibrary(ebookId) : false), [ebookId]);
  useEffect(() => setFavorite(ebookId ? ebookIsFavorite(ebookId) : false), [ebookId]);
  useEffect(() => {
    setDescriptionExpanded(false);
    setDescriptionClipped(false);
  }, [ebookId]);
  useEffect(() => {
    const element = descriptionRef.current;
    if (!element || descriptionExpanded) return;
    const measure = () => setDescriptionClipped(element.scrollHeight > element.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [descriptionExpanded, ebook?.description, ebookId]);
  useEffect(() => {
    if (!ebook || !ebook.authors.length) {
      setAuthorBooks([]);
      return;
    }
    let active = true;
    setAuthorBooks(null);
    const authors = ebook.authors.slice(0, 2);
    void (async () => {
      const sourceResults = (
        await Promise.all(authors.map((author) => searchSourceEBookCatalog(author, "all")))
      ).flat();
      const sourceMatches = booksBySameAuthor(ebook, sourceResults);
      if (sourceMatches.length) return sourceMatches;
      const metadataResults = (
        await Promise.all(authors.map((author) => searchEBooks(author).catch(() => [])))
      ).flat();
      return booksBySameAuthor(ebook, metadataResults);
    })()
      .then((items) => {
        if (active) setAuthorBooks(items.slice(0, 18));
      })
      .catch(() => {
        if (active) setAuthorBooks([]);
      });
    return () => {
      active = false;
    };
  }, [authorKey, ebookId]);
  useEffect(() => {
    if (!ebook) return;
    let active = true;
    setRecommendations(null);
    setRecommendationsError(false);
    const normalizeTitle = (value: string) =>
      value
        .normalize("NFKD")
        .toLocaleLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim();
    const currentTitles = new Set(
      [
        ebook.title,
        ebook.altTitle,
        ...(ebook.books ?? []).flatMap((book) => [book.title, book.altTitle]),
      ]
        .filter((title): title is string => Boolean(title))
        .map(normalizeTitle),
    );
    const normalizeGenre = (value: string) =>
      value
        .normalize("NFKD")
        .toLocaleLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim();
    const currentGenres = ebook.genres.map(normalizeGenre).filter(Boolean);
    const genreScore = (item: EBook) => {
      const candidateGenres = item.genres.map(normalizeGenre).filter(Boolean);
      return currentGenres.reduce(
        (score, genre) =>
          score +
          Number(
            candidateGenres.some(
              (candidate) =>
                candidate === genre || candidate.includes(genre) || genre.includes(candidate),
            ),
          ),
        0,
      );
    };
    const sourceRecommendations = (items: EBook[]) => {
      const seen = new Set<string>();
      return items
        .filter((item) => {
          const title = normalizeTitle(item.title);
          if (item.id === ebook.id || currentTitles.has(title)) return false;
          const key = `${item.source}:${item.id}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((item) => ({ item, score: genreScore(item) }))
        .filter(({ score }) => score > 0)
        .sort((left, right) => right.score - left.score)
        .map(({ item }) => item)
        .slice(0, 18);
    };
    void loadSourceEBookPage(undefined, "all")
      .then(async (page) => {
        const sourceItems = sourceRecommendations(page.items);
        if (active && sourceItems.length) setRecommendations(sourceItems);
        const enriched = await page.enriched.catch(() => page.items);
        if (active) setRecommendations(sourceRecommendations(enriched));
      })
      .catch(() => {
        if (!active) return;
        setRecommendations([]);
        setRecommendationsError(true);
      });
    return () => {
      active = false;
    };
  }, [ebookId, genreKey, recommendationsAttempt]);
  useEffect(() => {
    setReading(null);
  }, [ebookId]);
  useEffect(() => {
    if (!ebook) return;
    let active = true;
    const existing = (ebook.books ?? [ebook]).filter((book) => book.source === "source");
    setSourceOptions(existing);
    setSourceRoute(existing[0]?.id ?? null);
    setResolvingSource(existing.length === 0);
    const queries = [
      ebook.title,
      ...(ebook.sourceAliases ?? []),
      ...(ebook.verifiedAliases ?? []),
      ...(ebook.altTitle?.split("|") ?? []),
    ]
      .map((title) => title.trim())
      .filter(Boolean);
    const normalizedAuthors = new Set(
      ebook.authors
        .map((author) => author.normalize("NFKD").toLocaleLowerCase().trim())
        .filter(Boolean),
    );
    const hasArabic = (value: string) => /\p{Script=Arabic}/u.test(value);
    const ebookIsArabic = hasArabic(ebook.title);
    void Promise.all(
      [...new Set(queries)].slice(0, 6).map((query) => searchSourceEBookCatalog(query, "all")),
    )
      .then(async (results) => {
        if (!active) return;
        const searched = results.flat().flatMap((item) => item.books ?? [item]);
        const candidates = [...existing, ...searched, ...sourceCandidates];
        const uniqueCandidates = [...new Map(candidates.map((item) => [item.id, item])).values()];
        const promising = uniqueCandidates
          .filter((candidate) => {
            if (existing.some((book) => book.id === candidate.id) || eBooksMatch(candidate, ebook))
              return true;
            const sharesAuthor = candidate.authors.some((author) =>
              normalizedAuthors.has(author.normalize("NFKD").toLocaleLowerCase().trim()),
            );
            return sharesAuthor || hasArabic(candidate.title) !== ebookIsArabic;
          })
          .slice(0, 32);
        const hydrated = await Promise.all(
          promising.map((candidate) =>
            sourceEBookDetail(candidate.id)
              .then((detail) => detail ?? candidate)
              .catch(() => candidate),
          ),
        );
        if (!active) return;
        const resolvedCandidates = [...uniqueCandidates, ...hydrated];
        const matches = dedupeEBooks(resolvedCandidates)
          .filter(
            (item) =>
              eBooksMatch(item, ebook) || item.books?.some((book) => eBooksMatch(book, ebook)),
          )
          .flatMap((item) => item.books ?? [item]);
        const uniqueMatches = [...new Map(matches.map((item) => [item.id, item])).values()];
        setSourceOptions(uniqueMatches);
        setSourceRoute((current) =>
          current && uniqueMatches.some((item) => item.id === current)
            ? current
            : (uniqueMatches[0]?.id ?? null),
        );
        const currentIds = new Set(existing.map((item) => item.id));
        if (uniqueMatches.some((item) => !currentIds.has(item.id)))
          onSourcesResolved(uniqueMatches);
      })
      .catch(() => {})
      .finally(() => active && setResolvingSource(false));
    return () => {
      active = false;
    };
  }, [ebookId, ebook?.source, ebook?.title, sourceAliasKey, sourceKey, sourceCandidateKey]);
  useEffect(() => {
    let active = true;
    if (!sourceRoute) {
      setSelectedVolume(null);
      setChapters(null);
      return;
    }
    setSelectedVolume(null);
    setChapters(null);
    void sourceEBookChapters(sourceRoute)
      .then((items) => active && setChapters(items))
      .catch(() => active && setChapters([]));
    return () => {
      active = false;
    };
  }, [sourceRoute]);
  const volumeGroups = useMemo(() => {
    const groups = new Map<string, { title?: string; chapters: EBookChapter[] }>();
    for (const chapter of chapters ?? []) {
      const volume = chapter.volume?.trim() ?? "";
      const group = groups.get(volume) ?? { chapters: [] };
      groups.set(volume, {
        title: group.title ?? (chapter.volumeTitle?.trim() || undefined),
        chapters: [...group.chapters, chapter],
      });
    }
    return [...groups]
      .map(([volume, group]) => {
        const number = labelNumber(volume);
        const base = number === undefined ? volume || "Chapters" : `Volume ${number}`;
        return {
          volume,
          label: group.title || base,
          number,
          chapters: group.chapters,
        };
      })
      .sort((left, right) => {
        if (!left.volume) return 1;
        if (!right.volume) return -1;
        if (left.number !== undefined && right.number !== undefined)
          return left.number - right.number;
        return left.volume.localeCompare(right.volume, undefined, {
          numeric: true,
          sensitivity: "base",
        });
      });
  }, [chapters]);
  useEffect(() => {
    if (selectedVolume !== null && !volumeGroups.some((group) => group.volume === selectedVolume))
      setSelectedVolume(null);
  }, [selectedVolume, volumeGroups]);
  const readChapter = useCallback(
    (chapter: EBookChapter) => {
      if (!sourceRoute || !ebook) return;
      saveEBookResume(profile, ebook.id, {
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        chapterLabel: chapter.chapter,
        volumeLabel:
          chapter.volumeTitle || (chapter.volume ? `Volume ${chapter.volume}` : undefined),
      });
      setReading({ chapter, content: null });
      void sourceEBookContent(sourceRoute, chapter.id, chapter.title)
        .then((content) => {
          setReading((current) =>
            current?.chapter.id === chapter.id ? { chapter, content } : current,
          );
          const position = chapters?.findIndex((item) => item.id === chapter.id) ?? -1;
          const next = position >= 0 ? chapters?.[position + 1] : undefined;
          if (next) {
            const prefetch = () =>
              void prefetchSourceEBookContent(sourceRoute, next.id).catch(() => undefined);
            const idle = window as typeof window & {
              requestIdleCallback?: (
                callback: () => void,
                options?: { timeout?: number },
              ) => number;
            };
            if (idle.requestIdleCallback) idle.requestIdleCallback(prefetch, { timeout: 3_000 });
            else window.setTimeout(prefetch, 1_000);
          }
        })
        .catch(() =>
          setReading((current) =>
            current?.chapter.id === chapter.id
              ? { chapter, content: {}, error: "This chapter could not be loaded." }
              : current,
          ),
        );
    },
    [chapters, ebook, profile, sourceRoute],
  );
  useEffect(() => {
    if (!autoRead || !ebook || chapters === null || !sourceRoute) return;
    if (!chapters.length) {
      onAutoReadConsumed();
      return;
    }
    const resume = loadEBookResume(profile, ebook.id);
    const target =
      chapters.find((chapter) => chapter.id === resume?.chapterId) ??
      [...chapters].sort(
        (left, right) =>
          (left.position ?? Number.MAX_SAFE_INTEGER) - (right.position ?? Number.MAX_SAFE_INTEGER),
      )[0];
    onAutoReadConsumed();
    if (target) readChapter(target);
  }, [autoRead, chapters, ebook, onAutoReadConsumed, profile, readChapter, sourceRoute]);
  if (!ebook)
    return (
      <div className="flex flex-1 items-center justify-center text-ink-muted">
        {t("Loading eBook…")}
      </div>
    );
  const facts = [
    ebook.year,
    ebook.status,
    ebook.volumes ? t("{count} volumes", { count: ebook.volumes }) : null,
    ebook.chapters ? t("{count} chapters", { count: ebook.chapters }) : null,
  ].filter(Boolean);
  return (
    <main
      data-ebook-page
      ref={detailScrollRef}
      className="relative flex-1 overflow-y-auto overflow-x-hidden px-12 pb-20 pt-24"
    >
      <div className="flex flex-col gap-10 pb-4">
        <div className="relative -mx-12 -mt-24 min-h-[360px] overflow-hidden">
          <div className="absolute inset-0 z-0">
            {(ebook.banner || ebook.cover) && (
              <img
                src={ebook.banner || ebook.cover}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                style={
                  ebook.banner
                    ? { objectPosition: "50% 22%" }
                    : { filter: "blur(28px)", transform: "scale(1.18)", objectPosition: "50% 25%" }
                }
              />
            )}
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-r from-[var(--color-canvas)] from-0% via-[color-mix(in_oklch,var(--color-canvas),transparent_45%)] via-55% to-[color-mix(in_oklch,var(--color-canvas),transparent_88%)] to-100%"
            />
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-[70%]"
              style={{
                background:
                  "linear-gradient(to top, var(--color-canvas), color-mix(in oklch, var(--color-canvas), transparent 55%) 45%, transparent)",
              }}
            />
          </div>
          <div className="relative z-10 px-12 pt-24 pb-8">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 rounded-full border border-edge-soft bg-canvas/40 px-4 py-2 text-[14px] text-ink-muted backdrop-blur-sm transition-colors hover:bg-elevated hover:text-ink"
            >
              <ChevronLeft size={18} /> {t("Back")}
            </button>
            <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-end">
              <div className="w-52 shrink-0 sm:self-start">
                <div className="ebook-details-book-cover">
                  <div className="ebook-details-book-rear" aria-hidden="true" />
                  <div className="ebook-details-book-pages" aria-hidden="true" />
                  <Poster
                    src={ebook.cover}
                    seed={`ebook:${ebook.id}`}
                    ratio="portrait"
                    className="ebook-details-book-poster"
                  />
                  <span className="ebook-details-book-spine" aria-hidden="true" />
                  {readStatus && <EBookReadMark status={readStatus} />}
                </div>
              </div>
              <div className="flex min-w-0 flex-1 flex-col items-start gap-4">
                <div className="flex flex-col gap-1.5">
                  <h1
                    className="text-[40px] font-medium leading-[1.05] tracking-tight text-ink drop-shadow-[0_2px_18px_rgba(0,0,0,0.5)]"
                    style={{ fontFamily: "var(--font-book)" }}
                  >
                    {ebook.title}
                  </h1>
                  {ebook.altTitle && ebook.altTitle !== ebook.title && (
                    <p className="text-[16px] text-ink-muted">{ebook.altTitle}</p>
                  )}
                  {ebook.authors.length > 0 && (
                    <p className="text-[14px] text-ink-muted">
                      {t("by {authors}", { authors: ebook.authors.join(", ") })}
                    </p>
                  )}
                </div>
                {detailRank && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-accent-soft px-3 py-1 text-[13px] font-semibold text-accent ring-1 ring-inset ring-accent/25">
                      {`#${detailRank.rank} New York Times Bestseller`}
                    </span>
                    {detailRank.weeksOnList > 0 && (
                      <span className="rounded-full bg-elevated/60 px-3 py-1 text-[13px] text-ink-muted ring-1 ring-edge-soft backdrop-blur-sm">
                        {detailRank.weeksOnList === 1
                          ? "1 week on the list"
                          : `${detailRank.weeksOnList} weeks on the list`}
                      </span>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {facts.map((fact) => (
                    <span
                      key={String(fact)}
                      className="rounded-full bg-elevated/60 px-3 py-1 text-[13px] capitalize text-ink-muted ring-1 ring-edge-soft backdrop-blur-sm"
                    >
                      {fact}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {ebook.genres.map((genre) => (
                    <span
                      key={genre}
                      className="rounded-full bg-elevated/60 px-3 py-1 text-[12px] text-ink-muted ring-1 ring-edge-soft backdrop-blur-sm"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const next = toggleEBookLibrary(ebook);
                      setSaved(next);
                    }}
                    className="inline-flex h-12 items-center gap-2.5 rounded-full bg-ink px-7 text-[15px] font-semibold text-canvas transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98]"
                  >
                    {saved ? <Library size={19} /> : <Bookmark size={19} />}
                    {saved ? t("Bookmarked") : t("Bookmark")}
                  </button>
                  {sourceOptions.length > 0 && sourceRoute && (
                    <EBookDetailDropdown
                      options={sourceOptions.map((source) => ({
                        id: source.id,
                        label: source.providerName ?? source.title,
                        icon: ebookProviderIcon(source.providerId),
                      }))}
                      selected={sourceRoute}
                      onSelect={setSourceRoute}
                      buttonLabel={t("Source")}
                    />
                  )}
                  <button
                    type="button"
                    aria-pressed={favorite}
                    aria-label={favorite ? t("Remove favorite") : t("Add favorite")}
                    onClick={() => setFavorite(toggleEBookFavorite(ebook))}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-ink transition-[transform,background-color] duration-200 hover:bg-white/[0.10] active:scale-[0.94]"
                  >
                    <Heart
                      size={21}
                      fill={favorite ? "currentColor" : "none"}
                      className={favorite ? "text-accent" : "text-ink"}
                    />
                  </button>
                  {ebook.siteUrl && (
                    <button
                      type="button"
                      aria-label={t("Open in {provider}", {
                        provider: ebook.source === "anilist" ? "AniList" : "Open Library",
                      })}
                      title={ebook.source === "anilist" ? "AniList" : "Open Library"}
                      onClick={() => openUrl(ebook.siteUrl!)}
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-ink transition-[transform,background-color] duration-200 hover:bg-white/[0.10] active:scale-[0.94]"
                    >
                      <ExternalLink size={21} />
                    </button>
                  )}
                </div>
                <div className="max-w-3xl">
                  <p
                    ref={descriptionRef}
                    className={`whitespace-pre-line text-[15px] leading-relaxed text-ink-muted ${descriptionExpanded ? "" : "line-clamp-4"}`}
                  >
                    {ebook.description || t("No description is available for this eBook.")}
                  </p>
                  {(descriptionClipped || descriptionExpanded) && (
                    <button
                      type="button"
                      aria-expanded={descriptionExpanded}
                      onClick={() => setDescriptionExpanded((expanded) => !expanded)}
                      className="mt-2 text-[13px] font-semibold text-ink transition-colors hover:text-accent"
                    >
                      {descriptionExpanded ? t("Show less") : t("Show more")}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-10">
          {(resolvingSource || sourceRoute) && (
            <EBookChapterSection
              chapters={chapters}
              loading={resolvingSource}
              volumeGroups={volumeGroups}
              selectedVolume={selectedVolume}
              onSelectVolume={setSelectedVolume}
              sourceRoute={sourceRoute}
              onRead={readChapter}
            />
          )}
          {(ebook.books?.length ?? 0) > 1 && (
            <section className="flex w-fit max-w-full items-center gap-4 rounded-xl bg-elevated/40 p-3 ring-1 ring-edge-soft">
              <div className="shrink-0 px-1">
                <h2 className="text-[13.5px] font-semibold text-ink">{t("Available sources")}</h2>
                <p className="text-[11.5px] text-ink-subtle">{t("Read from")}</p>
              </div>
              <div className="flex min-w-0 items-center gap-2.5 overflow-x-auto py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {ebook.books!.map((book) => (
                  <div
                    key={book.id}
                    className={`flex w-[248px] shrink-0 items-center gap-3 rounded-lg p-2.5 ring-1 ring-inset transition-colors ${
                      sourceRoute === book.id
                        ? "bg-elevated ring-accent/45"
                        : "bg-surface ring-edge-soft hover:bg-elevated"
                    }`}
                  >
                    <span className="w-12 shrink-0 overflow-hidden rounded ring-1 ring-inset ring-edge-soft">
                      <Poster src={book.cover} seed={`ebook-book:${book.id}`} ratio="portrait" />
                    </span>
                    <button
                      type="button"
                      onClick={() => book.source === "source" && setSourceRoute(book.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate text-[13px] font-semibold text-ink">
                        {book.providerName ?? book.title}
                      </span>
                      <span className="mt-0.5 block line-clamp-2 text-[11.5px] leading-snug text-ink-subtle">
                        {book.title}
                      </span>
                    </button>
                    {book.siteUrl && (
                      <button
                        type="button"
                        aria-label={t("Open {title}", { title: book.title })}
                        onClick={() => openUrl(book.siteUrl!)}
                        className="grid size-6 shrink-0 place-items-center rounded-full text-ink-subtle hover:bg-elevated hover:text-ink"
                      >
                        <ExternalLink size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
          {ebook.authors[0] && (
            <EBookRail
              title={t("More by {author}", { author: ebook.authors[0] })}
              subtitle={t("Other titles from the same author")}
              items={authorBooks}
              onOpen={onOpen}
              hideEmpty
            />
          )}
          {recommendationsError ? (
            <section className="flex items-center justify-between gap-4 rounded-2xl border border-edge-soft bg-elevated/25 px-5 py-4">
              <div>
                <h2 className="text-[18px] font-semibold text-ink">{t("Recommended eBooks")}</h2>
                <p className="text-[13px] text-ink-subtle">
                  {t("Recommendations are temporarily unavailable.")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRecommendationsAttempt((attempt) => attempt + 1)}
                className="rounded-full border border-edge-soft bg-canvas/50 px-4 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-elevated"
              >
                {t("Retry")}
              </button>
            </section>
          ) : (
            <EBookRail
              title={t("Recommended eBooks")}
              subtitle={t("Same-genre picks from your installed sources")}
              items={recommendations}
              onOpen={onOpen}
              hideEmpty
            />
          )}
          <EBookInformation ebook={ebook} />
        </div>
      </div>
      {reading && (
        <EBookReader
          key={reading.chapter.id}
          bookId={ebook.id}
          bookTitle={ebook.title}
          bookCover={ebook.cover}
          internalCover={ebook.internalCover}
          chapter={reading.chapter}
          content={reading.content}
          error={
            reading.error === "This chapter could not be loaded."
              ? t("This chapter could not be loaded.")
              : reading.error
          }
          volumes={
            volumeGroups.length
              ? volumeGroups.map((group) => ({
                  ...group,
                  label:
                    group.number !== undefined && group.label === `Volume ${group.number}`
                      ? t("Volume {number}", { number: group.number })
                      : group.volume
                        ? group.label
                        : t("Chapters"),
                }))
              : [{ volume: "", label: t("Chapters"), chapters: chapters ?? [reading.chapter] }]
          }
          onSelectChapter={readChapter}
          onClose={() => setReading(null)}
        />
      )}
      {showScrollTop && !reading && (
        <div className="animate-in fade-in slide-in-from-bottom-3 fixed bottom-7 end-7 z-[60]">
          <button
            type="button"
            onClick={() => detailScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
            aria-label={t("Scroll to top")}
            className="flex h-14 items-center gap-2.5 rounded-full bg-accent px-6 text-canvas shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)] transition-transform duration-200 hover:scale-[1.03] active:scale-[0.97]"
          >
            <ArrowUp size={24} strokeWidth={2.6} />
            <span className="text-[16px] font-bold">{t("Top")}</span>
          </button>
        </div>
      )}
    </main>
  );
}
