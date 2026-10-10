import { ArrowDown, ArrowUp, ChevronsUp, GripVertical } from "lucide-react";
import { useMemo, useState, type HTMLAttributes } from "react";
import { HoverTooltip } from "@/components/hover-tooltip";
import { moveItem } from "@/lib/addons-store/reorder";
import { useT } from "@/lib/i18n";
import { useSettings, type AnimeIdPriorityEntry } from "@/lib/settings";
import { DEFAULT } from "@/lib/settings/defaults";
import { useDragList } from "@/views/addons/organize/use-drag-list";

import imdbLogo from "@/assets/imdb.webp";
import kitsuLogo from "@/assets/addon-logos/anime-kitsu.png";
import malLogo from "@/assets/mal.png";
import anidbLogo from "@/assets/anidb.webp";
import anilistLogo from "@/assets/anilist.png";
import tmdbLogo from "@/assets/addon-logos/tmdb.png";

const LOGOS: Record<string, string> = {
  tt: imdbLogo,
  kitsu: kitsuLogo,
  mal: malLogo,
  anidb: anidbLogo,
  anilist: anilistLogo,
  tmdb: tmdbLogo,
};

const BTN =
  "flex h-11 w-11 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-raised hover:text-ink disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-ink-muted";


export function resolveAnimeIdPriority(entries: AnimeIdPriorityEntry[]): AnimeIdPriorityEntry[] {
  if (entries.length === 0) return DEFAULT.animeIdPriority;
  return entries;
}

export function AnimeIdPriorityCard() {
  const t = useT();
  const { settings, update } = useSettings();
  const [announce, setAnnounce] = useState("");

  const entries = useMemo<AnimeIdPriorityEntry[]>(() => {
    if (settings.animeIdPriority.length > 0) return settings.animeIdPriority;
    return DEFAULT.animeIdPriority;
  }, [settings.animeIdPriority]);

  const isCustom = settings.animeIdPriority.length > 0;
  const enabledCount = entries.filter((e) => e.enabled).length;

  const commit = (next: AnimeIdPriorityEntry[], moved?: AnimeIdPriorityEntry, to?: number) => {
    update({ animeIdPriority: next });
    if (moved && to != null) {
      setAnnounce(
        t("Moved {name} to position {n} of {total}", {
          name: moved.label,
          n: to + 1,
          total: next.length,
        }),
      );
    }
  };

  const move = (from: number, to: number) => {
    const clamped = Math.max(0, Math.min(entries.length - 1, to));
    if (clamped === from) return;
    commit(moveItem(entries, from, clamped), entries[from], clamped);
  };

  const toggle = (index: number) => {
    const entry = entries[index];
    // Prevent disabling the last enabled ID
    if (entry.enabled && enabledCount <= 1) return;
    const next = entries.map((e, i) => (i === index ? { ...e, enabled: !e.enabled } : e));
    commit(next);
  };

  const drag = useDragList(entries.length, move);

  return (
    <section className="rounded-md bg-elevated px-4 py-3.5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-[13.5px] font-medium tracking-tight text-ink">
            {t("Anime ID priority")}
          </h2>
          <p className="max-w-[70ch] text-[12.5px] leading-relaxed text-ink-subtle">
            {t("When an anime has multiple IDs, addons are queried using the highest-priority enabled ID. Drag to reorder, toggle to enable or disable.")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          {isCustom && (
            <button
              type="button"
              onClick={() => {
                update({ animeIdPriority: [] });
                setAnnounce(t("Reset to defaults"));
              }}
              className="flex h-9 items-center rounded-full px-3 text-[12.5px] font-semibold text-ink-muted transition-colors hover:bg-raised hover:text-ink"
            >
              {t("Reset")}
            </button>
          )}
          <span className="rounded-full bg-raised px-2.5 py-0.5 text-[11.5px] font-semibold text-ink-muted">
            {enabledCount}/{entries.length}
          </span>
        </div>
      </div>

      <div className={`flex flex-col gap-2.5 ${drag.dragIndex != null ? "select-none" : ""}`}>
        {entries.map((entry, i) => (
          <AnimeIdRow
            key={entry.prefix}
            entry={entry}
            position={i + 1}
            rowRef={drag.rowRef(i)}
            handleProps={drag.handleProps(i)}
            dragging={drag.dragIndex === i}
            indicator={
              drag.dragIndex != null && drag.overIndex === i && drag.overIndex !== drag.dragIndex
                ? drag.overIndex < drag.dragIndex
                  ? "above"
                  : "below"
                : null
            }
            canUp={i > 0}
            canDown={i < entries.length - 1}
            onUp={() => move(i, i - 1)}
            onDown={() => move(i, i + 1)}
            onTop={() => move(i, 0)}
            onToggle={() => toggle(i)}
            isLastEnabled={entry.enabled && enabledCount <= 1}
          />
        ))}
      </div>

      <span aria-live="polite" className="sr-only">
        {announce}
      </span>
    </section>
  );
}

function AnimeIdRow({
  entry,
  position,
  rowRef,
  handleProps,
  dragging,
  indicator,
  canUp,
  canDown,
  onUp,
  onDown,
  onTop,
  onToggle,
  isLastEnabled,
}: {
  entry: AnimeIdPriorityEntry;
  position: number;
  rowRef: (el: HTMLDivElement | null) => void;
  handleProps: HTMLAttributes<HTMLElement>;
  dragging: boolean;
  indicator: "above" | "below" | null;
  canUp: boolean;
  canDown: boolean;
  onUp: () => void;
  onDown: () => void;
  onTop: () => void;
  onToggle: () => void;
  isLastEnabled: boolean;
}) {
  const t = useT();
  const logo = LOGOS[entry.prefix];
  return (
    <div
      ref={rowRef}
      className={`relative flex items-center gap-3 rounded-2xl border border-edge-soft bg-elevated px-2 py-1.5 sm:gap-4 sm:px-4 ${
        dragging ? "opacity-50 ring-1 ring-accent/40" : ""
      } ${!entry.enabled ? "opacity-60" : ""}`}
    >
      {indicator && (
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-x-2 h-[3px] rounded-full bg-accent ${
            indicator === "above" ? "-top-[7px]" : "-bottom-[7px]"
          }`}
        />
      )}
      <span className="hidden w-9 shrink-0 text-center font-display text-[19px] font-medium text-ink-subtle sm:block">
        {position}
      </span>
      <span
        {...handleProps}
        title={t("Drag to reorder")}
        className="flex h-11 w-10 shrink-0 cursor-grab touch-none items-center justify-center text-ink-subtle transition-colors hover:text-ink active:cursor-grabbing"
      >
        <GripVertical size={18} strokeWidth={2.2} />
      </span>
      {logo && (
        <img
          src={logo}
          alt=""
          className="h-9 w-9 shrink-0 rounded-lg object-contain"
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col items-start">
        <span className="max-w-full truncate text-[15px] font-medium text-ink">{entry.label}</span>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <HoverTooltip label={t("Move to top")} side="top" align="center" delayMs={200}>
          <button onClick={onTop} disabled={!canUp} aria-label={t("Move to top")} className={BTN}>
            <ChevronsUp size={17} strokeWidth={2.2} />
          </button>
        </HoverTooltip>
        <HoverTooltip label={t("Move up")} side="top" align="center" delayMs={200}>
          <button onClick={onUp} disabled={!canUp} aria-label={t("Move up")} className={BTN}>
            <ArrowUp size={17} strokeWidth={2.2} />
          </button>
        </HoverTooltip>
        <HoverTooltip label={t("Move down")} side="top" align="center" delayMs={200}>
          <button onClick={onDown} disabled={!canDown} aria-label={t("Move down")} className={BTN}>
            <ArrowDown size={17} strokeWidth={2.2} />
          </button>
        </HoverTooltip>
        <HoverTooltip
          label={isLastEnabled ? t("At least one ID must stay enabled") : entry.enabled ? t("Disable") : t("Enable")}
          side="top"
          align="center"
          delayMs={200}
        >
          <button
            type="button"
            onClick={onToggle}
            disabled={isLastEnabled}
            aria-label={entry.enabled ? t("Disable {name}", { name: entry.label }) : t("Enable {name}", { name: entry.label })}
            className={`flex h-11 w-11 items-center justify-center rounded-xl ${isLastEnabled ? "cursor-not-allowed" : ""}`}
          >
            <span
              aria-hidden
              className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${
                entry.enabled ? "bg-ink" : "bg-edge"
              } ${isLastEnabled ? "opacity-50" : ""}`}
            >
              <span
                className={`absolute start-[2px] top-0.5 h-5 w-5 rounded-full bg-canvas transition-transform ${
                  entry.enabled ? "translate-x-4 rtl:-translate-x-4" : "translate-x-0"
                }`}
              />
            </span>
          </button>
        </HoverTooltip>
      </div>
    </div>
  );
}
