import { useState } from "react";
import { Play } from "@/components/icons/play-filled";
import { SFX } from "@/lib/sfx";
import { BP_ACTION_RING as FOCUS_RING, BP_ACTION_SOLID } from "./bp-action-style";
import type { BpDetailAction } from "./use-bp-detail-actions";

// Height and box are tokens, not literals: these are inline styles and a
// stylesheet cannot reach an inline style, so the non-TV upscale in bp-tokens
// can only raise them through a var. The 607px television keeps the floor.
const PRIMARY_H = "var(--bp-action-h)";
const ICON_BOX = "var(--bp-action-box)";

function scrollHeroIntoView(el: HTMLElement): void {
  const page = el.closest<HTMLElement>("[data-bp-scroll-y]");
  if (!page || page.scrollTop === 0) return;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  // centerScroll runs synchronously right after focus() and would settle the row
  // just under the top bar, stranding the hero above the viewport.
  requestAnimationFrame(() => {
    page.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  });
}

function BpSecondaryAction({
  action,
  onHint,
}: {
  action: BpDetailAction;
  onHint: (label: string) => void;
}) {
  const Icon = action.icon;
  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-action-icon
      aria-label={action.label}
      onFocus={() => onHint(action.label)}
      onClick={() => {
        SFX.click();
        action.onPress();
      }}
      style={{ width: ICON_BOX, height: ICON_BOX }}
      className={`flex shrink-0 items-center justify-center rounded-[var(--bp-r-xs)] border ${
        action.active
          ? "border-transparent bg-[var(--bp-on)] text-ink"
          : "border-[var(--bp-edge-2)] text-ink"
      } ${FOCUS_RING}`}
    >
      {action.badge ? (
        <span className="text-[13.4px] font-bold leading-none tabular-nums">
          {action.badge}
        </span>
      ) : action.logo ? (
        <img
          src={action.logo}
          alt=""
          className="h-[20px] w-[20px] rounded-[4px] object-contain"
        />
      ) : (
        <Icon
          size={20}
          strokeWidth={action.filled ? 0 : 2.1}
          fill={action.filled ? "currentColor" : "none"}
        />
      )}
    </button>
  );
}

export function BpDetailActions({
  playLabel,
  onPlay,
  actions,
  progress,
  trailing,
}: {
  playLabel: string;
  onPlay: () => void;
  actions: BpDetailAction[];
  progress: number;
  /**
   * A cell that belongs beside the actions rather than under them. The synopsis
   * toggle is the one that matters: rendered as its own row below this one it
   * intercepted every Down out of Play, because Play is not in a rail row and
   * vertical falls to spatial ranking from here.
   */
  trailing?: BpDetailAction;
}) {
  const [hint, setHint] = useState("");

  return (
    <section
      data-bp-row
      onFocus={(e) => scrollHeroIntoView(e.currentTarget)}
      // The line names the icon under the ring, so it has to go out with the
      // ring. Down into the episodes left the last icon's label sitting under
      // the hero describing a control the viewer had already left.
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setHint("");
      }}
      style={{ containIntrinsicSize: "auto 90px" }}
    >
      <div
        data-bp-scroll-x
        className="flex items-center gap-[8px] overflow-x-auto py-[12px] ps-[12px] pe-[12px] -my-[12px] -ms-[12px] -me-[12px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <button
          type="button"
          data-bp-focusable
          data-bp-autofocus="true"
          data-bp-action-primary
          onFocus={() => setHint("")}
          onClick={() => {
            SFX.click();
            onPlay();
          }}
          style={{ height: PRIMARY_H }}
          className={`relative flex shrink-0 items-center gap-[7px] overflow-hidden px-[17px] text-[13.4px] ${BP_ACTION_SOLID} ${FOCUS_RING}`}
        >
          <Play size={14} className="fill-current" strokeWidth={0} />
          {playLabel}
          {progress > 0.01 && progress < 0.97 && (
            <span className="absolute inset-x-[17px] bottom-[7px] h-[3px] rounded-full bg-[var(--bp-void)]/45">
              <span
                className="block h-full rounded-full bg-[var(--bp-touch)]"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </span>
          )}
        </button>

        <div className="flex shrink-0 items-center gap-[8px]">
          {actions.map((a) => (
            <BpSecondaryAction key={a.key} action={a} onHint={setHint} />
          ))}
          {trailing && <BpSecondaryAction action={trailing} onHint={setHint} />}
        </div>
      </div>

      <p data-bp-action-hint className="pt-[10px] text-[12.5px] font-semibold tracking-[0.04em] text-ink-subtle">
        {hint || " "}
      </p>
    </section>
  );
}
