import { useT } from "@/lib/i18n";
import { FAVORITES_GROUP_KEY } from "@/lib/iptv/favorites";
import { toggleGroupHidden, toggleGroupPin, useGroupPrefs } from "@/lib/iptv/group-order";
import { Eye, EyeOff, Layers, Pin, Search, Star, Tv, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export function CategorySidebar({
  groups,
  active,
  onSelect,
  counts,
  groupLogos,
  favoritesCount = 0,
  sourceId,
}: {
  groups: string[];
  active: string | null;
  onSelect: (g: string | null) => void;
  counts: Map<string, number>;
  groupLogos: Map<string, string | null>;
  favoritesCount?: number;
  sourceId: string;
}) {
  const t = useT();
  const total = Array.from(counts.values()).reduce((a, b) => a + b, 0);
  const prefs = useGroupPrefs(sourceId);
  const pinnedSet = useMemo(() => new Set(prefs.pinned), [prefs.pinned]);
  const [showHidden, setShowHidden] = useState(false);
  const [filter, setFilter] = useState("");
  const visibleGroups = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.toLowerCase().includes(q));
  }, [groups, filter]);
  const showFavs = favoritesCount > 0 && !filter;
  const all: string[] = [...(showFavs ? [FAVORITES_GROUP_KEY] : []), "__ALL__", ...visibleGroups];
  const activeKey = active ?? "__ALL__";
  const activeIdx = Math.max(0, all.indexOf(activeKey));
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLButtonElement>(`[data-cat-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  const move = (delta: number) => {
    const next = Math.max(0, Math.min(all.length - 1, activeIdx + delta));
    const key = all[next];
    onSelect(key === "__ALL__" ? null : key);
    const btn = listRef.current?.querySelector<HTMLButtonElement>(`[data-cat-idx="${next}"]`);
    btn?.focus();
  };
  const favIdx = showFavs ? 0 : -1;
  const allIdx = showFavs ? 1 : 0;

  const handleKey = (e: React.KeyboardEvent) => {
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
    }
  };

  return (
    <aside
      role="listbox"
      aria-label={t("Channel categories")}
      className="flex w-[220px] shrink-0 flex-col border-e border-s border-edge-soft/40 bg-surface/45"
      onKeyDown={handleKey}
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
            onClick={() => onSelect(g)}
            logoUrl={groupLogos.get(g) ?? null}
            groupName={g}
            sourceId={sourceId}
            pinned={pinnedSet.has(g)}
          />
        ))}
        {visibleGroups.length === 0 && (
          <div className="flex flex-col items-center gap-1.5 px-4 py-8 text-center text-[12px] text-ink-subtle">
            <span>{t("No categories match")}</span>
            <button
              onClick={() => setFilter("")}
              className="text-[11.5px] font-medium text-ink-muted underline-offset-2 hover:underline"
            >
              {t("Clear filter")}
            </button>
          </div>
        )}
      </div>
      {prefs.hidden.length > 0 && (
        <div className="border-t border-edge-soft/40 px-2 py-1.5">
          <button
            onClick={() => setShowHidden((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-[11.5px] font-medium text-ink-subtle transition-colors hover:bg-elevated/60 hover:text-ink"
          >
            <span>{t("{n} hidden", { n: prefs.hidden.length })}</span>
            <span className="text-ink-muted">{showHidden ? t("Done") : t("Manage")}</span>
          </button>
          {showHidden && (
            <div className="mt-1 flex max-h-44 flex-col gap-0.5 overflow-y-auto">
              {prefs.hidden.map((g) => (
                <div key={g} className="flex items-center gap-2 rounded-md px-2 py-1 text-[12px] text-ink-subtle">
                  <span className="flex-1 truncate">{g}</span>
                  <button
                    onClick={() => toggleGroupHidden(sourceId, g)}
                    aria-label={t("Unhide {name}", { name: g })}
                    className="flex h-6 w-6 items-center justify-center rounded text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
                  >
                    <Eye size={13} strokeWidth={2} />
                  </button>
                </div>
              ))}
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
  onClick,
  icon,
  logoUrl,
  groupName,
  sourceId,
  pinned,
}: {
  idx: number;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  logoUrl?: string | null;
  groupName?: string;
  sourceId?: string;
  pinned?: boolean;
}) {
  const t = useT();
  const [errored, setErrored] = useState(false);
  const showLogo = logoUrl && !errored;
  const hasActions = !!groupName && !!sourceId;
  return (
    <div className="group/cat relative">
      <button
        data-cat-idx={idx}
        role="option"
        aria-selected={active}
        tabIndex={active ? 0 : -1}
        onClick={onClick}
        className={`flex w-full items-center gap-2.5 px-3 py-2 text-start transition-colors duration-150 ${
          active ? "bg-elevated text-ink" : "text-ink-muted hover:bg-elevated/65 hover:text-ink"
        }`}
      >
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md ${
            active ? "bg-canvas" : "bg-elevated/70"
          }`}
        >
          {showLogo ? (
            <img
              src={logoUrl!}
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
            active ? "bg-canvas text-ink-muted" : "bg-canvas/55 text-ink-subtle"
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
              toggleGroupPin(sourceId!, groupName!);
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
              toggleGroupHidden(sourceId!, groupName!);
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
