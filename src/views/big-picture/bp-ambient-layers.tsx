import { memo, useEffect, useState, type RefObject } from "react";
import { isAndroidTv } from "@/lib/platform";
import { BpMosaic } from "./bp-mosaic";
import { BpLiveSplit } from "./bp-live-split";
import { useBpDecorMotion } from "./bp-decor-motion";

export const BP_TITLE_ART_FADE_MS = 440;

const PRUNE_MS = 1200;

export type BpLayer = { src: string; id: number; bridge?: boolean };
export type BpStill = BpLayer & { band: string };
export type BpSplit = { a: string; b: string; id: number; band: string };
export type BpPair = { a: string; b: string; front: "a" | "b" };

// A band's colour arrives either as its own brand hex or as a sample, and both
// end up inside rgba(R G B / a), so a raw hex would silently paint nothing.
export function bpRgbTriplet(value: string | undefined): string {
  if (!value) return "";
  if (value[0] !== "#") return value;
  const hex = value.slice(1);
  const full = hex.length === 3 ? hex.replace(/./g, (c) => c + c) : hex;
  if (full.length < 6) return "";
  const n = Number.parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(n)) return "";
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

// useArtGlow holds the previous colour until the new sample resolves, so
// rewriting one layer's background repaints instantly between two bands.
// Two persistent layers crossfade instead.
export function useBpPair(next: string | undefined): BpPair {
  const [pair, setPair] = useState<BpPair>({ a: "", b: "", front: "a" });
  useEffect(() => {
    if (!next) return;
    setPair((prev) => {
      if (prev[prev.front] === next) return prev;
      return prev.front === "a"
        ? { a: prev.a, b: next, front: "b" }
        : { a: next, b: prev.b, front: "a" };
    });
  }, [next]);
  return pair;
}

export function useBpPrune<T>(layers: readonly T[], set: (fn: (prev: T[]) => T[]) => void): void {
  useEffect(() => {
    if (layers.length < 2) return;
    const id = window.setTimeout(() => set((prev) => prev.slice(-1)), PRUNE_MS);
    return () => window.clearTimeout(id);
  }, [layers, set]);
}

// Room for three, and only while the newest is a bridge. Dropping the outgoing
// backdrop to make room unmounts it mid cross-fade, which is the hard cut the
// render comment further down records, and with a bridge in the stack the real
// backdrop can land while that fade is still running. A bridge is a bitmap a
// card on screen is already holding, so the third slot costs no new pixels.
export function bpPushLayer(prev: BpLayer[], next: BpLayer): BpLayer[] {
  const last = prev[prev.length - 1];
  if (last?.src === next.src) return prev;
  return [...prev.slice(last?.bridge ? -2 : -1), next];
}

// Where a bridge's src comes from: art a card on screen has already fetched and
// decoded. Keyed on the restore key, which every meta-bearing card sets to that
// meta's own id while every other cell namespaces its own, so this cannot answer
// with a different title's picture the way the pool fallback could. A new cell
// carrying a bare restore key would reintroduce exactly that.
// It must never start a load either, because a url the browser has not got is
// precisely the fetch and decode a bridge exists to skip: a miss is a miss and
// the hero then waits as it did before.
export function bpResidentArt(metaId: string): string {
  if (!metaId) return "";
  const sel = `[data-bp-tile][data-bp-restore-key="${CSS.escape(metaId)}"] img`;
  // Every match is the same title, so any loaded one answers. Taking only the
  // first in document order would miss whenever a title sits in two rows and the
  // copy nearer the top of the page is the one still waiting on its own art.
  for (const img of document.querySelectorAll<HTMLImageElement>(sel)) {
    if (img.complete && img.naturalWidth > 0) return img.currentSrc || img.src;
  }
  return "";
}

// A mask reads alpha and nothing else, so these stops are opacity, not colour.
// A var(--bp-*) token here resolves to something translucent and erases the
// entire art stack this envelope wraps.
const ENVELOPE = "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.5) 17%, black 38%)";

const FLOOR_FILL =
  "linear-gradient(to top, var(--bp-page) 0%, var(--bp-page) 52%, color-mix(in oklab, var(--bp-page) 60%, transparent) 78%, transparent 100%)";

const PAGE_FADE =
  "linear-gradient(to top, var(--bp-page) 0%, var(--bp-page) 34%, color-mix(in oklab, var(--bp-page) 78%, transparent) 46%, color-mix(in oklab, var(--bp-page) 34%, transparent) 58%, transparent 72%)";

const TOP_FADE =
  "linear-gradient(to bottom, color-mix(in oklab, var(--bp-void) 80%, transparent) 0%, transparent 26%)";

const LEFT_VOID =
  "radial-gradient(150% 120% at 8% 38%, var(--bp-void) 0%, color-mix(in oklab, var(--bp-void) 55%, transparent) 38%, transparent 70%)";

const KENBURNS =
  "[animation:bp-kenburns_14s_cubic-bezier(0.22,1,0.36,1)_900ms_forwards] motion-reduce:[animation:none]";

const STILL_DRIFT =
  "[animation:bp-kenburns_14s_cubic-bezier(0.22,1,0.36,1)_900ms_forwards] motion-reduce:[animation:none]";

// The wash is corner-anchored on the art side and reaches zero well before the
// copy, so the hero origin stays near-black at full brand strength.
function bandWash(rgb: string, rtl: boolean): string {
  const at = rtl ? "12% 6%" : "88% 6%";
  return `radial-gradient(96% 118% at ${at}, rgba(${rgb} / 0.32) 0%, rgba(${rgb} / 0.18) 26%, rgba(${rgb} / 0.06) 46%, transparent 62%)`;
}

// Anchored bottom centre so the band's colour wells up out of the row it
// belongs to, under the cards, instead of behind the copy where it reads as mud.
function bandTint(rgb: string): string {
  return `radial-gradient(140% 88% at 50% 100%, rgba(${rgb} / 0.30) 0%, rgba(${rgb} / 0.15) 30%, rgba(${rgb} / 0.05) 52%, transparent 68%)`;
}

export type BpAmbientView = {
  rtl: boolean;
  floor: string;
  titleArt: number;
  layers: readonly BpLayer[];
  drift: boolean;
  trailerSrc: string | null;
  trailerOn: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  onTrailerReady: () => void;
  wash: BpPair;
  washOn: boolean;
  mosaicKey: string;
  mosaicPosters: readonly string[];
  mosaicOn: boolean;
  stills: readonly BpStill[];
  stillBand: string;
  stillOn: boolean;
  splits: readonly BpSplit[];
  splitOn: boolean;
  tint: BpPair;
  tintOn: boolean;
};

function BpAmbientLayersBody(v: BpAmbientView) {
  // The split and the single still are two contents of one wrapper, never two
  // wrappers. Same opacity and same timing in both modes, so switching between
  // them cannot step the brightness of the whole envelope.
  const artOn = v.stillOn || v.splitOn;
  const rgb = v.tintOn ? v.tint[v.tint.front] : "";
  const decor = useBpDecorMotion();
  const kenburns = decor && v.drift ? KENBURNS : "";
  const stillDrift = decor ? STILL_DRIFT : "";
  // The two backdrop layers are the only elements in this stack given a
  // compositing layer of their own, and the crossfade is what earns it. The
  // 900ms fade runs on an image covering 76% of the viewport, inside a masked
  // envelope, under three static gradients: unpromoted, every frame of that
  // fade re-rasters the whole surface, and on this WebView an opacity animation
  // is main-thread paint (bp-decor-motion records the measurement). Promoted,
  // the same fade is a GPU blend of two textures that already exist.
  //
  // TRAP, and it is why this is two elements and not a pattern: bp-tokens.ts
  // records will-change on 262 tiles taking the average frame from 92ms to
  // 125ms and the worst from 154ms to 308ms. One promoted layer is a hint, 262
  // is a denial of service. bpPushLayer caps this stack at two, three only
  // while one is a bridge, so the count is capped with it; every other
  // [data-bp-xfade] in this file stays unpromoted on purpose. The band stills
  // are the obvious next candidate and are deliberately left out until the
  // hero pair has a number: they fire on a band crossing, not on a press.
  // The cost is graphics memory: two 1459x1080 layers is about 12MB
  // against an 18MB steady state, so read GL mtrack out of
  // `dumpsys meminfo app.harbor` after touching this, not just framestats.
  // TV only. Desktop composites these fine and was never measured here.
  const xfadeLayer = isAndroidTv() ? "opacity" : undefined;

  return (
    <div
      aria-hidden
      data-bp-ambient
      className="pointer-events-none absolute inset-0 overflow-hidden bg-[var(--bp-void)]"
    >
      <div className="absolute inset-0 bg-[var(--bp-page)]" />

      {/* Every art-bearing layer shares one envelope and one feather. That single
          mask is what makes a colour field and a poster grid read as one
          photograph instead of two pasted rectangles. */}
      <div
        className="absolute inset-y-0 end-0 w-[76%] overflow-hidden"
        style={{ maskImage: ENVELOPE, WebkitMaskImage: ENVELOPE }}
      >
        {(["a", "b"] as const).map((slot) => (
          <div
            key={`wash-${slot}`}
            data-bp-xfade
            className="absolute inset-0 transition-opacity duration-[520ms] ease-[var(--bp-ease)]"
            style={{
              background: v.wash[slot] ? bandWash(v.wash[slot], v.rtl) : undefined,
              opacity: v.washOn && v.wash.front === slot ? 1 : 0,
            }}
          />
        ))}

        <div
          data-bp-xfade
          className="absolute inset-0 transition-opacity duration-[260ms] ease-[var(--bp-ease)]"
          style={{ opacity: v.mosaicOn ? 1 : 0 }}
        >
          <BpMosaic key={v.mosaicKey} posters={v.mosaicPosters} variant="stage" />
        </div>

        {/* The band still carries its 0.50 on this permanently mounted wrapper,
            never on the images. An image that mounts already carrying its final
            opacity has no transition to run, and a fresh cell inside the band
            would land as a cut. */}
        <div
          data-bp-xfade
          className={`absolute inset-0 ${
            artOn
              ? "transition-opacity duration-[560ms] delay-[120ms] ease-[var(--bp-ease)]"
              : "transition-opacity duration-[380ms] ease-[var(--bp-ease-in)]"
          } ${v.splitOn ? stillDrift : ""}`}
          style={{ opacity: artOn ? 0.5 : 0 }}
        >
          {/* The drift rides the wrapper in split mode, never the panels. Two
              panels drifting on their own shear apart at the seam inside two
              seconds and the one designed frame becomes two sliding photos. */}
          {v.splitOn
            ? v.splits.map((l, i) => {
                const top = i === v.splits.length - 1 && l.band === v.stillBand;
                return (
                  <div
                    key={l.id}
                    data-bp-xfade
                    className="absolute inset-0 transition-opacity duration-[560ms] ease-[var(--bp-ease)]"
                    style={{ opacity: top ? 1 : 0, zIndex: top ? 0 : 1 }}
                  >
                    <BpLiveSplit a={l.a} b={l.b} rtl={v.rtl} rgb={rgb} />
                  </div>
                );
              })
            : v.stills.map((l, i) => {
                // A still whose band is no longer active drops on its own rather
                // than waiting to be displaced, so the next band never rises with
                // the previous band's artwork still lit underneath it.
                const top = i === v.stills.length - 1 && l.band === v.stillBand;
                return (
                  <img
                    key={l.id}
                    data-bp-xfade
                    src={l.src}
                    alt=""
                    decoding="async"
                    className={`absolute inset-0 h-full w-full object-cover ${stillDrift} transition-opacity duration-[560ms] ease-[var(--bp-ease)]`}
                    style={{ opacity: top ? 1 : 0, zIndex: top ? 0 : 1 }}
                  />
                );
              })}
        </div>

        <div
          data-bp-xfade
          className="absolute inset-0 transition-opacity ease-[var(--bp-ease)]"
          style={{ opacity: v.titleArt, transitionDuration: `${BP_TITLE_ART_FADE_MS}ms` }}
        >
          {/* The outgoing layer fades out above the incoming one rather than the
              incoming one fading in: a layer mounts at its final opacity, so it
              has no transition to run. Keying this wrapper by the newest layer
              is the same trap, it unmounts the outgoing image mid-crossfade and
              every backdrop change lands as a hard cut. */}
          <div className="absolute inset-0">
            {v.layers.map((l, i) => {
              const top = i === v.layers.length - 1;
              // No Ken Burns on a bridge. It is replaced inside about a second,
              // so a fourteen second zoom reads as nothing, and this WebView
              // pays for the whole of it on the main thread either way.
              return (
                <img
                  key={l.id}
                  data-bp-xfade
                  src={l.src}
                  alt=""
                  // Every other <img> on the board already carries this. This
                  // one, the biggest decode on the screen, did not, and it is
                  // the one image that mounts at its final opacity with no
                  // fade to hide a decode behind.
                  decoding="async"
                  className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[480ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${
                    l.bridge ? "" : kenburns
                  }`}
                  style={{
                    opacity: v.trailerOn ? 0 : top ? 1 : 0,
                    zIndex: top ? 0 : 1,
                    willChange: xfadeLayer,
                  }}
                />
              );
            })}
            {v.trailerSrc && (
              <video
                ref={v.videoRef}
                data-bp-xfade
                src={v.trailerSrc}
                muted
                loop
                playsInline
                preload="none"
                onCanPlay={v.onTrailerReady}
                className="pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-[480ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
                style={{ opacity: v.trailerOn ? 1 : 0 }}
              />
            )}
          </div>
        </div>

        <div className="absolute inset-0" style={{ background: "var(--bp-scrim-side)" }} />
        <div className="absolute inset-0" style={{ background: PAGE_FADE }} />
        <div className="absolute inset-0" style={{ background: TOP_FADE }} />

      </div>

      {(["a", "b"] as const).map((slot) => (
        <div
          key={`tint-${slot}`}
          data-bp-xfade
          className="absolute inset-0 transition-opacity duration-[620ms] ease-[var(--bp-ease)]"
          style={{
            background: v.tint[slot] ? bandTint(v.tint[slot]) : undefined,
            opacity: v.tintOn && v.tint.front === slot ? 1 : 0,
          }}
        />
      ))}

      <div className="absolute inset-0" style={{ background: LEFT_VOID }} />
      <div
        className="absolute inset-x-0 bottom-0 transition-[height] duration-[520ms] ease-[var(--bp-ease)] motion-reduce:transition-none"
        style={{ height: v.floor, background: FLOOR_FILL }}
      />
    </div>
  );
}

export const BpAmbientLayers = memo(BpAmbientLayersBody);
