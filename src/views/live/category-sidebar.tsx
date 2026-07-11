import { useT } from "@/lib/i18n";
import { FAVORITES_GROUP_KEY } from "@/lib/iptv/favorites";
import {
  setGroupsHidden,
  setGroupsPinned,
  toggleGroupHidden,
  toggleGroupPin,
  useGroupPrefs,
} from "@/lib/iptv/group-order";
import { CheckSquare, Eye, EyeOff, Layers, Pin, Search, Square, Star, Tv, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function CategorySidebar({
  groups,
  active,
  onSelect,
  counts,
  groupLogos,
  favoritesCount = 0,
  sourceId,
  /** When true (or bumps), open the hidden-categories manage panel. */
  openHiddenManager = false,
  onHiddenManagerOpened,
}: {
  groups: string[];
  active: string | null;
  onSelect: (g: string | null) => void;
  counts: Map<string, number>;
  groupLogos: Map<string, string | null>;
  favoritesCount?: number;
  sourceId: string;
  openHiddenManager?: boolean;
  onHiddenManagerOpened?: () => void;
}) {
  const t = useT();
  const total = Array.from(counts.values()).reduce((a, b) => a + b, 0);
  const prefs = useGroupPrefs(sourceId);
  const pinnedSet = useMemo(() => new Set(prefs.pinned), [prefs.pinned]);
  const [showHidden, setShowHidden] = useState(false);

  useEffect(() => {
    if (!openHiddenManager) return;
    setShowHidden(true);
    onHiddenManagerOpened?.();
  }, [openHiddenManager, onHiddenManagerOpened]);
  const [filter, setFilter] = useState("");
  /** Multi-select for bulk hide (visible categories). */
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const lastClickedRef = useRef<string | null>(null);
  /** Multi-select for bulk unhide (hidden list). */
  const [hiddenSelected, setHiddenSelected] = useState<Set<string>>(() => new Set());
  const lastHiddenClickedRef = useRef<string | null>(null);

  const visibleGroups = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.toLowerCase().includes(q));
  }, [groups, filter]);

  // Drop selection when groups leave the list (e.g. filtered out or already hidden)
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const keep = new Set<string>();
      for (const g of prev) {
        if (visibleGroups.includes(g)) keep.add(g);
      }
      return keep.size === prev.size ? prev : keep;
    });
  }, [visibleGroups]);

  useEffect(() => {
    setHiddenSelected((prev) => {
      if (prev.size === 0) return prev;
      const hidden = new Set(prefs.hidden);
      const keep = new Set<string>();
      for (const g of prev) {
        if (hidden.has(g)) keep.add(g);
      }
      return keep.size === prev.size ? prev : keep;
    });
  }, [prefs.hidden]);

  // If every category is hidden, open Manage so you can still unhide them
  const allCategoriesHidden = groups.length === 0 && prefs.hidden.length > 0 && !filter;
  useEffect(() => {
    if (allCategoriesHidden) setShowHidden(true);
  }, [allCategoriesHidden]);

  const showFavs = favoritesCount > 0 && !filter;
  const navKeys = useMemo(
    () => [...(showFavs ? [FAVORITES_GROUP_KEY] : []), "__ALL__", ...visibleGroups],
    [showFavs, visibleGroups],
  );
  const activeKey = active ?? "__ALL__";
  const activeIdx = Math.max(0, navKeys.indexOf(activeKey));
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLButtonElement>(`[data-cat-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  const move = useCallback(
    (delta: number) => {
      const next = Math.max(0, Math.min(navKeys.length - 1, activeIdx + delta));
      const key = navKeys[next];
      onSelect(key === "__ALL__" ? null : key);
      const btn = listRef.current?.querySelector<HTMLButtonElement>(`[data-cat-idx="${next}"]`);
      btn?.focus();
    },
    [navKeys, activeIdx, onSelect],
  );
  const favIdx = showFavs ? 0 : -1;
  const allIdx = showFavs ? 1 : 0;

  // Native listener avoids a11y lint on static div handlers; keyboard nav still works.
  useEffect(() => {
    const root = listRef.current;
    if (!root) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        move(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        move(-1);
      } else if (e.key === "Home") {
        e.preventDefault();
        onSelect(null);
      } else if (e.key === "End") {
        e.preventDefault();
        const last = groups[groups.length - 1];
        if (last) onSelect(last);
      } else if (e.key === "Escape" && selected.size > 0) {
        e.preventDefault();
        setSelected(new Set());
        lastClickedRef.current = null;
      } else if ((e.key === "a" || e.key === "A") && (e.metaKey || e.ctrlKey) && visibleGroups.length > 0) {
        e.preventDefault();
        setSelected(new Set(visibleGroups));
      }
    };
    root.addEventListener("keydown", onKey);
    return () => {
      root.removeEventListener("keydown", onKey);
    };
  }, [move, onSelect, groups, selected.size, visibleGroups]);

  const applyRangeSelect = useCallback(
    (
      list: string[],
      group: string,
      lastRef: React.MutableRefObject<string | null>,
      setSel: React.Dispatch<React.SetStateAction<Set<string>>>,
      shift: boolean,
      meta: boolean,
    ) => {
      if (shift && lastRef.current && list.includes(lastRef.current)) {
        const a = list.indexOf(lastRef.current);
        const b = list.indexOf(group);
        if (a >= 0 && b >= 0) {
          const [lo, hi] = a < b ? [a, b] : [b, a];
          const range = list.slice(lo, hi + 1);
          setSel((prev) => {
            const next = new Set(prev);
            for (const g of range) next.add(g);
            return next;
          });
          return;
        }
      }
      if (meta) {
        setSel((prev) => {
          const next = new Set(prev);
          if (next.has(group)) next.delete(group);
          else next.add(group);
          return next;
        });
        lastRef.current = group;
        return;
      }
      // Plain click while multi-selecting: toggle only this item (unselect if selected)
      setSel((prev) => {
        if (prev.size === 0) return new Set([group]);
        const next = new Set(prev);
        if (next.has(group)) next.delete(group);
        else next.add(group);
        return next;
      });
      lastRef.current = group;
    },
    [],
  );

  const onGroupClick = (g: string, e: React.MouseEvent) => {
    const shift = e.shiftKey;
    const meta = e.metaKey || e.ctrlKey;
    // Multi-select mode: shift / cmd / already have a selection
    if (shift || meta || selected.size > 0) {
      e.preventDefault();
      applyRangeSelect(visibleGroups, g, lastClickedRef, setSelected, shift, meta);
      return;
    }
    // Normal: open category
    onSelect(g);
    lastClickedRef.current = g;
  };

  const onHiddenRowClick = (g: string, e: React.MouseEvent) => {
    applyRangeSelect(prefs.hidden, g, lastHiddenClickedRef, setHiddenSelected, e.shiftKey, e.metaKey || e.ctrlKey);
  };

  const selectAllVisible = () => {
    setSelected(new Set(visibleGroups));
    lastClickedRef.current = visibleGroups[visibleGroups.length - 1] ?? null;
  };

  const clearSelection = () => {
    setSelected(new Set());
    lastClickedRef.current = null;
  };

  const hideSelected = () => {
    if (selected.size === 0) return;
    setGroupsHidden(sourceId, [...selected], true);
    clearSelection();
  };

  const pinSelected = () => {
    if (selected.size === 0) return;
    setGroupsPinned(sourceId, [...selected], true);
    clearSelection();
  };

  /** Eye button always hides only this category (never the whole selection). */
  const hideOne = (g: string) => {
    toggleGroupHidden(sourceId, g);
    setSelected((prev) => {
      if (!prev.has(g)) return prev;
      const next = new Set(prev);
      next.delete(g);
      return next;
    });
  };

  const selectAllHidden = () => {
    setHiddenSelected(new Set(prefs.hidden));
    lastHiddenClickedRef.current = prefs.hidden[prefs.hidden.length - 1] ?? null;
  };

  const unhideSelected = () => {
    if (hiddenSelected.size === 0) return;
    setGroupsHidden(sourceId, [...hiddenSelected], false);
    setHiddenSelected(new Set());
    lastHiddenClickedRef.current = null;
  };

  const unhideAll = () => {
    if (prefs.hidden.length === 0) return;
    setGroupsHidden(sourceId, [...prefs.hidden], false);
    setHiddenSelected(new Set());
    lastHiddenClickedRef.current = null;
    setShowHidden(false);
  };

  return (
    <aside
      aria-label={t("Channel categories")}
      className="flex w-[220px] shrink-0 flex-col border-e border-s border-edge-soft/40 bg-surface/45"
    >
      <div className="border-b border-edge-soft/40 px-3 py-2">
        <div className="flex h-9 items-center gap-2 rounded-lg border border-edge-soft/55 bg-canvas px-2.5">
          <Search size={13} strokeWidth={2} className="text-ink-subtle" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t("Filter categories")}
            className="flex-1 bg-transparent text-[12.5px] text-ink placeholder:text-ink-subtle focus:outline-none"
          />
          {filter && (
            <button
              onClick={() => setFilter("")}
              aria-label={t("Clear filter")}
              className="text-ink-subtle transition-colors hover:text-ink"
            >
              <X size={13} strokeWidth={2} />
            </button>
          )}
        </div>
        {visibleGroups.length > 0 && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <button
              type="button"
              onClick={selectAllVisible}
              className="rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-subtle transition-colors hover:bg-elevated/70 hover:text-ink"
            >
              {t("Select all")}
            </button>
            {selected.size > 0 && (
              <>
                <span className="text-[10px] text-ink-subtle">·</span>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-subtle transition-colors hover:bg-elevated/70 hover:text-ink"
                >
                  {t("Clear")}
                </button>
              </>
            )}
          </div>
        )}
      </div>
      <div ref={listRef} className="flex-1 overflow-y-auto py-1.5">
        {showFavs && (
          <CategoryItem
            idx={favIdx}
            label={t("Favorites")}
            count={favoritesCount}
            active={activeKey === FAVORITES_GROUP_KEY}
            onClick={() => onSelect(FAVORITES_GROUP_KEY)}
            icon={<Star size={15} strokeWidth={0} fill="currentColor" className="text-accent" />}
          />
        )}
        {!filter && (
          <CategoryItem
            idx={allIdx}
            label={t("All channels")}
            count={total}
            active={activeKey === "__ALL__"}
            onClick={() => onSelect(null)}
            icon={<Layers size={16} strokeWidth={1.9} className="text-ink-muted" />}
          />
        )}
        {visibleGroups.map((g, i) => (
          <CategoryItem
            key={g}
            idx={i + (showFavs ? 2 : 1)}
            label={g}
            count={counts.get(g) ?? 0}
            active={activeKey === g}
            selected={selected.has(g)}
            onClick={(e) => onGroupClick(g, e)}
            logoUrl={groupLogos.get(g) ?? null}
            groupName={g}
            sourceId={sourceId}
            pinned={pinnedSet.has(g)}
            onHide={() => hideOne(g)}
          />
        ))}
        {visibleGroups.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-[12px] text-ink-subtle">
            {allCategoriesHidden ? (
              <>
                <EyeOff size={22} strokeWidth={1.7} className="text-ink-subtle" />
                <span className="font-medium text-ink-muted">{t("All categories are hidden")}</span>
                <span className="max-w-[18ch] text-[11.5px] leading-snug">
                  {t("Use Manage below to unhide categories, or restore everything at once.")}
                </span>
                <button
                  type="button"
                  onClick={unhideAll}
                  className="mt-1 rounded-full bg-accent/15 px-3 py-1.5 text-[11.5px] font-semibold text-accent transition-colors hover:bg-accent/25"
                >
                  {t("Unhide all")}
                </button>
              </>
            ) : (
              <>
                <span>{t("No categories match")}</span>
                <button
                  onClick={() => setFilter("")}
                  className="text-[11.5px] font-medium text-ink-muted underline-offset-2 hover:underline"
                >
                  {t("Clear filter")}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {selected.size > 0 && (
        <div className="border-t border-edge-soft/40 px-2 py-2">
          <div className="mb-1.5 px-1 text-[11px] font-medium text-ink-muted">
            {t("{n} selected", { n: selected.size })}
            <span className="ms-1 text-[10px] font-normal text-ink-subtle">({t("Shift+click for range")})</span>
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={pinSelected}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-edge-soft/60 bg-canvas/50 px-2 py-1.5 text-[11.5px] font-semibold text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
            >
              <Pin size={12} strokeWidth={2.2} />
              {t("Pin")}
            </button>
            <button
              type="button"
              onClick={hideSelected}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-accent/15 px-2 py-1.5 text-[11.5px] font-semibold text-accent transition-colors hover:bg-accent/25"
            >
              <EyeOff size={12} strokeWidth={2.2} />
              {t("Hide")}
            </button>
          </div>
        </div>
      )}

      {prefs.hidden.length > 0 && (
        <div className={`border-t border-edge-soft/40 px-2 py-1.5 ${allCategoriesHidden ? "bg-accent/5" : ""}`}>
          <button
            type="button"
            onClick={() => {
              setShowHidden((v) => !v);
              if (showHidden) {
                setHiddenSelected(new Set());
                lastHiddenClickedRef.current = null;
              }
            }}
            className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-[11.5px] font-medium transition-colors hover:bg-elevated/60 hover:text-ink ${
              allCategoriesHidden ? "text-accent" : "text-ink-subtle"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <EyeOff size={13} strokeWidth={2} />
              {t("{n} hidden", { n: prefs.hidden.length })}
            </span>
            <span className="text-ink-muted">{showHidden ? t("Done") : t("Manage")}</span>
          </button>
          {showHidden && (
            <div className="mt-1 flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-1 px-1">
                <button
                  type="button"
                  onClick={selectAllHidden}
                  className="rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-subtle transition-colors hover:bg-elevated/70 hover:text-ink"
                >
                  {t("Select all")}
                </button>
                <button
                  type="button"
                  onClick={unhideAll}
                  className="rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold text-accent transition-colors hover:bg-accent/15"
                >
                  {t("Unhide all")}
                </button>
                {hiddenSelected.size > 0 && (
                  <button
                    type="button"
                    onClick={unhideSelected}
                    className="ms-auto rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold text-accent transition-colors hover:bg-accent/15"
                  >
                    {t("Unhide selected")} ({hiddenSelected.size})
                  </button>
                )}
              </div>
              <div
                className={`flex flex-col gap-0.5 overflow-y-auto ${
                  allCategoriesHidden ? "max-h-[min(50vh,320px)]" : "max-h-44"
                }`}
              >
                {prefs.hidden.map((g) => {
                  const isSel = hiddenSelected.has(g);
                  return (
                    <div
                      key={g}
                      className={`flex items-center gap-1 rounded-md pr-1 text-[12px] transition-colors ${
                        isSel ? "bg-accent/15 text-ink" : "text-ink-subtle hover:bg-elevated/50 hover:text-ink"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={(e) => onHiddenRowClick(g, e)}
                        aria-pressed={isSel}
                        className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1 text-start"
                      >
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-ink-muted">
                          {isSel ? (
                            <CheckSquare size={13} strokeWidth={2.2} className="text-accent" />
                          ) : (
                            <Square size={13} strokeWidth={2} />
                          )}
                        </span>
                        <span className="flex-1 truncate" dir="auto">
                          {g}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleGroupHidden(sourceId, g)}
                        aria-label={t("Unhide {name}", { name: g })}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
                      >
                        <Eye size={13} strokeWidth={2} />
                      </button>
                    </div>
                  );
                })}
              </div>
              <p className="px-1 pt-0.5 text-[10px] text-ink-subtle">
                {t("Shift+click for range · ⌘/Ctrl+click to toggle")}
              </p>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

function CategoryItem({
  idx,
  label,
  count,
  active,
  selected = false,
  onClick,
  icon,
  logoUrl,
  groupName,
  sourceId,
  pinned,
  onHide,
}: {
  idx: number;
  label: string;
  count: number;
  active: boolean;
  selected?: boolean;
  onClick: (e: React.MouseEvent) => void;
  icon?: React.ReactNode;
  logoUrl?: string | null;
  groupName?: string;
  sourceId?: string;
  pinned?: boolean;
  onHide?: () => void;
}) {
  const t = useT();
  const [errored, setErrored] = useState(false);
  const showLogo = logoUrl && !errored;
  const hasActions = !!groupName && !!sourceId && !!onHide;
  return (
    <div className="group/cat relative">
      <button
        data-cat-idx={idx}
        aria-current={active ? "true" : undefined}
        aria-pressed={selected || undefined}
        tabIndex={active ? 0 : -1}
        onClick={onClick}
        className={`flex w-full items-center gap-2.5 px-3 py-2 text-start transition-colors duration-150 ${
          selected
            ? "bg-accent/15 text-ink ring-1 ring-inset ring-accent/30"
            : active
              ? "bg-elevated text-ink"
              : "text-ink-muted hover:bg-elevated/65 hover:text-ink"
        }`}
      >
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md ${
            selected || active ? "bg-canvas" : "bg-elevated/70"
          }`}
        >
          {showLogo && logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              draggable={false}
              loading="lazy"
              onError={() => setErrored(true)}
              className="max-h-full max-w-full object-contain"
            />
          ) : icon ? (
            icon
          ) : (
            <Tv size={15} strokeWidth={1.9} className="text-ink-subtle" />
          )}
        </span>
        <span className="flex flex-1 items-center gap-1.5 truncate text-[13px] font-medium">
          {pinned && <Pin size={11} strokeWidth={2.4} className="shrink-0 fill-current text-accent" />}
          <span dir="auto" className="truncate">
            {label}
          </span>
        </span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold tabular-nums transition-opacity ${
            active || selected ? "bg-canvas text-ink-muted" : "bg-canvas/55 text-ink-subtle"
          } ${hasActions ? "group-hover/cat:opacity-0" : ""}`}
        >
          {count.toLocaleString()}
        </span>
      </button>
      {hasActions && (
        <div className="absolute end-2 top-1/2 flex -translate-y-1/2 items-center gap-1 opacity-0 transition-opacity group-hover/cat:opacity-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (sourceId && groupName) toggleGroupPin(sourceId, groupName);
            }}
            title={pinned ? t("Unpin from top") : t("Pin category to top")}
            aria-label={pinned ? t("Unpin category") : t("Pin category to top")}
            className={`flex h-6 w-6 items-center justify-center rounded-md ${
              pinned ? "bg-accent text-canvas" : "bg-canvas/90 text-ink-muted hover:text-ink"
            }`}
          >
            <Pin size={12} strokeWidth={2.2} className={pinned ? "fill-current" : ""} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onHide?.();
            }}
            title={t("Hide category")}
            aria-label={t("Hide category")}
            className="flex h-6 w-6 items-center justify-center rounded-md bg-canvas/90 text-ink-muted hover:text-ink"
          >
            <EyeOff size={12} strokeWidth={2.2} />
          </button>
        </div>
      )}
    </div>
  );
}
