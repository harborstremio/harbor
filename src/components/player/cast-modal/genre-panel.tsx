import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { tmdbDiscover } from "@/lib/providers/tmdb/tmdb-catalogs";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  buildDiscoverParams,
  EMPTY_FILTERS,
  genreIdFor,
  initialBrowsePage,
  remapGenre,
  type GenreFilters,
} from "./genre-filter-model";
import { GenreToolbar } from "./genre-toolbar";
import { PosterGrid } from "./rails";
import { resolveImdbScore } from "./use-card-imdb";

function scrollParent(el: HTMLElement | null): HTMLElement | null {
  let p = el?.parentElement ?? null;
  while (p) {
    const oy = getComputedStyle(p).overflowY;
    if (oy === "auto" || oy === "scroll") return p;
    p = p.parentElement;
  }
  return null;
}

export function GenrePanel({
  genreName,
  genreId: genreIdProp,
  mediaType: mediaTypeProp,
  tmdbKey,
  onOpenTitle,
  onActiveGenre,
}: {
  genreName: string;
  genreId?: number;
  mediaType: "movie" | "tv";
  tmdbKey: string | null;
  onOpenTitle: (m: Meta) => void;
  onActiveGenre?: (genreId: number, mediaType: "movie" | "tv") => void;
}) {
  const t = useT();
  const [mediaType, setMediaType] = useState(mediaTypeProp);
  const [genre, setGenre] = useState(() => ({
    name: genreName,
    id: genreIdProp || genreIdFor(genreName, mediaTypeProp),
  }));
  const [filters, setFilters] = useState<GenreFilters>(EMPTY_FILTERS);
  const [items, setItems] = useState<Meta[]>([]);
  const [page, setPage] = useState(() => initialBrowsePage(EMPTY_FILTERS));
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const params = useMemo(() => buildDiscoverParams(genre.id, mediaType, filters), [genre.id, mediaType, filters]);

  useEffect(() => {
    if (genre.id) onActiveGenre?.(genre.id, mediaType);
  }, [genre.id, mediaType, onActiveGenre]);

  useEffect(() => {
    setItems([]);
    setDone(false);
    setPage(initialBrowsePage(filters));
  }, [params, filters]);

  useEffect(() => {
    if (!genre.id || !tmdbKey) {
      setLoading(false);
      setDone(true);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const minRating = Number(filters.minRating);
    const imdbFilter = !!filters.minRating && Number.isFinite(minRating);
    (async () => {
      try {
        const r = await tmdbDiscover(tmdbKey, mediaType, { ...params, page: String(page) });
        if (cancelled) return;
        let passing = r.filter((m) => m.poster);
        if (imdbFilter) {
          const scored = await Promise.all(
            passing.map((m) => resolveImdbScore(m.id, tmdbKey).then((s) => [m, s] as const)),
          );
          if (cancelled) return;
          passing = scored.filter(([, s]) => s != null && s >= minRating).map(([m]) => m);
        }
        setItems((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          return [...prev, ...passing.filter((m) => !seen.has(m.id))];
        });
        if (r.length < 20 || page >= 500) setDone(true);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setLoading(false);
          setDone(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params, page, mediaType, tmdbKey, genre.id, filters.minRating]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || done) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loading) setPage((p) => p + 1);
      },
      { root: scrollParent(el), rootMargin: "400px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [done, loading]);

  const changeMedia = (mt: "movie" | "tv") => {
    if (mt === mediaType) return;
    setMediaType(mt);
    setGenre((g) => remapGenre(g.name, g.id, mt));
  };

  const showInitialSkeleton = loading && items.length === 0;

  return (
    <div className="flex flex-col gap-5 px-6 pb-8 pt-1 sm:px-8">
      <GenreToolbar
        mediaType={mediaType}
        genreName={genre.name}
        filters={filters}
        onMediaType={changeMedia}
        onGenre={(name) => setGenre({ name, id: genreIdFor(name, mediaType) })}
        onFilters={(patch) => setFilters((f) => ({ ...f, ...patch }))}
        onClear={() => setFilters(EMPTY_FILTERS)}
      />

      {showInitialSkeleton ? (
        <div className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4 md:grid-cols-5">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] w-full animate-pulse rounded-xl bg-white/[0.06]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="px-1 text-[13.5px] text-white/50">{t("No titles match these filters.")}</p>
      ) : (
        <>
          <PosterGrid items={items} onOpen={onOpenTitle} />
          {!done && (
            <div ref={sentinelRef} className="flex items-center justify-center py-3">
              <Loader2 size={18} className="animate-spin text-white/40" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
