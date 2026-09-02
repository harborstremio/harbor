import { BookCheck, ChevronDown, Clock3, Loader2, Sparkles } from "lucide-react";
import { Search } from "@/components/icons/search-icon";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { Row } from "@/components/row";
import {
  MANGA_PAGE,
  popularManga,
  popularMangaStream,
  searchManga,
  searchMangaStream,
  type MangaSummary,
} from "@/lib/manga/api";
import { useMangaFavorites } from "@/lib/manga-favorites";
import { activeMangaSource, activeMangaSourceId, subscribeMangaSources } from "@/lib/manga/sources";
import {
  FAVORITES,
  ManageServersButton,
  SourceDropdown,
  TagDropdown,
} from "./manga-browse/filters";
import { BrowseEmpty, BrowseError, SkeletonGrid } from "./manga-browse/states";
import { AllExtensionsView, sourceDisplayName } from "./manga-browse/all-extensions";
import { searchExtensions } from "./manga-browse/extensions-search";
import { LanguageDropdown } from "./manga-browse/language-dropdown";
import {
  cachedSuwayomiSources,
  langFilterMatches,
  loadMangaLangFilter,
  subscribeMangaLangFilter,
} from "./manga-browse/langs";
import { MangaCard } from "./manga-browse/manga-card";

type Status = "loading" | "ready" | "error";
type SortMode = "latest" | "new" | "chapters";
type StatusFilter = "all" | "completed" | "ongoing";

const GRID = "repeat(auto-fill, minmax(150px, 1fr))";
type SearchResultGroup = { sourceId: string; name: string; items: MangaSummary[] };

export function MangaBrowse({
  onOpen,
  onManageSources,
}: {
  onOpen: (mangaId: string) => void;
  onManageSources: () => void;
}) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [tagId, setTagId] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("latest");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const { items: favItems } = useMangaFavorites();
  const [items, setItems] = useState<MangaSummary[]>([]);
  const [searchGroups, setSearchGroups] = useState<SearchResultGroup[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);

  const offsetRef = useRef(0);
  const seenRef = useRef(new Set<string>());
  const reqRef = useRef(0);
  const queryRef = useRef("");
  const tagRef = useRef("");
  queryRef.current = query;
  tagRef.current = tagId;

  const fetchPage = useCallback((offset: number) => {
    const q = queryRef.current.trim();
    const tag = tagRef.current || undefined;
    return q || tagRef.current ? searchManga(q, offset, tag) : popularManga(offset, tag);
  }, []);

  const fetchPageStream = useCallback(
    (offset: number, onChunk: (items: MangaSummary[]) => void) => {
      const q = queryRef.current.trim();
      const tag = tagRef.current || undefined;
      return q || tagRef.current
        ? searchMangaStream(q, offset, tag, onChunk)
        : popularMangaStream(offset, tag, onChunk);
    },
    [],
  );

  const reload = useCallback(() => setReloadTick((n) => n + 1), []);

  const sourceRef = useRef(activeMangaSourceId());
  const activeSource = activeMangaSource();
  const allExtensionsMode = tagId === "" && !query.trim() && activeSource?.kind === "suwayomi";
  const extensionsSearchMode = !!query.trim() && tagId === "" && activeSource?.kind === "suwayomi";

  useEffect(
    () =>
      subscribeMangaLangFilter(() => {
        if (activeMangaSource()?.kind !== "suwayomi") return;
        reload();
      }),
    [reload],
  );

  useEffect(
    () =>
      subscribeMangaSources(() => {
        const id = activeMangaSourceId();
        if (id === sourceRef.current) return;
        sourceRef.current = id;
        reload();
      }),
    [reload],
  );

  useEffect(() => {
    const id = ++reqRef.current;
    if (tagId === FAVORITES) {
      setItems([]);
      offsetRef.current = 0;
      setHasMore(false);
      setStatus("ready");
      return;
    }
    if (allExtensionsMode) {
      setItems([]);
      offsetRef.current = 0;
      setHasMore(false);
      setStatus("ready");
      return;
    }
    if (extensionsSearchMode) {
      setStatus("loading");
      setItems([]);
      setSearchGroups([]);
      offsetRef.current = 0;
      seenRef.current = new Set();
      setHasMore(false);
      const timer = window.setTimeout(() => {
        const config = { baseUrl: activeMangaSource()?.baseUrl ?? "" };
        void cachedSuwayomiSources(config)
          .then((all) => {
            if (id !== reqRef.current) return { okSources: 0, failedSources: 0 };
            const filtered = all.filter((source) =>
              langFilterMatches(loadMangaLangFilter(), source.lang),
            );
            return searchExtensions(
              config,
              filtered,
              query.trim(),
              () => id !== reqRef.current,
              (source, chunk) => {
                if (id !== reqRef.current || chunk.length === 0) return;
                setStatus("ready");
                const fresh = chunk.filter((manga) => !seenRef.current.has(manga.id));
                fresh.forEach((manga) => seenRef.current.add(manga.id));
                if (!fresh.length) return;
                setItems((previous) => [...previous, ...fresh]);
                setSearchGroups((previous) => {
                  const index = previous.findIndex((group) => group.sourceId === source.id);
                  if (index === -1) {
                    return [
                      ...previous,
                      {
                        sourceId: source.id,
                        name: sourceDisplayName(source),
                        items: fresh,
                      },
                    ];
                  }
                  const next = [...previous];
                  next[index] = {
                    ...next[index],
                    items: [...next[index].items, ...fresh],
                  };
                  return next;
                });
              },
            );
          })
          .then(({ okSources }) => {
            if (id !== reqRef.current) return;
            setStatus(okSources > 0 ? "ready" : "error");
          })
          .catch(() => {
            if (id === reqRef.current) setStatus("error");
          });
      }, 350);
      return () => window.clearTimeout(timer);
    }
    setStatus("loading");
    setItems([]);
    offsetRef.current = 0;
    seenRef.current = new Set();
    setHasMore(true);
    const timer = window.setTimeout(
      () => {
        let any = false;
        fetchPageStream(0, (chunk) => {
          if (id !== reqRef.current || chunk.length === 0) return;
          any = true;
          setStatus("ready");
          const fresh = chunk.filter((m) => !seenRef.current.has(m.id));
          fresh.forEach((m) => seenRef.current.add(m.id));
          if (fresh.length) setItems((prev) => [...prev, ...fresh]);
        })
          .then((all) => {
            if (id !== reqRef.current) return;
            offsetRef.current = MANGA_PAGE;
            setHasMore(all.length > 0);
            setStatus("ready");
          })
          .catch(() => {
            if (id !== reqRef.current || any) return;
            setItems([]);
            setHasMore(false);
            setStatus("error");
          });
      },
      query.trim() ? 350 : 0,
    );
    return () => window.clearTimeout(timer);
  }, [query, tagId, reloadTick, fetchPageStream, allExtensionsMode, extensionsSearchMode]);

  useEffect(() => {
    if (status !== "ready" || !hasMore || items.length === 0) return;
    const id = reqRef.current;
    const next = offsetRef.current;
    const timer = window.setTimeout(() => {
      if (id === reqRef.current) void fetchPage(next).catch(() => {});
    }, 600);
    return () => window.clearTimeout(timer);
  }, [status, hasMore, items.length, fetchPage]);

  const displayItems = useMemo(() => {
    let list: MangaSummary[];
    if (tagId === FAVORITES) {
      const qf = query.trim().toLowerCase();
      const favs = [...favItems.values()]
        .sort((a, b) => b.addedAt - a.addedAt)
        .map((e) => ({ id: e.id, title: e.title, cover: e.cover }));
      list = qf ? favs.filter((m) => m.title.toLowerCase().includes(qf)) : favs;
    } else {
      const favs: MangaSummary[] = [];
      const rest: MangaSummary[] = [];
      for (const manga of items) (favItems.has(manga.id) ? favs : rest).push(manga);
      list = favs.length ? [...favs, ...rest] : items;
    }

    if (statusFilter !== "all") {
      list = list.filter((manga) => mangaStatus(manga.status) === statusFilter);
    }
    if (sortMode === "new") {
      return [...list].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
    }
    if (sortMode === "chapters") {
      return [...list].sort((a, b) => chapterNumber(b.lastChapter) - chapterNumber(a.lastChapter));
    }
    return list;
  }, [items, favItems, tagId, query, sortMode, statusFilter]);

  const sortedSearchGroups = useMemo(
    () => [...searchGroups].sort((a, b) => a.name.localeCompare(b.name)),
    [searchGroups],
  );

  const loadMore = useCallback(() => {
    if (loadingMore || status !== "ready" || !hasMore) return;
    const id = reqRef.current;
    setLoadingMore(true);
    fetchPage(offsetRef.current)
      .then((list) => {
        if (id !== reqRef.current) return;
        const fresh = list.filter((m) => !seenRef.current.has(m.id));
        fresh.forEach((m) => seenRef.current.add(m.id));
        if (fresh.length) setItems((prev) => [...prev, ...fresh]);
        offsetRef.current += MANGA_PAGE;
        setHasMore(fresh.length > 0);
        setLoadingMore(false);
      })
      .catch(() => {
        if (id !== reqRef.current) return;
        setHasMore(false);
        setLoadingMore(false);
      });
  }, [loadingMore, status, hasMore, fetchPage]);

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { root: null, rootMargin: "800px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  const emptyKind = tagId === FAVORITES ? "favorites" : query.trim() || tagId ? "search" : "source";

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
        <SourceDropdown />
        <TagDropdown tagId={tagId} onSelect={setTagId} />
        {activeSource?.kind === "suwayomi" && <LanguageDropdown />}
        <ManageServersButton onClick={onManageSources} className="ms-auto me-2" />
      </div>
      <div className="-mt-3 flex flex-wrap items-center gap-2 border-b border-edge-soft/60 pb-4">
        <FilterButton
          active={sortMode === "latest"}
          onClick={() => setSortMode("latest")}
          icon={<Clock3 size={14} />}
          label={t("Latest")}
        />
        <FilterButton
          active={sortMode === "new"}
          onClick={() => setSortMode("new")}
          icon={<Sparkles size={14} />}
          label={t("New releases")}
        />
        <FilterButton
          active={sortMode === "chapters"}
          onClick={() => setSortMode("chapters")}
          icon={<BookCheck size={14} />}
          label={t("Latest chapters")}
        />
        <span className="mx-1 h-5 w-px bg-edge-soft" />
        <FilterButton
          active={statusFilter === "completed"}
          onClick={() => setStatusFilter(statusFilter === "completed" ? "all" : "completed")}
          label={t("Completed")}
        />
        <FilterButton
          active={statusFilter === "ongoing"}
          onClick={() => setStatusFilter(statusFilter === "ongoing" ? "all" : "ongoing")}
          label={t("Ongoing")}
        />
      </div>

      {allExtensionsMode ? (
        <AllExtensionsView key={activeSource?.id ?? ""} onOpen={onOpen} />
      ) : extensionsSearchMode && sortedSearchGroups.length > 0 ? (
        <div className="flex flex-col gap-9">
          {sortedSearchGroups.map((group) => (
            <SearchGroupSection
              key={group.sourceId}
              name={group.name}
              items={group.items}
              onOpen={onOpen}
            />
          ))}
        </div>
      ) : status === "loading" ? (
        <SkeletonGrid />
      ) : status === "error" ? (
        <BrowseError onRetry={reload} onManageSources={onManageSources} />
      ) : displayItems.length === 0 ? (
        <BrowseEmpty kind={emptyKind} onRetry={reload} />
      ) : (
        <>
          <div className="grid gap-x-4 gap-y-7" style={{ gridTemplateColumns: GRID }}>
            {displayItems.map((m) => (
              <MangaCard key={m.id} manga={m} onOpen={onOpen} />
            ))}
          </div>
          <div ref={sentinelRef} className="h-4" />
          {loadingMore && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-ink-subtle motion-reduce:animate-none" />
            </div>
          )}
          {!hasMore && (
            <p className="py-6 text-center text-[12.5px] text-ink-subtle">
              {t("That is everything from this source.")}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function chapterNumber(value?: string): number {
  return Number(value?.match(/\d+(?:\.\d+)?/)?.[0]) || 0;
}

function mangaStatus(value?: string): StatusFilter {
  const status = value?.toLowerCase() ?? "";
  if (/complete|finished|ended/.test(status)) return "completed";
  if (/ongoing|publishing|releasing|serialization/.test(status)) return "ongoing";
  return "all";
}

function FilterButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon?: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-semibold transition-colors ${
        active
          ? "bg-ink text-canvas"
          : "bg-elevated/40 text-ink-muted ring-1 ring-edge-soft/60 hover:bg-elevated hover:text-ink"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function SearchGroupSection({
  name,
  items,
  onOpen,
}: {
  name: string;
  items: MangaSummary[];
  onOpen: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="group flex w-fit items-center gap-1.5"
      >
        <ChevronDown
          size={14}
          strokeWidth={2.2}
          className={`shrink-0 text-ink-subtle transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
        />
        <h3 className="font-medium tracking-tight text-ink transition-colors group-hover:text-ink-muted">
          {name}
        </h3>
      </button>
      <div className={open ? "" : "hidden"}>
        <Row min={140}>
          {items.map((manga) => (
            <MangaCard key={manga.id} manga={manga} onOpen={onOpen} />
          ))}
        </Row>
      </div>
    </section>
  );
}
