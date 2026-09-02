import { Fragment, type ReactNode } from "react";
import { ChevronRight, LogOut } from "lucide-react";
import { ServiceLogo } from "@/components/service-logo";
import type { StreamingService } from "@/lib/settings";
import { SFX } from "@/lib/sfx";
import { BP_ROW_FLUSH } from "./onboarding/bp-step-parts";
import type { BpMultiItem, BpOption } from "./bp-settings-catalog";

/**
 * Every row here is a direct child of the column, which is the [data-bp-scroll-y]
 * element, so bpRailStep resolves the rail as row.parentElement and vertical
 * never measures the page. Wrapping any of these in another div breaks that.
 *
 * contain-intrinsic-size is set per row because the [data-bp-row] rule in
 * bp-tokens defaults it to 340px, which is a catalog row and five times these.
 */
const CONTROL_ROW = { ...BP_ROW_FLUSH, containIntrinsicSize: "auto 64px" } as const;

const CELL_BASE =
  "flex shrink-0 items-center justify-center rounded-[var(--bp-r-sm)] border text-center transition-colors duration-[var(--bp-dur-fast)]";

const CELL_ON = "border-transparent bg-[var(--bp-glass)] font-bold text-ink";
const CELL_OFF = "border-[var(--bp-edge)] bg-[var(--bp-panel)] font-semibold text-ink-subtle";

const TRACK =
  "flex gap-[clamp(5px,0.5vw,10px)] overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

const LABEL =
  "block truncate text-[clamp(11px,1.45vh,15px)] font-bold uppercase tracking-[0.14em] text-ink-subtle";

const CELL_H = "h-[clamp(44px,5.6vh,58px)]";

// Rendered at its own value so the control shows the thing rather than naming
// it. Four words for four sizes is a paragraph a remote cannot judge.
const LETTER_PX: Record<string, string> = {
  "24": "15px",
  "32": "19px",
  "44": "24px",
  "60": "30px",
};

export function BpSettingsColumnBox({
  children,
  scrollRef,
  scrollable = false,
}: {
  children: ReactNode;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  scrollable?: boolean;
}) {
  return (
    // Categories fit the fixed box and stay still. Control rows may grow when a
    // choice group becomes a grid, so that depth opts into the focus engine's
    // centred vertical scrolling instead of letting lower settings clip.
    <div
      ref={scrollRef}
      data-bp-scroll-y
      data-bp-center={scrollable ? "" : undefined}
      className={`flex min-h-0 w-[clamp(330px,38%,470px)] shrink-0 flex-col gap-[clamp(5px,0.8vh,10px)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
        scrollable ? "overflow-y-auto" : "overflow-hidden"
      }`}
    >
      {children}
    </div>
  );
}

export function BpCategoryRow({
  index,
  label,
  summary,
  active,
  autofocus,
  onPress,
  onFocus,
}: {
  index: number;
  label: string;
  summary: string;
  active: boolean;
  autofocus: boolean;
  onPress: () => void;
  onFocus: () => void;
}) {
  return (
    <div data-bp-rail-row={index} className="shrink-0">
      <button
        type="button"
        data-bp-focusable
        data-bp-chip
        data-bp-autofocus={autofocus ? "true" : undefined}
        onFocus={onFocus}
        onClick={() => {
          SFX.click();
          onPress();
        }}
        className={`flex h-[clamp(46px,6.6vh,62px)] w-full items-center gap-[clamp(10px,1vw,18px)] rounded-[var(--bp-r-sm)] px-[clamp(12px,1.2vw,22px)] text-start transition-colors duration-[var(--bp-dur-fast)] ${
          active ? "bg-[var(--bp-glass)]" : "bg-transparent"
        }`}
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[clamp(15px,2.1vh,21px)] font-bold leading-tight text-ink">
            {label}
          </span>
          <span className="truncate text-[clamp(11px,1.5vh,15px)] font-medium leading-tight text-ink-subtle">
            {summary}
          </span>
        </span>
        <ChevronRight size={18} strokeWidth={2.4} className="shrink-0 opacity-55" />
      </button>
    </div>
  );
}

export function BpOptionRow({
  index,
  label,
  value,
  options,
  letter,
  columns,
  autofocus,
  onPick,
  onCellFocus,
}: {
  index: number;
  label: string;
  value: string;
  options: BpOption[];
  letter?: boolean;
  columns?: 2;
  autofocus: boolean;
  onPick: (value: string) => void;
  onCellFocus?: (value: string) => void;
}) {
  const rows =
    columns === 2
      ? Array.from({ length: Math.ceil(options.length / 2) }, (_, row) =>
          options.slice(row * 2, row * 2 + 2),
        )
      : [options];

  return (
    <Fragment>
      {rows.map((row, rowIndex) => (
        <div
          key={`${label}:${rowIndex}`}
          data-bp-rail-row={index + rowIndex}
          data-bp-row
          style={CONTROL_ROW}
          className="shrink-0"
        >
          {rowIndex === 0 && <span className={LABEL}>{label}</span>}
          <div
            data-bp-scroll-x
            className={`${TRACK} ${rowIndex === 0 ? "mt-[clamp(3px,0.5vh,7px)]" : ""}`}
          >
            {row.map((o, cellIndex) => {
              const optionIndex = rowIndex * 2 + cellIndex;
              const on = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  data-bp-focusable
                  data-bp-chip
                  data-bp-autofocus={autofocus && optionIndex === 0 ? "true" : undefined}
                  aria-pressed={on}
                  aria-label={o.label}
                  onFocus={onCellFocus ? () => onCellFocus(o.value) : undefined}
                  onClick={() => {
                    SFX.click();
                    onPick(o.value);
                  }}
                  className={`${CELL_BASE} ${CELL_H} ${on ? CELL_ON : CELL_OFF} min-w-[clamp(56px,6vw,96px)] px-[clamp(6px,0.7vw,14px)] ${
                    columns === 2 ? "w-[calc((100%-clamp(5px,0.5vw,10px))/2)] flex-none" : "flex-1"
                  }`}
                  style={letter ? { fontSize: LETTER_PX[o.value] ?? "17px" } : undefined}
                >
                  {letter ? (
                    <span aria-hidden className="font-bold leading-none">
                      A
                    </span>
                  ) : (
                    <span className="truncate text-[clamp(12px,1.7vh,17px)] leading-tight">
                      {o.label}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </Fragment>
  );
}

export function BpMultiRow({
  index,
  label,
  items,
  render,
  autofocus,
  onToggle,
}: {
  index: number;
  label: string;
  items: BpMultiItem[];
  render: "logo" | "text";
  autofocus: boolean;
  onToggle: (value: string) => void;
}) {
  return (
    <div data-bp-rail-row={index} data-bp-row style={CONTROL_ROW} className="shrink-0">
      <span className={LABEL}>{label}</span>
      <div data-bp-scroll-x className={`${TRACK} mt-[clamp(3px,0.5vh,7px)]`}>
        {items.map((item, i) => (
          <button
            key={item.value}
            type="button"
            data-bp-focusable
            data-bp-chip
            data-bp-autofocus={autofocus && i === 0 ? "true" : undefined}
            aria-pressed={item.on}
            aria-label={item.label}
            onClick={() => {
              SFX.click();
              onToggle(item.value);
            }}
            className={`${CELL_BASE} ${CELL_H} ${item.on ? CELL_ON : CELL_OFF} gap-[clamp(4px,0.4vw,8px)] px-[clamp(9px,0.9vw,16px)] ${
              item.on ? "" : "opacity-60"
            }`}
          >
            {render === "logo" ? (
              <ServiceLogo service={item.value as StreamingService} height={20} />
            ) : (
              <span className="truncate text-[clamp(12px,1.7vh,17px)] leading-tight">
                {item.label}
              </span>
            )}
            {item.on && item.rank > 0 && (
              <span className="flex h-[clamp(18px,2.2vh,24px)] w-[clamp(18px,2.2vh,24px)] shrink-0 items-center justify-center rounded-full bg-[var(--bp-void)] text-[clamp(10px,1.3vh,14px)] font-bold text-ink">
                {item.rank}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export function BpPushRow({
  index,
  label,
  detail,
  autofocus,
  onPress,
}: {
  index: number;
  label: string;
  detail: string;
  autofocus: boolean;
  onPress: () => void;
}) {
  return (
    <div data-bp-rail-row={index} className="shrink-0">
      <button
        type="button"
        data-bp-focusable
        data-bp-chip
        data-bp-autofocus={autofocus ? "true" : undefined}
        onClick={() => {
          SFX.click();
          onPress();
        }}
        className="flex w-full items-center gap-[clamp(10px,1vw,18px)] rounded-[var(--bp-r-sm)] border border-[var(--bp-edge)] bg-[var(--bp-panel)] px-[clamp(12px,1.2vw,22px)] py-[clamp(9px,1.3vh,16px)] text-start transition-colors duration-[var(--bp-dur-fast)]"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[clamp(14px,2vh,20px)] font-bold leading-tight text-ink">
            {label}
          </span>
          <span className="truncate text-[clamp(11px,1.5vh,15px)] font-medium leading-tight text-ink-subtle">
            {detail}
          </span>
        </span>
        <ChevronRight size={18} strokeWidth={2.4} className="shrink-0 opacity-55" />
      </button>
    </div>
  );
}

export function BpActionRow({
  index,
  label,
  autofocus,
  onPress,
}: {
  index: number;
  label: string;
  autofocus: boolean;
  onPress: () => void;
}) {
  return (
    <div data-bp-rail-row={index} className="mt-auto shrink-0">
      <button
        type="button"
        data-bp-focusable
        data-bp-chip
        data-bp-autofocus={autofocus ? "true" : undefined}
        onClick={onPress}
        className="flex h-[clamp(46px,6.2vh,60px)] w-full items-center justify-center gap-[clamp(7px,0.7vw,12px)] rounded-[var(--bp-r-sm)] border border-[var(--bp-edge-2)] text-[clamp(14px,2vh,20px)] font-bold text-ink transition-colors duration-[var(--bp-dur-fast)]"
      >
        <LogOut size={17} strokeWidth={2.3} />
        {label}
      </button>
    </div>
  );
}
