import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { PlayerBridge, PlayerSnapshot } from "@/lib/player/bridge";
import { getPlaybackPosition, usePlaybackFlag } from "@/lib/player/playback-clock";
import { pinPickerCache, unpinPickerCache } from "@/lib/picker-cache";
import { readResumeMs } from "@/lib/resume";
import { SHORT_PLAYBACK_SEC } from "@/lib/dead-streams";
import { savePlayback } from "@/lib/playback-history";
import { resolveStream } from "@/lib/streams/resolve";
import type { ScoredStream } from "@/lib/streams/types";
import { registerStreamProxy, unregisterStreamProxy } from "@/lib/stream-proxy";
import type { PlayerSrc } from "@/lib/view";
import type { DebridStore } from "@/lib/debrid/types";
import { StreamSwitchGuard } from "./stream-switch-guard";

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
  const swapGuardRef = useRef(new StreamSwitchGuard());

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
      const request = swapGuardRef.current.begin(snapRef.current.status === "playing");
      const isCurrentSwap = () =>
        swapGuardRef.current.isCurrent(request) && swapAcRef.current === ac && !ac.signal.aborted;
      // Pause the current stream up front: the swap loader covers the whole
      // stage, so the old stream's audio must not keep playing behind it.
      // Resumed below when the swap fails before the new stream took over.
      const bridgeAtStart = bridgeRef.current;
      const resumeOnFailure = () => {
        if (swapGuardRef.current.shouldResumeOnFailure(request)) {
          bridgeAtStart?.play().catch(() => {});
        }
      };
      bridgeAtStart?.pause();
      try {
        const hint = src.episode
          ? { season: src.episode.season ?? null, episode: src.episode.episode ?? null }
          : undefined;
        const r = await resolveStream(stream, debrids, ac.signal, true, false, hint);
        if (!isCurrentSwap()) return;
        if (!r.ok) {
          console.warn(`[player] stream swap failed: ${r.code}`);
          resumeOnFailure();
          return;
        }
        let playUrl = r.data.url;
        if (r.data.headers && Object.keys(r.data.headers).length > 0) {
          try {
            const proxied = await registerStreamProxy(r.data.url, r.data.headers);
            playUrl = proxied.url;
            if (!isCurrentSwap()) {
              void unregisterStreamProxy(proxied.sessionId).catch(() => {});
              return;
            }
          } catch {
            resumeOnFailure();
            return;
          }
        }
        const b = bridgeRef.current;
        if (!b) {
          resumeOnFailure();
          return;
        }
        try {
          const current = getPlaybackPosition();
          const savedSec =
            readResumeMs(src.meta.id, src.episode?.season, src.episode?.episode) / 1000;
          const curDur = snapRef.current.durationSec;
          const currentIsStub = curDur > 0 && curDur < SHORT_PLAYBACK_SEC;
          const resumeAt = !currentIsStub && current > 5 ? current : savedSec;
          await b.load({
            url: playUrl,
            subtitles: r.data.subtitles,
            notWebReady: r.data.notWebReady,
            startAtSec: resumeAt > 5 ? resumeAt : undefined,
          });
          if (!isCurrentSwap()) return;
          await b.play().catch(() => {});
        } catch (e) {
          // The old stream is already gone here (load stops it), so there is
          // nothing to resume; the bridge error state drives the UI.
          console.warn("[player] stream swap failed", e);
          return;
        }
        if (!isCurrentSwap()) return;
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
        setSwitcherOpen(false);
        checkShownRef.current = false;
        setStreamCheckOpen(false);
      } finally {
        // The swap loader is keyed on swapResolvingKey, so it must always
        // clear — but only the latest swap may clear it, or an aborted swap
        // would hide the loader of the one that superseded it.
        if (isCurrentSwap()) {
          setSwapResolvingKey(null);
          swapGuardRef.current.finish(request);
        }
      }
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
