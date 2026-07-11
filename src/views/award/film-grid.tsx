import { PickCard } from "@/components/pick-card";
import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, type RefObject } from "react";

const GRID = "grid grid-cols-3 gap-x-4 gap-y-8 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6";
const PREVIEW = 18;

export function FilmGrid({
  films,
  total,
  loading,
  loadingMore,
  expanded,
  done,
  onViewAll,
  onLoadMore,
  scrollRoot,
  tint,
}: {
  films: Meta[];
  total: number;
  loading: boolean;
  loadingMore: boolean;
  expanded: boolean;
  done: boolean;
  onViewAll: () => void;
  onLoadMore: () => void;
  scrollRoot: RefObject<HTMLElement | null>;
  tint: string;
}) {
  const t = useT();
  const skeleton = loading && films.length === 0;
  if (!skeleton && films.length === 0) return null;
  const shown = expanded ? films : films.slice(0, PREVIEW);
  const canViewAll = !expanded && total > PREVIEW && films.length > 0;
  return (
    <section className="flex flex-col gap-7">
      <Header title={t("Winning films & shows")} count={skeleton ? null : total} tint={tint} />
      <div className={GRID}>
        {skeleton
          ? Array.from({ length: PREVIEW }).map((_, i) => <PosterSkeleton key={i} />)
          : shown.map((m) => <PickCard key={m.id} meta={m} />)}
        {expanded && loadingMore && Array.from({ length: 6 }).map((_, i) => <PosterSkeleton key={`m${i}`} />)}
      </div>

      {canViewAll && (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={onViewAll}
            className="group flex items-center gap-2 rounded-full border border-edge-soft bg-elevated/50 px-5 py-2.5 text-[13.5px] font-semibold text-ink transition-colors hover:bg-elevated"
          >
            {t("View all {n} winners", { n: total })}
            <ChevronDown
              size={15}
              strokeWidth={2.4}
              className="transition-transform duration-200 group-hover:translate-y-0.5"
              style={{ color: tint }}
            />
          </button>
        </div>
      )}

      {expanded && !done && <LoadMoreSentinel onLoadMore={onLoadMore} scrollRoot={scrollRoot} />}
    </section>
  );
}

function LoadMoreSentinel({
  onLoadMore,
  scrollRoot,
}: {
  onLoadMore: () => void;
  scrollRoot: RefObject<HTMLElement | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onLoadMore);
  cb.current = onLoadMore;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) cb.current();
      },
      { root: scrollRoot.current ?? null, rootMargin: "800px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [scrollRoot]);
  return <div ref={ref} aria-hidden className="h-1 w-full" />;
}

function PosterSkeleton() {
  return <div className="aspect-[2/3] animate-pulse rounded-xl bg-elevated/40" />;
}

export function Header({ title, count, tint }: { title: string; count: number | null; tint: string }) {
  const t = useT();
  return (
    <div className="flex items-baseline justify-between gap-4">
      <h2 className="flex items-center gap-3 font-display text-[30px] font-medium leading-tight tracking-tight text-ink">
        <span aria-hidden className="h-7 w-1 rounded-full" style={{ backgroundColor: tint }} />
        {title}
      </h2>
      {count != null && count > 0 && (
        <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
          {count === 1 ? t("{n} title", { n: count }) : t("{n} titles", { n: count })}
        </span>
      )}
    </div>
  );
}
