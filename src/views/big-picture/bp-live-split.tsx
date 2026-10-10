import { useEffect, useState } from "react";
import { useProxiedImageSrc } from "@/lib/remote-image-proxy";

const SEAM_TOP = 58;
const SEAM_BOTTOM = 50;
const SEAM_W = 0.14;
const BRIDGE_AT = 0.22;
const PANEL_FILTER = "saturate(0.72) contrast(1.06)";
const SEAM_INK = "color-mix(in oklab, var(--color-ink) 10%, transparent)";
const WASH_MAX = 0.14;
const BRIDGE_DELAY_MS = 240;
const BRIDGE_FADE_MS = 420;
const BRIDGE_DROP = "drop-shadow(0 8px 24px rgba(0,0,0,0.55))";

const BRIDGE_X = SEAM_TOP + (SEAM_BOTTOM - SEAM_TOP) * BRIDGE_AT;
const SOLO_X = 62;

function pct(v: number, rtl: boolean): string {
  return `${(rtl ? 100 - v : v).toFixed(2)}%`;
}

// Panel B is drawn full-bleed and unclipped underneath, and only Panel A is
// clipped. Two adjacent clip-paths sharing an edge leave a subpixel hairline of
// whatever sits behind them, and on a near-black field that reads as a crack.
function clipPanelA(rtl: boolean): string {
  return `polygon(${pct(0, rtl)} 0%, ${pct(SEAM_TOP, rtl)} 0%, ${pct(SEAM_BOTTOM, rtl)} 100%, ${pct(0, rtl)} 100%)`;
}

function clipSeam(rtl: boolean): string {
  return `polygon(${pct(SEAM_TOP, rtl)} 0%, ${pct(SEAM_TOP + SEAM_W, rtl)} 0%, ${pct(SEAM_BOTTOM + SEAM_W, rtl)} 100%, ${pct(SEAM_BOTTOM, rtl)} 100%)`;
}

// One overlay across both panels and the cut. Tinting each panel on its own
// turns the seam into a colour boundary and the frame reads as a collage again.
function splitWash(rgb: string, rtl: boolean): string {
  const at = rtl ? "12% 6%" : "88% 6%";
  return `radial-gradient(96% 118% at ${at}, rgba(${rgb} / ${WASH_MAX}) 0%, rgba(${rgb} / 0.08) 30%, rgba(${rgb} / 0.03) 46%, transparent 60%)`;
}

export function BpLiveSplit({
  a,
  b,
  rtl,
  rgb,
}: {
  a: string;
  b: string;
  rtl: boolean;
  rgb: string;
}) {
  const aSrc = useProxiedImageSrc(a);
  const bSrc = useProxiedImageSrc(b);

  return (
    <>
      <img
        src={bSrc}
        alt=""
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ filter: PANEL_FILTER }}
      />
      <img
        src={aSrc}
        alt=""
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ filter: PANEL_FILTER, clipPath: clipPanelA(rtl) }}
      />
      <div
        className="absolute inset-0"
        style={{ background: SEAM_INK, clipPath: clipSeam(rtl) }}
      />
      {rgb && <div className="absolute inset-0" style={{ background: splitWash(rgb, rtl) }} />}
    </>
  );
}

// The bug is the only full saturation hard-edged thing in the frame and the
// only element allowed to cross the seam. It arrives after the panels commit so
// the depth assembles instead of landing pre-built, and it sits above the
// envelope's own scrims so nothing dims the one object carrying the front plane.
export function BpLiveBridge({
  src,
  rtl,
  solo,
}: {
  src: string;
  rtl: boolean;
  solo: boolean;
}) {
  const url = useProxiedImageSrc(src);
  const [lit, setLit] = useState(false);

  useEffect(() => {
    setLit(false);
    if (!url) return;
    const id = window.requestAnimationFrame(() => setLit(true));
    return () => window.cancelAnimationFrame(id);
  }, [url, solo]);

  if (!url) return null;

  return (
    <img
      src={url}
      alt=""
      decoding="async"
      data-bp-xfade
      className="absolute object-contain transition-opacity ease-[var(--bp-ease)] motion-reduce:delay-0"
      style={{
        left: solo ? pct(SOLO_X, rtl) : pct(BRIDGE_X, rtl),
        top: solo ? "46%" : "22%",
        transform: solo ? "translate(-50%, -50%)" : "translateX(-50%)",
        width: solo ? undefined : "clamp(110px, 10vw, 220px)",
        maxWidth: solo ? "clamp(160px, 16vw, 340px)" : undefined,
        maxHeight: solo ? "clamp(88px, 11vh, 190px)" : "clamp(56px, 7vh, 130px)",
        filter: BRIDGE_DROP,
        opacity: lit ? 1 : 0,
        transitionDuration: `${BRIDGE_FADE_MS}ms`,
        transitionDelay: `${BRIDGE_DELAY_MS}ms`,
      }}
    />
  );
}
