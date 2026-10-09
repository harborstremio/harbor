import type { ReactNode } from "react";
import { SFX } from "@/lib/sfx";

const SHELL =
  "group relative flex shrink-0 flex-col justify-between overflow-hidden rounded-[var(--bp-r-md)] border border-[var(--bp-edge)] bg-[var(--bp-panel)] p-[clamp(14px,1.2vw,26px)] text-start transition-[transform,box-shadow] duration-[var(--bp-dur)] ease-[var(--bp-ease)]";

// A band's way in, as a real cell rather than as decoration.
//
// It CLOSES the band, it does not open it. As the first cell it cost a full
// poster of first-screen content on a 1140px canvas, one cell in four to five,
// and on Discover it also reprinted a title the page hero was already printing
// in an h1 directly above the rail: the same fact twice on one screen, with the
// second copy charged at the price of content. At the end of the track it is
// reached by the natural Right press, the way every see-all in Big Picture is,
// and bpRailStep's bp-lead: predicate still steps over it on vertical entry so
// repeated Down reaches titles rather than stopping on an escape.
//
// So the caller passes the ACTION as `label` and the band name as `action`: an
// end cap reads as "and here is the way in", not as a second heading.
export function BpLeadTile({
  label,
  action,
  tint,
  mark,
  autofocus,
  restoreKey,
  width = "clamp(178px, 15vw, 300px)",
  ratio = "5 / 4",
  onSelect,
}: {
  label: string;
  action: string;
  tint?: string;
  mark?: ReactNode;
  autofocus?: boolean;
  restoreKey: string;
  width?: string;
  ratio?: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-tile
      data-bp-autofocus={autofocus ? "true" : undefined}
      data-bp-restore-key={restoreKey}
      onClick={() => {
        SFX.click();
        onSelect();
      }}
      aria-label={`${label}, ${action}`}
      className={SHELL}
      style={{ width, aspectRatio: ratio }}
    >
      {tint && (
        <span
          aria-hidden
          className="absolute inset-0 opacity-70"
          style={{
            background: `linear-gradient(150deg, color-mix(in oklab, ${tint} 26%, transparent), transparent 68%)`,
          }}
        />
      )}
      <span className="relative flex min-h-0 flex-1 items-start">{mark}</span>
      <span className="relative flex flex-col gap-[clamp(2px,0.4vh,6px)]">
        <span className="line-clamp-2 font-display text-[clamp(15px,2.2vh,29px)] font-semibold leading-tight tracking-[-0.01em] text-ink">
          {label}
        </span>
        <span className="truncate text-[clamp(10.5px,1.4vh,16px)] font-bold uppercase tracking-[0.16em] text-ink-subtle">
          {action}
        </span>
      </span>
    </button>
  );
}
