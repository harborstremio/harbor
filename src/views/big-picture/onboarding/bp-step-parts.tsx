import { useEffect, useRef, useState, type ReactNode } from "react";
import { SFX } from "@/lib/sfx";
import { useBpT } from "../bp-i18n";
import { BpOnboardAux } from "./bp-onboard-aux";

/**
 * Pieces shared by the ten decision surfaces. The frame, the progress rail, the
 * eyebrow, the headline and the primary/skip rail all belong to
 * bp-onboarding-frame. Nothing here draws chrome.
 *
 * The frame parks the ring on the first [data-bp-focusable] inside
 * [data-bp-onboard-decision] that is not the overflow pager, so a screen whose
 * default answer is not its first cell must put that cell first in DOM order
 * and restore the visual order with flex `order`. Arrow navigation is
 * geometric, so it is unaffected.
 */

/**
 * Every [data-bp-row] under [data-bp-root] gets the page gutter as padding plus
 * a matching negative margin, which is right for a full-bleed catalog row and
 * wrong inside the decision column: it makes the row two gutters wider than its
 * container and the column silently scrollable sideways into empty padding.
 * Spread this into any row here, then add contain-intrinsic-size.
 */
export const BP_ROW_FLUSH = { paddingInline: 0, marginInline: 0 } as const;

const RING_ROOM = "p-[10px]";

const SCROLL =
  `flex min-h-0 flex-1 flex-col gap-[clamp(9px,1.2vh,18px)] ${RING_ROOM} overflow-x-hidden overflow-y-auto overscroll-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`;

// Never a mask-image here. mask-repeat defaults to repeat, so the tile above
// the box is the gradient's transparent tail and it erased any focus ring that
// bled past the padding box. An overlay sibling fades the same edge and cannot
// touch anything outside itself.
const FADE_TAIL = 52;

/**
 * Vertical scrolling in Big Picture is driven only by centerScroll following
 * the focus ring, so a decision column that overflows with nothing focusable
 * inside it hides its own bottom with no way to reach it. Rather than a second
 * keydown listener, which the focus contract forbids, the column grows one real
 * focus target, and only in the case that would otherwise be unreachable.
 */
export function BpDecisionScroll({
  children,
  bottom,
}: {
  children: ReactNode;
  bottom?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const t = useBpT();
  const [stranded, setStranded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // The pager is itself focusable and lives inside the scroller, so a plain
    // "has no focusable" test would unset the flag that rendered it and the
    // button would flicker in and out forever. Discount its own contribution.
    const check = () => {
      setOverflows(el.scrollHeight - el.clientHeight > 4);
      setStranded((was) => {
        const over = el.scrollHeight - el.clientHeight > 4;
        const own = el.querySelectorAll("[data-bp-focusable]").length - (was ? 1 : 0);
        return over && own <= 0;
      });
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    const mo = new MutationObserver(check);
    mo.observe(el, { childList: true, subtree: true });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, []);

  const page = () => {
    const el = ref.current;
    if (!el) return;
    const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 4;
    el.scrollTo({
      top: atEnd ? 0 : el.scrollTop + el.clientHeight * 0.8,
      behavior: bpReducedMotion() ? "auto" : "smooth",
    });
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={ref}
        data-bp-scroll-y
        data-bp-center
        className={`${SCROLL} ${bottom && !overflows ? "justify-center" : ""}`}
        style={{ paddingBottom: overflows ? FADE_TAIL : undefined }}
      >
        {children}

      </div>
      {stranded && (
        <BpOnboardAux>
          <BpDecisionAction label={t("Read the rest")} tone="quiet" pager onSelect={page} />
        </BpOnboardAux>
      )}
    </div>
  );
}

function bpReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** A focusable control that lives with the decision, not on the frame's rail. */
export function BpDecisionAction({
  label,
  onSelect,
  tone = "solid",
  disabled,
  buttonRef,
  pager,
}: {
  label: string;
  onSelect: () => void;
  tone?: "solid" | "quiet";
  disabled?: boolean;
  buttonRef?: React.Ref<HTMLButtonElement>;
  /**
   * This control answers "the column overflows", never "this is the decision".
   * The frame's arrival pass skips it, so a step with no real decision keeps
   * the ring on the primary instead of losing it to the overflow escape.
   */
  pager?: boolean;
}) {
  const off = !!disabled;
  return (
    <button
      ref={buttonRef}
      type="button"
      data-bp-focusable
      data-bp-chip
      data-bp-onboard-pager={pager ? "true" : undefined}
      // Never the native disabled attribute. The pool selector only honours
      // data-bp-disabled, so a natively disabled button stays a candidate the
      // engine then cannot focus and the ring lands nowhere.
      data-bp-disabled={off ? "true" : undefined}
      tabIndex={off ? -1 : undefined}
      aria-disabled={off || undefined}
      onClick={() => {
        if (off) return;
        SFX.click();
        onSelect();
      }}
      // Border on both tones, fill on neither. bp-tokens fills the FOCUSED chip
      // with --bp-touch, so a solid resting tone puts a second filled pill on
      // the row and the D-pad cursor stops being unambiguous at ten feet.
      className={`h-[clamp(56px,6.6vh,70px)] shrink-0 rounded-[var(--bp-r-xs)] border px-[clamp(18px,1.8vw,34px)] text-[clamp(17px,2.2vh,21px)] font-bold transition-colors duration-[var(--bp-dur-fast)] ${
        off ? "opacity-45" : ""
      } ${
        tone === "solid"
          ? "border-transparent bg-[var(--bp-on)] text-ink"
          : "border-[var(--bp-edge-2)] bg-[var(--bp-glass)] text-ink"
      }`}
    >
      {label}
    </button>
  );
}

/** A row of decision actions. Scoped so Left and Right stay on the row. */
export function BpDecisionRow({ children }: { children: ReactNode }) {
  return (
    <div
      data-bp-row
      style={{ ...BP_ROW_FLUSH, containIntrinsicSize: "auto 80px" }}
      className="flex shrink-0 flex-wrap items-center gap-[clamp(9px,0.9vw,16px)]"
    >
      {children}
    </div>
  );
}

/** The face a satisfied step wears. States the identity, never the secret. */
export function BpStepConfirmed({
  title,
  detail,
}: {
  title: string;
  detail?: string;
}) {
  return (
    <div className="flex items-center gap-[clamp(14px,1.5vw,28px)] rounded-[var(--bp-r-md)] border border-[var(--bp-edge)] bg-[var(--bp-panel)] px-[clamp(18px,1.7vw,34px)] py-[clamp(16px,2vh,30px)]">
      <BpTick on />
      <span className="flex min-w-0 flex-1 flex-col gap-[clamp(2px,0.35vh,6px)]">
        <span className="truncate text-[clamp(15px,2.2vh,27px)] font-semibold text-ink">{title}</span>
        {detail && (
          <span className="truncate text-[clamp(12.5px,1.7vh,19px)] font-medium text-ink-subtle">
            {detail}
          </span>
        )}
      </span>
    </div>
  );
}

export function BpTick({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className="flex h-[clamp(30px,3.6vh,50px)] w-[clamp(30px,3.6vh,50px)] shrink-0 items-center justify-center rounded-full"
      style={{
        background: on ? "color-mix(in oklab, var(--bp-live) 22%, transparent)" : "var(--bp-panel-2)",
      }}
    >
      {on && (
        <svg viewBox="0 0 24 24" fill="none" className="h-[54%] w-[54%]">
          <path
            d="M5 12.5 L10 17.5 L19 7"
            stroke="var(--bp-live)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  );
}

/** A quiet line under the decision, for counts, errors and reasons. */
export function BpDecisionNote({ text, alert }: { text: string; alert?: boolean }) {
  return (
    <p
      role={alert ? "status" : undefined}
      className={`shrink-0 text-[clamp(12px,1.65vh,19px)] font-medium leading-relaxed ${
        alert ? "text-ink" : "text-ink-subtle"
      }`}
    >
      {text}
    </p>
  );
}
