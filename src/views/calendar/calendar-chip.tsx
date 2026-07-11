import { Poster, usePosterChain } from "@/components/poster";
import type { CalendarItem } from "@/lib/calendar";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { formatDateLong } from "./utils";

export function CalendarChip({ item, onOpen }: { item: CalendarItem; onOpen: (item: CalendarItem) => void }) {
  const t = useT();
  const { settings } = useSettings();
  const poster = usePosterChain(
    settings.rpdbKey,
    item.id,
    item.poster ?? undefined,
    item.type === "tv" ? "series" : "movie",
  );
  const [hovered, setHovered] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const tag = item.isAnime ? t("Anime") : item.type === "movie" ? t("Movie") : t("TV");
  const tagClass = item.isAnime
    ? "bg-rose-400/20 text-rose-200"
    : item.type === "movie"
      ? "bg-amber-400/20 text-amber-200"
      : "bg-blue-400/20 text-blue-200";
  return (
    <button
      ref={ref}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(item);
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative flex min-w-0 items-center gap-2 rounded-md bg-canvas/50 p-1 pe-2 text-start transition-colors hover:bg-canvas/85"
    >
      <div className="h-7 w-5 shrink-0 overflow-hidden rounded-[3px] bg-elevated/50">
        {item.poster ? (
          <Poster src={poster.src} onError={poster.onError} seed={item.id} ratio="portrait" className="h-full w-full" />
        ) : null}
      </div>
      <span className="flex-1 truncate text-[11.5px] font-medium text-ink">{item.name}</span>
      <span
        className={`hidden shrink-0 rounded-sm px-1 py-px text-[9px] font-bold uppercase tracking-[0.12em] xl:inline ${tagClass}`}
      >
        {tag}
      </span>
      {hovered && <ChipTooltip item={item} anchorRef={ref} />}
    </button>
  );
}

function ChipTooltip({ item, anchorRef }: { item: CalendarItem; anchorRef: React.RefObject<HTMLElement | null> }) {
  const t = useT();
  const { settings } = useSettings();
  const poster = usePosterChain(
    settings.rpdbKey,
    item.id,
    item.poster ?? undefined,
    item.type === "tv" ? "series" : "movie",
  );
  const tipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; ready: boolean }>({
    left: 0,
    top: 0,
    ready: false,
  });

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const tip = tipRef.current;
    if (!anchor || !tip) return;
    const rect = anchor.getBoundingClientRect();
    const tw = tip.offsetWidth || 320;
    const th = tip.offsetHeight || 220;
    const margin = 8;
    let left = rect.right + margin;
    if (left + tw > window.innerWidth - 16) left = rect.left - tw - margin;
    if (left < 16) left = 16;
    let top = rect.top + rect.height / 2 - th / 2;
    top = Math.max(16, Math.min(top, window.innerHeight - th - 16));
    setPos({ left, top, ready: true });
  }, [anchorRef, item.id]);

  const tag = item.isAnime ? t("Anime") : item.type === "movie" ? t("Movie") : t("TV");
  const dateLabel = formatDateLong(item.releaseDate);

  return createPortal(
    <div
      ref={tipRef}
      onClick={(e) => e.stopPropagation()}
      style={{ left: pos.left, top: pos.top, opacity: pos.ready ? 1 : 0 }}
      className="pointer-events-none fixed z-[200] flex w-[320px] flex-col gap-3 rounded-2xl border border-edge bg-elevated/95 p-4 shadow-[0_24px_60px_-18px_rgba(0,0,0,0.7)] backdrop-blur-md transition-opacity duration-100"
    >
      <div className="flex items-start gap-3">
        <div className="h-[120px] w-[80px] shrink-0 overflow-hidden rounded-lg bg-canvas/40 ring-1 ring-edge-soft">
          {item.poster ? (
            <Poster
              src={poster.src}
              onError={poster.onError}
              seed={item.id}
              ratio="portrait"
              className="h-full w-full"
            />
          ) : null}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-ink-subtle">{tag}</span>
          <p className="text-[14px] font-semibold leading-tight text-ink">{item.name}</p>
          <p className="text-[12px] text-ink-muted">{dateLabel}</p>
          {item.voteAverage > 0 && (
            <p className="text-[11.5px] text-ink-muted">
              <span className="text-amber-300">★</span> {item.voteAverage.toFixed(1)}
            </p>
          )}
        </div>
      </div>
      {item.overview && <p className="line-clamp-4 text-[12px] leading-relaxed text-ink-muted">{item.overview}</p>}
    </div>,
    document.body,
  );
}
