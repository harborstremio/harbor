import { BookCheck, Clock3, Loader2, Search, Sparkles, Star } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { Poster } from "@/components/poster";
import {
  MANGA_PAGE,
  popularManga,
  popularMangaStream,
  searchManga,
  searchMangaStream,
  type MangaSummary,
} from "@/lib/manga/api";
import { useIsMangaFavorite, useMangaFavorites } from "@/lib/manga-favorites";
import { activeMangaSourceId, subscribeMangaSources } from "@/lib/manga/sources";
import { FAVORITES, SourceDropdown, TagDropdown } from "./manga-browse/filters";
import { BrowseEmpty, BrowseError, SkeletonGrid } from "./manga-browse/states";
import { CollectionBadges } from "./collection-badge";

type Status = "loading" | "ready" | "error";
type SortMode = "latest" | "new" | "chapters";
type StatusFilter = "all" | "completed" | "ongoing";

const GRID = "repeat(auto-fill, minmax(150px, 1fr))";

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
  }, [query, tagId, reloadTick, fetchPageStream]);

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
      const favs: MangaSummary[] = [], rest: MangaSummary[] = [];
      for (const m of items) (favItems.has(m.id) ? favs : rest).push(m);
      list = favs.length ? [...favs, ...rest] : items;
    }
    if (statusFilter !== "all") list = list.filter((m) => mangaStatus(m.status) === statusFilter);
    if (sortMode === "new") return [...list].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
    if (sortMode === "chapters") return [...list].sort((a, b) => chapterNumber(b.lastChapter) - chapterNumber(a.lastChapter));
    return list;
  }, [items, favItems, tagId, query, sortMode, statusFilter]);

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
        <SourceDropdown onManageSources={onManageSources} />
        <TagDropdown tagId={tagId} onSelect={setTagId} />
      </div>
      <div className="-mt-3 flex flex-wrap items-center gap-2 border-b border-edge-soft/60 pb-4">
        <FilterButton active={sortMode === "latest"} onClick={() => setSortMode("latest")} icon={<Clock3 size={14} />} label={t("Latest")} />
        <FilterButton active={sortMode === "new"} onClick={() => setSortMode("new")} icon={<Sparkles size={14} />} label={t("New releases")} />
        <FilterButton active={sortMode === "chapters"} onClick={() => setSortMode("chapters")} icon={<BookCheck size={14} />} label={t("Latest chapters")} />
        <span className="mx-1 h-5 w-px bg-edge-soft" />
        <FilterButton active={statusFilter === "completed"} onClick={() => setStatusFilter(statusFilter === "completed" ? "all" : "completed")} label={t("Completed")} />
        <FilterButton active={statusFilter === "ongoing"} onClick={() => setStatusFilter(statusFilter === "ongoing" ? "all" : "ongoing")} label={t("Ongoing")} />
      </div>

      {status === "loading" ? (
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

function FilterButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon?: React.ReactNode; label: string }) {
  return <button type="button" onClick={onClick} className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-semibold transition-colors ${active ? "bg-ink text-canvas" : "bg-elevated/40 text-ink-muted ring-1 ring-edge-soft/60 hover:bg-elevated hover:text-ink"}`}>{icon}{label}</button>;
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
