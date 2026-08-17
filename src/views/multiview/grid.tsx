import { Move } from "lucide-react";
import { useRef, type RefObject } from "react";
import {
  SPLIT3A_MAX,
  SPLIT3A_MIN,
  SPLIT3B_MAX,
  SPLIT3B_MIN,
  SPLIT_MAX,
  SPLIT_MIN,
  layoutSlotCount,
  type Layout,
  type SlotChannel,
} from "@/lib/multiview/store";
import { Cell } from "./cell";

const HANDLE_CENTER_OFFSET = "0.875rem";

type Axis = "x" | "y";
type DividerDrag = { pointerId: number; value: number };
type NexusValue = { split: number; row: number; row2: number };
type NexusDrag = NexusValue & {
  pointerId: number;
  startX: number;
  startY: number;
  value: NexusValue;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function Divider({
  axis,
  split,
  min,
  max,
  onChange,
}: {
  axis: Axis;
  split: number;
  min: number;
  max: number;
  onChange: (pct: number) => void;
}) {
  const dragRef = useRef<DividerDrag | null>(null);
  const isX = axis === "x";

  const valueAt = (target: HTMLDivElement, clientX: number, clientY: number) => {
    const parent = target.parentElement;
    if (!parent) return null;
    const rect = parent.getBoundingClientRect();
    const size = isX ? rect.width : rect.height;
    if (size === 0) return null;
    const position = isX ? clientX - rect.left : clientY - rect.top;
    return clamp((position / size) * 100, min, max);
  };

  const preview = (target: HTMLDivElement, value: number) => {
    const panel = target.previousElementSibling;
    if (!(panel instanceof HTMLElement)) return;
    if (isX) panel.style.width = value + "%";
    else panel.style.height = value + "%";
  };

  const finish = () => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    if (drag.value !== split) onChange(drag.value);
  };

  return (
    <div
      role="separator"
      aria-orientation={isX ? "vertical" : "horizontal"}
      aria-valuenow={Math.round(split)}
      aria-valuemin={Math.round(min)}
      aria-valuemax={Math.round(max)}
      tabIndex={0}
      onPointerDown={(event) => {
        if (event.button !== 0 || !event.isPrimary || dragRef.current) return;
        dragRef.current = { pointerId: event.pointerId, value: split };
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        const value = valueAt(event.currentTarget, event.clientX, event.clientY);
        if (value == null) return;
        drag.value = value;
        preview(event.currentTarget, value);
      }}
      onPointerUp={(event) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        const value = valueAt(event.currentTarget, event.clientX, event.clientY);
        if (value != null) {
          drag.value = value;
          preview(event.currentTarget, value);
        }
        finish();
        try {
          event.currentTarget.releasePointerCapture(event.pointerId);
        } catch {
          /* ignore */
        }
      }}
      onPointerCancel={(event) => {
        if (dragRef.current?.pointerId === event.pointerId) finish();
      }}
      onKeyDown={(event) => {
        const increase = event.key === "ArrowRight" || event.key === "ArrowDown";
        const decrease = event.key === "ArrowLeft" || event.key === "ArrowUp";
        if (!increase && !decrease) return;
        event.preventDefault();
        onChange(clamp(split + (increase ? 2.5 : -2.5), min, max));
      }}
      className={
        "group relative z-10 shrink-0 touch-none outline-none " +
        (isX ? "w-3 cursor-col-resize" : "h-3 cursor-row-resize")
      }
    >
      <div
        className={
          "rounded-full bg-edge-soft/70 transition-colors group-hover:bg-accent group-focus-visible:bg-accent group-active:bg-accent " +
          (isX ? "mx-auto h-full w-[3px]" : "mx-auto h-[3px] w-full")
        }
      />
    </div>
  );
}

function Nexus({
  rootRef,
  leftRef,
  leftTopRef,
  rightTopRef,
  split,
  splitRow,
  splitRow2,
  onSplitChange,
  onSplitRowChange,
  onSplitRow2Change,
}: {
  rootRef: RefObject<HTMLDivElement | null>;
  leftRef: RefObject<HTMLDivElement | null>;
  leftTopRef: RefObject<HTMLDivElement | null>;
  rightTopRef: RefObject<HTMLDivElement | null>;
  split: number;
  splitRow: number;
  splitRow2: number;
  onSplitChange: (pct: number) => void;
  onSplitRowChange: (pct: number) => void;
  onSplitRow2Change: (pct: number) => void;
}) {
  const handleRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<NexusDrag | null>(null);

  const preview = (value: NexusValue) => {
    if (leftRef.current) leftRef.current.style.width = value.split + "%";
    if (leftTopRef.current) leftTopRef.current.style.height = value.row + "%";
    if (rightTopRef.current) rightTopRef.current.style.height = value.row2 + "%";
    if (handleRef.current) {
      handleRef.current.style.left = "calc(" + value.split + "% + " + HANDLE_CENTER_OFFSET + ")";
      handleRef.current.style.top =
        "calc(" + (value.row + value.row2) / 2 + "% + " + HANDLE_CENTER_OFFSET + ")";
    }
  };

  const valueAt = (clientX: number, clientY: number) => {
    const drag = dragRef.current;
    const root = rootRef.current;
    if (!drag || !root) return null;
    const rect = root.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return drag.value;

    const value = {
      split: clamp(drag.split + ((clientX - drag.startX) / rect.width) * 100, SPLIT_MIN, SPLIT_MAX),
      row: clamp(drag.row + ((clientY - drag.startY) / rect.height) * 100, SPLIT_MIN, SPLIT_MAX),
      row2: clamp(drag.row2 + ((clientY - drag.startY) / rect.height) * 100, SPLIT_MIN, SPLIT_MAX),
    };
    drag.value = value;
    return value;
  };

  const finish = (value?: NexusValue) => {
    const drag = dragRef.current;
    if (!drag) return;
    const next = value ?? drag.value;
    preview(next);
    dragRef.current = null;
    if (next.split !== split) onSplitChange(next.split);
    if (next.row !== splitRow) onSplitRowChange(next.row);
    if (next.row2 !== splitRow2) onSplitRow2Change(next.row2);
  };

  const center = (splitRow + splitRow2) / 2;

  return (
    <div
      ref={handleRef}
      title="Drag to resize all four panels"
      onPointerDown={(event) => {
        if (event.button !== 0 || !event.isPrimary || dragRef.current || !rootRef.current) return;
        dragRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          split,
          row: splitRow,
          row2: splitRow2,
          value: { split, row: splitRow, row2: splitRow2 },
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        const value = valueAt(event.clientX, event.clientY);
        if (value) preview(value);
      }}
      onPointerUp={(event) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        finish(valueAt(event.clientX, event.clientY) ?? undefined);
        try {
          event.currentTarget.releasePointerCapture(event.pointerId);
        } catch {
          /* ignore */
        }
      }}
      onPointerCancel={(event) => {
        if (dragRef.current?.pointerId === event.pointerId) finish();
      }}
      className="absolute z-20 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none select-none items-center justify-center rounded-full border border-edge-soft bg-elevated/95 text-ink-muted shadow-[0_3px_14px_rgba(0,0,0,0.28)] transition-colors hover:border-accent hover:bg-accent hover:text-black active:cursor-grabbing"
      style={{
        left: "calc(" + split + "% + " + HANDLE_CENTER_OFFSET + ")",
        top: "calc(" + center + "% + " + HANDLE_CENTER_OFFSET + ")",
      }}
    >
      <Move aria-hidden size={15} strokeWidth={2.2} />
    </div>
  );
}

export function Grid({
  layout,
  slots,
  focusIndex,
  split,
  splitRow,
  splitRow2,
  split3a,
  split3b,
  onPick,
  onClose,
  onFocus,
  onMute,
  onSplitChange,
  onSplitRowChange,
  onSplitRow2Change,
  onSplit3aChange,
  onSplit3bChange,
}: {
  layout: Layout;
  slots: (SlotChannel | null)[];
  focusIndex: number;
  split: number;
  splitRow: number;
  splitRow2: number;
  split3a: number;
  split3b: number;
  onPick: (slot: number) => void;
  onClose: (slot: number) => void;
  onFocus: (slot: number) => void;
  onMute: () => void;
  onSplitChange: (pct: number) => void;
  onSplitRowChange: (pct: number) => void;
  onSplitRow2Change: (pct: number) => void;
  onSplit3aChange: (pct: number) => void;
  onSplit3bChange: (pct: number) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const leftTopRef = useRef<HTMLDivElement>(null);
  const rightTopRef = useRef<HTMLDivElement>(null);
  const count = layoutSlotCount(layout);
  const renderCell = (index: number) => (
    <Cell
      key={index}
      slot={index}
      channel={slots[index] ?? null}
      focused={focusIndex === index}
      onPick={() => onPick(index)}
      onClose={() => onClose(index)}
      onFocus={() => onFocus(index)}
      onMute={onMute}
    />
  );

  if (layout === "2") {
    return (
      <div className="flex h-full w-full gap-2">
        <div className="flex h-full min-w-0" style={{ width: split + "%" }}>
          {renderCell(0)}
        </div>
        <Divider axis="x" split={split} min={SPLIT_MIN} max={SPLIT_MAX} onChange={onSplitChange} />
        <div className="flex h-full min-w-0 flex-1">{renderCell(1)}</div>
      </div>
    );
  }

  if (layout === "2v") {
    return (
      <div className="flex h-full w-full flex-col gap-2">
        <div className="flex h-full min-h-0" style={{ height: splitRow + "%" }}>
          {renderCell(0)}
        </div>
        <Divider
          axis="y"
          split={splitRow}
          min={SPLIT_MIN}
          max={SPLIT_MAX}
          onChange={onSplitRowChange}
        />
        <div className="flex h-full min-h-0 flex-1">{renderCell(1)}</div>
      </div>
    );
  }

  if (layout === "3") {
    return (
      <div className="flex h-full w-full gap-2">
        <div className="flex h-full min-w-0" style={{ width: split3a + "%" }}>
          {renderCell(0)}
        </div>
        <Divider
          axis="x"
          split={split3a}
          min={SPLIT3A_MIN}
          max={SPLIT3A_MAX}
          onChange={onSplit3aChange}
        />
        <div className="flex h-full min-w-0 flex-1 gap-2">
          <div className="flex h-full min-w-0" style={{ width: split3b + "%" }}>
            {renderCell(1)}
          </div>
          <Divider
            axis="x"
            split={split3b}
            min={SPLIT3B_MIN}
            max={SPLIT3B_MAX}
            onChange={onSplit3bChange}
          />
          <div className="flex h-full min-w-0 flex-1">{renderCell(2)}</div>
        </div>
      </div>
    );
  }

  if (layout === "2x2") {
    return (
      <div ref={rootRef} className="relative flex h-full w-full gap-2">
        <div
          ref={leftRef}
          className="flex h-full min-w-0 flex-col gap-2"
          style={{ width: split + "%" }}
        >
          <div ref={leftTopRef} className="flex h-full min-h-0" style={{ height: splitRow + "%" }}>
            {renderCell(0)}
          </div>
          <Divider
            axis="y"
            split={splitRow}
            min={SPLIT_MIN}
            max={SPLIT_MAX}
            onChange={onSplitRowChange}
          />
          <div className="flex h-full min-h-0 flex-1">{renderCell(1)}</div>
        </div>
        <Divider axis="x" split={split} min={SPLIT_MIN} max={SPLIT_MAX} onChange={onSplitChange} />
        <div className="flex h-full min-w-0 flex-1 flex-col gap-2">
          <div
            ref={rightTopRef}
            className="flex h-full min-h-0"
            style={{ height: splitRow2 + "%" }}
          >
            {renderCell(2)}
          </div>
          <Divider
            axis="y"
            split={splitRow2}
            min={SPLIT_MIN}
            max={SPLIT_MAX}
            onChange={onSplitRow2Change}
          />
          <div className="flex h-full min-h-0 flex-1">{renderCell(3)}</div>
        </div>
        <Nexus
          rootRef={rootRef}
          leftRef={leftRef}
          leftTopRef={leftTopRef}
          rightTopRef={rightTopRef}
          split={split}
          splitRow={splitRow}
          splitRow2={splitRow2}
          onSplitChange={onSplitChange}
          onSplitRowChange={onSplitRowChange}
          onSplitRow2Change={onSplitRow2Change}
        />
      </div>
    );
  }

  return (
    <div className="grid h-full w-full grid-cols-1 grid-rows-1">
      {Array.from({ length: count }, (_, index) => renderCell(index))}
    </div>
  );
}
