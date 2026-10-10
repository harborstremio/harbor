import { useEffect, useLayoutEffect, useRef } from "react";
import { RotateCcw } from "lucide-react";
import { Play } from "@/components/icons/play-filled";
import { SFX } from "@/lib/sfx";
import { pushBpBack } from "../bp-back";
import { useBpT } from "../bp-i18n";
import { setBpFocus } from "../use-bp-focus";
import {
  blockSpaceActivate,
  bpSurfaceVars,
  ensureBpPlayerSurfaceTokens,
} from "./bp-up-next";

const ACTION =
  "flex shrink-0 items-center gap-[clamp(9px,0.9vw,16px)] rounded-[var(--bp-r-md)] px-[clamp(22px,2.1vw,44px)] text-[clamp(15px,2.05vh,26px)] font-bold";
const ACTION_H = "clamp(56px,6.4vh,86px)";

// No kid branch here, on purpose. bp-shell exits Big Picture outright whenever a
// kid profile is active, so the ten-foot shell and the kid player can never be
// on screen together. The bubbles-and-octopus variant stays in
// components/player/resume-prompt.tsx where it is actually reachable.
//
// Unlike the skip pill this surface is allowed to take the remote. It is not a
// stage overlay, it is a fork that blocks playback: there is nothing else on
// screen to steal from, and leaving it unfocused would strand a D-pad user with
// two buttons and no ring.
export function BpResumePrompt({
  resumeSec,
  totalSec,
  title,
  subtitle,
  onResume,
  onStartOver,
}: {
  resumeSec: number;
  totalSec: number;
  title: string;
  subtitle?: string;
  onResume: () => void;
  onStartOver: () => void;
}) {
  const t = useBpT();
  const resumeRef = useRef<HTMLButtonElement | null>(null);

  useLayoutEffect(() => ensureBpPlayerSurfaceTokens(), []);

  // The shell's own settle pass is keyed on the route and is not running during
  // playback, so the ring has to be placed by hand.
  useEffect(() => {
    if (resumeRef.current) setBpFocus(resumeRef.current, { silent: true });
  }, []);

  // A blocking fork with no Back is a dead end: the shell would hide its chrome
  // instead, which switches the focus engine off and leaves this on screen with
  // two buttons the arrows can no longer reach. Back takes the default action.
  useEffect(
    () =>
      pushBpBack(() => {
        onResume();
        return true;
      }),
    [onResume],
  );

  const pct = totalSec > 0 ? Math.min(100, Math.max(0, (resumeSec / totalSec) * 100)) : 0;

  return (
    <div
      data-bp-player-surface="true"
      data-bp-dialog
      style={bpSurfaceVars()}
      role="dialog"
      aria-modal="true"
      aria-label={t("Pick up where you left off")}
      className="absolute inset-0 z-[90] flex flex-col justify-end [animation:bp-fade_var(--bp-dur)_var(--bp-ease)_backwards] motion-reduce:[animation:none]"
    >
      {/* Two layers, not one flat wash. The paused frame behind this is the
          title's own art and it stays readable at the top, while the copy below
          sits on a falloff that is genuinely opaque where the text lands. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "color-mix(in oklab, var(--bp-void) 55%, transparent)" }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "var(--bp-scrim-up)" }}
      />

      <div
        className="relative flex flex-col gap-[clamp(10px,1.3vh,22px)] px-[var(--bp-gutter)] pb-[calc(clamp(38px,5.2vh,86px)_+_var(--bp-safe-y,0px))] [animation:bp-rise_var(--bp-dur-slow)_var(--bp-ease)_60ms_backwards] motion-reduce:[animation:none]"
        style={{ maxWidth: "min(100%, 62rem)" }}
      >
        <p className="text-[clamp(11.5px,1.5vh,17px)] font-bold uppercase tracking-[0.2em] text-ink-subtle">
          {t("Pick up where you left off")}
        </p>

        <h2 className="line-clamp-2 font-display text-[clamp(28px,5.2vh,76px)] font-semibold leading-[1.05] tracking-[-0.02em] text-ink">
          {title}
        </h2>

        {subtitle && (
          <p className="line-clamp-1 text-[clamp(13px,1.75vh,21px)] font-medium text-ink-muted">
            {subtitle}
          </p>
        )}

        {totalSec > 0 && (
          <>
            <div
              className="mt-[clamp(4px,0.6vh,10px)] w-full overflow-hidden rounded-full bg-[var(--bp-edge-2)]"
              style={{ height: "clamp(6px,0.8vh,12px)" }}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={Math.round(totalSec)}
              aria-valuenow={Math.round(resumeSec)}
            >
              <div
                className="h-full rounded-full bg-[var(--bp-touch)]"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-[clamp(13px,1.75vh,21px)] font-medium tabular-nums text-ink-muted">
              {`${t("{watched} of {total} watched ({pct}%).", {
                watched: formatTime(resumeSec),
                total: formatTime(totalSec),
                pct: Math.round(pct),
              })} ${t("{time} left", { time: formatTime(Math.max(0, totalSec - resumeSec)) })}`}
            </p>
          </>
        )}

        {/* No data-bp-row on this pair. A rail row would pick up the
            content-visibility:auto rule from the re-emitted sheet the moment the
            ring left it, and a blocking fork with two unfocusable buttons is a
            dead end with no way out. */}
        <div className="mt-[clamp(12px,1.6vh,28px)] flex flex-wrap items-center gap-[clamp(10px,1vw,20px)]">
          {/* Resting fill stays a class. The chip focus rule sets background
              without !important, so an inline fill would outrank it and the ring
              would never light this button. */}
          <button
            ref={resumeRef}
            type="button"
            data-bp-focusable
            data-bp-chip
            data-bp-autofocus="true"
            onKeyDown={blockSpaceActivate}
            onClick={() => {
              SFX.click();
              onResume();
            }}
            className={`${ACTION} bg-[var(--bp-on)] text-ink`}
            style={{ height: ACTION_H }}
          >
            <Play size={24} className="fill-current" strokeWidth={0} />
            {t("Resume from {time}", { time: formatTime(resumeSec) })}
          </button>

          <button
            type="button"
            data-bp-focusable
            data-bp-chip
            onKeyDown={blockSpaceActivate}
            onClick={() => {
              SFX.click();
              onStartOver();
            }}
            className={`${ACTION} border border-[var(--bp-edge-2)] text-ink`}
            style={{ height: ACTION_H }}
          >
            <RotateCcw size={22} strokeWidth={2.6} />
            {t("Start Over")}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatTime(totalSec: number): string {
  if (!Number.isFinite(totalSec) || totalSec < 0) return "0:00";
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
