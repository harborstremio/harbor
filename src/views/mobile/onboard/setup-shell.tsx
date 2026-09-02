import type { ReactNode } from "react";
import { HarborMark } from "@/components/icons/harbor-mark";
import { useT } from "@/lib/i18n";
import { SETUP_CSS } from "./setup-ui";
import type { LinkStatus } from "./use-setup-link";

const SEG_LAG = ["", "setup-seg-lag-1", "setup-seg-lag-2"];

function pipTone(status: LinkStatus): { dot: string; label: string } {
  if (status === "connected") return { dot: "bg-success setup-pip", label: "connected" };
  if (status === "connecting") return { dot: "bg-ink-subtle setup-pip", label: "connecting" };
  return { dot: "bg-danger", label: "unreachable" };
}

export type SetupChrome = {
  status: LinkStatus;
  /** A socket is open but the TV has not offered anything to do. */
  idleHost?: boolean;
  stepIndex: number;
  stepCount: number;
  /** Pieces of Harbor's mark this run has earned, 0 to BOAT_PARTS. */
  built: number;
};

export function SetupShell({
  status,
  idleHost,
  stepIndex,
  stepCount,
  children,
  action,
}: SetupChrome & { children: ReactNode; action?: ReactNode }) {
  const t = useT();
  const tone = pipTone(status);
  const where =
    status === "connected"
      ? idleHost
        ? t("Your TV is not on the setup screen")
        : t("Connected to your TV")
      : status === "connecting"
        ? t("Reaching your TV")
        : t("Not connected");

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-canvas">
      <style>{SETUP_CSS}</style>

      <header
        className="shrink-0 border-b border-edge-soft bg-canvas/95 px-5 pb-3 backdrop-blur-xl"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 14px)" }}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2">
            <HarborMark className="h-[15px] w-[15px] shrink-0 text-ink" />
            <span className="truncate text-[15px] font-bold tracking-[-0.01em] text-ink">
              {t("Set up Harbor")}
            </span>
          </span>
          {stepCount > 1 && (
            <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-ink-subtle">
              {t("{a} of {b}", { a: Math.min(stepIndex + 1, stepCount), b: stepCount })}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${tone.dot}`} aria-hidden />
          <span className="truncate text-[13px] text-ink-muted">{where}</span>
        </div>
        {stepCount > 1 && (
          <div className="mt-3 flex gap-1.5" aria-hidden>
            {Array.from({ length: stepCount }, (_, i) => (
              <span
                key={i}
                className={`h-[3px] flex-1 overflow-hidden rounded-full ${
                  i === stepIndex ? "bg-accent-soft" : "bg-edge-soft"
                }`}
              >
                {i < stepIndex && (
                  <span className={`setup-seg-fill rounded-full bg-accent ${SEG_LAG[i] ?? ""}`} />
                )}
              </span>
            ))}
          </div>
        )}
      </header>

      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 pt-5"
        style={{ paddingBottom: action ? "24px" : "calc(env(safe-area-inset-bottom, 0px) + 32px)" }}
      >
        <div className="mx-auto flex w-full max-w-[520px] flex-col gap-4">{children}</div>
      </div>

      {action && (
        <div
          className="shrink-0 border-t border-edge-soft bg-canvas/95 px-5 pt-3 backdrop-blur-xl"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
        >
          <div className="mx-auto flex w-full max-w-[520px] flex-col gap-2.5">{action}</div>
        </div>
      )}
    </div>
  );
}
