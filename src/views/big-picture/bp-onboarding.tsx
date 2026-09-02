import { useCallback, useEffect, useId, useRef, useState, type ComponentType } from "react";
import { useBigPicture } from "@/lib/big-picture";
import { useOnboarding } from "@/lib/onboarding";
import { SFX } from "@/lib/sfx";
import { pushBpBack } from "./bp-back";
import { bpFirstVisible } from "./bp-visible";
import { useBpT } from "./bp-i18n";
import {
  BP_ONBOARD_LAST,
  BP_ONBOARD_STEPS,
  BpOnboardFrame,
  type BpOnboardGuard,
  type BpOnboardStepId,
  type BpOnboardStepProps,
} from "./bp-onboarding-frame";
import { BpHandoffProvider } from "./onboarding/bp-handoff-context";
import { useBpPageModal } from "./use-bp-page-modal";
import { currentBpFocus, setBpFocus } from "./use-bp-focus";

// Its own key, never harbor.onboarding. That record has no profile id and is
// shared with the desktop modal, so parking a Big Picture cursor inside it
// would collide with both the desktop flow and the profiles workflow.
const RESUME_KEY = "harbor.onboarding.bp";

type BpOnboardResume = { step: BpOnboardStepId; at: number };

function readResumeIndex(): number {
  try {
    const raw = localStorage.getItem(RESUME_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as Partial<BpOnboardResume>;
    const at = BP_ONBOARD_STEPS.findIndex((s) => s.id === parsed.step);
    return at < 0 ? 0 : at;
  } catch {
    return 0;
  }
}

function writeResumeIndex(index: number): void {
  const step = BP_ONBOARD_STEPS[index];
  if (!step) return;
  try {
    const record: BpOnboardResume = { step: step.id, at: Date.now() };
    localStorage.setItem(RESUME_KEY, JSON.stringify(record));
  } catch {
    // A full quota must not take the setup flow down with it. Losing the
    // resume cursor costs the user one screen, throwing here costs the app.
  }
}

function clearResume(): void {
  try {
    localStorage.removeItem(RESUME_KEY);
  } catch {
    // Same reasoning as writeResumeIndex.
  }
}

// Same rule as the frame's rail: border on both, fill on neither, so the one
// filled pill on screen is always the one the ring is on.
const LEAVE_ACTION =
  "h-[clamp(56px,6.6vh,70px)] rounded-[var(--bp-r-xs)] border px-[clamp(18px,1.8vw,34px)] text-[clamp(17px,2.2vh,22px)] font-bold";

function motionReduced(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function BpOnboardLeave({
  onKeep,
  onLater,
  onNever,
}: {
  onKeep: () => void;
  onLater: () => void;
  onNever: () => void;
}) {
  const t = useBpT();
  const keepRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const [reduce] = useState(motionReduced);

  // The root autofocus pass is keyed on the route and stops after its settle
  // window, so a dialog opened later seeds itself and hands focus back on close.
  useEffect(() => {
    // bpFirstVisible, never a raw querySelector: during playback there are two
    // [data-bp-root]s and the hidden one is earlier in document order.
    const prev = currentBpFocus(bpFirstVisible("[data-bp-root]"));
    if (keepRef.current) setBpFocus(keepRef.current, { silent: true });
    return () => {
      if (prev?.isConnected) setBpFocus(prev, { silent: true });
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-bp-dialog
      // animation stays inline: a class loses to the [dir=rtl] [role=dialog]
      // rule in bp-tokens, which slides this in sideways.
      className="absolute inset-0 z-[10] grid place-items-center bg-[color-mix(in_oklab,var(--bp-void)_84%,transparent)] px-[var(--bp-gutter)]"
      style={{ animation: reduce ? undefined : "bp-fade var(--bp-dur) var(--bp-ease) both" }}
    >
      <div
        className="flex flex-col gap-[clamp(18px,2.4vh,34px)] rounded-[var(--bp-r-md)] bg-[var(--bp-panel-2)] p-[clamp(26px,3vw,50px)]"
        style={{ width: "min(88vw, 720px)" }}
      >
        <div className="flex flex-col gap-[clamp(6px,0.9vh,13px)]">
          <h2
            id={titleId}
            className="font-display text-[clamp(28px,3.6vh,38px)] font-semibold leading-[1.1] tracking-[-0.02em] text-ink"
          >
            {t("Leave setup?")}
          </h2>
          <p className="text-[clamp(17px,2.2vh,22px)] leading-relaxed text-ink-subtle">
            {t("Nothing you have already set is lost. Harbor picks this back up where you left it.")}
          </p>
        </div>

        <div
          data-bp-row
          style={{ paddingInline: 0, marginInline: 0, containIntrinsicSize: "auto 88px" }}
          className="flex gap-[clamp(9px,0.9vw,16px)]"
        >
          <button
            ref={keepRef}
            type="button"
            data-bp-focusable
            data-bp-chip
            data-bp-autofocus="true"
            onClick={() => {
              SFX.click();
              onKeep();
            }}
            className={`${LEAVE_ACTION} flex-1 border-transparent bg-[var(--bp-on)] text-ink`}
          >
            {t("Keep setting up")}
          </button>
          <button
            type="button"
            data-bp-focusable
            data-bp-chip
            onClick={() => {
              SFX.close();
              onLater();
            }}
            className={`${LEAVE_ACTION} flex-1 border-[var(--bp-edge-2)] bg-[var(--bp-glass)] text-ink`}
          >
            {t("Finish later")}
          </button>
        </div>

        {/* Its own row, and never the default. This is the only path other than
            the last screen that marks Harbor onboarded, and the desktop modal's
            close button doing it silently on step two is the bug being fixed. */}
        <div
          data-bp-row
          style={{ paddingInline: 0, marginInline: 0, containIntrinsicSize: "auto 72px" }}
          className="flex justify-center"
        >
          <button
            type="button"
            data-bp-focusable
            data-bp-chip
            onClick={() => {
              SFX.close();
              onNever();
            }}
            className="h-[clamp(48px,5.4vh,60px)] rounded-[var(--bp-r-xs)] px-[clamp(16px,1.6vw,30px)] text-[clamp(15px,2vh,19px)] font-semibold text-ink-muted"
          >
            {t("Do not show this again")}
          </button>
        </div>
      </div>
    </div>
  );
}

export type BpOnboardingGate = {
  open: boolean;
  resumeIndex: number;
  /** Finish later. This session only, and the next launch resumes in place. */
  suspend: () => void;
  /** Mark Harbor onboarded. Only the last screen and Do not show this again. */
  complete: () => void;
};

export function useBpOnboardingGate(ready: boolean): BpOnboardingGate {
  const { onboarded, finishOnboarding } = useOnboarding();
  const { active } = useBigPicture();
  const [snoozed, setSnoozed] = useState(false);
  const [resumeIndex, setResumeIndex] = useState(readResumeIndex);

  // The shell keeps this component mounted across Big Picture sessions, so
  // without a reset on the way out a Finish later would hide setup for the
  // rest of the app run rather than for this visit.
  useEffect(() => {
    if (active || !snoozed) return;
    setSnoozed(false);
    setResumeIndex(readResumeIndex());
  }, [active, snoozed]);

  const suspend = useCallback(() => setSnoozed(true), []);

  const complete = useCallback(() => {
    clearResume();
    finishOnboarding();
  }, [finishOnboarding]);

  return { open: ready && !onboarded && !snoozed, resumeIndex, suspend, complete };
}

export type BpOnboardStepViews = Partial<
  Record<BpOnboardStepId, ComponentType<BpOnboardStepProps>>
>;

export function BpOnboarding({
  resumeIndex,
  onSuspend,
  onComplete,
  onHint,
  steps,
}: {
  resumeIndex: number;
  onSuspend: () => void;
  onComplete: () => void;
  /**
   * Which held-Down hint is true on this screen. The hint bar belongs to the
   * shell and the shell cannot see which of the ten is up, so one global hint
   * named a Skip that four of them do not render, and advertised a gesture on
   * the last screen where the ring already starts on the only button.
   */
  onHint?: (hint: "actions" | "advance" | null) => void;
  /**
   * The ten screens, supplied by whoever owns them. An id with no view still
   * renders its frame and its action rail, so the flow stays walkable while the
   * step surfaces land one at a time.
   */
  steps?: BpOnboardStepViews;
}) {
  const t = useBpT();
  const setModalNode = useBpPageModal(true);
  const [index, setIndex] = useState(() =>
    Math.min(Math.max(Math.trunc(resumeIndex), 0), BP_ONBOARD_LAST),
  );
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [satisfiedAt, setSatisfiedAt] = useState<number | null>(null);
  const indexRef = useRef(index);
  indexRef.current = index;

  const step = BP_ONBOARD_STEPS[index];
  const satisfied = satisfiedAt === index;

  // Keyed on the index rather than reset by an effect. An effect racing the
  // step's own first report would flip a satisfied screen back to unsatisfied
  // after the ring had already been parked on the primary.
  const setSatisfied = useCallback((value: boolean) => {
    setSatisfiedAt(value ? indexRef.current : null);
  }, []);

  // Cleared on every move as well as by the step's own cleanup. A guard left
  // behind by the screen you just left would block the next one's Continue.
  const guardRef = useRef<BpOnboardGuard | null>(null);
  const setPrimaryGuard = useCallback((fn: BpOnboardGuard | null) => {
    guardRef.current = fn;
  }, []);

  const next = useCallback(() => {
    guardRef.current = null;
    setIndex((i) => Math.min(i + 1, BP_ONBOARD_LAST));
  }, []);

  const [working, setWorking] = useState(false);

  // A remote repeats OK readily and a guard can be a live network call, so a
  // second press must not fire a second sign-in.
  const busyRef = useRef(false);

  const onPrimary = useCallback(async () => {
    if (busyRef.current) return;
    const guard = guardRef.current;
    if (guard) {
      busyRef.current = true;
      setWorking(true);
      let ok = false;
      try {
        ok = await guard();
      } catch {
        ok = false;
      }
      busyRef.current = false;
      setWorking(false);
      if (!ok) return;
    }
    if (indexRef.current >= BP_ONBOARD_LAST) {
      onComplete();
      return;
    }
    next();
  }, [next, onComplete]);

  // Written on every move, not only on the way out. A power cut mid-setup is
  // the common case on a TV and it should not restart the flow.
  useEffect(() => {
    writeResumeIndex(index);
  }, [index]);

  const hint = step.focus === "primary" ? null : step.skip ? "actions" : "advance";
  useEffect(() => {
    onHint?.(hint);
  }, [hint, onHint]);

  // Back never reaches the shell while this is up: it must not pop the Big
  // Picture stack and it must not open the exit confirm behind a live setup.
  useEffect(
    () =>
      pushBpBack(() => {
        if (leaveOpen) {
          setLeaveOpen(false);
          return true;
        }
        if (indexRef.current > 0) {
          setIndex((i) => Math.max(i - 1, 0));
          return true;
        }
        setLeaveOpen(true);
        return true;
      }),
    [leaveOpen],
  );

  const View = steps?.[step.id];

  return (
    <div
      ref={setModalNode}
      role="dialog"
      aria-modal="true"
      aria-label={t("Set up Harbor")}
      data-bp-dialog
      // No entry animation on the layer itself. An [animation] class here loses
      // to the [dir=rtl] [role=dialog] rule in bp-tokens, which would translate
      // the whole opaque surface and flash the shell behind it. The frame
      // inside carries the motion instead.
      className="absolute inset-0 z-[60] bg-[var(--bp-void)]"
    >
      {/* Above the frame, so the hand-off code outlives the screen that shows
          it. A delivery landing while the TV has moved on still applies. */}
      <BpHandoffProvider active>
        <BpOnboardFrame
          key={step.id}
          step={step}
          at={index}
          satisfied={satisfied}
          working={working}
          onPrimary={() => void onPrimary()}
          onSkip={next}
        >
          {View ? (
            <View
              onNext={next}
              onSkip={next}
              setSatisfied={setSatisfied}
              setPrimaryGuard={setPrimaryGuard}
            />
          ) : null}
        </BpOnboardFrame>
      </BpHandoffProvider>

      {leaveOpen && (
        <BpOnboardLeave
          onKeep={() => setLeaveOpen(false)}
          onLater={() => {
            setLeaveOpen(false);
            onSuspend();
          }}
          onNever={() => {
            setLeaveOpen(false);
            onComplete();
          }}
        />
      )}
    </div>
  );
}
