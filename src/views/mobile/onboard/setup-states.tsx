import type { ReactNode } from "react";
import { Loader2, MonitorSmartphone, TimerOff, WifiOff } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { SetupBoat } from "./setup-boat";
import { StepMark } from "./setup-marks";
import { SetupShell, type SetupChrome } from "./setup-shell";
import { SetupButton, SetupCard, SetupHeading } from "./setup-ui";
import type { SetupStepId } from "./setup-wire";

function StateIcon({ children, tone }: { children: ReactNode; tone: "quiet" | "good" | "bad" }) {
  const skin =
    tone === "good"
      ? "bg-success/15 text-success"
      : tone === "bad"
        ? "bg-danger/15 text-danger"
        : "bg-elevated text-ink-subtle";
  return (
    <span className={`flex h-16 w-16 items-center justify-center rounded-2xl ${skin}`}>
      {children}
    </span>
  );
}

export function SetupConnecting({ chrome }: { chrome: SetupChrome }) {
  const t = useT();
  return (
    <SetupShell {...chrome}>
      <div className="setup-rise flex flex-col items-start gap-5 pt-6">
        <StateIcon tone="quiet">
          <Loader2 size={28} className="animate-spin motion-reduce:animate-none" />
        </StateIcon>
        <SetupHeading
          title={t("Reaching your TV")}
          body={t("Waiting for your TV to hand over what it needs. This takes a moment.")}
        />
      </div>
    </SetupShell>
  );
}

/**
 * The socket is open and the TV is simply not offering anything. Saying
 * "connected" and spinning forever was the single most reachable dead end on
 * this page, because leaving the setup screen on the TV produces it.
 */
export function SetupIdleHost({
  chrome,
  onRetry,
  onExit,
}: {
  chrome: SetupChrome;
  onRetry: () => void;
  onExit: () => void;
}) {
  const t = useT();
  return (
    <SetupShell
      {...chrome}
      action={
        <>
          <SetupButton onClick={onRetry}>{t("Try again")}</SetupButton>
          <SetupButton variant="quiet" onClick={onExit}>
            {t("Leave setup")}
          </SetupButton>
        </>
      }
    >
      <div className="setup-rise flex flex-col items-start gap-5 pt-6">
        <StateIcon tone="quiet">
          <MonitorSmartphone size={28} />
        </StateIcon>
        <SetupHeading
          title={t("Your TV is not asking for anything")}
          body={t(
            "This page works while your TV is showing its setup screen. Go back to that screen on the TV, then try again.",
          )}
        />
      </div>
    </SetupShell>
  );
}

export function SetupUnreachable({
  chrome,
  onRetry,
  onExit,
}: {
  chrome: SetupChrome;
  onRetry: () => void;
  onExit: () => void;
}) {
  const t = useT();
  return (
    <SetupShell
      {...chrome}
      action={
        <>
          <SetupButton onClick={onRetry}>{t("Try again")}</SetupButton>
          <SetupButton variant="quiet" onClick={onExit}>
            {t("Leave setup")}
          </SetupButton>
        </>
      }
    >
      <div className="setup-rise flex flex-col items-start gap-5 pt-6">
        <StateIcon tone="bad">
          <WifiOff size={28} />
        </StateIcon>
        <SetupHeading
          title={t("This phone cannot reach your TV")}
          body={t(
            "Both devices need to be on the same Wi-Fi network, and some guest networks block devices from seeing each other.",
          )}
        />
      </div>
      <SetupCard title={t("What usually fixes it")}>
        <ul className="flex flex-col gap-2.5 text-[14.5px] leading-relaxed text-ink-muted">
          <li>{t("Turn off mobile data so your phone uses Wi-Fi.")}</li>
          <li>{t("Join the same network your TV is on, not the guest one.")}</li>
          <li>{t("If nothing works, everything here can be done on the TV itself.")}</li>
        </ul>
      </SetupCard>
    </SetupShell>
  );
}

export function SetupExpired({ chrome, onExit }: { chrome: SetupChrome; onExit: () => void }) {
  const t = useT();
  return (
    <SetupShell
      {...chrome}
      action={<SetupButton onClick={onExit}>{t("Leave setup")}</SetupButton>}
    >
      <div className="setup-rise flex flex-col items-start gap-5 pt-6">
        <StateIcon tone="bad">
          <TimerOff size={28} />
        </StateIcon>
        <SetupHeading
          title={t("That code has expired")}
          body={t("Look at your TV. It is already showing a new code. Scan that one.")}
        />
      </div>
    </SetupShell>
  );
}

export function SetupNoToken({ chrome, onExit }: { chrome: SetupChrome; onExit: () => void }) {
  const t = useT();
  return (
    <SetupShell
      {...chrome}
      action={<SetupButton onClick={onExit}>{t("Open the remote")}</SetupButton>}
    >
      <div className="setup-rise flex flex-col items-start gap-5 pt-6">
        <StateIcon tone="quiet">
          <MonitorSmartphone size={28} />
        </StateIcon>
        <SetupHeading
          title={t("Nothing to set up")}
          body={t("Open this page by scanning the code on your TV's setup screen.")}
        />
      </div>
    </SetupShell>
  );
}

const STEP_LABEL: Record<SetupStepId, string> = {
  tmdb: "TMDB connected",
  stremio: "Stremio library signed in",
  harbor: "Harbor account signed in",
};

/**
 * The boat the viewer assembled a piece at a time is shown whole here for the
 * first time, then leaves in the direction they are being told to look. The
 * departure is gated in JS rather than by a media query: its end state is
 * off-screen, so the global reduced-motion clamp would resolve it to a boat
 * that simply is not there.
 */
export function SetupDone({
  chrome,
  done,
  onExit,
}: {
  chrome: SetupChrome;
  done: readonly SetupStepId[];
  onExit: () => void;
}) {
  const t = useT();
  const reduced = useReducedMotion();
  const built = chrome.built;

  return (
    <SetupShell
      {...chrome}
      action={<SetupButton onClick={onExit}>{t("Open the remote")}</SetupButton>}
    >
      {built > 0 && (
        <div className="overflow-hidden border-b border-edge-soft pt-4">
          <SetupBoat
            built={built}
            animate={reduced ? "none" : "all"}
            className={`w-[104px] text-accent ${reduced ? "" : "setup-depart"}`}
          />
        </div>
      )}

      <header className={reduced ? "" : "setup-land"}>
        <p className="text-[15px] font-semibold text-ink-muted">{t("You are done.")}</p>
        <h1 className="mt-1 text-[34px] font-bold leading-[1.1] tracking-[-0.02em] text-ink">
          {t("Look at your TV.")}
        </h1>
      </header>

      {done.length > 0 && (
        <div className={reduced ? "" : "setup-land-late"}>
          <SetupCard>
            <ul className="flex flex-col gap-3.5">
              {done.map((s) => (
                <li key={s} className="flex items-center gap-3">
                  <StepMark step={s} className="h-7 w-7 shrink-0" />
                  <span className="text-[15px] text-ink">{t(STEP_LABEL[s])}</span>
                </li>
              ))}
            </ul>
          </SetupCard>
        </div>
      )}

      <p className="px-1 text-[13.5px] leading-relaxed text-ink-subtle">
        {t("Saved on that device. You can close this page, or use this phone as a remote.")}
      </p>
    </SetupShell>
  );
}
