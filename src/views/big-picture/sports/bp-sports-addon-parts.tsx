import { useState, type CSSProperties } from "react";
import { Plug } from "lucide-react";
import { BP_ACTION_RING } from "../bp-action-style";

export const BP_ADDON_LIFT = { "--bp-focus-lift-wide": "1.012" } as CSSProperties;

export const BP_ADDON_FLUSH = {
  paddingInline: 0,
  marginInline: 0,
  containIntrinsicSize: "auto 100px",
} as const;

export const BP_ADDON_CELL =
  "flex min-h-[clamp(62px,7vh,88px)] shrink-0 items-center gap-[clamp(12px,1.1vw,22px)] rounded-[var(--bp-r-sm)] bg-[var(--bp-panel-2)] px-[clamp(16px,1.4vw,28px)] py-[clamp(10px,1.1vh,16px)] text-start data-[bp-focus=true]:bg-[var(--color-ink)] data-[bp-focus=true]:text-[var(--color-canvas)]";

export const BP_ADDON_CHIP = `h-[clamp(52px,6vh,74px)] shrink-0 rounded-[var(--bp-r-xs)] bg-[var(--bp-panel-2)] px-[clamp(18px,1.5vw,30px)] text-[calc(clamp(15px,2vh,24px)*var(--bp-up,1))] font-bold text-ink ${BP_ACTION_RING}`;

export const BP_ADDON_TITLE =
  "truncate text-[calc(clamp(15px,2.05vh,25px)*var(--bp-up,1))] font-bold";

export const BP_ADDON_SUB =
  "truncate text-[calc(clamp(12px,1.6vh,19px)*var(--bp-up,1))] font-semibold text-ink-subtle";

export const BP_ADDON_NOTE =
  "text-[calc(clamp(14px,1.9vh,23px)*var(--bp-up,1))] leading-[1.55] text-ink-muted";

export const BP_ADDON_HEAD =
  "font-display text-[calc(clamp(22px,3.1vh,38px)*var(--bp-up,1))] font-semibold leading-[1.1] tracking-[-0.02em] text-ink";

export const BP_ADDON_SPIN = "animate-spin motion-reduce:[animation-duration:2.4s]";

export function BpSportsAddonMark({ src }: { src?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <Plug size={26} strokeWidth={2.1} className="shrink-0" aria-hidden />;
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
      className="h-[clamp(38px,4.4vh,60px)] w-[clamp(38px,4.4vh,60px)] shrink-0 rounded-[8px] object-contain"
    />
  );
}
