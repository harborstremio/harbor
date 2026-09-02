import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { isRtl, useUiLanguage } from "@/lib/i18n";
import type { BpQueueArt } from "./use-bp-queue-art";

export const BP_QUEUE_HINT_CLEAR = "var(--bp-hint-h)";

const SLIDE = 2.2;
const FADE_MS = 560;
const SLIDE_MS = 700;
const PRUNE_MS = 900;
const EDGE = "clamp(52px,6.2vh,78px)";

const FIELD =
  "radial-gradient(120% 90% at 28% 62%, var(--bp-panel-2) 0%, transparent 62%)";

const VEIL = "color-mix(in oklab, var(--bp-void) 22%, transparent)";

const KENBURNS =
  "[animation:bp-kenburns_14s_cubic-bezier(0.22,1,0.36,1)_forwards] motion-reduce:[animation:none]";

type Layer = {
  id: number;
  sig: string;
  art: BpQueueArt;
  slide: number;
  ordinal: string;
  first: boolean;
};

function useReducedMotion(): boolean {
  const [reduce] = useState(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  );
  return reduce;
}

// A step slides the incoming frame in from the direction it came from, and Ken
// Burns rides the image inside it. Both on one element is one transform, and the
// second declaration silently replaces the first: the same shear bp-ambient
// paid for at bp-ambient-layers.tsx:124. The box is deliberately oversized so a
// 2.2% slide can never expose a sliver of void at the screen edge.
function BpQueueArtLayer({
  layer,
  top,
  reduce,
}: {
  layer: Layer;
  top: boolean;
  reduce: boolean;
}) {
  const [armed, setArmed] = useState(false);
  const { art } = layer;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setArmed(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  // Only the layer that has nothing under it fades itself in. Every other layer
  // arrives at full strength and is uncovered by the one above it fading out,
  // which is what keeps a step from ever showing a frame of void.
  const lit = top && (!layer.first || armed);

  return (
    <div
      data-bp-xfade
      className="absolute inset-0 transition-opacity ease-[cubic-bezier(0.4,0,0.2,1)]"
      style={{ opacity: lit ? 1 : 0, zIndex: top ? 0 : 1, transitionDuration: `${FADE_MS}ms` }}
    >
      <div
        className="absolute inset-[-3.4%]"
        style={{
          translate: armed ? "0 0" : `${layer.slide}% 0`,
          transition: reduce ? undefined : `translate ${SLIDE_MS}ms var(--bp-ease)`,
        }}
      >
        {art.mode === "landscape" && art.src ? (
          <img
            src={art.src}
            alt=""
            decoding="async"
            className={`absolute inset-0 h-full w-full object-cover ${KENBURNS}`}
          />
        ) : art.mode === "composite" && art.poster ? (
          <>
            {/* The bed carries a static overscale for the blur to spill into, so
                it never takes Ken Burns: the keyframe starts at scale 1.005 and
                would drop the overscale on frame one, baking a blurred border
                around the whole screen. */}
            <img
              src={art.poster}
              alt=""
              decoding="async"
              className="absolute inset-0 h-full w-full scale-[1.12] object-cover opacity-45 blur-[26px]"
            />
            <img
              src={art.poster}
              alt=""
              decoding="async"
              className="absolute end-[14%] top-1/2 h-[62%] w-auto -translate-y-1/2 rounded-[var(--bp-r-md)] object-contain shadow-[0_40px_90px_-30px_rgba(0,0,0,0.9)]"
            />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--bp-panel-2)]">
            <span className="font-display text-[clamp(140px,26vh,360px)] font-semibold leading-none tracking-[-0.03em] tabular-nums text-[var(--bp-edge-2)]">
              {layer.ordinal}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function BpQueueEdge({
  side,
  faded,
  lit,
  refused,
  reduce,
  rtl,
}: {
  side: "start" | "end";
  faded: boolean;
  lit: boolean;
  refused: number;
  reduce: boolean;
  rtl: boolean;
}) {
  const Icon = side === "start" ? ChevronLeft : ChevronRight;
  const ref = useRef<HTMLDivElement | null>(null);
  const seen = useRef(refused);

  // The dead end has to be answered here. A declined direction falls through to
  // the shell, whose nudge animates the element the ring is on, and on this
  // surface that is a transparent full-screen cell: the shake is real and
  // completely invisible. This is the only thing on screen that can say "that
  // is the end of the run" without a sound.
  useEffect(() => {
    const bump = refused !== seen.current;
    seen.current = refused;
    if (!bump || !faded) return;
    const el = ref.current;
    if (!el) return;
    const push = `${(side === "start" ? -8 : 8) * (rtl ? -1 : 1)}px 0`;
    el.animate?.(
      reduce
        ? [{ opacity: 0.12 }, { opacity: 0.5 }, { opacity: 0.12 }]
        : [
            { opacity: 0.12, translate: "0 0" },
            { opacity: 0.5, translate: push },
            { opacity: 0.12, translate: "0 0" },
          ],
      { duration: 280, easing: "cubic-bezier(0.22,1,0.36,1)" },
    );
  }, [refused, faded, reduce, rtl, side]);

  return (
    // Not focusable, for the reason bp-hero-pips.tsx:6 already records: an edge
    // affordance that takes the ring is a dead stop between the deck and the rail.
    <div
      ref={ref}
      className={`absolute top-[46%] flex items-center justify-center rounded-full border border-[var(--bp-edge-2)] text-ink transition-opacity duration-[var(--bp-dur)] ease-[var(--bp-ease)] ${
        side === "start" ? "start-[clamp(10px,1.2vw,26px)]" : "end-[clamp(10px,1.2vw,26px)]"
      }`}
      style={{ width: EDGE, height: EDGE, opacity: faded ? 0.12 : lit ? 1 : 0.35 }}
    >
      <Icon size={34} className="rtl:rotate-180" />
    </div>
  );
}

export function BpQueueStage({
  art,
  dir,
  dimmed,
  loading = false,
  focused = true,
  atStart = false,
  atEnd = false,
  ordinal = "",
  refused = 0,
}: {
  art: BpQueueArt | null;
  dir: 1 | -1;
  dimmed: boolean;
  /**
   * The pool is still resolving. NEVER infer this from layers.length: empty,
   * nokey and unreachable are all permanently layer-less, so a breath gated on
   * the layer count runs forever on three screens that are at rest.
   */
  loading?: boolean;
  focused?: boolean;
  atStart?: boolean;
  atEnd?: boolean;
  ordinal?: string;
  refused?: number;
}) {
  const rtl = isRtl(useUiLanguage());
  const reduce = useReducedMotion();
  const [layers, setLayers] = useState<Layer[]>([]);
  const seq = useRef(0);

  // A keyless art object is the hook's "nothing has committed yet", which only
  // happens before the first entry of a run resolves. Pushing a layer for it
  // would put an empty plate on screen and then make the real first frame slide
  // in as though the queue had stepped.
  const sig = art?.key ? `${art.key}|${art.mode}|${art.src ?? ""}|${art.poster ?? ""}` : "";

  useEffect(() => {
    if (!art || !sig) {
      setLayers((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    setLayers((prev) => {
      const last = prev[prev.length - 1];
      if (last?.sig === sig) return prev;
      // The ladder upgrading a composite into the real backdrop is the same
      // entry, not a step. Sliding it would read as the queue moving on its own.
      const stepped = Boolean(last) && last.art.key !== art.key;
      seq.current += 1;
      return [
        ...prev.slice(-1),
        {
          id: seq.current,
          sig,
          art,
          ordinal,
          first: prev.length === 0,
          slide: stepped && !reduce ? (rtl ? -dir : dir) * SLIDE : 0,
        },
      ];
    });
  }, [sig, art, ordinal, dir, rtl, reduce]);

  useEffect(() => {
    if (layers.length < 2) return;
    const id = window.setTimeout(() => setLayers((prev) => prev.slice(-1)), PRUNE_MS);
    return () => window.clearTimeout(id);
  }, [layers]);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden bg-[var(--bp-void)]"
    >
      {/* Permanently mounted under the art so the first frame of a run dissolves
          out of the field instead of cutting to it. The breath is gated on the
          fetch, not on the layer count: it stops when art covers it AND it never
          starts on the three settled states that hold no art by definition. */}
      <div
        className={`absolute inset-0 ${
          loading && layers.length === 0
            ? "[animation:bp-drift_18s_var(--bp-ease)_infinite_alternate] motion-reduce:[animation:none]"
            : ""
        }`}
        style={{ background: FIELD }}
      />

      {/* The outgoing layer fades out above the incoming one, because a layer
          mounts already at its final opacity and has no transition to run.
          Keying this list by the newest id is the same trap: it unmounts the
          outgoing image mid-crossfade and every step lands as a hard cut. */}
      {layers.map((l, i) => (
        <BpQueueArtLayer key={l.id} layer={l} top={i === layers.length - 1} reduce={reduce} />
      ))}

      <div className="absolute inset-0" style={{ background: "var(--bp-scrim-side)" }} />
      <div className="absolute inset-0" style={{ background: "var(--bp-scrim-up)" }} />

      <div
        data-bp-xfade
        className="absolute inset-0 transition-opacity duration-[var(--bp-dur)] ease-[var(--bp-ease)]"
        style={{ background: VEIL, opacity: dimmed ? 1 : 0 }}
      />

      <BpQueueEdge
        side="start"
        faded={atStart}
        lit={focused}
        refused={refused}
        reduce={reduce}
        rtl={rtl}
      />
      <BpQueueEdge
        side="end"
        faded={atEnd}
        lit={focused}
        refused={refused}
        reduce={reduce}
        rtl={rtl}
      />
    </div>
  );
}

// Zero padded against the width of the total, tabular figures, a fixed slash:
// the block swaps instantly on every press and must not reflow while it does.
export function BpQueuePosition({
  index,
  total,
  tag,
  tagOn = true,
}: {
  index: number;
  total: number;
  tag: string;
  tagOn?: boolean;
}) {
  const known = total > 0;
  const pad = known ? String(total).length : 2;
  const current = known ? String(Math.min(index + 1, total)).padStart(pad, "0") : "--";

  return (
    <div className="flex items-baseline gap-[clamp(6px,0.7vw,13px)]">
      <span className="font-display text-[clamp(30px,4.4vh,64px)] font-semibold leading-none tracking-[-0.02em] tabular-nums text-ink">
        {current}
      </span>
      <span className="text-[clamp(14px,1.9vh,26px)] font-semibold leading-none tabular-nums text-ink-subtle">
        / {known ? total : "--"}
      </span>
      {/* The counter is navigation state and swaps on the press. The tag is the
          title's own copy, so it rides the art gate with everything else: a
          category that changes while the outgoing backdrop is still up is copy
          arriving ahead of art, on the one surface with nothing behind it. */}
      {tag && (
        <span
          data-bp-xfade
          className="flex items-baseline gap-[clamp(6px,0.7vw,13px)] transition-opacity duration-[300ms] ease-[var(--bp-ease)]"
          style={{ opacity: tagOn ? 1 : 0 }}
        >
          <span aria-hidden className="text-[clamp(14px,1.9vh,26px)] leading-none opacity-40">
            •
          </span>
          <span className="text-[clamp(10.5px,1.4vh,16px)] font-bold uppercase leading-none tracking-[0.16em] text-ink-subtle">
            {tag}
          </span>
        </span>
      )}
    </div>
  );
}

// A sliding window, never a fill. The pool extends itself whenever the run gets
// short, so total grows mid session and a fill would visibly jump backwards
// every time it did. Parked on the hint line rather than the floor: the hint
// bar's own scrim is opaque --bp-void at bottom 0 and would paint this out.
export function BpQueueThumb({ index, total }: { index: number; total: number }) {
  // Read here rather than threaded down. This is a positional travel written as
  // an inline style, and an inline style cannot be beaten by a motion-reduce:
  // utility class, so the setting has to be answered in the value itself.
  const reduce = useReducedMotion();
  const at = total > 0 ? Math.min(Math.max(index, 0), total - 1) / total : 0;
  // Bare track while the run is still unknown. A full-width thumb over an empty
  // pool would claim the queue was finished.
  const width = total > 0 ? Math.max(2, 100 / total) : 0;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 h-[3px] bg-[var(--bp-edge)]"
      style={{ bottom: BP_QUEUE_HINT_CLEAR, zIndex: 10 }}
    >
      <span
        className="absolute inset-y-0 bg-ink opacity-55"
        style={{
          insetInlineStart: `${at * 100}%`,
          width: `${width}%`,
          transition: reduce
            ? undefined
            : "inset-inline-start 420ms var(--bp-ease), width 420ms var(--bp-ease)",
        }}
      />
    </div>
  );
}
