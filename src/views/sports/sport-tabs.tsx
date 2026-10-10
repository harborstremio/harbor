import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Star } from "lucide-react";
import { useT } from "@/lib/i18n";
import { SportsMoreMenu } from "./more-menu";

export type SportTab = { key: string; label: string };

export const FAVORITES_TAB = "favorites";
export const ALL_TAB = "all";

const GAP = 8;

export function SportsTabs({
  tabs,
  selected,
  favoriteCount,
  onSelect,
  onManageFavorites,
}: {
  tabs: SportTab[];
  selected: string;
  favoriteCount: number;
  onSelect: (key: string) => void;
  onManageFavorites: () => void;
}) {
  const t = useT();
  const rowRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(tabs.length);
  const tabsKey = tabs.map((x) => x.key).join(",");

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const count = tabs.length;

    const fit = () => {
      const mirror = mirrorRef.current;
      if (!mirror || mirror.children.length !== count + 1) return;
      const kids = Array.from(mirror.children) as HTMLElement[];
      const widths = kids.slice(0, count).map((el) => el.offsetWidth);
      if (widths.some((w) => w <= 0)) return;
      const moreWidth = kids[count].offsetWidth;
      const avail = row.clientWidth - (pinnedRef.current?.offsetWidth ?? 0);

      const countFor = (budget: number) => {
        let used = 0;
        let n = 0;
        for (const w of widths) {
          const next = used + GAP + w;
          if (next > budget) break;
          used = next;
          n += 1;
        }
        return n;
      };

      const full = countFor(avail);
      setVisible(full === count ? count : countFor(avail - GAP - moreWidth));
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(row);
    return () => ro.disconnect();
  }, [tabsKey]);

  const shown = tabs.slice(0, visible);
  const overflow = tabs.slice(visible);

  return (
    <div className="relative flex h-14 items-center bg-surface px-6">
      <div ref={rowRef} className="flex w-full items-center justify-center gap-2">
        <div ref={pinnedRef} className="flex shrink-0 items-center gap-2">
          <FavoritesPill
            label={t("Favorites")}
            count={favoriteCount}
            active={selected === FAVORITES_TAB}
            onClick={() => (favoriteCount === 0 ? onManageFavorites() : onSelect(FAVORITES_TAB))}
          />
          <GroupPill
            label={t("All")}
            active={selected === ALL_TAB}
            onClick={() => onSelect(ALL_TAB)}
          />
        </div>
        {shown.map((tab) => (
          <GroupPill
            key={tab.key}
            label={tab.label}
            active={selected === tab.key}
            onClick={() => onSelect(tab.key)}
          />
        ))}
        <SportsMoreMenu items={overflow} selected={selected} onSelect={onSelect} />
      </div>

      <div
        ref={mirrorRef}
        aria-hidden
        className="pointer-events-none absolute -top-[9999px] start-0 flex items-center gap-2"
      >
        {tabs.map((tab) => (
          <GroupPill key={tab.key} label={tab.label} active={false} mirror />
        ))}
        <GroupPill
          label={t("More")}
          active={false}
          mirror
          trailing={<ChevronDown size={11} strokeWidth={2.4} className="-me-0.5" />}
        />
      </div>
    </div>
  );
}

function GroupPill({
  label,
  active,
  onClick,
  mirror,
  trailing,
}: {
  label: string;
  active: boolean;
  onClick?: () => void;
  mirror?: boolean;
  trailing?: ReactNode;
}) {
  return (
    <button
      type="button"
      tabIndex={mirror ? -1 : undefined}
      aria-pressed={mirror ? undefined : active}
      onClick={onClick}
      className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[12.5px] font-medium transition-colors ${
        active
          ? "border-transparent bg-ink text-canvas"
          : "border-edge-soft/60 bg-elevated text-ink-muted hover:border-edge hover:text-ink"
      }`}
    >
      <span className="whitespace-nowrap">{label}</span>
      {trailing}
    </button>
  );
}

function FavoritesPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[12.5px] font-medium transition-colors ${
        active
          ? "border-transparent bg-ink text-canvas"
          : "border-edge-soft/60 bg-elevated text-ink-muted hover:border-edge hover:text-ink"
      } ${count === 0 ? "opacity-60" : ""}`}
    >
      <Star size={13} strokeWidth={2.2} fill={count > 0 ? "currentColor" : "none"} />
      <span className="whitespace-nowrap">{label}</span>
      {count > 0 && (
        <span
          className={`flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums ${
            active ? "bg-canvas/25 text-canvas" : "bg-raised text-ink-muted"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}
