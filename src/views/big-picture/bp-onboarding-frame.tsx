import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { HarborMark } from "@/components/icons/harbor-mark";
import { SFX } from "@/lib/sfx";
import { BpOnboardBackdrop } from "./onboarding/bp-onboard-backdrop";
import { useBpOnboardEscape } from "./onboarding/bp-onboard-escape";
import { parkBpOnboardRing } from "./onboarding/bp-onboard-ring";
import {
  BP_ONBOARD_STEPS,
  type BpOnboardStep,
  type BpOnboardStepId,
} from "./onboarding/bp-onboard-steps";
import { useBpT } from "./bp-i18n";

// bp-onboarding.tsx imports this and every step surface imports the contract
// below, so a step may never import the machine back or that becomes a require
// cycle. Everything this file pulls out of ./onboarding stays a leaf for the
// same reason. The step table lives in its own module for the LOC budget and is
// re-exported here so every existing import path keeps working.

export { BP_ONBOARD_LAST, BP_ONBOARD_STEPS } from "./onboarding/bp-onboard-steps";
export type { BpOnboardStep, BpOnboardStepId } from "./onboarding/bp-onboard-steps";

export type BpOnboardStepProps = {
  /** Advance. The same target the primary action uses. */
  onNext: () => void;
  /** Leave without completing. Only meaningful on a step that declares a skip. */
  onSkip: () => void;
  /** Report that the value is already set, which parks the ring on the primary. */
  setSatisfied: (value: boolean) => void;
  /**
   * Claim the primary. The frame runs the handler and advances only if it
   * resolves true, so a screen holding typed input can commit it rather than
   * watch Continue throw it away. Register null to release.
   */
  setPrimaryGuard: (fn: BpOnboardGuard | null) => void;
};

export type BpOnboardGuard = () => boolean | Promise<boolean>;

// The stranded pager is a real focusable and it lives in the decision column,
// but it answers "the column overflows", never "this is the decision". Seeding
// the ring on it takes focus off the primary on a screen that has no decision
// at all, which is exactly what phone looks like while it waits for a scan.
// data-bp-disabled is the only refusal the engine's own pool honours, and this
// query is not the engine's. Without the exclusion the arrival pass can park
// the ring on a control that is deliberately dead, which focus() accepts
// because nothing here is natively disabled.
const DECISION =
  "[data-bp-onboard-decision] [data-bp-focusable]:not([data-bp-onboard-pager]):not([data-bp-disabled='true'])";
const PRIMARY = "[data-bp-onboard-primary]";
const SKIP = "[data-bp-onboard-skip]";
const RING = "[data-bp-focus='true']";
const FOCUS_TRIES = 14;
const LATE_MOUNT_MS = 6000;

/**
 * A step's decision can mount a frame or two late, so the ring lands on the
 * primary first and upgrades once the real decision exists. The rAF ladder
 * covers the common case in a few frames; taste cannot, because its grid waits
 * on seventeen network calls, so a bounded MutationObserver carries the upgrade
 * the rest of the way. Both stop the moment the ring is anywhere this pass did
 * not put it, or the upgrade would drag the cursor backwards every time a step
 * finished loading.
 */
function useBpOnboardFocus(
  hostRef: RefObject<HTMLElement | null>,
  stepId: BpOnboardStepId,
  intent: BpOnboardStep["focus"],
  satisfied: boolean,
): void {
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let raf = 0;
    let tries = 0;
    let done = false;
    let placed: HTMLElement | null = null;
    let observer: MutationObserver | null = null;

    const pick = (): { el: HTMLElement | null; final: boolean } => {
      const primary = host.querySelector<HTMLElement>(PRIMARY);
      if (satisfied || intent === "primary") return { el: primary, final: true };
      if (intent === "skip") {
        const skip = host.querySelector<HTMLElement>(SKIP);
        return { el: skip ?? primary, final: skip !== null };
      }
      const decision = host.querySelector<HTMLElement>(DECISION);
      return { el: decision ?? primary, final: decision !== null };
    };

    const stop = (): void => {
      done = true;
      window.clearTimeout(expire);
      observer?.disconnect();
      observer = null;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    const expire = window.setTimeout(stop, LATE_MOUNT_MS);

    const tick: () => void = () => {
      raf = 0;
      if (done) return;
      // Anywhere this pass did not put it means the user, a step calling
      // advanceBpOnboardRing, or a dialog that opened over the frame. The
      // observer runs for six seconds now, long enough to reach all three, so
      // it yields rather than dragging the ring back out of any of them.
      const ring = document.querySelector<HTMLElement>(RING);
      if (ring && (placed ? ring !== placed : !host.contains(ring))) {
        stop();
        return;
      }
      const { el, final } = pick();
      if (el && el !== placed) {
        if (parkBpOnboardRing(host, el, { silent: true })) placed = el;
      }
      if (final) {
        stop();
        return;
      }
      tries += 1;
      if (tries < FOCUS_TRIES) raf = requestAnimationFrame(tick);
    };

    const schedule = (): void => {
      if (done || raf) return;
      raf = requestAnimationFrame(tick);
    };

    tick();
    if (!done) {
      observer = new MutationObserver(schedule);
      observer.observe(host, { childList: true, subtree: true });
    }
    return stop;
  }, [hostRef, stepId, intent, satisfied]);
}

function BpOnboardProgress({ at, total }: { at: number; total: number }) {
  const t = useBpT();
  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={at + 1}
      aria-label={t("Setup progress")}
      className="flex items-center gap-[clamp(5px,0.5vw,10px)]"
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className="h-[clamp(3px,0.42vh,6px)] rounded-full transition-[width,background-color] duration-[var(--bp-dur)] ease-[var(--bp-ease)] motion-reduce:transition-none"
          style={{
            width: i === at ? "clamp(30px, 3vw, 62px)" : "clamp(14px, 1.4vw, 30px)",
            background:
              i === at
                ? "var(--color-ink)"
                : i < at
                  ? "color-mix(in oklab, var(--color-ink) 42%, transparent)"
                  : "var(--bp-edge)",
          }}
        />
      ))}
    </div>
  );
}

// border on both, fill on neither. bp-tokens fills the FOCUSED chip with
// --bp-touch; a primary that also rests filled leaves two solid pills whose only
// difference is hue, which at ten feet is not a cursor.
const ACTION =
  "h-[clamp(56px,6.6vh,72px)] shrink-0 rounded-[var(--bp-r-xs)] border px-[clamp(22px,2vw,44px)] text-[clamp(17px,2.2vh,22px)] font-bold";

export function BpOnboardFrame({
  step,
  at,
  satisfied,
  working,
  onPrimary,
  onSkip,
  children,
}: {
  step: BpOnboardStep;
  at: number;
  satisfied: boolean;
  /** A step's primary guard is running. Never disables the button: a natively
      disabled element stays in the focus pool and cannot then take focus. */
  working?: boolean;
  onPrimary: () => void;
  onSkip: () => void;
  children?: ReactNode;
}) {
  const t = useBpT();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const headingId = useId();
  useBpOnboardFocus(hostRef, step.id, step.focus, satisfied);
  useBpOnboardEscape();

  return (
    <div
      ref={hostRef}
      data-bp-onboard-frame
      className="relative flex h-full flex-col [animation:bp-rise_var(--bp-dur)_var(--bp-ease)_both] motion-reduce:[animation:none]"
    >
      <BpOnboardBackdrop />
      {/* Above --bp-hint-h, never inside it. At 641px this used to sit 18px to
          50px off the bottom edge, entirely under the 52px hint bar, and the
          shell raises that bar to z-65 over onboarding's z-60, so the brand mark
          was drawn under its scrim on all ten screens. */}
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[calc(var(--bp-hint-h)+clamp(10px,1.4vh,22px))] start-[var(--bp-gutter)] z-10 flex items-center gap-[clamp(10px,1vw,18px)] opacity-40"
      >
        <HarborMark className="h-[clamp(32px,3.9vh,52px)] w-[clamp(32px,3.9vh,52px)] shrink-0 text-ink" />
        <span
          className="whitespace-nowrap text-[clamp(28px,3.5vh,48px)] font-medium leading-none tracking-tight text-ink"
          style={{ fontFamily: '"Fraunces", "Iowan Old Style", "Georgia", serif' }}
        >
          Harb
          <span
            className="inline-block"
            style={{ transform: "rotate(7deg)", transformOrigin: "50% 65%" }}
          >
            o
          </span>
          r
        </span>
      </div>
      <header className="flex shrink-0 flex-col gap-[clamp(12px,1.6vh,24px)] px-[var(--bp-gutter)] pt-[calc(var(--bp-safe-y,0px)+clamp(26px,4.4vh,72px))]">
        <BpOnboardProgress at={at} total={BP_ONBOARD_STEPS.length} />
        <span
          key={step.id}
          className="text-[clamp(10.5px,1.4vh,16px)] font-semibold uppercase tracking-[0.2em] text-ink-muted [animation:bp-step-in_var(--bp-dur)_var(--bp-ease)_both] motion-reduce:[animation:none]"
        >
          {t(step.eyebrow)}
        </span>
      </header>

      <div className="flex min-h-0 flex-1 gap-[clamp(30px,3.6vw,80px)] px-[var(--bp-gutter)] pt-[clamp(14px,2.2vh,36px)]">
        <div
          key={`copy:${step.id}`}
          className="flex w-[min(38%,640px)] shrink-0 flex-col gap-[clamp(10px,1.4vh,22px)] [animation:bp-step-in_var(--bp-dur-slow)_var(--bp-ease)_both] motion-reduce:[animation:none]"
        >
          <div className="flex flex-wrap items-center gap-x-[clamp(12px,1.3vw,26px)] gap-y-[clamp(6px,0.9vh,14px)]">
            <h1
              id={headingId}
              className="font-display text-[clamp(26px,4.6vh,62px)] font-semibold leading-[1.04] tracking-[-0.022em] text-ink"
              style={{ maxWidth: "18ch" }}
            >
              {t(step.headline)}
            </h1>
            {step.mark && (
              <span className="flex h-[clamp(30px,4.1vh,58px)] w-[clamp(30px,4.1vh,58px)] shrink-0 items-center justify-center rounded-full bg-[var(--bp-panel-2)] ring-1 ring-[var(--bp-edge-2)]">
                <img
                  src={step.mark}
                  alt=""
                  className="h-[56%] w-[56%] object-contain opacity-90"
                />
              </span>
            )}
          </div>
          <p
            className="text-[clamp(13px,1.85vh,23px)] leading-relaxed text-ink-subtle"
            style={{ maxWidth: "40ch" }}
          >
            {t(step.body)}
          </p>
          <div data-bp-onboard-aside className="flex min-h-0 flex-1 flex-col" />
        </div>

        <div
          key={`decision:${step.id}`}
          data-bp-onboard-decision
          className="flex min-w-0 flex-1 flex-col [animation:bp-step-in_var(--bp-dur-slow)_var(--bp-ease)_both] motion-reduce:[animation:none]"
        >
          {children}
        </div>
      </div>

      <div className="shrink-0 px-[var(--bp-gutter)] pb-[calc(var(--bp-safe-y,0px)+clamp(64px,7.6vh,104px))] pt-[clamp(14px,2vh,32px)]">
        {/* Scoped so Left and Right stay on the rail. Without the row the
            actions sit in free spatial mode and a sideways press escapes up
            into whatever the step put nearest above them.

            data-bp-onboard-rail names the region the held Down lands in. The
            escape asks whether the ring is already here before it swallows the
            tail of a hold, so every control that belongs to the rail, including
            whatever a step portals into the aux slot, has to sit inside this
            element rather than beside it. */}
        <div
          data-bp-row
          data-bp-onboard-rail
          style={{ paddingInline: 0, marginInline: 0, containIntrinsicSize: "auto 88px" }}
          className="flex items-center justify-end gap-[clamp(10px,1vw,20px)]"
        >
          <div data-bp-onboard-aux className="contents" />
          {step.skip ? (
            <button
              type="button"
              data-bp-focusable
              data-bp-chip
              data-bp-onboard-skip
              onClick={() => {
                SFX.click();
                onSkip();
              }}
              className={`${ACTION} border-[var(--bp-edge-2)] bg-[var(--bp-glass)] text-ink`}
            >
              {t(step.skip)}
            </button>
          ) : null}
          <button
            type="button"
            data-bp-focusable
            data-bp-chip
            data-bp-onboard-primary
            onClick={() => {
              SFX.click();
              onPrimary();
            }}
            className={`${ACTION} border-transparent bg-[var(--bp-on)] text-ink`}
          >
            {working
              ? t("Working…")
              : t(satisfied && step.primaryDone ? step.primaryDone : step.primary)}
          </button>
        </div>
      </div>
    </div>
  );
}
