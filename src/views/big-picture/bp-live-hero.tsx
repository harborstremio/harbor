import { useEffect, useReducer, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isRtl, useUiLanguage } from "@/lib/i18n";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { useView } from "@/lib/view";
import { usePageVisible } from "@/lib/visibility";
import { MultiPlayer } from "@/views/multiview/multi-player";
import type { NowItem } from "./use-bp-live";

// bp-guide-portal dwells 700ms because a wrong start there is a small tile. This
// layer is half the screen, so a wrong start is a full screen flash, and the
// owner asked for "a few seconds". One constant, one line to tune.
const HERO_DWELL_MS = 1600;

// Same refusal ledger as bp-guide-portal. Without it a dead channel restarts the
// whole failure cycle every time the cursor comes back to it.
const FAILED = new Set<string>();

// The ambient's own envelope stops, so the two layers register instead of
// reading as one photograph pasted over another.
const FEATHER_LTR = "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.5) 17%, #000 38%)";
const FEATHER_RTL = "linear-gradient(to left, transparent 0%, rgba(0,0,0,0.5) 17%, #000 38%)";

const FLOOR =
  "linear-gradient(to top, var(--bp-page) 0%, color-mix(in oklab, var(--bp-page) 55%, transparent) 22%, transparent 46%)";

// The exact envelope BpAmbient gives its artwork. The preview has to occupy the
// same rectangle with the same feather and the same scrims, or it reads as a
// video pasted on top of a backdrop instead of being the backdrop.
const ENVELOPE_WIDTH = "76%";

const PAGE_FADE =
  "linear-gradient(to top, var(--bp-page) 0%, var(--bp-page) 34%, color-mix(in oklab, var(--bp-page) 78%, transparent) 46%, color-mix(in oklab, var(--bp-page) 34%, transparent) 58%, transparent 72%)";

const TOP_FADE =
  "linear-gradient(to bottom, color-mix(in oklab, var(--bp-void) 80%, transparent) 0%, transparent 26%)";

export function BpLiveHero({ item }: { item: NowItem | null }) {
  const reduced = useReducedMotion();
  const pageVisible = usePageVisible();
  const { stackKinds } = useView();
  const rtl = isRtl(useUiLanguage());
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const [armedId, setArmedId] = useState("");
  const [playing, setPlaying] = useState(false);
  const [, markFailed] = useReducer((n: number) => n + 1, 0);

  const channel = item?.channel ?? null;
  const channelId = channel?.id ?? "";

  // Into the ambient, never into [data-bp-root]. A portal appends as the last
  // child, so mounting at root put a full height video above every row and hid
  // the page behind it. The ambient is the backdrop layer and paints under main,
  // which is the only place a full bleed preview can live. Positioning stays
  // absolute so it escapes the rail's transform.
  useEffect(() => {
    setRoot(document.querySelector<HTMLElement>("[data-bp-ambient]"));
  }, []);

  // The dwell is held as the channel id, not a boolean. A boolean is still true
  // for the one render between a new channel arriving and this effect clearing
  // it, and MultiPlayer mounting in that render opens a socket with no dwell at
  // all and flashes the outgoing channel's opacity onto it.
  useEffect(() => {
    setPlaying(false);
    setArmedId("");
    if (!channelId) return;
    const id = window.setTimeout(() => setArmedId(channelId), HERO_DWELL_MS);
    return () => window.clearTimeout(id);
  }, [channelId]);

  // PlayerView and the Big Picture shell are mounted as siblings and the
  // inactive tree is only marked invisible, so an invisible video keeps decoding
  // and keeps its socket open. Many IPTV accounts cap concurrent connections at
  // 1, which would make this preview reject the user's real playback.
  const mountVideo =
    channelId !== "" &&
    armedId === channelId &&
    !!channel &&
    !!channel.url &&
    !FAILED.has(channel.id) &&
    pageVisible &&
    !stackKinds.includes("player") &&
    !reduced;

  if (!root || !channel || !mountVideo) return null;

  const feather = rtl ? FEATHER_RTL : FEATHER_LTR;

  return createPortal(
    <div
      ref={panelRef}
      aria-hidden
      data-bp-xfade
      className="pointer-events-none absolute overflow-hidden transition-opacity duration-[520ms] ease-[var(--bp-ease)]"
      style={{
        insetInlineEnd: 0,
        top: 0,
        bottom: 0,
        width: ENVELOPE_WIDTH,
        zIndex: 0,
        opacity: playing ? 1 : 0,
        maskImage: feather,
        WebkitMaskImage: feather,
      }}
    >
      <MultiPlayer
        key={channel.id}
        url={channel.url}
        muted
        exclusive
        cover
        onPlaying={() => setPlaying(true)}
        onError={() => {
          FAILED.add(channel.id);
          setPlaying(false);
          markFailed();
        }}
      />
      <div className="absolute inset-0" style={{ background: FLOOR }} />
      <div className="absolute inset-0" style={{ background: PAGE_FADE }} />
      <div className="absolute inset-0" style={{ background: TOP_FADE }} />
    </div>,
    root,
  );
}
