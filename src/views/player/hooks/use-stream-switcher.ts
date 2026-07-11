import { SHORT_PLAYBACK_SEC } from "@/lib/dead-streams";
import type { DebridStore } from "@/lib/debrid/types";
import { pinPickerCache, unpinPickerCache } from "@/lib/picker-cache";
import { savePlayback } from "@/lib/playback-history";
import type { PlayerBridge, PlayerSnapshot } from "@/lib/player/bridge";
import { getPlaybackPosition, usePlaybackFlag } from "@/lib/player/playback-clock";
import { readResumeMs } from "@/lib/resume";
import { registerStreamProxy } from "@/lib/stream-proxy";
import { resolveStream } from "@/lib/streams/resolve";
import type { ScoredStream } from "@/lib/streams/types";
import type { PlayerSrc } from "@/lib/view";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

let checkShownThisSession = false;

export function useStreamSwitcher(params: {
  bridgeRef: RefObject<PlayerBridge | null>;
  src: PlayerSrc;
  snap: PlayerSnapshot;
  debrids: DebridStore[];
}) {
  const { bridgeRef, src, snap, debrids } = params;
  const snapRef = useRef(snap);
  snapRef.current = snap;

  const checkShownRef = useRef(false);
  const [streamCheckOpen, setStreamCheckOpen] = useState(false);
  const isLive = src.meta.id?.startsWith("iptv:") ?? false;
  const startedEnough = usePlaybackFlag(() => getPlaybackPosition() >= 1.5);
  useEffect(() => {
    checkShownRef.current = false;
    setStreamCheckOpen(false);
  }, [src.url]);
  useEffect(() => {
    if (checkShownRef.current) return;
    if (checkShownThisSession) return;
    if (isLive) return;
    if (snap.status !== "playing" || !startedEnough) return;
    checkShownRef.current = true;
    checkShownThisSession = true;
    setStreamCheckOpen(true);
  }, [snap.status, startedEnough, src.url, isLive]);
  useEffect(() => {
    if (!streamCheckOpen) return;
    const t = window.setTimeout(() => setStreamCheckOpen(false), 5500);
    return () => window.clearTimeout(t);
  }, [streamCheckOpen]);

  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [swapResolvingKey, setSwapResolvingKey] = useState<string | null>(null);
  const [liveUrl, setLiveUrl] = useState(src.url);
  const [liveStreamRef, setLiveStreamRef] = useState(src.streamRef);
  useEffect(() => {
    setLiveUrl(src.url);
    setLiveStreamRef(src.streamRef);
  }, [src.url, src.streamRef]);

  const swapAcRef = useRef<AbortController | null>(null);

  // Pin this item's streams in the picker cache for the whole playback session
  // so they survive the 30-min stale sweep. Without this, opening the switcher
  // after watching a while found a cold cache and fell back to the full picker.
  useEffect(() => {
    pinPickerCache(src.meta, src.episode);
    return () => unpinPickerCache(src.meta, src.episode);
  }, [src.meta, src.episode]);

  // Always open the in-place switcher overlay. NEVER navigate to the full
  // picker from here: that unmounts the player and stops the movie, which is
  // the "switching stream kicked me out of the movie" bug. The pinned cache
  // above keeps this item's streams available for the overlay.
  const pickAnother = useCallback(() => {
    setSwitcherOpen(true);
  }, []);

  const onSwitchStream = useCallback(
    async (stream: ScoredStream) => {
      const key = stream.infoHash ?? stream.url ?? `${stream.addonId}:${stream.title ?? ""}`;
      setSwapResolvingKey(key);
      swapAcRef.current?.abort();
      const ac = new AbortController();
      swapAcRef.current = ac;
      const hint = src.episode
        ? { season: src.episode.season ?? null, episode: src.episode.episode ?? null }
        : undefined;
      const r = await resolveStream(stream, debrids, ac.signal, true, false, hint);
      if (ac.signal.aborted) return;
      if (!r.ok) {
        console.warn(`[player] stream swap failed: ${r.code}`);
        setSwapResolvingKey(null);
        return;
      }
      let playUrl = r.data.url;
      if (r.data.headers && Object.keys(r.data.headers).length > 0) {
        try {
          const proxied = await registerStreamProxy(r.data.url, r.data.headers);
          playUrl = proxied.url;
        } catch {
          setSwapResolvingKey(null);
          return;
        }
      }
      const b = bridgeRef.current;
      if (!b) {
        setSwapResolvingKey(null);
        return;
      }
      try {
        const current = getPlaybackPosition();
        const savedSec = readResumeMs(src.meta.id, src.episode?.season, src.episode?.episode) / 1000;
        const curDur = snapRef.current.durationSec;
        const currentIsStub = curDur > 0 && curDur < SHORT_PLAYBACK_SEC;
        const resumeAt = !currentIsStub && current > 5 ? current : savedSec;
        await b.load({
          url: playUrl,
          subtitles: r.data.subtitles,
          notWebReady: r.data.notWebReady,
          startAtSec: resumeAt > 5 ? resumeAt : undefined,
        });
        await b.play().catch(() => {});
      } catch (e) {
        console.warn("[player] stream swap failed", e);
      }
      setLiveUrl(playUrl);
      setLiveStreamRef({
        infoHash: stream.infoHash ?? null,
        fileIdx: stream.fileIdx ?? null,
        addonId: stream.addonId ?? null,
        title: stream.title ?? null,
        parsedTitle: stream.parsedTitle ?? null,
        resolution: stream.resolution ?? null,
        source: stream.source ?? null,
        size: stream.size ?? null,
        bingeGroup: stream.behaviorHints?.bingeGroup ?? null,
        cachedSlugs: Object.entries(stream.cached ?? {})
          .filter(([, v]) => v === true)
          .map(([k]) => k),
      });
      if (src.meta.id && !src.meta.id.startsWith("iptv:")) {
        savePlayback(
          src.meta.id,
          {
            infoHash: stream.infoHash ?? null,
            fileIdx: stream.fileIdx ?? null,
            addonId: stream.addonId ?? null,
            url: playUrl,
            title: src.meta.name,
            parsedTitle: stream.parsedTitle ?? null,
            resolution: stream.resolution ?? null,
            source: stream.source ?? null,
            size: stream.size ?? null,
            bingeGroup: stream.behaviorHints?.bingeGroup ?? null,
            cachedSlugs: Object.entries(stream.cached ?? {})
              .filter(([, v]) => v === true)
              .map(([k]) => k),
          },
          src.episode?.season,
          src.episode?.episode,
        );
      }
      setSwapResolvingKey(null);
      setSwitcherOpen(false);
      checkShownRef.current = false;
      setStreamCheckOpen(false);
    },
    [debrids],
  );

  useEffect(() => () => swapAcRef.current?.abort(), []);

  return {
    streamCheckOpen,
    setStreamCheckOpen,
    switcherOpen,
    setSwitcherOpen,
    swapResolvingKey,
    liveUrl,
    liveStreamRef,
    pickAnother,
    onSwitchStream,
  };
}
