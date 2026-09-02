import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Check, Filter, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { StoreTheme } from "@/lib/theme-store";
import { MOOD_RAILS, themeMoods, type Mood } from "./color-rank";
import { MarketCard } from "./market/market-card";
import { matchesThemeBehavior, THEME_BEHAVIORS, type ThemeBehavior } from "./theme-behavior-filter";
import { Diagram } from "../../theme-studio/layout-picker";

const SORTS = [
  { id: "top", label: "Top rated" },
  { id: "downloads", label: "Most downloaded" },
  { id: "new", label: "Newest" },
] as const;

type SortId = (typeof SORTS)[number]["id"];

function sortThemes(list: StoreTheme[], sort: SortId): StoreTheme[] {
  const copy = [...list];
  if (sort === "downloads") return copy.sort((a, b) => b.downloads - a.downloads);
  if (sort === "new")
    return copy.sort((a, b) =>
      b.createdAt > a.createdAt ? 1 : b.createdAt < a.createdAt ? -1 : 0,
    );
  return copy.sort(
    (a, b) =>
      b.ratingAvg - a.ratingAvg || b.ratingCount - a.ratingCount || b.downloads - a.downloads,
  );
}

export function StoreBrowse({
  themes,
  query,
  mood,
  onOpen,
  onClearMood,
}: {
  themes: StoreTheme[];
  query: string;
  mood?: Mood | null;
  onOpen: (t: StoreTheme) => void;
  onClearMood?: () => void;
}) {
  const t = useT();
  const [sort, setSort] = useState<SortId>("top");
  const [behavior, setBehavior] = useState<ThemeBehavior | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterDropUp, setFilterDropUp] = useState(false);
  const [filterMenuMaxHeight, setFilterMenuMaxHeight] = useState(360);
  const filterRootRef = useRef<HTMLDivElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const filterOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const filterMenuId = useId();
  const q = query.trim().toLowerCase();

  useEffect(() => {
    if (!filterOpen) return;
    const activeIndex = THEME_BEHAVIORS.findIndex((option) => option.id === behavior);
    queueMicrotask(() => filterOptionRefs.current[Math.max(0, activeIndex)]?.focus());
    const onPointerDown = (event: PointerEvent) => {
      if (!filterRootRef.current?.contains(event.target as Node)) setFilterOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setFilterOpen(false);
      filterButtonRef.current?.focus();
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [filterOpen, behavior]);

  useLayoutEffect(() => {
    if (!filterOpen) return;
    const updatePlacement = () => {
      const rect = filterRootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const viewportMargin = 12;
      const menuGap = 6;
      const preferredHeight = Math.min(360, window.innerHeight * 0.6);
      const above = Math.max(0, rect.top - viewportMargin - menuGap);
      const below = Math.max(0, window.innerHeight - rect.bottom - viewportMargin - menuGap);
      const dropUp = below < preferredHeight && above > below;
      const available = dropUp ? above : below;
      setFilterDropUp(dropUp);
      setFilterMenuMaxHeight(Math.min(preferredHeight, available));
    };
    updatePlacement();
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);
    return () => {
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [filterOpen]);

  const shown = useMemo(() => {
    const byMood = mood ? themes.filter((t) => themeMoods(t).has(mood)) : themes;
    const byBehavior = byMood.filter((t) => matchesThemeBehavior(t.layout, behavior));
    const filtered = q
      ? byBehavior.filter((t) => `${t.name} ${t.author} ${t.blurb}`.toLowerCase().includes(q))
      : byBehavior;
    return sortThemes(filtered, sort);
  }, [themes, q, sort, mood, behavior]);

  return (
    <section className="flex flex-col gap-5 ps-[9px]">
      <div className="flex flex-wrap items-center gap-2">
        {SORTS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSort(s.id)}
            className={`h-8 rounded-full px-3.5 text-[12px] font-semibold transition-colors ${
              sort === s.id
                ? "bg-ink text-canvas"
                : "bg-surface text-ink-muted ring-1 ring-edge-soft hover:text-ink hover:ring-edge"
            }`}
          >
            {t(s.label)}
          </button>
        ))}
        {mood && (
          <button
            type="button"
            onClick={onClearMood}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-accent-soft px-3 text-[12px] font-semibold text-accent transition-opacity hover:opacity-85"
          >
            {t(MOOD_RAILS.find((r) => r.mood === mood)?.title ?? mood)}
            <X size={12} strokeWidth={2.6} />
          </button>
        )}
        <div className="ms-auto flex items-center gap-2.5">
          <div ref={filterRootRef} className="relative">
            <button
              ref={filterButtonRef}
              type="button"
              onClick={() => setFilterOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={filterOpen}
              aria-controls={filterOpen ? filterMenuId : undefined}
              className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold transition-colors ${
                behavior
                  ? "bg-accent-soft text-accent ring-1 ring-accent/25"
                  : "bg-surface text-ink-muted ring-1 ring-edge-soft hover:text-ink hover:ring-edge"
              }`}
            >
              <Filter size={13} strokeWidth={2.3} />
              {t("Filter")}
            </button>

            {filterOpen && (
              <div
                id={filterMenuId}
                role="menu"
                aria-label={t("Filter")}
                style={{ maxHeight: filterMenuMaxHeight }}
                className={`absolute end-0 z-40 w-[min(288px,calc(100vw-32px))] overflow-y-auto overscroll-contain rounded-xl border border-edge bg-elevated p-1 shadow-[0_22px_55px_-18px_rgba(0,0,0,0.7)] [scrollbar-width:thin] animate-popover-in ${
                  filterDropUp ? "bottom-[calc(100%+6px)]" : "top-[calc(100%+6px)]"
                }`}
              >
                <div className="grid grid-cols-2 gap-0.5">
                  {THEME_BEHAVIORS.map((option, index) => {
                    const active = behavior === option.id;
                    return (
                      <button
                        key={option.id}
                        ref={(element) => {
                          filterOptionRefs.current[index] = element;
                        }}
                        type="button"
                        role="menuitemradio"
                        aria-checked={active}
                        onClick={() => {
                          setBehavior(active ? null : option.id);
                          setFilterOpen(false);
                          queueMicrotask(() => filterButtonRef.current?.focus());
                        }}
                        className={`relative flex min-w-0 flex-col gap-1.5 rounded-lg p-1.5 text-start text-[12px] font-medium transition-colors ${
                          active
                            ? "bg-accent-soft text-accent"
                            : "text-ink-muted hover:bg-raised hover:text-ink"
                        }`}
                      >
                        <div
                          aria-hidden="true"
                          className="aspect-[4/3] w-full overflow-hidden rounded-lg border border-edge-soft bg-surface"
                        >
                          <Diagram active={active} kind={option.id} />
                        </div>
                        <span className="flex w-full items-center justify-between gap-2 px-0.5 pb-0.5">
                          <span>{t(option.label)}</span>
                          {active && <Check size={13} strokeWidth={2.6} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {behavior && (
                  <>
                    <div className="my-1 h-px bg-edge-soft" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setBehavior(null);
                        setFilterOpen(false);
                        queueMicrotask(() => filterButtonRef.current?.focus());
                      }}
                      className="flex h-8 w-full items-center justify-center rounded-lg text-[11.5px] font-semibold text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
                    >
                      {t("Clear filter")}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          <span className="tabular-nums text-[12px] text-ink-subtle">
            {shown.length} {shown.length === 1 ? t("theme") : t("themes")}
          </span>
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-[14px] bg-surface/40 px-4 py-14 text-center text-[13px] text-ink-subtle ring-1 ring-edge-soft">
          {q || mood || behavior
            ? t("No themes match your search.")
            : t("No community themes yet. Be the first to share one.")}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((t) => (
            <MarketCard
              key={t.id}
              item={t}
              kind="theme"
              onOpen={(item) => onOpen(item as StoreTheme)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
