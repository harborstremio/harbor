import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChannelStatsVersion } from "@/lib/iptv/channel-stats";
import { useFavorites } from "@/lib/iptv/favorites";
import { useSettings } from "@/lib/settings";
import { BP_LIVE_TRACK, BpGuideCell, BpGuideCellSkeleton } from "./bp-live-cell";
import { BpLiveHero } from "./bp-live-hero";
import { BP_LIVE_MIN_CELLS, rankBpLive } from "./bp-live-rank";
import { BpRowHeader, type BpRowLead } from "./bp-row-header";
import { publishBpBandArt } from "./use-bp-sections";
import { useBpLive, useBpLiveArt, type NowItem } from "./use-bp-live";

const HYDRATE_CAP = 16;

export function BpLiveRow({
  lead,
  autofocusFirst,
}: {
  lead: BpRowLead;
  autofocusFirst?: boolean;
}) {
  const live = useBpLive();
  const { settings } = useSettings();
  const favorites = useFavorites();
  const statsVersion = useChannelStatsVersion();
  const sectionRef = useRef<HTMLElement | null>(null);
  const [hot, setHot] = useState<NowItem | null>(null);

  const favoriteIds = useMemo(() => new Set(favorites.items.keys()), [favorites.items]);

  // Blur fires before the incoming focus, so clearing straight from it would
  // unmount the stream and its socket on every step inside the row. Deferring
  // one frame lets the arriving focus cancel it, and leaving the row entirely
  // is then the only path that reaches the clear.
  const blurRef = useRef(0);
  const onHot = useCallback((next: NowItem | null) => {
    if (blurRef.current) {
      cancelAnimationFrame(blurRef.current);
      blurRef.current = 0;
    }
    if (next) {
      setHot(next);
      return;
    }
    blurRef.current = requestAnimationFrame(() => {
      blurRef.current = 0;
      setHot(null);
    });
  }, []);

  useEffect(
    () => () => {
      if (blurRef.current) cancelAnimationFrame(blurRef.current);
    },
    [],
  );

  // The only ordering upstream is group-alphabetical, so raw playlist order puts
  // "##" and "24/7" ahead of every real network and useLiveHome then tops the
  // guide up from the first 600 of that order with no ranking at all. This is
  // the only thing standing between the user and a row of sixteen filler feeds.
  const cells = useMemo(
    () =>
      rankBpLive({
        channels: live.channels,
        guide: live.guide,
        epg: live.epg,
        tvgCounts: live.tvgCounts,
        nowMs: live.nowMs,
        region: settings.region,
        favoriteIds,
      }),
    [
      live.channels,
      live.guide,
      live.epg,
      live.tvgCounts,
      live.nowMs,
      settings.region,
      favoriteIds,
      statsVersion,
    ],
  );

  const art = useBpLiveArt(cells, HYDRATE_CAP);

  // publishBpBandArt writes into a module map that outlives this row, so a band
  // art record from a playlist that has since been removed would keep painting
  // the hero for every later focus on the live band.
  useEffect(() => {
    if (!live.hasPlaylists) publishBpBandArt("live", null);
  }, [live.hasPlaylists]);

  useEffect(() => () => publishBpBandArt("live", null), []);

  if (!live.hasPlaylists) return null;

  // This branch used to carry the focusable label tile, which is what held the
  // rail index reachable during the playlist fetch. The tile is gone and the
  // skeletons below are not focusable, so for the length of the fetch this is a
  // rail index with nothing in it and bpRailStep steps over it. That is correct:
  // a row of placeholders is not something a remote can act on.
  //
  // The one thing it costs is home's provisional live seed. That seed was
  // already inert here, because autofocusFirst lands on BpGuideCell i === 0 and
  // there are no cells yet, so no data-bp-autofocus has ever existed in this
  // branch. Do NOT add one to a skeleton: a focus stop that does nothing on
  // Enter is the exact failure the addon lead tile was.
  if (live.loading && live.channels.length === 0) {
    return (
      <section data-bp-row data-bp-row-key="live" data-bp-row-tab={lead.tab} className="relative">
        <BpRowHeader title={lead.title} lead={lead} />
        <div data-bp-scroll-x className={BP_LIVE_TRACK}>
          <div aria-hidden className="flex shrink-0 gap-[clamp(11px,1vw,20px)]">
            {Array.from({ length: BP_LIVE_MIN_CELLS }).map((_, i) => (
              <BpGuideCellSkeleton key={i} />
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Configured but resolved to nothing. An empty rail row would stand in as a
  // dead step, so the row leaves the rail entirely rather than rendering a
  // spinner nobody can act on.
  if (live.channels.length === 0) return null;

  return (
    <section
      ref={sectionRef}
      data-bp-row
      data-bp-row-key="live"
      data-bp-row-tab={lead.tab}
      aria-label={lead.title}
      className="relative"
    >
      <BpLiveHero item={hot} />
      <BpRowHeader title={lead.title} lead={lead} />
      <div data-bp-scroll-x className={BP_LIVE_TRACK}>
        {cells.map((item, i) => (
          <BpGuideCell
            key={item.channel.id}
            item={item}
            sourceId={live.activeId}
            art={art.get(item.channel.id)}
            autofocus={autofocusFirst && i === 0}
            onHot={onHot}
            onPlay={(it) => live.play(it.channel, it.current)}
          />
        ))}
      </div>
    </section>
  );
}
