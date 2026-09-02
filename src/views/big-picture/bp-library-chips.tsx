import type { ReactNode } from "react";
import { SFX } from "@/lib/sfx";

// The chip band bleeds to the physical screen edge so the strip reads as
// continuing off screen. The ramp is one gutter wide at both ends, which is
// exactly where the first chip starts, so nothing is faded until the row is
// actually scrolled. Symmetric, so RTL needs no second value.
export const BP_CHIP_EDGE_MASK =
  "linear-gradient(90deg, transparent 0, #000 var(--bp-gutter), #000 calc(100% - var(--bp-gutter)), transparent 100%)";

const TRACK =
  "flex items-center gap-[clamp(6px,0.6vw,12px)] overflow-x-auto py-[26px] ps-[22px] -my-[26px] -ms-[22px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

// [data-bp-row] carries the page gutter as padding plus a matching negative
// margin. Inside a dialog panel that pushes the strip outside the panel.
const FLUSH = { paddingInline: 0, marginInline: 0 } as const;

export function BpChipRow({
  children,
  trailing,
  flush,
}: {
  children: ReactNode;
  trailing?: ReactNode;
  flush?: boolean;
}) {
  return (
    <div
      data-bp-row
      style={flush ? FLUSH : undefined}
      className="flex items-center gap-[clamp(6px,0.6vw,12px)]"
    >
      <div data-bp-scroll-x className={TRACK}>
        {children}
      </div>
      {trailing}
    </div>
  );
}

export function BpChip({
  label,
  count,
  selected,
  disabled,
  icon,
  restoreKey,
  autofocus,
  ariaLabel,
  onSelect,
}: {
  label: string;
  count?: number;
  selected?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  restoreKey?: string;
  autofocus?: boolean;
  /** For a chip whose visible label is its VALUE rather than its name. */
  ariaLabel?: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-chip
      data-bp-disabled={disabled ? "true" : undefined}
      data-bp-restore-key={restoreKey}
      data-bp-autofocus={autofocus ? "true" : undefined}
      aria-label={ariaLabel}
      aria-pressed={selected}
      onClick={() => {
        if (disabled) return;
        SFX.click();
        onSelect();
      }}
      className={`flex h-[clamp(44px,5vh,58px)] shrink-0 items-center gap-[clamp(5px,0.45vw,9px)] rounded-full px-[clamp(14px,1.2vw,22px)] text-[clamp(12.5px,1.78vh,20px)] font-semibold transition-colors duration-[var(--bp-dur-fast)] ${
        disabled ? "opacity-55" : ""
      } ${
        selected
          ? "bg-[var(--bp-on)] text-ink"
          : "border border-[var(--bp-edge)] text-ink-subtle"
      }`}
    >
      {icon}
      <span className="max-w-[clamp(160px,24vw,380px)] truncate">{label}</span>
      {count != null && (
        <span className="text-[clamp(10.5px,1.4vh,16px)] font-bold opacity-60">{count}</span>
      )}
    </button>
  );
}

export function BpChipDivider() {
  return (
    <span
      aria-hidden
      className="h-[clamp(20px,2.4vh,30px)] w-px shrink-0 bg-[var(--bp-edge)] opacity-70"
    />
  );
}
