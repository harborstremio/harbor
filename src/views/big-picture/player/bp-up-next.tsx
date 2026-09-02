import {
  useEffect,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { X } from "lucide-react";
import { Play } from "@/components/icons/play-filled";
import { SFX } from "@/lib/sfx";
import type { SpoilerMask } from "@/lib/spoilers";
import type { PlayEpisode } from "@/lib/view";
import { bpBoxCss, bpBoxPx, bpCardArt, type BpArtBox } from "../bp-art";
import { pushBpBack } from "../bp-back";
import { useBpT } from "../bp-i18n";
import { bpOverscan } from "../bp-safe-area";
import { BP_TOKENS, ensureBigPictureTokens } from "../bp-tokens";
import { useBpPlayerOptional } from "./bp-player-context";

const RING_R = 19;
const RING_C = 2 * Math.PI * RING_R;

const STILL_BOX: BpArtBox = { min: 148, vw: 15, max: 300 };

// One emitter, imported by every surface that needs it. There were briefly two
// hand-copied ones and the reason they had to stay byte-identical is that the
// id is the only guard against a second sheet. Import, never re-copy.
const STYLE_ID = "harbor-bp-player-surface-tokens";

const ACTION =
  "inline-flex h-[clamp(48px,5.6vh,68px)] shrink-0 items-center gap-[clamp(7px,0.7vw,13px)] rounded-[var(--bp-r-xs)] px-[clamp(16px,1.5vw,30px)] text-[clamp(14px,1.95vh,23px)] font-bold";

// bp-shell puts visibility:hidden on [data-bp-root] the moment playback starts,
// and a hidden subtree cannot hold focus, so every player surface lives outside
// it. Each --bp-* token and every focus-ring rule is scoped to [data-bp-root],
// which these surfaces are not inside, so the sheet is re-emitted verbatim
// against their own attribute. Re-emit, never hand-copy: a partial copy loses
// the ring and a D-pad user is then flying blind.
export function ensureBpPlayerSurfaceTokens(): void {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
  ensureBigPictureTokens();
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = BP_TOKENS.replaceAll("[data-bp-root]", "[data-bp-player-surface]");
  document.head.appendChild(el);
}

// The re-emitted sheet redeclares --bp-overscan: 0 on every player surface,
// which outranks any value inherited from the shell above it and would quietly
// drop the TV crop back to zero. Set it inline from the source bp-shell reads.
export function bpSurfaceVars(): CSSProperties {
  const o = bpOverscan();
  return o > 0 ? ({ "--bp-overscan": String(o) } as CSSProperties) : {};
}

// Space must stay the player's pause key. A focused <button> activates on Space
// natively, so a viewer tapping pause while the ring sits on a stage control
// would both toggle playback and fire the button in a single press. Select on a
// D-pad arrives as Enter, so nothing real is lost by refusing Space here.
export function blockSpaceActivate(e: KeyboardEvent<HTMLElement>): void {
  if (e.key === " ") e.preventDefault();
}

// Where a stage surface parks itself, so it clears the transport at any size.
// BpPlayerShell measures its own chrome and publishes the real height; this is
// what a stage surface standing alone falls back to, and it deliberately sits
// low because with no shell above it there is no chrome to clear.
export const BP_STAGE_BOTTOM =
  "var(--bp-player-dock, calc(var(--bp-safe-y, 0px) + clamp(30px, 4vh, 64px)))";

// A stage surface drops data-bp-focusable when the chrome goes down, and the
// chrome can go down on the idle timer while the ring is still parked on one of
// its buttons. A mark left behind on an element that is no longer in the focus
// pool paints a lit chip that no key can move, so the mark goes with the pool.
export function useBpStageRing(scope: RefObject<HTMLElement | null>, focusable: boolean): void {
  useEffect(() => {
    if (focusable) return;
    const root = scope.current;
    if (!root) return;
    for (const el of root.querySelectorAll<HTMLElement>("[data-bp-focus='true']")) {
      el.removeAttribute("data-bp-focus");
    }
    // The row mark travels with the ring, so dropping one without the other
    // leaves a row permanently uncontained. See applyBpFocus in bp-focus-core.
    for (const row of root.querySelectorAll<HTMLElement>("[data-bp-row-focus]")) {
      row.removeAttribute("data-bp-row-focus");
    }
  }, [scope, focusable]);
}

export function BpUpNext({
  ep,
  mask,
  remainingSec,
  leadSec,
  visible,
  onPlay,
  onCancel,
  seedFocus = true,
}: {
  ep: PlayEpisode;
  mask?: SpoilerMask;
  remainingSec: number;
  leadSec: number;
  visible: boolean;
  onPlay: () => void;
  onCancel?: () => void;
  seedFocus?: boolean;
}) {
  const t = useBpT();
  const shell = useBpPlayerOptional();
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Standalone, with no shell above it, the card has to be reachable or it is
  // decoration. Under the shell the stage rule wins: nothing on the stage holds
  // the ring while the chrome is away. `visible` is part of the test because
  // inertBlocked in bp-focus-core never looks at opacity, so an opacity-0 card
  // would stay in the pool at full size and the ring could land on nothing.
  const focusable = (shell ? shell.chromeUp : true) && visible;
  useBpStageRing(rootRef, focusable);

  useLayoutEffect(() => ensureBpPlayerSurfaceTokens(), []);

  useEffect(() => {
    if (!onCancel || !visible) return;
    return pushBpBack(() => {
      onCancel();
      return true;
    });
  }, [onCancel, visible]);

  const seconds = Math.max(0, Math.ceil(remainingSec));
  const progress = leadSec > 0 ? Math.min(1, Math.max(0, 1 - seconds / leadSec)) : 0;
  const epLabel =
    typeof ep.season === "number" && typeof ep.episode === "number"
      ? `S${ep.imdbSeason ?? ep.season} · E${ep.imdbEpisode ?? ep.episode}`
      : t("Up Next");
  const title = mask?.title ? epLabel : ep.name?.trim() || epLabel;
  const runtime = ep.runtime && ep.runtime > 0 ? t("{n} min", { n: ep.runtime }) : "";
  const meta = [title === epLabel ? "" : epLabel, runtime].filter(Boolean).join(" · ");
  const showStill = Boolean(ep.still) && mask?.thumb !== true;

  return (
    <div
      ref={rootRef}
      data-bp-player-surface="true"
      style={bpSurfaceVars()}
      className="pointer-events-none absolute inset-0 z-30"
    >
      <div
        data-bp-up-next
        role="group"
        aria-label={t("Up next in {s}s", { s: seconds })}
        className={`pointer-events-auto absolute end-[var(--bp-gutter)] flex w-[clamp(430px,36vw,780px)] max-w-[calc(100%-var(--bp-gutter)*2)] flex-col overflow-hidden transition-[opacity,transform,bottom] duration-[var(--bp-dur)] ease-[var(--bp-ease)] motion-reduce:transition-none ${
          visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
        }`}
        style={{
          bottom: BP_STAGE_BOTTOM,
          borderRadius: "var(--bp-r-lg)",
          border: "1px solid var(--bp-edge-2)",
          background: "var(--bp-panel-2)",
          boxShadow: "0 40px 120px -30px rgba(0, 0, 0, 0.9)",
        }}
      >
        <div className="flex items-start gap-[clamp(13px,1.3vw,26px)] p-[clamp(14px,1.7vh,26px)]">
          <div
            style={{ width: bpBoxCss(STILL_BOX) }}
            className="relative aspect-[16/9] shrink-0 overflow-hidden rounded-[var(--bp-r-md)] bg-[var(--bp-panel)]"
          >
            {showStill ? (
              <img
                src={bpCardArt(ep.still, bpBoxPx(STILL_BOX))}
                alt=""
                draggable={false}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="grid h-full place-items-center px-2 text-center text-[clamp(11px,1.45vh,16px)] font-bold uppercase tracking-[0.16em] text-ink-subtle">
                {epLabel}
              </span>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-[clamp(4px,0.6vh,10px)]">
            <div className="flex items-start justify-between gap-[clamp(8px,0.8vw,16px)]">
              <span className="pt-[2px] text-[clamp(11.5px,1.5vh,17px)] font-bold uppercase tracking-[0.14em] text-ink-subtle">
                {t("Up Next")}
              </span>
              <CountdownRing seconds={seconds} progress={progress} ticking={visible} />
            </div>

            <h3 className="line-clamp-2 font-display text-[clamp(16px,2.35vh,32px)] font-semibold leading-[1.15] tracking-[-0.01em] text-ink">
              {title}
            </h3>

            {meta && (
              <p className="line-clamp-1 text-[clamp(12px,1.6vh,18px)] font-medium text-ink-subtle">
                {meta}
              </p>
            )}

            {/* No data-bp-row and no wrapper carrying one. Two buttons side by
                side are already a spatial pair, and a rail row here would
                inherit the content-visibility:auto rule from the re-emitted
                sheet and turn both unfocusable the moment the ring left. */}
            <div className="mt-[clamp(8px,1vh,16px)] flex flex-wrap items-center gap-[clamp(9px,0.9vw,16px)]">
              <button
                type="button"
                data-bp-focusable={focusable ? "" : undefined}
                data-bp-chip
                onKeyDown={blockSpaceActivate}
                onClick={() => {
                  SFX.click();
                  onPlay();
                }}
                className={`${ACTION} bg-[var(--bp-on)] text-ink`}
              >
                <Play size={20} className="fill-current" strokeWidth={0} />
                {t("Play now")}
              </button>

              {/* The seed sits on cancel, never on play. It only decides where a
                  first deliberate direction press lands, and the two outcomes
                  are not symmetric: an accidental cancel leaves Play now one
                  press away, an accidental play throws away the end of an
                  episode the viewer is still watching. */}
              {onCancel && (
                <button
                  type="button"
                  data-bp-focusable={focusable ? "" : undefined}
                  data-bp-chip
                  data-bp-autofocus={focusable && seedFocus ? "true" : undefined}
                  onKeyDown={blockSpaceActivate}
                  onClick={() => {
                    SFX.close();
                    onCancel();
                  }}
                  className={`${ACTION} border border-[var(--bp-edge-2)] text-ink`}
                >
                  <X size={20} strokeWidth={2.6} />
                  {t("Keep watching")}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CountdownRing({
  seconds,
  progress,
  ticking,
}: {
  seconds: number;
  progress: number;
  ticking: boolean;
}) {
  return (
    <span className="relative grid h-[clamp(46px,5.2vh,66px)] w-[clamp(46px,5.2vh,66px)] shrink-0 place-items-center">
      <svg
        viewBox="0 0 44 44"
        className="absolute inset-0 h-full w-full -rotate-90"
        aria-hidden="true"
      >
        <circle cx="22" cy="22" r={RING_R} fill="none" stroke="var(--bp-edge-2)" strokeWidth="3.5" />
        {/* stroke-dashoffset, not a conic-gradient. Gradient interpolation is
            still uneven across the WebViews Harbor ships on, and a countdown
            that steps in whole seconds on one platform reads as a stutter. */}
        <circle
          cx="22"
          cy="22"
          r={RING_R}
          fill="none"
          stroke="var(--bp-touch)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={RING_C}
          strokeDashoffset={RING_C * (1 - progress)}
          className={
            ticking
              ? "transition-[stroke-dashoffset] duration-200 ease-linear motion-reduce:transition-none"
              : undefined
          }
        />
      </svg>
      <span className="relative text-[clamp(15px,2vh,24px)] font-bold tabular-nums leading-none text-ink">
        {seconds}
      </span>
    </span>
  );
}
