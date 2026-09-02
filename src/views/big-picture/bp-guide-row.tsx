import { useState } from "react";
import { Star, Tv } from "lucide-react";
import { useFavorites } from "@/lib/iptv/favorites";
import type { EpgProgram, IptvChannel } from "@/lib/iptv/types";
import { channelNumber } from "@/views/live/live-home/now-format";
import { BpGuideBlock } from "./bp-guide-block";
import type { GuideMetrics } from "./bp-guide-geometry";
import { laneHasProgram, type BpGuideCell } from "./bp-guide-lane";
import { bpChannelLabel, bpGroupLabel, type BpChannelLabel } from "./bp-guide-title";
import { useBpT } from "./bp-i18n";
import type { BpGuideRow as BpGuideRowData } from "./use-bp-guide-data";
import { bpVisibleCells, type BpGuideCursor } from "./use-bp-guide-layout";

const RING =
  "data-[bp-focus=true]:bg-[var(--bp-focus-face)] data-[bp-focus=true]:shadow-[inset_0_0_0_2px_var(--bp-focus-stroke)]";

// The column holds exactly one focusable and it is the star, not the name. A
// real ten foot guide has no focusable channel column, because Left has to mean
// "earlier" without a dead end. Play is not lost: Enter on any programme cell
// tunes the channel regardless of which programme is under the ring.
// data-bp-guide-cell stays "channel" so queryCell, BpGuideCursor.kind and
// applyCursor's early return all keep working untouched.
function BpGuideChannelCell({
  channel,
  label,
  group,
  index,
  width,
  sourceId,
  focused,
}: {
  channel: IptvChannel;
  label: BpChannelLabel;
  group: string | null;
  index: number;
  width: number;
  sourceId: string;
  focused: boolean;
}) {
  const t = useBpT();
  const favorites = useFavorites();
  const [broken, setBroken] = useState(false);
  const logo = channel.logo && !broken ? channel.logo : null;
  const chno = channelNumber(channel.attrs) ?? String(index + 1).padStart(3, "0");
  const isFav = favorites.has(channel.id);

  return (
    <div
      style={{
        width,
        flex: `0 0 ${width}px`,
        background: "var(--bp-panel)",
        borderInlineEnd: "1px solid var(--bp-edge)",
        borderBottom: "1px solid var(--bp-edge-2)",
      }}
      className="flex h-full items-center gap-[clamp(6px,0.5vw,11px)] overflow-hidden ps-[calc(var(--bp-safe-x,0px)_+_clamp(9px,0.8vw,17px))] pe-[clamp(6px,0.5vw,10px)]"
    >
      <span className="shrink-0 text-[clamp(12.5px,1.45vh,17px)] font-bold tabular-nums text-ink-subtle">
        {chno}
      </span>

      <span
        className="flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--bp-r-xs)] bg-[var(--bp-panel-2)]"
        style={{ width: "clamp(44px, 3.4vw, 66px)", height: "clamp(28px, 2.2vw, 42px)" }}
      >
        {logo ? (
          <img
            src={logo}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setBroken(true)}
            className="max-h-[78%] max-w-[82%] object-contain"
          />
        ) : (
          <Tv size={17} strokeWidth={1.8} className="text-ink-subtle" />
        )}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-[1px]">
        <span className="flex min-w-0 items-center gap-[clamp(4px,0.35vw,8px)]">
          <span
            dir="auto"
            className="truncate text-[clamp(16px,1.9vh,23px)] font-semibold text-ink"
          >
            {label.name}
          </span>
          {label.badge && (
            <span className="shrink-0 rounded-[4px] border border-[var(--bp-edge-2)] px-[4px] text-[clamp(8.5px,1.05vh,11px)] font-bold text-ink-subtle">
              {label.badge}
            </span>
          )}
        </span>
        {group && (
          <span
            dir="auto"
            className="truncate text-[clamp(12.5px,1.4vh,16px)] font-medium text-ink-subtle"
          >
            {group}
          </span>
        )}
      </span>

      <button
        type="button"
        data-bp-focusable
        data-bp-guide-row={index}
        data-bp-guide-cell="channel"
        data-bp-autofocus={focused ? "true" : undefined}
        data-bp-restore-key={`iptv:${sourceId}:${channel.id}`}
        onClick={() => favorites.toggle(channel)}
        aria-pressed={isFav}
        aria-label={
          isFav
            ? t("Unfavorite {channel}", { channel: label.name })
            : t("Favorite {channel}", { channel: label.name })
        }
        style={{ width: "clamp(44px, 2.4vw, 48px)", height: "clamp(44px, 4.4vh, 60px)" }}
        className={`${RING} flex shrink-0 items-center justify-center rounded-[var(--bp-r-xs)] transition-[background-color,box-shadow,color] duration-[var(--bp-dur-fast)] ease-[var(--bp-ease)] ${
          isFav ? "text-[var(--bp-touch)]" : "text-ink-subtle"
        }`}
      >
        <Star
          className="h-[clamp(20px,2.2vh,28px)] w-[clamp(20px,2.2vh,28px)]"
          strokeWidth={2}
          fill={isFav ? "currentColor" : "none"}
        />
      </button>
    </div>
  );
}

export function BpGuideRow({
  row,
  index,
  cells,
  windowStart,
  viewStartMs,
  metrics,
  nowMs,
  cursor,
  sourceId,
  onPlay,
}: {
  row: BpGuideRowData;
  index: number;
  cells: BpGuideCell[];
  windowStart: number;
  viewStartMs: number;
  metrics: GuideMetrics;
  nowMs: number;
  cursor: BpGuideCursor;
  sourceId: string;
  onPlay: (channel: IptvChannel, program: EpgProgram | null) => void;
}) {
  const t = useBpT();
  const onCursorRow = cursor.row === index;
  const held = onCursorRow && cursor.kind === "program" ? cursor.cellStart : null;
  const mounted = bpVisibleCells(cells, viewStartMs, metrics.visibleMs, held);
  const populated = laneHasProgram(cells);
  const offsetPx = (viewStartMs - windowStart) * metrics.pxPerMs;
  const label = bpChannelLabel(row.channel.name);
  const group = bpGroupLabel(row.channel.group, label.name);

  // Two weights, never one on the whole row. The lane's rule being the weaker
  // of the two is part of what makes the lane read as ground and the column
  // read as a different surface.
  return (
    <div className="flex" style={{ height: metrics.rowPx }}>
      <BpGuideChannelCell
        channel={row.channel}
        label={label}
        group={group}
        index={index}
        width={metrics.colPx}
        sourceId={sourceId}
        focused={onCursorRow && cursor.kind === "channel"}
      />
      <div
        className="relative h-full min-w-0 flex-1 overflow-hidden"
        style={{ borderBottom: "1px solid var(--bp-edge)" }}
      >
        <div
          className="absolute inset-0 transition-transform duration-[var(--bp-dur-fast)] ease-[var(--bp-ease)]"
          style={{ transform: `translate3d(${-offsetPx}px, 0, 0)` }}
        >
          {mounted.map((cell) => (
            <BpGuideBlock
              key={cell.startMs}
              cell={cell}
              row={index}
              windowStart={windowStart}
              metrics={metrics}
              nowMs={nowMs}
              focused={held === cell.startMs}
              title={cell.program?.title ?? ""}
              channelName={label.name}
              onPlay={() => onPlay(row.channel, cell.program)}
            />
          ))}
        </div>
        {/* Anchored to the lane viewport, outside the translated track, so an
            unscheduled row says this once at the lane origin instead of
            repeating in every slot as the window pans. It stays visible while
            the row is focused: hiding it left a blank band with a ring on it. */}
        {!populated && (
          <span className="pointer-events-none absolute inset-y-0 start-0 z-[1] flex items-center ps-[clamp(9px,0.8vw,17px)] text-[clamp(13px,1.5vh,17px)] font-medium text-ink-subtle">
            {t("No program info")}
          </span>
        )}
      </div>
    </div>
  );
}
