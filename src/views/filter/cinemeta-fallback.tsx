import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { PickCard } from "@/components/pick-card";
import { type Meta, topMovies, topSeries } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import type { MetaFilter } from "@/lib/view";

const PAGE_SIZE = 100;
const MAX_ITEMS = 600;

export function CinemetaFallback({ filter }: { filter: MetaFilter }) {
  const t = useT();
  const [items, setItems] = useState<Meta[]>([]);
  const [loading, setLoading] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const seenRef = useRef<Set<string>>(new Set());
  const skipRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const genre = filter.kind === "genre" ? filter.name : null;
  const mediaType = filter.mediaType;

  useEffect(() => {
    seenRef.current = new Set();
    skipRef.current = 0;
    setItems([]);
    setExhausted(false);
  }, [genre, mediaType]);

  const loadMore = useCallback(async () => {
    if (loading || exhausted || !genre) return;
    setLoading(true);
    const fetcher = mediaType === "tv" ? topSeries : topMovies;
    try {
      const batch = await fetcher(genre, skipRef.current);
      const fresh = batch.filter((m) => {
        if (!m.poster) return false;
        if (seenRef.current.has(m.id)) return false;
        seenRef.current.add(m.id);
        return true;
      });
      setItems((prev) => [...prev, ...fresh].slice(0, MAX_ITEMS));
      if (batch.length < PAGE_SIZE) {
        setExhausted(true);
      } else {
        skipRef.current += batch.length;
      }
    } catch {
      setExhausted(true);
    } finally {
      setLoading(false);
    }
  }, [exhausted, genre, loading, mediaType]);

  useEffect(() => {
    if (items.length >= MAX_ITEMS) setExhausted(true);
  }, [items.length]);

  useEffect(() => {
    if (items.length === 0 && !loading && !exhausted && genre) {
      void loadMore();
    }
  }, [items.length, loading, exhausted, genre, loadMore]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || exhausted) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "800px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, exhausted, items.length]);

  if (filter.kind !== "genre") {
    return (
      <div className="rounded-2xl border border-dashed border-edge bg-canvas/30 p-8 text-center">
        <p className="text-[14px] font-semibold text-ink">
          {t("Add a TMDB key to browse by this filter.")}
        </p>
        <p className="mt-1 text-[12.5px] text-ink-muted">
          {t(
            "Year, runtime, language, and country filters need TMDB. Genre browsing falls back to Cinemeta automatically.",
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
        {items.map((m) => (
          <PickCard key={m.id} meta={m} />
        ))}
        {items.length === 0 &&
          loading &&
          Array.from({ length: 14 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] w-full animate-pulse rounded-xl bg-elevated/40" />
          ))}
      </div>
      <div ref={sentinelRef} className="h-px w-full" aria-hidden />
      {loading && items.length > 0 && (
        <div className="flex items-center justify-center py-4 text-ink-subtle">
          <Loader2 size={18} className="animate-spin" />
        </div>
      )}
      {exhausted && items.length > 0 && (
        <p className="pt-1 text-center text-[11.5px] text-ink-subtle">
          {t("That's everything Cinemeta has for {genre}. Add a TMDB key for deeper rails.", {
            genre: genre ?? "",
          })}
        </p>
      )}
      {exhausted && items.length === 0 && (
        <p className="rounded-xl border border-dashed border-edge bg-canvas/30 px-5 py-6 text-center text-[12.5px] text-ink-subtle">
          {t(
            "Cinemeta didn't return anything for {genre}. Try a different genre or add a TMDB key.",
            {
              genre: genre ?? "",
            },
          )}
        </p>
      )}
    </div>
  );
}
