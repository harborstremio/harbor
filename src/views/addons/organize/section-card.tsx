import { AddonLogo } from "@/components/addon-logo";
import { HoverTooltip } from "@/components/hover-tooltip";
import { useT } from "@/lib/i18n";
import { ArrowDown, ArrowUp, ChevronsUp, GripVertical } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";

import type { DragList } from "./use-drag-list";

export type OrganizeEntry = {
  key: string;
  name: string;
  host: string;
  addonId: string;
  logo: string | null;
};

const BTN =
  "flex h-10 w-10 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-raised hover:text-ink disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-ink-muted";

export function SectionCard({
  title,
  sub,
  count,
  children,
}: {
  title: string;
  sub: string;
  count: number;
  children: ReactNode;
}) {
  const t = useT();
  return (
    <section className="rounded-2xl border border-edge-soft bg-elevated/40 p-5 sm:p-6">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="font-display text-[21px] font-medium tracking-tight text-ink">{title}</h2>
          <p className="text-[12.5px] text-ink-muted">{sub}</p>
        </div>
        <span className="shrink-0 rounded-full bg-raised px-3 py-1 text-[12px] font-semibold text-ink-muted">
          {count === 1 ? t("{n} addon", { n: count }) : t("{n} addons", { n: count })}
        </span>
      </div>
      {children}
    </section>
  );
}

export function OrganizeList({
  entries,
  drag,
  busy,
  onMove,
  onMoveTop,
}: {
  entries: OrganizeEntry[];
  drag: DragList;
  busy: boolean;
  onMove: (index: number, delta: -1 | 1) => void;
  onMoveTop: (index: number) => void;
}) {
  return (
    <div className={`flex flex-col gap-2.5 ${drag.dragIndex != null ? "select-none" : ""}`}>
      {entries.map((entry, i) => (
        <OrganizeRow
          key={entry.key}
          entry={entry}
          position={i + 1}
          rowRef={drag.rowRef(i)}
          handleProps={busy ? {} : drag.handleProps(i)}
          dragging={drag.dragIndex === i}
          indicator={
            drag.dragIndex != null && drag.overIndex === i && drag.overIndex !== drag.dragIndex
              ? drag.overIndex < drag.dragIndex
                ? "above"
                : "below"
              : null
          }
          canUp={!busy && i > 0}
          canDown={!busy && i < entries.length - 1}
          onUp={() => onMove(i, -1)}
          onDown={() => onMove(i, 1)}
          onTop={() => onMoveTop(i)}
        />
      ))}
    </div>
  );
}

function OrganizeRow({
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
}: {
  entry: OrganizeEntry;
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
}) {
  const t = useT();
  return (
    <div
      ref={rowRef}
      className={`relative flex items-center gap-3 rounded-2xl border border-edge-soft bg-elevated px-3 py-3 sm:gap-4 sm:px-4 ${
        dragging ? "opacity-50 ring-1 ring-accent/40" : ""
      }`}
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
        className="flex h-10 w-8 shrink-0 cursor-grab touch-none items-center justify-center text-ink-subtle transition-colors hover:text-ink active:cursor-grabbing"
      >
        <GripVertical size={18} strokeWidth={2.2} />
      </span>
      <AddonLogo addonId={entry.addonId} addonName={entry.name} manifestLogo={entry.logo} size="lg" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-medium text-ink">{entry.name}</span>
        <span className="truncate text-[12px] text-ink-subtle">{entry.host}</span>
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
      </div>
    </div>
  );
}

export function SkeletonRows() {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-[66px] animate-pulse rounded-2xl border border-edge-soft bg-elevated/50"
          style={{ animationDelay: `${i * 70}ms` }}
        />
      ))}
    </div>
  );
}
