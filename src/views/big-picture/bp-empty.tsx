import { RotateCw, SlidersHorizontal } from "lucide-react";
import { SFX } from "@/lib/sfx";
import { BP_ACTION_RING, BP_ACTION_SOLID } from "./bp-action-style";

export type BpEmptyIcon = "retry" | "setup";

// A page whose only terminal state is a sentence is a dead end: the ring has
// nowhere to land, and on a remote that reads as the device having frozen
// rather than as an empty shelf. Every caller that can settle with no content
// passes an action, and the action is the thing that fixes the state it names.
export function BpEmptyState({
  message,
  action,
  icon = "retry",
  onAction,
}: {
  message: string;
  action?: string;
  icon?: BpEmptyIcon;
  onAction?: () => void;
}) {
  const Glyph = icon === "setup" ? SlidersHorizontal : RotateCw;
  return (
    <div className="flex min-h-[40vh] flex-1 flex-col items-center justify-center gap-[clamp(14px,1.8vh,26px)] px-[var(--bp-gutter)]">
      <p className="max-w-[46ch] text-center text-[clamp(13.5px,1.95vh,22px)] font-medium text-ink-subtle">
        {message}
      </p>
      {action && onAction && (
        <button
          type="button"
          data-bp-focusable
          // Deliberately not data-bp-chip. That rule fills with --bp-touch on
          // focus, which is the language for the small filter pills. This is the
          // one action on an otherwise empty page, so it reads as Play does: a
          // solid ink plate that keeps its colour and takes the ring.
          onClick={() => {
            SFX.click();
            onAction();
          }}
          className={`flex h-[clamp(48px,5.6vh,66px)] shrink-0 items-center gap-[clamp(7px,0.6vw,12px)] px-[clamp(22px,2vw,40px)] text-[clamp(13.5px,1.9vh,22px)] ${BP_ACTION_SOLID} ${BP_ACTION_RING}`}
        >
          <Glyph size={17} strokeWidth={2.2} />
          {action}
        </button>
      )}
    </div>
  );
}
