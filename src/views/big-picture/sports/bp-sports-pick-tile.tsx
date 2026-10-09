import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { SFX } from "@/lib/sfx";

const TILE =
  "group relative flex aspect-[5/4] flex-col items-center justify-center gap-[clamp(6px,0.9vh,14px)] overflow-hidden rounded-[var(--bp-r-md)] border px-[clamp(7px,0.7vw,14px)] text-center transition-colors duration-[var(--bp-dur-fast)] motion-reduce:transition-none data-[bp-focus=true]:border-transparent data-[bp-focus=true]:bg-[var(--bp-focus-face)]";
const TILE_LABEL =
  "line-clamp-2 text-[calc(clamp(11.5px,1.6vh,19px)*var(--bp-up,1))] font-bold leading-[1.2] text-ink-muted transition-colors duration-[var(--bp-dur-fast)] motion-reduce:transition-none group-data-[bp-focus=true]:text-ink";

const BADGE =
  "absolute end-[clamp(6px,0.6vw,11px)] top-[clamp(6px,0.6vw,11px)] flex h-[clamp(22px,2.6vh,32px)] w-[clamp(22px,2.6vh,32px)] items-center justify-center rounded-full bg-[var(--bp-void)] text-ink";

export function BpPickTile({
  label,
  mark,
  on,
  onSelect,
  restoreKey,
}: {
  label: string;
  mark: ReactNode;
  on: boolean;
  onSelect: () => void;
  restoreKey: string;
}) {
  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-tile
      data-bp-restore-key={restoreKey}
      aria-pressed={on}
      onClick={() => {
        SFX.click();
        onSelect();
      }}
      className={`${TILE} ${
        on ? "border-transparent bg-[var(--bp-on)]" : "border-[var(--bp-edge)] bg-[var(--bp-panel)]"
      }`}
    >
      {mark}
      <span className={TILE_LABEL}>{label}</span>
      {on && (
        <span aria-hidden className={BADGE}>
          <Check className="h-[62%] w-[62%]" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}
