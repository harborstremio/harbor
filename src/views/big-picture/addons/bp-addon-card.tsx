import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { hostOf } from "@/lib/addons-store/reorder";
import { isRtl, useUiLanguage } from "@/lib/i18n";
import { useProxiedImageSrc } from "@/lib/remote-image-proxy";
import { SFX } from "@/lib/sfx";
import { useArtGlow } from "../bp-art-color";

export const BP_ADDON_CARD_W = "clamp(214px, 17.6vw, 318px)";
export const BP_ADDON_CARD_H = `calc(${BP_ADDON_CARD_W} * 0.75)`;

// Byte-identical to the services track. The pb/-mb pair is what gives the focus
// lift somewhere to grow into without the row clipping it, and every rail row
// has to share the same gutter or the label column stops lining up.
export const BP_ADDON_TRACK =
  "flex gap-[clamp(11px,1vw,20px)] overflow-x-auto px-[var(--bp-gutter)] pt-[clamp(22px,2.6vh,40px)] pb-[60px] -mb-[38px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

const SLOTS = 6;

// Every animated property here is opacity or filter, so the tokens' blanket
// reduced-motion rule flattens the whole card on its own. This file must not
// declare keyframes and must not carry data-bp-xfade, which would opt the fades
// back into 320ms under reduced motion.

// Structural on purpose: the registry's BpAddonEntry satisfies this without the
// card importing it, so this file compiles on its own while the row and the
// data hook land beside it. The component is generic over it because
// strictFunctionTypes checks callback parameters contravariantly, so a caller
// handing in its own richer entry type needs onOpen to be typed on that type
// and not on this floor.
export type BpAddonCardEntry = {
  id: string;
  name?: string;
  transportUrl: string;
  logo?: string | null;
  hasCatalogs: boolean;
};

// The 88% stop sits at 52% and not at 34% because that is where the mark box
// actually ends (start 7.5% plus width 44%). At 34% the outer third of a wide
// wordmark sat over roughly 62% coverage, so a pale mark over bright key art
// was far less protected than the geometry claimed.
const SCRIM_STOPS =
  "var(--bp-void) 0%, color-mix(in oklab, var(--bp-void) 88%, transparent) 52%, color-mix(in oklab, var(--bp-void) 52%, transparent) 68%, color-mix(in oklab, var(--bp-void) 22%, transparent) 84%, transparent 100%";

const SCRIM_LTR = `linear-gradient(to right, ${SCRIM_STOPS})`;

const SCRIM_RTL = `linear-gradient(to left, ${SCRIM_STOPS})`;

const FLOOR =
  "linear-gradient(to top, color-mix(in oklab, var(--bp-void) 72%, transparent) 0%, color-mix(in oklab, var(--bp-void) 24%, transparent) 24%, transparent 48%)";

const MARK_SHADOW = "drop-shadow(0 3px 14px color-mix(in oklab, var(--bp-void) 80%, transparent))";

const SHELL =
  "group relative block shrink-0 overflow-hidden rounded-[var(--bp-r-md)] border border-[var(--bp-edge)] text-start";

// Bottom-anchored like bandTint(), so the addon's own colour wells up out of the
// card rather than sitting behind the mark where it reads as mud.
function veilOf(rtl: boolean): string {
  const at = rtl ? "82% 100%" : "18% 100%";
  return `radial-gradient(120% 100% at ${at}, rgba(var(--bp-art-glow) / 0.30) 0%, rgba(var(--bp-art-glow) / 0.12) 42%, transparent 70%)`;
}

// useProxiedImageSrc is a hook, so it cannot be mapped over a poster list. One
// cell is one component for that reason alone.
function BpAddonMosaicCell({ src }: { src: string }) {
  const url = useProxiedImageSrc(src);
  const [dead, setDead] = useState(false);

  return (
    <span className="block overflow-hidden">
      {url && !dead && (
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setDead(true)}
          className="h-full w-full object-cover"
        />
      )}
    </span>
  );
}

export function BpAddonCard<E extends BpAddonCardEntry>({
  entry,
  posters,
  width,
  autofocus,
  onOpen,
  onFocus,
}: {
  entry: E;
  posters?: readonly string[];
  width?: string;
  autofocus?: boolean;
  onOpen: (entry: E) => void;
  onFocus?: (entry: E) => void;
}) {
  const rtl = isRtl(useUiLanguage());
  const [touched, setTouched] = useState(false);
  const [glowSeed, setGlowSeed] = useState<string>();
  const [failedUrl, setFailedUrl] = useState<string>();
  const [markLoaded, setMarkLoaded] = useState(false);
  const [artOn, setArtOn] = useState(false);

  // Already absolute: bp-addon-entries resolves the manifest logo against the
  // addon's own host once, so the card and the band hero cannot disagree.
  const logoUrl = entry.logo ?? undefined;
  const proxied = useProxiedImageSrc(logoUrl);
  const failed = !!proxied && proxied === failedUrl;
  const markSrc = failed ? undefined : proxied;

  // Extraction refetches and decodes the whole mark, so a row of sixteen must
  // not all pay for it. The seed latches on first focus and is never cleared,
  // so the veil survives blur and every later visit is a module-cache hit.
  useEffect(() => {
    if (!touched || !markSrc) return;
    setGlowSeed((prev) => prev ?? markSrc);
  }, [touched, markSrc]);
  const glow = useArtGlow(glowSeed);

  const host = hostOf(entry.transportUrl);
  // A manifest stripped by the quota branch arrives with no name at all. The
  // host is honest and is already on screen as the eyebrow, so it is never
  // printed twice.
  const subject = entry.name?.trim() || host;
  const eyebrow = subject === host ? undefined : host;

  const cells = useMemo(() => {
    const seen = new Set<string>();
    const kept: string[] = [];
    for (const p of posters ?? []) {
      if (!p || seen.has(p)) continue;
      seen.add(p);
      kept.push(p);
      if (kept.length === SLOTS) break;
    }
    if (kept.length === 0) return [] as Array<string | null>;
    const size = kept.length <= 3 ? 3 : SLOTS;
    // Gaps fill from the start side, where the scrim is at its darkest and an
    // empty slot cannot be read.
    const pad: Array<string | null> = Array.from({ length: size - kept.length }, () => null);
    return [...pad, ...kept];
  }, [posters]);

  // A layer that mounts already carrying its final opacity has no transition to
  // run. The art has to land as a fade, so the flag is set in an effect after
  // the layer has painted at zero.
  useEffect(() => {
    if (cells.length > 0) setArtOn(true);
  }, [cells.length]);

  const hasArt = cells.length > 0;
  const markOn = !!markSrc && markLoaded;
  // Type must never beat art on arrival, so a direct logo gets the box to
  // itself while it loads. The proxy path is the exception: that round trip
  // goes through Rust and can take seconds, so the wordmark holds the box until
  // the blob lands and then cross-fades out.
  const wordmarkOn = !logoUrl || failed || !markSrc;
  // Never both. Keyed on logoUrl alone this printed the name twice for the whole
  // length of the proxy round trip, which for a plain-http addon mark is seconds.
  const nameOn = !wordmarkOn;

  // Decided by what the manifest declares, never by whether posters arrived. A
  // card that re-centred its mark when its mosaic landed would jump under the
  // ring.
  const markBox: CSSProperties = entry.hasCatalogs
    ? { insetInlineStart: "7.5%", top: "50%", width: "44%", height: "46%" }
    : { insetInlineStart: "21%", top: "50%", width: "58%", height: "54%" };

  const style = {
    width: width ?? BP_ADDON_CARD_W,
    aspectRatio: "4 / 3",
    ...(glow ? { "--bp-art-glow": glow } : null),
  } as CSSProperties;

  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-tile="wide"
      data-bp-addon={entry.transportUrl}
      data-bp-restore-key={`addon:${entry.transportUrl}`}
      data-bp-autofocus={autofocus ? "true" : undefined}
      onFocus={() => {
        setTouched(true);
        onFocus?.(entry);
      }}
      onClick={() => {
        SFX.click();
        onOpen(entry);
      }}
      aria-label={subject}
      className={`${SHELL} ${logoUrl ? "bg-[var(--bp-panel)]" : "bg-[var(--bp-panel-2)]"}`}
      style={style}
    >
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-0 transition-opacity duration-[var(--bp-dur-slow)] ease-[var(--bp-ease)] ${
          glow ? "opacity-85 group-data-[bp-focus=true]:opacity-100" : "opacity-0"
        }`}
        style={{ background: veilOf(rtl) }}
      />

      {hasArt && (
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-0 transition-opacity duration-[var(--bp-dur-slow)] ease-[var(--bp-ease)] ${
            artOn ? "opacity-100" : "opacity-0"
          }`}
        >
          {/* The over-scale bleeds off the end and the edges, never toward the
              mark, so no poster is ever cropped into the mark's box. */}
          <span
            /* --bp-focus-fade: this is the single most expensive per-press
               transition on the home rail. It animates a FILTER and a group
               opacity over the same nine-cell mosaic, so both the offscreen pass
               and its contents are re-resolved on every frame it runs for.
               BP_TOKENS zeroes it on a television. */
            className="grid h-full w-full gap-[2px] opacity-[0.55] saturate-[0.85] transition-[opacity,filter] duration-[var(--bp-focus-fade)] ease-[var(--bp-ease)] group-data-[bp-focus=true]:opacity-[0.8] group-data-[bp-focus=true]:saturate-100"
            style={{
              gridTemplateColumns: "repeat(3, 1fr)",
              gridTemplateRows: cells.length <= 3 ? "1fr" : "repeat(2, 1fr)",
              transform: "scale(1.06)",
              // Origin pins the edge it names, so the overflow is clipped off
              // the opposite one. Start-side origin therefore bleeds off the
              // end, away from the mark, which is the intent above.
              transformOrigin: rtl ? "100% 50%" : "0% 50%",
            }}
          >
            {cells.map((src, i) =>
              src ? (
                <BpAddonMosaicCell key={src} src={src} />
              ) : (
                <span key={`gap-${i}`} className="block" />
              ),
            )}
          </span>
        </span>
      )}

      {hasArt && (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: rtl ? SCRIM_RTL : SCRIM_LTR }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: FLOOR }}
          />
        </>
      )}

      <span aria-hidden className="pointer-events-none absolute -translate-y-1/2" style={markBox}>
        {/* object-contain, never cover: a large share of manifest marks are wide
            wordmarks and cover crops them to their middle third. This is the one
            reason the row cannot reuse the AddonLogo component. */}
        {markSrc && (
          <img
            src={markSrc}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onLoad={() => setMarkLoaded(true)}
            onError={() => setFailedUrl(markSrc)}
            className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-[var(--bp-dur-slow)] ease-[var(--bp-ease)] ${
              markOn ? "opacity-100" : "opacity-0"
            }`}
            style={{
              filter: MARK_SHADOW,
              objectPosition: entry.hasCatalogs ? (rtl ? "right center" : "left center") : "center",
            }}
          />
        )}
        <span
          className={`absolute inset-0 flex flex-col justify-center gap-[0.3em] transition-opacity duration-[var(--bp-dur-slow)] ease-[var(--bp-ease)] ${
            entry.hasCatalogs ? "items-start text-start" : "items-center text-center"
          } ${wordmarkOn ? "opacity-100" : "opacity-0"}`}
        >
          {eyebrow && (
            <span className="line-clamp-1 text-[clamp(9.5px,1.2vh,13px)] font-bold uppercase tracking-[0.16em] text-ink-subtle">
              {eyebrow}
            </span>
          )}
          <span className="line-clamp-2 font-display text-[clamp(17px,2.5vh,32px)] font-semibold leading-[1.05] tracking-[-0.02em] text-ink">
            {subject}
          </span>
        </span>
      </span>

      {nameOn && (
        <span
          aria-hidden
          className={`pointer-events-none absolute line-clamp-1 text-[clamp(11px,1.45vh,16px)] font-semibold text-ink-subtle transition-opacity duration-[var(--bp-dur)] ease-[var(--bp-ease)] ${
            entry.hasCatalogs ? "opacity-0 group-data-[bp-focus=true]:opacity-100" : "opacity-100"
          }`}
          style={{ insetInlineStart: "7.5%", bottom: "clamp(9px, 1.1vh, 16px)", maxWidth: "52%" }}
        >
          {subject}
        </span>
      )}
    </button>
  );
}
