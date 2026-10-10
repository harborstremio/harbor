import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { isHydratableChannel } from "@/lib/iptv/channel-hydration";
import type { EpgProgram, IptvChannel } from "@/lib/iptv/types";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { useView } from "@/lib/view";
import { usePageVisible } from "@/lib/visibility";
import { useChannelHydration } from "@/views/live/hooks/use-channel-hydration";
import { MultiPlayer } from "@/views/multiview/multi-player";
import { BpGuidePortalArt } from "./bp-guide-portal-art";
import { useBpT } from "./bp-i18n";
import { subscribeBpTick } from "./bp-live-tick";

// 400ms is what a JSON hover-preview uses. A video mount is heavier than a
// fetch, so holding Down through a category must not spawn one per channel.
const DWELL_MS = 700;

const NO_NAMES: string[] = [];

// A stream that refuses once refuses every time the cursor comes back. Without
// this, revisiting a dead channel restarts the whole failure cycle each pass.
const FAILED = new Set<string>();

function ratioAt(startMs: number, endMs: number, atMs: number): number {
  const span = endMs - startMs;
  if (span <= 0) return 0;
  return Math.max(0, Math.min(1, (atMs - startMs) / span));
}

function BpPortalProgress({
  startMs,
  endMs,
  nowMs,
}: {
  startMs: number;
  endMs: number;
  nowMs: number;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const apply = () => {
      const el = ref.current;
      if (!el) return;
      const next = `${(ratioAt(startMs, endMs, Date.now()) * 100).toFixed(2)}%`;
      if (el.style.width !== next) el.style.width = next;
    };
    apply();
    return subscribeBpTick(apply);
  }, [startMs, endMs]);

  return (
    <span
      aria-hidden
      className="mt-[3px] block h-[3px] w-full overflow-hidden rounded-full bg-[var(--bp-edge-2)]"
    >
      <span
        ref={ref}
        className="block h-full rounded-full"
        style={{
          width: `${(ratioAt(startMs, endMs, nowMs) * 100).toFixed(2)}%`,
          background: "var(--bp-live)",
        }}
      />
    </span>
  );
}

export function BpGuidePortal({
  channel,
  program,
  title,
  meta,
  nowMs,
  dimmed,
}: {
  channel: IptvChannel | null;
  program: EpgProgram | null;
  title: string;
  meta: string;
  nowMs: number;
  dimmed: boolean;
}) {
  const t = useBpT();
  const reduced = useReducedMotion();
  const pageVisible = usePageVisible();
  const { stackKinds } = useView();
  const [playing, setPlaying] = useState(false);
  const [armed, setArmed] = useState(false);
  const [, markFailed] = useReducer((n: number) => n + 1, 0);

  const channelId = channel?.id ?? "";
  const artKey = program?.title?.trim() || channel?.name || "";
  const hydrateNames = useMemo(
    () => (channel && artKey && isHydratableChannel(channel) ? [artKey] : NO_NAMES),
    [channel, artKey],
  );
  const hydrations = useChannelHydration(hydrateNames);

  useEffect(() => {
    setPlaying(false);
    setArmed(false);
    if (!channelId) return;
    const id = window.setTimeout(() => setArmed(true), DWELL_MS);
    return () => window.clearTimeout(id);
  }, [channelId]);

  // Gone, not dimmed. Parking this subtree at opacity 0.1 is a group opacity
  // strictly between 0 and 1, which is a permanent offscreen pass, and the
  // subtree it would promote is a decoding 16:9 video: the single most expensive
  // element on the page to hold in a render surface, held for as long as the
  // cursor sits on a bottom row. Unmounting also drops the IPTV socket the
  // comment below worries about.
  if (!channel || dimmed) return null;

  // PlayerView and the Big Picture shell are mounted as siblings and the
  // inactive tree is only marked invisible, so an invisible video keeps
  // decoding and keeps its socket open. Many IPTV accounts cap concurrent
  // connections at 1, which would make the preview reject the real playback.
  const mountVideo =
    armed &&
    !!channel.url &&
    !FAILED.has(channel.id) &&
    pageVisible &&
    !stackKinds.includes("player") &&
    !reduced;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute overflow-hidden bg-[var(--bp-void)]"
      style={{
        insetInlineEnd: "calc(var(--bp-safe-x, 0px) + clamp(18px, 1.7vw, 40px))",
        bottom: "calc(var(--bp-hint-h) + clamp(8px, 1vh, 16px))",
        width: "clamp(300px, 23vw, 520px)",
        aspectRatio: "16 / 9",
        zIndex: 4,
        borderRadius: "var(--bp-r-xs)",
        boxShadow: "inset 0 0 0 1px var(--bp-edge-2), 0 24px 60px -20px rgba(0, 0, 0, 0.85)",
      }}
    >
      <BpGuidePortalArt
        key={`${channel.id}|${artKey}`}
        channel={channel}
        program={program}
        hydrated={hydrations.get(artKey) ?? null}
      />

      {mountVideo && (
        <div
          data-bp-xfade
          className="absolute inset-0 transition-opacity duration-[420ms] ease-[var(--bp-ease)]"
          style={{ opacity: playing ? 1 : 0 }}
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
        </div>
      )}

      <div className="absolute inset-0" style={{ background: "var(--bp-scrim-up)" }} />

      <div
        className="absolute inset-x-0 bottom-0 flex flex-col gap-[2px]"
        style={{ padding: "clamp(10px, 0.9vw, 18px)" }}
      >
        <span className="flex items-center gap-[6px]">
          <span
            aria-hidden
            className="h-[6px] w-[6px] shrink-0 rounded-full"
            style={{ background: "var(--bp-live)" }}
          />
          <span className="text-[clamp(9px,1.15vh,12.5px)] font-semibold uppercase tracking-[0.16em] text-ink-muted">
            {t("Live")}
          </span>
        </span>

        <span
          dir="auto"
          className="line-clamp-1 text-[clamp(13px,1.7vh,19px)] font-semibold text-ink"
        >
          {title}
        </span>

        <span
          dir="auto"
          className="line-clamp-1 text-[clamp(10px,1.35vh,14.5px)] font-medium tabular-nums text-ink-subtle"
        >
          {meta}
        </span>

        {/* Replacing the desktop hover tooltip with a persistent readout is
            right, dropping the payload it carried is a content regression. */}
        {program?.description && (
          <span
            dir="auto"
            className="line-clamp-2 text-[clamp(11px,1.4vh,15px)] leading-[1.45] text-ink-subtle"
          >
            {program.description}
          </span>
        )}

        {program && (
          <BpPortalProgress startMs={program.startMs} endMs={program.endMs} nowMs={nowMs} />
        )}
      </div>
    </div>
  );
}
