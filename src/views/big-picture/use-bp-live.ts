import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { headersFromChannel } from "@/lib/iptv/channel-headers";
import { recordChannelPlay } from "@/lib/iptv/channel-stats";
import { isHydratableChannel } from "@/lib/iptv/channel-hydration";
import { computeTvgIdCounts } from "@/lib/iptv/epg-resolver";
import { useFavorites } from "@/lib/iptv/favorites";
import { sortChannelsByGroupRelevance } from "@/lib/iptv/group-relevance";
import { isLiveChannel } from "@/lib/iptv/vod-classify";
import type { EpgIndex, EpgProgram, IptvChannel, IptvPlaylistSource } from "@/lib/iptv/types";
import { useChannelHydration } from "@/views/live/hooks/use-channel-hydration";
import { useEpg } from "@/views/live/hooks/use-epg";
import { useIptvPlaylist } from "@/views/live/hooks/use-iptv-playlist";
import { synthChannelMeta } from "@/views/live/hooks/use-live-actions";
import { useXtreamEpgFallback } from "@/views/live/hooks/use-xtream-epg-fallback";
import {
  buildNowItem,
  hydrationKey,
  useLiveHome,
  type ChannelRail,
  type NowItem,
} from "@/views/live/live-home/use-live-home";

export type { ChannelRail, NowItem };

const ACTIVE_KEY = "harbor.iptv.active";
const EMPTY_CHANNELS: IptvChannel[] = [];
const TICK_MS = 30_000;
const MAX_STALE_MS = 5 * 60_000;

function readActiveId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

function writeActiveId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_KEY, id);
  } catch {}
}

// Titles and times only change when a programme rolls over, so the clock that
// drives them waits for the nearest end instead of ticking the whole surface
// every interval. Progress bars run on their own DOM-only ticker.
function useBoundaryClock(): [number, (boundaryMs: number) => void] {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const boundaryRef = useRef(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      const t = Date.now();
      if (t >= boundaryRef.current) setNowMs(t);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const setBoundary = useCallback((boundaryMs: number) => {
    boundaryRef.current = Math.min(boundaryMs, Date.now() + MAX_STALE_MS);
  }, []);

  return [nowMs, setBoundary];
}

export function useBpLivePlay(): (ch: IptvChannel, current?: EpgProgram | null) => void {
  const { openPlayer } = useView();
  return useCallback(
    (ch: IptvChannel, current?: EpgProgram | null) => {
      if (!ch.url) return;
      recordChannelPlay(ch);
      openPlayer({
        meta: synthChannelMeta(ch),
        url: ch.url,
        title: ch.name,
        subtitle: ch.group ?? "Live",
        notWebReady: true,
        isLive: true,
        headers: headersFromChannel(ch),
        liveProgram: current?.title || undefined,
      });
    },
    [openPlayer],
  );
}

export function buildBpGuide(
  channels: IptvChannel[],
  epg: EpgIndex | null,
  tvgCounts: ReadonlyMap<string, number>,
  nowMs: number,
): NowItem[] {
  return channels.map((ch) => buildNowItem(ch, epg, tvgCounts, nowMs));
}

export function useBpLiveArt(items: NowItem[], cap: number): Map<string, string> {
  const names = useMemo(
    () =>
      items
        .slice(0, cap)
        .filter((it) => isHydratableChannel({ group: it.channel.group, name: it.channel.name }))
        .map(hydrationKey),
    [items, cap],
  );
  const hydrated = useChannelHydration(names);

  return useMemo(() => {
    const out = new Map<string, string>();
    for (const it of items) {
      const art = hydrated.get(hydrationKey(it))?.background ?? it.current?.iconUrl ?? null;
      if (art) out.set(it.channel.id, art);
    }
    return out;
  }, [items, hydrated]);
}

export type BpLive = {
  hasPlaylists: boolean;
  loading: boolean;
  error: string | null;
  sources: IptvPlaylistSource[];
  activeId: string;
  setActiveId: (id: string) => void;
  channels: IptvChannel[];
  guide: NowItem[];
  rails: ChannelRail[];
  categoryRails: ChannelRail[];
  epg: EpgIndex | null;
  tvgCounts: ReadonlyMap<string, number>;
  nowMs: number;
  favoriteCount: number;
  play: (ch: IptvChannel, current?: EpgProgram | null) => void;
  refresh: () => void;
};

export function useBpLive(enabled = true): BpLive {
  const { settings } = useSettings();
  const favorites = useFavorites();
  const play = useBpLivePlay();

  const sources = useMemo<IptvPlaylistSource[]>(
    () =>
      settings.iptvPlaylists
        .filter((p) => (p.kind ?? "m3u") !== "epg")
        .map((p) => ({
          id: p.id,
          name: p.name,
          url: p.url,
          epgUrl: p.epgUrl,
          kind: p.kind,
          xtream: p.xtream,
        })),
    [settings.iptvPlaylists],
  );

  const [storedId, setStoredId] = useState<string | null>(() => readActiveId());
  const activeSource = useMemo(
    () => sources.find((s) => s.id === storedId) ?? sources[0] ?? null,
    [sources, storedId],
  );
  const activeId = activeSource?.id ?? "";
  const setActiveId = useCallback((id: string) => {
    writeActiveId(id);
    setStoredId(id);
  }, []);

  const { state, refresh } = useIptvPlaylist(enabled ? activeSource : null);
  const playlist = state.kind === "ready" ? state.playlist : null;

  const epgOnlyUrls = useMemo(
    () => settings.iptvPlaylists.filter((s) => s.kind === "epg").map((s) => s.epgUrl || s.url),
    [settings.iptvPlaylists],
  );
  const { index: baseEpg } = useEpg(enabled ? activeSource : null, epgOnlyUrls);
  const epg = useXtreamEpgFallback(activeSource, playlist?.channels ?? EMPTY_CHANNELS, baseEpg);

  const channels = useMemo(() => {
    const live = (playlist?.channels ?? EMPTY_CHANNELS).filter(isLiveChannel);
    return sortChannelsByGroupRelevance(live, settings.region, settings.preferredLanguages);
  }, [playlist, settings.region, settings.preferredLanguages]);

  const tvgCounts = useMemo(() => computeTvgIdCounts(channels), [channels]);
  const [nowMs, setBoundary] = useBoundaryClock();

  const home = useLiveHome({
    channels,
    epg,
    nowMs,
    sourceId: activeId,
    region: settings.region,
    favorites,
  });

  const { hydrate } = favorites;
  useEffect(() => {
    hydrate(channels);
  }, [channels, hydrate]);

  const boundary = useMemo(() => {
    let min = Number.POSITIVE_INFINITY;
    for (const it of home.guide) {
      if (it.current && it.current.endMs < min) min = it.current.endMs;
    }
    return min;
  }, [home.guide]);

  useEffect(() => {
    setBoundary(boundary);
  }, [boundary, setBoundary]);

  return {
    hasPlaylists: sources.length > 0,
    loading: state.kind === "loading" && channels.length === 0,
    error: state.kind === "error" ? state.message : null,
    sources,
    activeId,
    setActiveId,
    channels,
    guide: home.guide,
    rails: home.rails,
    categoryRails: home.categoryRails,
    epg,
    tvgCounts,
    nowMs,
    favoriteCount: favorites.count,
    play,
    refresh,
  };
}
