import type { ReactNode } from "react";
import { BP_SPORTS_LABEL } from "./bp-sports-extra-kit";

export const BP_LIVE_FIGURE =
  "font-display text-[calc(clamp(34px,4.8vh,64px)*var(--bp-up,1))] font-semibold leading-[0.92] tracking-[-0.03em] tabular-nums text-ink";

export const BP_LIVE_SURFACE =
  "relative block w-full overflow-hidden rounded-[var(--bp-r-sm)] bg-[var(--bp-void)]/55 ring-1 ring-[var(--bp-edge)]";

export const BP_LIVE_TAG =
  "text-[calc(clamp(12px,1.62vh,18px)*var(--bp-up,1))] font-semibold text-ink-muted";

export const BP_LIVE_SEAT =
  "flex items-center justify-center rounded-full text-[calc(clamp(10px,1.3vh,15px)*var(--bp-up,1))] font-bold tabular-nums";

export const BP_LIVE_READOUT =
  "flex w-full flex-wrap items-end gap-x-[clamp(20px,2.2vw,48px)] gap-y-[clamp(10px,1.2vh,18px)]";

export function BpLiveFigure({ value, label }: { value: ReactNode; label: string }) {
  return (
    <span className="flex min-w-[clamp(56px,5.2vw,104px)] flex-col gap-[clamp(3px,0.4vh,7px)]">
      <span className={BP_LIVE_FIGURE}>{value}</span>
      <span className={`${BP_SPORTS_LABEL} truncate`}>{label}</span>
    </span>
  );
}

export function BpLivePips({
  filled,
  total,
  label,
}: {
  filled: number;
  total: number;
  label: string;
}) {
  return (
    <span className="flex flex-col gap-[clamp(8px,1vh,15px)] pb-[clamp(3px,0.4vh,7px)]">
      <span className="flex items-center gap-[clamp(6px,0.6vw,11px)]">
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={`block h-[clamp(15px,1.9vh,26px)] w-[clamp(15px,1.9vh,26px)] rounded-full ${
              index < filled ? "bg-ink" : "bg-[var(--bp-edge-2)]"
            }`}
          />
        ))}
      </span>
      <span className={`${BP_SPORTS_LABEL} truncate`}>{label}</span>
    </span>
  );
}

export function BpLiveSeat({
  jersey,
  name,
  left,
  top,
  home,
}: {
  jersey: string;
  name: string;
  left: number;
  top: number;
  home: boolean;
}) {
  const face = home
    ? "bg-[var(--bp-on)] text-ink"
    : "bg-[var(--bp-void)]/85 text-ink ring-1 ring-[var(--bp-edge-2)]";
  return (
    <span
      className="absolute flex w-[clamp(56px,5.8vw,100px)] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-[3px]"
      style={{ left: `${left}%`, top: `${top}%` }}
    >
      <span
        className={`${BP_LIVE_SEAT} h-[clamp(25px,3.1vh,44px)] w-[clamp(25px,3.1vh,44px)] ${face}`}
      >
        {jersey || "-"}
      </span>
      <span
        className={`${BP_LIVE_TAG} w-full truncate text-center text-ink [text-shadow:0_1px_4px_var(--bp-void)]`}
      >
        {name}
      </span>
    </span>
  );
}
