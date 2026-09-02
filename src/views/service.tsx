import { ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { BackToTop } from "@/components/back-to-top";
import { PickCard } from "@/components/pick-card";
import { Row } from "@/components/row";
import { ServiceLogo } from "@/components/service-logo";
import { TopRankCard } from "@/components/top-rank-card";
import { SERVICES } from "@/lib/providers/streaming";
import { CATEGORIES, type Category } from "@/lib/providers/service-catalog";
import { useServiceCatalog } from "@/lib/providers/use-service-catalog";
import { useSettings, type StreamingService } from "@/lib/settings";
import { useScrollMemory } from "@/lib/view";
import { useT } from "@/lib/i18n";

export function ServiceView({ service }: { service: StreamingService }) {
  const t = useT();
  const { settings } = useSettings();
  const meta = SERVICES[service];
  const [category, setCategory] = useState<Category>(CATEGORIES[0]);
  const scrollRef = useRef<HTMLElement>(null);
  useScrollMemory(`service:${service}`, scrollRef);
  const { bucket, metas: merged, loading, loadMore } = useServiceCatalog(service, category);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1200) loadMore();
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [loadMore]);

  return (
    <main ref={scrollRef} className="absolute inset-0 overflow-y-auto pb-14">
      <div className="relative px-12 pt-28 pb-6">
        <div className="relative flex items-end justify-between gap-8">
          <div className="flex flex-col gap-3">
            <span className="text-[12.5px] font-medium uppercase tracking-[0.18em] text-ink-subtle">
              {t("Popular on")}
            </span>
            <div className="flex h-16 items-center">
              <ServiceLogo service={service} height={56} />
            </div>
            <p className="max-w-xl text-[14.5px] leading-relaxed text-ink-muted">
              {t("The most-watched movies and series on {name} right now in {region}.", { name: meta.name, region: settings.region })}
            </p>
          </div>
        </div>
      </div>

      <CategoryPills active={category} onChange={setCategory} />
      <CategoryFab active={category} onChange={setCategory} />

      <div className="px-12 pt-10">
        {loading && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-5 gap-y-9">
            {Array.from({ length: 18 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] animate-pulse rounded-xl border border-edge-soft bg-elevated/30" />
            ))}
          </div>
        )}

        {!loading && category.id === "all" && (
          <div className="flex flex-col gap-12">
            {bucket.movies.length === 0 && bucket.series.length === 0 ? (
              <EmptyState hasKey={!!settings.tmdbKey} />
            ) : (
              <>
                {bucket.movies.length >= 10 ? (
                  <>
                    <Row title={t("Top 10 Movies on {name}", { name: meta.name })} min={180} shape="rank">
                      {bucket.movies.slice(0, 10).map((m, i) => (
                        <TopRankCard key={m.id} meta={m} rank={i + 1} />
                      ))}
                    </Row>
                    {bucket.movies.length > 10 && (
                      <Row title={t("More Movies")}>
                        {bucket.movies.slice(10).map((m) => (
                          <PickCard key={m.id} meta={m} />
                        ))}
                      </Row>
                    )}
                  </>
                ) : bucket.movies.length > 0 ? (
                  <Row title={t("Movies on {name}", { name: meta.name })}>
                    {bucket.movies.map((m) => (
                      <PickCard key={m.id} meta={m} />
                    ))}
                  </Row>
                ) : null}
                {bucket.series.length >= 10 ? (
                  <>
                    <Row title={t("Top 10 Series on {name}", { name: meta.name })} min={180} shape="rank">
                      {bucket.series.slice(0, 10).map((m, i) => (
                        <TopRankCard key={m.id} meta={m} rank={i + 1} />
                      ))}
                    </Row>
                    {bucket.series.length > 10 && (
                      <Row title={t("More Series")}>
                        {bucket.series.slice(10).map((m) => (
                          <PickCard key={m.id} meta={m} />
                        ))}
                      </Row>
                    )}
                  </>
                ) : bucket.series.length > 0 ? (
                  <Row title={t("Series on {name}", { name: meta.name })}>
                    {bucket.series.map((m) => (
                      <PickCard key={m.id} meta={m} />
                    ))}
                  </Row>
                ) : null}
              </>
            )}
          </div>
        )}

        {!loading && category.id !== "all" && (
          <>
            {merged.length > 0 ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-5 gap-y-9">
                {merged.map((m) => (
                  <PickCard key={m.id} meta={m} />
                ))}
              </div>
            ) : (
              <EmptyState hasKey={!!settings.tmdbKey} />
            )}
          </>
        )}
      </div>
      <BackToTop scrollRef={scrollRef} />
    </main>
  );
}

function CategoryPills({
  active,
  onChange,
}: {
  active: Category;
  onChange: (c: Category) => void;
}) {
  const t = useT();
  const trackRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState({ canLeft: false, canRight: false });

  const recompute = useCallback(() => {
    const el = trackRef.current;
    if (!el) {
      setScrollState({ canLeft: false, canRight: false });
      return;
    }
    const maxScroll = el.scrollWidth - el.clientWidth;
    setScrollState({
      canLeft: el.scrollLeft > 4,
      canRight: maxScroll > 4 && el.scrollLeft < maxScroll - 4,
    });
  }, []);

  useLayoutEffect(() => {
    recompute();
  }, [recompute]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("scroll", recompute, { passive: true });
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", recompute);
      ro.disconnect();
    };
  }, [recompute]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const target = el.querySelector<HTMLButtonElement>(`button[data-cat="${active.id}"]`);
    if (target) {
      target.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
    }
  }, [active.id]);

  const page = (dir: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(220, el.clientWidth * 0.6), behavior: "smooth" });
  };

  return (
    <div className="px-12 pt-4">
      <div className="group/pills relative">
        <div
          ref={trackRef}
          className="flex gap-2 overflow-x-auto scroll-smooth pb-1 [scroll-padding:0_24px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {CATEGORIES.map((c) => {
            const isActive = c.id === active.id;
            return (
              <button
                key={c.id}
                data-cat={c.id}
                onClick={() => onChange(c)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-[13.5px] font-medium transition-colors [scroll-snap-align:start] ${
                  isActive
                    ? "bg-ink text-canvas"
                    : "border border-edge-soft bg-canvas/40 text-ink-muted hover:bg-elevated hover:text-ink"
                }`}
              >
                {t(c.label)}
              </button>
            );
          })}
        </div>
        <EdgeFade side="left" visible={scrollState.canLeft} />
        <EdgeFade side="right" visible={scrollState.canRight} />
        <ScrollArrow side="left" visible={scrollState.canLeft} onClick={() => page(-1)} />
        <ScrollArrow side="right" visible={scrollState.canRight} onClick={() => page(1)} />
      </div>
    </div>
  );
}

function ScrollArrow({
  side,
  visible,
  onClick,
}: {
  side: "left" | "right";
  visible: boolean;
  onClick: () => void;
}) {
  const t = useT();
  return (
    <button
      type="button"
      aria-label={side === "left" ? t("Scroll filters left") : t("Scroll filters right")}
      onClick={onClick}
      className={`absolute top-1/2 -translate-y-1/2 ${side === "left" ? "left-0 -translate-x-1/3" : "right-0 translate-x-1/3"} z-20 flex h-9 w-9 items-center justify-center rounded-full bg-canvas/85 text-ink shadow-[0_8px_24px_-6px_rgba(0,0,0,0.6)] backdrop-blur-md transition-all duration-200 hover:bg-canvas focus:outline-none ${
        visible
          ? "opacity-0 group-hover/pills:opacity-100 pointer-events-auto"
          : "pointer-events-none opacity-0"
      }`}
    >
      {side === "left" ? <ChevronLeft size={16} strokeWidth={2.4} /> : <ChevronRight size={16} strokeWidth={2.4} />}
    </button>
  );
}

function EdgeFade({ side, visible }: { side: "left" | "right"; visible: boolean }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-y-0 z-10 w-12 transition-opacity duration-200 ${
        side === "left"
          ? "left-0 bg-gradient-to-r from-canvas to-transparent"
          : "right-0 bg-gradient-to-l from-canvas to-transparent"
      } ${visible ? "opacity-100" : "opacity-0"}`}
    />
  );
}

function CategoryFab({
  active,
  onChange,
}: {
  active: Category;
  onChange: (c: Category) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-filter-fab]")) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div data-filter-fab className="fixed bottom-16 end-5 z-40">
      {open && (
        <div className="absolute bottom-full end-0 mb-2 max-h-[60vh] w-44 overflow-y-auto rounded-2xl border border-edge-soft/60 bg-canvas py-1.5 shadow-2xl">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
              className={`block w-full px-4 py-2 text-start text-[13.5px] transition-colors ${
                c.id === active.id
                  ? "bg-ink/10 text-ink"
                  : "text-ink-muted hover:bg-elevated/60 hover:text-ink"
              }`}
            >
              {t(c.label)}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 items-center gap-1.5 rounded-md border border-edge-soft/40 bg-canvas/90 px-2.5 text-[12px] font-medium text-ink-muted transition-colors hover:bg-canvas hover:text-ink"
      >
        <SlidersHorizontal size={12} strokeWidth={2.2} />
        {t(active.label)}
      </button>
    </div>
  );
}

function EmptyState({ hasKey }: { hasKey: boolean }) {
  const t = useT();
  return (
    <div className="rounded-2xl border border-dashed border-edge px-6 py-16 text-center text-[14px] text-ink-muted">
      {hasKey
        ? t("Nothing matched this filter. Try another category or change your region in Settings.")
        : t("Add a TMDB key in Settings → Library to power this view.")}
    </div>
  );
}
