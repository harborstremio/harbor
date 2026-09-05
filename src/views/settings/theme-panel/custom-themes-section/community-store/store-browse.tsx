import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Filter, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { advanceFocus, tvFocus } from "@/lib/keyboard-navigation";
import {
  findBest,
  getDirection,
  getFocusable,
  isBackKey,
  navOwnsFocus,
} from "@/lib/keyboard-navigation/geometry";
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

type MenuBox = { top: number; left: number; width: number; maxHeight: number; dropUp: boolean };

const MENU_WIDTH = 360;
const MENU_GAP = 6;
const MENU_MARGIN = 12;

function measureMenu(anchor: HTMLElement): MenuBox {
  const rect = anchor.getBoundingClientRect();
  const scroller = anchor.closest(".hset-main");
  const scrollRect = scroller?.getBoundingClientRect();
  const topLimit = Math.max(MENU_MARGIN, scrollRect ? scrollRect.top : 0);
  const bottomLimit = Math.min(
    window.innerHeight - MENU_MARGIN,
    scrollRect ? scrollRect.bottom : window.innerHeight,
  );
  const preferred = Math.min(380, (bottomLimit - topLimit) * 0.9);
  const above = Math.max(0, rect.top - topLimit - MENU_GAP);
  const below = Math.max(0, bottomLimit - rect.bottom - MENU_GAP);
  const dropUp = below < preferred && above > below;
  const width = Math.min(MENU_WIDTH, window.innerWidth - MENU_MARGIN * 2);
  const rtl = getComputedStyle(document.documentElement).direction === "rtl";
  const left = Math.min(
    Math.max(MENU_MARGIN, rtl ? rect.left : rect.right - width),
    window.innerWidth - width - MENU_MARGIN,
  );
  const maxHeight = Math.max(120, Math.min(preferred, dropUp ? above : below));
  const rawTop = dropUp ? rect.top - MENU_GAP - maxHeight : rect.bottom + MENU_GAP;
  const top = Math.min(
    Math.max(MENU_MARGIN, rawTop),
    Math.max(MENU_MARGIN, window.innerHeight - MENU_MARGIN - maxHeight),
  );
  return { top, left, width, maxHeight, dropUp };
}

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
  const [filterBox, setFilterBox] = useState<MenuBox | null>(null);
  const filterRootRef = useRef<HTMLDivElement>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const filterOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const filterMenuId = useId();
  const q = query.trim().toLowerCase();

  const closeFilter = useCallback(() => {
    const active = document.activeElement;
    const ring = active instanceof HTMLElement && navOwnsFocus(active);
    setFilterOpen(false);
    requestAnimationFrame(() => {
      const trigger = filterButtonRef.current;
      if (!trigger) return;
      if (ring) tvFocus(trigger);
      else trigger.focus();
    });
  }, []);

  useEffect(() => {
    if (!filterOpen) return;
    const activeIndex = THEME_BEHAVIORS.findIndex((option) => option.id === behavior);
    queueMicrotask(() => {
      const option = filterOptionRefs.current[Math.max(0, activeIndex)];
      if (option) advanceFocus(option);
    });
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (filterRootRef.current?.contains(target) || filterMenuRef.current?.contains(target)) return;
      setFilterOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isBackKey(event)) return;
      event.preventDefault();
      event.stopPropagation();
      closeFilter();
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [filterOpen, behavior, closeFilter]);

  useLayoutEffect(() => {
    if (!filterOpen) return;
    const updatePlacement = () => {
      const anchor = filterButtonRef.current;
      if (anchor) setFilterBox(measureMenu(anchor));
    };
    updatePlacement();
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);
    return () => {
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [filterOpen]);

  const onFilterMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const dir = getDirection(event.nativeEvent);
    const menu = filterMenuRef.current;
    const from = event.target as HTMLElement;
    if (!dir || !menu || !menu.contains(from)) return;
    const next = findBest(from, getFocusable(menu), dir);
    if (!next) return;
    event.preventDefault();
    advanceFocus(next, dir);
  };

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
            className={`h-11 rounded-full px-4 text-[15.5px] font-semibold transition-colors ${
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
            className="inline-flex h-11 items-center gap-2 rounded-full bg-accent-soft px-4 text-[15.5px] font-semibold text-accent transition-opacity hover:opacity-85"
          >
            {t(MOOD_RAILS.find((r) => r.mood === mood)?.title ?? mood)}
            <X size={16} strokeWidth={2.6} />
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
              className={`inline-flex h-11 items-center gap-2 rounded-full px-4 text-[15.5px] font-semibold transition-colors ${
                behavior
                  ? "bg-accent-soft text-accent ring-1 ring-accent/25"
                  : "bg-surface text-ink-muted ring-1 ring-edge-soft hover:text-ink hover:ring-edge"
              }`}
            >
              <Filter size={16} strokeWidth={2.3} />
              {t("Filter")}
            </button>

            {filterOpen &&
              filterBox &&
              createPortal(
                <div
                  ref={filterMenuRef}
                  id={filterMenuId}
                  role="menu"
                  aria-label={t("Filter")}
                  onKeyDown={onFilterMenuKeyDown}
                  style={{
                    position: "fixed",
                    top: filterBox.top,
                    left: filterBox.left,
                    width: filterBox.width,
                    maxHeight: filterBox.maxHeight,
                  }}
                  className={`z-[10000] overflow-y-auto overscroll-contain rounded-xl border border-edge bg-elevated p-1.5 harbor-float [scrollbar-width:thin] ${
                    filterBox.dropUp ? "animate-menu-in-up" : "animate-menu-in"
                  }`}
                >
                  <div className="grid grid-cols-2 gap-1">
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
                            closeFilter();
                          }}
                          className={`relative flex min-h-11 min-w-0 flex-col gap-2 rounded-lg p-2 text-start text-[15.5px] font-medium leading-[22px] transition-colors ${
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
                            <span className="min-w-0 truncate">{t(option.label)}</span>
                            {active && <Check size={16} strokeWidth={2.6} className="shrink-0" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {behavior && (
                    <>
                      <div className="my-1.5 h-px bg-edge-soft" />
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setBehavior(null);
                          closeFilter();
                        }}
                        className="flex h-11 w-full items-center justify-center rounded-lg text-[15.5px] font-semibold text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
                      >
                        {t("Clear filter")}
                      </button>
                    </>
                  )}
                </div>,
                document.body,
              )}
          </div>
          <span className="tabular-nums text-[15.5px] leading-[22px] text-ink-subtle">
            {shown.length} {shown.length === 1 ? t("theme") : t("themes")}
          </span>
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-[14px] border border-dashed border-edge px-4 py-14 text-center text-[15.5px] leading-[22px] text-ink-subtle">
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
