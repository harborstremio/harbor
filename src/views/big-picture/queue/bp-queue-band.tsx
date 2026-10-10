import { useEffect, useRef, useState } from "react";
import { SFX } from "@/lib/sfx";
import { bpCardArt, bpHeroArt } from "../bp-art";
import { useArtGlow } from "../bp-art-color";
import { useBpT } from "../bp-i18n";
import { useBpQueuePeek } from "./use-bp-queue";

const PEEK = 4;
const TILE_H = "clamp(150px, 20vh, 260px)";
const FAN_END = "clamp(18px, 1.6vw, 34px)";
const BED_CLEAR_MS = 620;

// The fan is laid out off the tile height, never off the decoded posters: a
// poster is 76% of the tile at 2:3, so it is 0.5067 of that height wide, and a
// 38% overlap steps the next one by 0.3141 of it. Measuring the images instead
// leaves the whole fan stacked on one spot until the last one decodes.
const FAN_STEP = 0.3141;
const FAN_FADE = [1, 0.82, 0.6, 0.38];
const FAN_POSTER_W = 76;

// The stage can afford blur-[26px] because its bed sits inside inset-[-3.4%] of
// a full viewport, roughly 100px of opaque overscale to spill into. This tile is
// 150px tall, so the same numbers fade both long edges to nothing well inside
// the frame and the fallback reads as a smudge in a box. Scale carries the
// overscale here instead: 0.4 of the height each way against a falloff of about
// 3 sigma, itself scaled by the same transform.
const BED_POSTER = "scale-[1.8] blur-[18px] opacity-45";
const BED_POSTER_W = 300;

const SHELL =
  "relative flex w-full items-center overflow-hidden rounded-[var(--bp-r-lg)] border border-[var(--bp-edge)] bg-[var(--bp-panel)] text-start will-change-transform";

// data-bp-xfade, never motion-reduce:transition-none. Reduced motion replaces
// travel with a cross-fade rather than removing it, and the blanket 1ms rule at
// bp-tokens.ts:236 would otherwise turn this swap into the hard cut the two
// layers exist to avoid.
const BED =
  "absolute inset-0 h-full w-full object-cover transition-opacity duration-[var(--bp-dur-slow)]";

// The only tile on Discover made of live content. Drawing it calls getPool,
// which is memoised per day per key, so the queue opens on already-warm data.
export function BpQueueBand({
  onOpen,
  onTint,
}: {
  onOpen: () => void;
  onTint: (colour: string) => void;
}) {
  const t = useBpT();
  const peek = useBpQueuePeek(PEEK);
  // The painted url, never a boolean: the pool can resolve after a settings
  // change and a flag would leave the new bed at full opacity mid-decode.
  const [shown, setShown] = useState<string | null>(null);
  const [outgoing, setOutgoing] = useState<string | null>(null);
  const [dead, setDead] = useState<string | null>(null);

  const posters = peek.posters.slice(0, PEEK);
  const ready = peek.status === "ready";
  const loading = peek.status === "loading";
  const bedIsPoster = !peek.backdrop && posters.length > 0;
  const raw = peek.backdrop
    ? bpHeroArt(peek.backdrop)
    : bpCardArt(posters[0], BED_POSTER_W);
  // A url that errored is not a url still on its way. Without this the pulse
  // under it runs for the life of the session on any 404, rate limit or plain
  // http source the WebView refuses, and the one autofocused cell on Discover
  // lies that it is still loading.
  const bed = raw && raw !== dead ? raw : undefined;
  const glow = useArtGlow(bed);

  const tintRef = useRef(onTint);
  tintRef.current = onTint;
  useEffect(() => {
    if (glow) tintRef.current(glow);
  }, [glow]);

  // The outgoing bed is held under the incoming one for the length of the fade
  // and no longer. Unmounting it the moment the new one loads would make the
  // swap a cut, and holding it forever stacks a full-size image per rebuild.
  useEffect(() => {
    if (!outgoing) return;
    const id = window.setTimeout(() => setOutgoing(null), BED_CLEAR_MS);
    return () => window.clearTimeout(id);
  }, [outgoing]);

  const count = t("{n} waiting", { n: peek.total });
  const line = ready
    ? t("Open the queue")
    : loading
      ? t("Building tonight's queue…")
      : peek.status === "empty"
        ? t("Nothing left in today's picks")
        : t("No picks loaded. TMDB might be unreachable.");

  const bedOpacity = bedIsPoster ? "opacity-45" : "opacity-80";

  return (
    <section data-bp-row data-bp-row-key="queue" aria-label={t("Discovery Queue")} className="relative">
      <div className="px-[var(--bp-gutter)] pt-[clamp(22px,2.6vh,40px)]">
        <button
          type="button"
          data-bp-focusable
          data-bp-tile="wide"
          // Discover's only autofocus, and it is unconditional. The band renders
          // in every state, so the marker never hands off mid-settle and drags
          // the ring across the page with it.
          data-bp-autofocus="true"
          data-bp-restore-key="bp-lead:queue"
          onClick={() => {
            SFX.click();
            onOpen();
          }}
          aria-label={
            ready
              ? `${t("Discovery Queue")}, ${line}, ${count}`
              : `${t("Discovery Queue")}, ${line}`
          }
          className={SHELL}
          style={{ height: TILE_H }}
        >
          {loading && !shown && (
            <span
              aria-hidden
              className="absolute inset-0 animate-pulse bg-[var(--bp-panel-2)] motion-reduce:animate-none"
            />
          )}

          {/* Two mounted layers, the outgoing one underneath. The incoming img
              mounts at opacity 0 and is flipped by its own load in a later
              commit, so the fade is a real transition rather than a cut from
              the empty panel. */}
          {outgoing && outgoing !== bed && (
            <img
              key={`out:${outgoing}`}
              src={outgoing}
              alt=""
              aria-hidden
              data-bp-xfade
              decoding="async"
              className={`${BED} ${bedIsPoster ? BED_POSTER : "opacity-80"}`}
            />
          )}
          {bed && (
            <img
              key={bed}
              src={bed}
              alt=""
              data-bp-xfade
              decoding="async"
              // Deliberately NOT lazy, unlike the poster mosaic below. The fade
              // above is gated on this element's onLoad, and this band is the
              // first entry pushed into the discover rail, so it is always in
              // the opening viewport. Lazy deprioritised the one fetch that
              // decides when the band stops being an empty panel, which is the
              // "art arrives after the text" failure in miniature. Measured
              // 1732 CSS px painted, the largest image on the page.
              onLoad={() => {
                setOutgoing((prev) => (shown && shown !== bed ? shown : prev));
                setShown(bed);
              }}
              onError={() => setDead(bed)}
              className={`${BED} ${bedIsPoster ? BED_POSTER : ""} ${
                shown === bed ? bedOpacity : "opacity-0"
              }`}
            />
          )}

          <span aria-hidden className="absolute inset-0" style={{ background: "var(--bp-scrim-side)" }} />

          {posters.map((url, i) => (
            <img
              key={`${i}:${url}`}
              src={bpCardArt(url, FAN_POSTER_W)}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute top-1/2 h-[76%] w-auto -translate-y-1/2 -rotate-[4deg] rounded-[var(--bp-r-sm)] object-cover shadow-[0_18px_38px_-14px_rgba(0,0,0,0.9)] rtl:rotate-[4deg]"
              style={{
                aspectRatio: "2 / 3",
                insetInlineEnd: `calc(${((posters.length - 1 - i) * FAN_STEP).toFixed(4)} * ${TILE_H} + ${FAN_END})`,
                zIndex: posters.length - i,
                opacity: FAN_FADE[i] ?? 0.38,
              }}
            />
          ))}

          <span className="relative z-10 flex max-w-[min(42%,560px)] flex-col gap-[clamp(3px,0.5vh,8px)] ps-[clamp(20px,2vw,44px)] [text-shadow:0_2px_18px_rgba(0,0,0,0.75)]">
            <span className="line-clamp-1 font-display text-[clamp(20px,3vh,42px)] font-semibold leading-tight tracking-[-0.01em] text-ink">
              {t("Discovery Queue")}
            </span>
            <span
              className={`flex min-w-0 items-baseline gap-[0.6em] text-[clamp(10.5px,1.4vh,16px)] font-bold text-ink-subtle ${
                ready || loading ? "uppercase tracking-[0.16em]" : "tracking-[0.02em]"
              }`}
            >
              <span className="truncate">{line}</span>
              {ready && (
                <>
                  <span aria-hidden className="opacity-40">
                    •
                  </span>
                  <span className="shrink-0 tabular-nums text-ink-muted">{count}</span>
                </>
              )}
            </span>
          </span>
        </button>
      </div>
    </section>
  );
}
