import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { ImdbIcon } from "@/components/icons/imdb-icon";
import { useProxiedImageSrc } from "@/lib/remote-image-proxy";
import { bpBoxCss, bpBoxPx, bpCardArt, type BpArtBox } from "./bp-art";
import { BpArt } from "./bp-art-img";
import { BP_METRIC_CHIP, BP_DETAIL_TRACK_TIGHT } from "./detail/bp-detail-chrome";

// One record for the drawn width and the requested one, the rule bp-art states.
export const BP_EPISODE_BOX: BpArtBox = { min: 212, vw: 17.5, max: 340 };

export const BP_EPISODE_CARD_W = bpBoxCss(BP_EPISODE_BOX);

export const BP_EPISODE_STRIP = BP_DETAIL_TRACK_TIGHT;

// A remote has no hover, so the desktop's group-hover unblur (SPOILER_THUMB_CLASS
// in lib/spoilers) would leave a masked still masked forever. Focus is the cursor
// here, and the mask has to lift on it or hideSpoilers makes the strip unusable.
export const BP_SPOILER_THUMB =
  "blur-[16px] scale-[1.05] transition-[filter,transform] duration-[var(--bp-dur)] ease-[var(--bp-ease)] group-data-[bp-focus=true]:blur-[0px] group-data-[bp-focus=true]:scale-100 motion-reduce:transition-none";

export const BP_SPOILER_TEXT =
  "blur-[6px] select-none transition-[filter] duration-[var(--bp-dur)] ease-[var(--bp-ease)] group-data-[bp-focus=true]:blur-[0px] motion-reduce:transition-none";

// The provider mark carries the identity so the numeral does not have to. A score
// is neither actionable nor live, so it never takes a saturated fill: it earns
// its place from contrast against the darkened chip. Marks size in em, because a
// mark pinned to 11px disappears once the type scales up on a 4K panel.
export function BpEpisodeRating({ value, isImdb }: { value: number; isImdb: boolean }) {
  return (
    <span
      className={`absolute start-[7px] bottom-[10px] text-[clamp(10px,1.28vh,15px)] ${BP_METRIC_CHIP}`}
    >
      {isImdb ? (
        <ImdbIcon className="h-[1.35em] w-auto shrink-0" />
      ) : (
        <Star className="h-[1.1em] w-[1.1em] shrink-0" fill="currentColor" strokeWidth={0} />
      )}
      {value.toFixed(1)}
    </span>
  );
}

// The series backdrop rides behind the numeral at low opacity rather than filling
// the frame. One backdrop repeated across a thousand cards is the identical
// rectangles failure state wearing nicer art, and the number is the one thing a
// viewer scanning an absolute-order strip is actually reading.
export function BpEpisodeStillPlate({ label, bed }: { label: number; bed?: string }) {
  return (
    <span className="relative flex h-full w-full items-center justify-center bg-[var(--bp-panel-2)]">
      {bed && (
        <>
          <img
            src={bed}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover opacity-25 saturate-[0.6]"
          />
          {/* The bed has to be darkened, not just faded. On a bright key art a
              25% wash lifts the field toward the ink colour and a translucent
              numeral over it collapses to roughly 2:1, which is under the large
              text floor and gone at ten feet. Darkening is how depth is made
              here anyway, so the scrim doubles as the numeral's plate. */}
          <span aria-hidden className="absolute inset-0 bg-[var(--bp-void)]/60" />
        </>
      )}
      <span className="relative font-display text-[clamp(26px,4.6vh,58px)] font-semibold tabular-nums text-ink opacity-60">
        {label}
      </span>
    </span>
  );
}

/**
 * Walks a still fallback chain and lands on the numbered plate once it runs out.
 * Every url goes through useProxiedImageSrc: a remote plain-http still is refused
 * by the WebView as mixed content and paints nothing at all.
 */
export function BpEpisodeStill({
  chain,
  label,
  backdrop,
}: {
  chain: string[];
  label: number;
  backdrop?: string;
}) {
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);
  // enrichEpisodes fills thumbnails in after first paint, so the chain can change
  // under a card that has already resolved. Without the ready reset the new url
  // paints at full opacity before it has loaded, which reads as a blank frame
  // rather than as art arriving.
  const key = chain.join("|");
  useEffect(() => {
    setStep(0);
    setReady(false);
  }, [key]);
  const url = chain[step];
  const src = useProxiedImageSrc(url);
  // The bed is one series backdrop drawn at 25 percent behind a numeral in a
  // 212px box. Asked for at hero size that is a 1920x1080 metahub file, 7.9MB
  // decoded, for a card that can paint 212 of it.
  const bed = useProxiedImageSrc(bpCardArt(backdrop, bpBoxPx(BP_EPISODE_BOX)));

  // A QUIET plate, and it must stay quiet. This carried animate-pulse behind a
  // useBpCardVisible gate, and the gate could not hold it: that hook observes
  // the enclosing [data-bp-rail-row], so the whole strip flips "near" the frame
  // the row intersects, including the eighteen cards past the right edge of a
  // 1140px canvas. Those are loading="lazy", never load, never set ready, and
  // pulsed for the life of the page: twenty-odd live group opacities against a
  // cliff that saturates at eight. A per-card loader cannot be rescued by a
  // visibility gate on this surface. If a strip needs motion while it loads,
  // that is BpEpisodeStripSkeleton's plates, below.
  if (!url) return <BpEpisodeStillPlate label={label} bed={bed} />;
  return (
    <>
      {!ready && <span className="absolute inset-0 bg-[var(--bp-panel-2)]" />}
      <BpArt
        key={src}
        src={src}
        onLoad={() => setReady(true)}
        onError={() => {
          setReady(false);
          setStep((s) => Math.min(s + 1, chain.length));
        }}
        className={`object-cover transition-opacity duration-[var(--bp-dur)] ease-[var(--bp-ease)] motion-reduce:transition-none ${
          ready ? "opacity-100" : "opacity-0"
        }`}
      />
    </>
  );
}

// Plates, the trade bp-page-skeleton.tsx:6-15 records. The host carries the
// strip's own gap so the plates do not move when the real cards land.
export function BpEpisodeStripSkeleton() {
  return (
    <span className="flex shrink-0 gap-[clamp(9px,0.85vw,17px)]">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="flex shrink-0 flex-col overflow-hidden rounded-sm bg-[var(--bp-panel)]"
          style={{ width: BP_EPISODE_CARD_W }}
        >
          <span
            data-bp-plate
            className="block w-full bg-[var(--bp-panel-2)]"
            style={{ aspectRatio: "16 / 9" }}
          />
          <span className="flex flex-col gap-1 p-[clamp(9px,0.9vw,15px)]">
            <span
              data-bp-plate
              className="block h-[clamp(10px,1.25vh,14px)] w-1/3 rounded-full bg-[var(--bp-panel-2)]"
            />
            <span
              data-bp-plate
              className="block h-[clamp(13px,1.8vh,20.5px)] w-3/4 rounded-full bg-[var(--bp-panel-2)]"
            />
          </span>
        </span>
      ))}
    </span>
  );
}
