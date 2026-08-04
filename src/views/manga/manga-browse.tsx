import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw, Search, Star } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { VirtualGrid } from "@/components/virtual-grid";
import { useT } from "@/lib/i18n";
import { Poster } from "@/components/poster";
import {
  clearMangaCache,
  MANGA_PAGE,
  popularManga,
  searchManga,
  type MangaSummary,
} from "@/lib/manga/api";
import { collapseMangaDuplicates } from "@/lib/manga/dedupe";
import {
  consumeMangaDataChange,
  refreshMangaData,
  subscribeMangaDataChanges,
} from "@/lib/manga/refresh";
import { useIsMangaFavorite, useMangaFavorites } from "@/lib/manga-favorites";
import { activeMangaSourceId, subscribeMangaSources } from "@/lib/manga/sources";
import { queryKeys } from "@/lib/query";
import { FAVORITES, SourceDropdown, TagDropdown } from "./manga-browse/filters";
import { BrowseEmpty, BrowseError, SkeletonGrid } from "./manga-browse/states";
import { CollectionBadges } from "./collection-badge";

export function MangaBrowse({
  onOpen,
  onManageSources,
  scrollRef,
}: {
  onOpen: (mangaId: string) => void;
  onManageSources: () => void;
  scrollRef: RefObject<HTMLElement | null>;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const queryClientRef = useRef(queryClient);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [tagId, setTagId] = useState("");
  const [sourceId, setSourceId] = useState(() => activeMangaSourceId());
  const [refreshing, setRefreshing] = useState(false);
  const sourceRef = useRef(sourceId);
  const refreshJobRef = useRef<Promise<void> | null>(null);
  const { items: favItems } = useMangaFavorites();

  const refresh = useCallback(() => {
    if (refreshJobRef.current) return refreshJobRef.current;
    setRefreshing(true);
    const job = (async () => {
      try {
        await refreshMangaData(queryClientRef.current, clearMangaCache);
      } finally {
        refreshJobRef.current = null;
        setRefreshing(false);
      }
    })();
    refreshJobRef.current = job;
    return job;
  }, []);

  useEffect(() => {
    const next = query.trim();
    const timer = window.setTimeout(() => setDebouncedQuery(next), next ? 350 : 0);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(
    () =>
      subscribeMangaSources(() => {
        const next = activeMangaSourceId();
        if (sourceRef.current === next) return;
        sourceRef.current = next;
        setSourceId(next);
        setTagId("");
      }),
    [],
  );

  useEffect(() => {
    const refreshIfChanged = () => {
      if (refreshJobRef.current || !consumeMangaDataChange()) return;
      void refresh()
        .catch(() => {})
        .finally(refreshIfChanged);
    };
    const unsubscribe = subscribeMangaDataChanges(refreshIfChanged);
    refreshIfChanged();
    return unsubscribe;
  }, [refresh]);

  const favoritesSelected = tagId === FAVORITES;
  const { data, fetchNextPage, hasNextPage, isError, isFetchingNextPage, isPending, refetch } =
    useInfiniteQuery({
      queryKey: queryKeys.manga.browse(sourceId, debouncedQuery, tagId),
      queryFn: ({ pageParam }) => {
        const tag = tagId || undefined;
        return debouncedQuery || tagId
          ? searchManga(debouncedQuery, pageParam, tag)
          : popularManga(pageParam, tag);
      },
      initialPageParam: 0,
      getNextPageParam: (lastPage, _pages, lastPageParam) =>
        lastPage.length > 0 ? lastPageParam + MANGA_PAGE : undefined,
      enabled: !favoritesSelected && !!sourceId,
      staleTime: 30_000,
      refetchOnMount: "always",
    });

  const items = useMemo(() => {
    return collapseMangaDuplicates((data?.pages ?? []).flat());
  }, [data]);

  const displayItems = useMemo(() => {
    if (tagId === FAVORITES) {
      const qf = query.trim().toLowerCase();
      const favs = [...favItems.values()]
        .sort((a, b) => b.addedAt - a.addedAt)
        .map((e) => ({ id: e.id, title: e.title, cover: e.cover }));
      return qf ? favs.filter((m) => m.title.toLowerCase().includes(qf)) : favs;
    }
    if (favItems.size === 0) return items;
    const favs: MangaSummary[] = [];
    const rest: MangaSummary[] = [];
    for (const m of items) (favItems.has(m.id) ? favs : rest).push(m);
    return favs.length ? [...favs, ...rest] : items;
  }, [items, favItems, tagId, query]);

  const loadMore = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { root: scrollRef.current, rootMargin: "800px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore, scrollRef]);

  const emptyKind = tagId === FAVORITES ? "favorites" : query.trim() || tagId ? "search" : "source";
  const reload = useCallback(() => {
    void refetch();
  }, [refetch]);

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-center gap-3 mb-1">
        <div className="relative max-w-sm flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-ink-subtle"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Search manga...")}
            className="w-full rounded-full bg-elevated/40 py-2.5 ps-10 pe-4 text-[13.5px] text-ink placeholder:text-ink-subtle ring-1 ring-edge-soft/60 outline-none focus:ring-edge"
          />
        </div>
        <SourceDropdown onManageSources={onManageSources} />
        <TagDropdown tagId={tagId} onSelect={setTagId} />
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={refreshing}
          title={t("Refresh")}
          aria-label={t("Refresh")}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-edge-soft bg-elevated/40 text-ink-muted shadow-[0_1px_0_rgba(255,255,255,0.03)] transition-colors hover:bg-raised hover:text-ink disabled:cursor-wait disabled:opacity-60"
        >
          <RefreshCw
            size={16}
            className={refreshing ? "animate-spin motion-reduce:animate-none" : undefined}
          />
        </button>
      </div>

      {!favoritesSelected && isPending ? (
        <SkeletonGrid />
      ) : !favoritesSelected && isError ? (
        <BrowseError onRetry={reload} onManageSources={onManageSources} />
      ) : displayItems.length === 0 ? (
        <BrowseEmpty kind={emptyKind} onRetry={reload} />
      ) : (
        <>
          <VirtualGrid
            items={displayItems}
            scrollRef={scrollRef}
            minColumnWidth={150}
            gapX={16}
            gapY={28}
            estimateRowHeight={270}
            getKey={(m) => m.id}
            renderItem={(m) => <MangaCard manga={m} onOpen={onOpen} />}
          />
          <div ref={sentinelRef} className="h-4" />
          {isFetchingNextPage && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-ink-subtle motion-reduce:animate-none" />
            </div>
          )}
          {!hasNextPage && (
            <p className="py-6 text-center text-[12.5px] text-ink-subtle">
              {t("That is everything from this source.")}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function MangaCard({ manga, onOpen }: { manga: MangaSummary; onOpen: (id: string) => void }) {
  const t = useT();
  const fav = useMangaFavorites();
  const isFav = useIsMangaFavorite(manga.id);
  return (
    <button
      type="button"
      onClick={() => onOpen(manga.id)}
      className="group flex w-full min-w-0 flex-col gap-2.5 text-start"
    >
      <div className="relative w-full transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0.24,1)] group-hover:will-change-transform group-hover:[transform:translate3d(0,-0.5rem,0)] motion-reduce:transition-none motion-reduce:group-hover:[transform:none]">
        <Poster
          src={manga.cover}
          seed={manga.id}
          ratio="portrait"
          lazy
          className="harbor-card-ring rounded-xl shadow-[0_2px_8px_-2px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)] transition-[box-shadow] duration-300 group-hover:shadow-[0_24px_48px_-14px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.08)]"
        />
        <span
          role="button"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            fav.toggle({ id: manga.id, title: manga.title, cover: manga.cover });
          }}
          className="absolute start-1.5 top-1.5 rounded-full bg-canvas/70 p-1.5 backdrop-blur-sm transition-transform hover:scale-110 motion-reduce:transition-none motion-reduce:hover:scale-100"
        >
          <Star
            size={15}
            strokeWidth={2.2}
            className={isFav ? "fill-amber-400 text-amber-400" : "text-ink"}
          />
        </span>
        {manga.lastChapter && (
          <span className="pointer-events-none absolute end-1.5 bottom-1.5 rounded-md bg-canvas/90 px-1.5 py-0.5 text-[10.5px] font-bold text-ink ring-1 ring-edge-soft/60 backdrop-blur-sm">
            {t("Ch {n}", { n: manga.lastChapter })}
          </span>
        )}
        <div className="absolute start-1.5 bottom-1.5 flex items-center gap-1">
          <CollectionBadges title={manga.title} size={28} side="top" awardsOnly />
        </div>
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="line-clamp-2 min-h-9 text-[13px] font-medium leading-snug text-ink">
          {manga.title}
        </p>
        {manga.year != null && <p className="text-[12px] text-ink-subtle">{manga.year}</p>}
      </div>
    </button>
  );
}
