import { useEffect, useMemo, useRef } from "react";
import jlMark from "@/assets/brand/jl-mark.webp";
import { Poster } from "@/components/poster";
import { CustomArtwork } from "@/components/custom-artwork";
import type { Meta } from "@/lib/cinemeta";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { bpBoxPx, bpCardArt, bpViewportWidth, type BpArtBox } from "./bp-art";
import { bpBootSplashDismiss, bpBootSplashUp } from "./bp-boot-splash";
import { bpIntroPoolLoad } from "./bp-intro-pool";

const COLUMNS = 8;
const PER_COLUMN = 6;
const GUTTER: BpArtBox = { min: 10, vw: 1, max: 20 };

function bpIntroCellWidth(): number {
  return (bpViewportWidth() - (COLUMNS + 1) * bpBoxPx(GUTTER)) / COLUMNS;
}

const SPEEDS = [46, 62, 52, 70, 56, 66, 50, 60];
const DELAYS = [-8, -22, -4, -31, -14, -26, -11, -18];
const DIRS = ["up", "down", "up", "down", "up", "down", "up", "down"] as const;

function BpIntroColumn({ idx, posters }: { idx: number; posters: string[] }) {
  // Guarded in JS, not with motion-reduce, because the animation is an inline
  // style and inline styles outrank the class Tailwind would emit for it.
  const reduce = useReducedMotion();
  const slice = useMemo(() => {
    const out: (string | null)[] = [];
    for (let i = 0; i < PER_COLUMN; i += 1) {
      const k = (idx * PER_COLUMN + i) % Math.max(posters.length, 1);
      out.push(posters[k] ?? null);
    }
    return out;
  }, [idx, posters]);

  return (
    <div className="h-full flex-1 overflow-hidden">
      <div
        className="flex flex-col gap-[clamp(10px,1vw,20px)] will-change-transform"
        // This was the only unguarded infinite animation under [data-bp-root],
        // and the reduced-motion blanket in bp-tokens made it worse rather than
        // better: it sets animation-duration to 1ms, which for a loop is a
        // thousand cycles a second, so the columns thrashed instead of stopping.
        style={
          reduce
            ? undefined
            : {
                animation: `splash-scroll-${DIRS[idx]} ${SPEEDS[idx]}s linear infinite`,
                animationDelay: `${DELAYS[idx]}s`,
              }
        }
      >
        {[...slice, ...slice].map((url, i) => (
          <Poster key={i} src={url ?? undefined} seed={`bp-intro-${idx}-${i}`} className="w-full" />
        ))}
      </div>
    </div>
  );
}

export function BpIntro({ pool, leaving }: { pool: Meta[]; leaving: boolean }) {
  const frozen = useRef<string[] | null>(null);
  // Read once, at the first render, so the mosaic is never blank while the
  // shell is still fetching rows. Reading it inside the effect below would be
  // one paint too late and the viewer would see the placeholder blocks first.
  const remembered = useRef<string[] | null>(null);
  if (remembered.current === null) remembered.current = bpIntroPoolLoad();
  // The boot splash draws this same mark in the same place, so the handoff is
  // a removal and not a cross-fade. Fading two identical images through each
  // other reads as a flicker, which is the artefact this whole pass is for.
  const handoff = useRef(bpBootSplashUp());
  useEffect(() => {
    bpBootSplashDismiss(false);
  }, []);

  if (!frozen.current) {
    const live = pool.map((m) => m.poster).filter((p): p is string => !!p);
    const urls = live.length >= COLUMNS * 2 ? live : remembered.current;
    if (urls.length >= COLUMNS * 2) {
      const shuffled = [...urls];
      for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = (i * 2654435761) % (i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const cell = bpIntroCellWidth();
      frozen.current = shuffled
        .slice(0, COLUMNS * PER_COLUMN)
        .map((u) => bpCardArt(u, cell) ?? u);
    }
  }

  const posters = frozen.current ?? [];

  return (
    <div
      aria-hidden
      className={`absolute inset-0 z-[60] overflow-hidden bg-[var(--bp-void)] ${
        leaving ? "[animation:bp-intro-out_620ms_var(--bp-ease)_forwards]" : ""
      } motion-reduce:[animation:none]`}
    >
      <div className="absolute inset-0 flex gap-[clamp(10px,1vw,20px)] px-[clamp(10px,1vw,20px)] opacity-[0.5] [animation:bp-intro-bed_1400ms_var(--bp-ease)_both] motion-reduce:[animation:none]">
        {Array.from({ length: COLUMNS }, (_, col) => (
          <BpIntroColumn key={col} idx={col} posters={posters} />
        ))}
      </div>

      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, color-mix(in oklab, var(--bp-void) 62%, transparent) 0%, color-mix(in oklab, var(--bp-void) 88%, transparent) 52%, var(--bp-void) 100%)",
        }}
      />

      <div className="relative flex h-full flex-col items-center justify-center gap-[clamp(28px,4.5vh,64px)]">
        <CustomArtwork role="launch" className="h-[min(22vh,200px)] w-[min(24vw,200px)]" fallback={<BpIntroMark settled={handoff.current} />} />
        <BpIntroSpinner settled={handoff.current} />
      </div>
    </div>
  );
}

// Same art and box as the mark index-tv.html inlines, so the boot splash hands
// over by removal. When the splash already showed the arrival, the mark is
// drawn settled instead of fading in a second time.
function BpIntroMark({ settled }: { settled: boolean }) {
  return (
    <img
      src={jlMark}
      alt=""
      draggable={false}
      className={`h-[min(22vh,200px)] w-[min(24vw,200px)] object-contain ${
        settled ? "" : "[animation:bp-intro-mark_1200ms_var(--bp-ease)_both] motion-reduce:[animation:none]"
      }`}
    />
  );
}

function BpIntroSpinner({ settled }: { settled: boolean }) {
  return (
    <span
      className={`relative block ${
        settled
          ? ""
          : "[animation:bp-intro-spinner-in_900ms_var(--bp-ease)_500ms_both] motion-reduce:[animation:none]"
      }`}
      style={{ width: "clamp(34px, 4.4vh, 58px)", height: "clamp(34px, 4.4vh, 58px)" }}
    >
      <svg viewBox="0 0 50 50" className="h-full w-full" fill="none">
        <circle
          cx="25"
          cy="25"
          r="20"
          stroke="currentColor"
          strokeWidth="3"
          className="text-ink/12"
        />
        <circle
          cx="25"
          cy="25"
          r="20"
          stroke="var(--bp-touch)"
          strokeWidth="3"
          strokeLinecap="round"
          className="origin-center [animation:bp-intro-spin_1300ms_cubic-bezier(0.5,0,0.5,1)_infinite,bp-intro-dash_2000ms_ease-in-out_infinite] motion-reduce:[animation:none]"
          style={{ strokeDasharray: "1, 126" }}
        />
      </svg>
    </span>
  );
}
