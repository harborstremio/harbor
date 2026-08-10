import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Meta } from "@/lib/cinemeta";
import type { DebridStore } from "@/lib/debrid/types";
import { savePlayback } from "@/lib/playback-history";
import { saveSeasonLock } from "@/lib/season-lock";
import { markStreamDead, recordStubEvent } from "@/lib/dead-streams";

const PREFLIGHT_STUB_TTL_MS = 15 * 60 * 1000;
const SAME_SOURCE_MAX_RETRIES = 4;
const SAME_SOURCE_RETRY_DELAY_MS = 1500;
import { engineP2pEligible } from "@/lib/torrent/stremio-stream";
import { hasUncachedMarker } from "@/lib/streams/cached";
import { preflightCheck } from "@/lib/streams/preflight";
import { resolveStream } from "@/lib/streams/resolve";
import { registerStreamProxy } from "@/lib/stream-proxy";
import type { ScoredStream } from "@/lib/streams/types";
import type { PlayInvite } from "@/lib/together/protocol";
import { buildPlayInvite } from "@/lib/together/build-invite";
import { type PlayEpisode, type PlayerSrc } from "@/lib/view";
import { openInAppBrowser, openUrl } from "@/lib/window";
import { enqueueDownload } from "@/lib/download/downloads-store";
import { snapshotDownloadPlaybackContext } from "@/lib/download/playback-context";
import { subtitleHintsFromStreamRef } from "@/lib/subtitles/player-hints";
import { formatStreamQuality, humanError, isDebridFailure } from "./picker-utils";

export function usePickHandler({
  meta,
  imdbId,
  imdbIdVerified,
  episode,
  attempt,
  resume,
  debrids,
  isCached,
  seasonLock,
  p2pAutoConsent,
  inSession,
  canInvite,
  inviteSentRef,
  sendInvite,
  claimHost,
  openPlayer,
  intent,
  onDownloadStarted,
  autoActive,
  autoAttemptIdx,
  autoCandidatesLength,
  autoFiredRef,
  setAutoAttemptIdx,
  setAutoExhausted,
  setFailedStreams,
  setResolveError,
  setResolving,
}: {
  meta: Meta;
  imdbId?: string | null;
  imdbIdVerified?: boolean;
  episode?: PlayEpisode;
  attempt?: number;
  resume?: boolean;
  debrids: DebridStore[];
  isCached: (s: ScoredStream) => boolean;
  seasonLock: boolean;
  p2pAutoConsent: boolean;
  inSession: boolean;
  canInvite: boolean;
  inviteSentRef: React.MutableRefObject<string | null>;
  sendInvite: (invite: PlayInvite) => void;
  claimHost: (fresh: boolean) => void;
  openPlayer: (src: PlayerSrc) => void;
  intent?: "play" | "download";
  onDownloadStarted?: (label?: string | null) => void;
  autoActive: boolean;
  autoAttemptIdx: number;
  autoCandidatesLength: number;
  autoFiredRef: React.MutableRefObject<boolean>;
  setAutoAttemptIdx: Dispatch<SetStateAction<number>>;
  setAutoExhausted: Dispatch<SetStateAction<boolean>>;
  setFailedStreams: Dispatch<SetStateAction<Set<ScoredStream>>>;
  setResolveError: (msg: string | null) => void;
  setResolving: Dispatch<SetStateAction<{ stream: ScoredStream } | null>>;
}) {
  const [queuedHash, setQueuedHash] = useState<string | null>(null);
  const [debridDown, setDebridDown] = useState(false);
  const [p2pConfirm, setP2pConfirm] = useState<{ stream: ScoredStream; forceP2p?: boolean } | null>(
    null,
  );
  const debridFailStreakRef = useRef(0);
  const resolveAcRef = useRef<AbortController | null>(null);
  const autoPickRef = useRef(false);
  const sameSourceRetryRef = useRef(0);
  const retryTimerRef = useRef<number | null>(null);

  const scheduleSameSourceRetry = (
    stream: ScoredStream,
    committed: boolean,
    forceP2p: boolean,
  ): boolean => {
    if (!seasonLock && autoActive) return false;
    if (sameSourceRetryRef.current >= SAME_SOURCE_MAX_RETRIES) return false;
    const n = (sameSourceRetryRef.current += 1);
    const delay = SAME_SOURCE_RETRY_DELAY_MS * n;
    console.warn(`[picker] same-source retry ${n}/${SAME_SOURCE_MAX_RETRIES} in ${delay}ms`);
    if (retryTimerRef.current != null) window.clearTimeout(retryTimerRef.current);
    retryTimerRef.current = window.setTimeout(() => {
      void resolveAndOpen(stream, committed, forceP2p);
    }, delay);
    return true;
  };

  const advanceAuto = () => {
    if (!autoActive) return;
    const nextIdx = autoAttemptIdx + 1;
    if (nextIdx < autoCandidatesLength) {
      autoFiredRef.current = false;
      setAutoAttemptIdx(nextIdx);
    } else {
      setAutoExhausted(true);
    }
  };

  const resolveAndOpen = async (stream: ScoredStream, userCommitted: boolean, forceP2p = false) => {
    const ac = new AbortController();
    resolveAcRef.current?.abort();
    resolveAcRef.current = ac;
    let opened = false;
    try {
      const hint = episode
        ? { season: episode.season ?? null, episode: episode.episode ?? null }
        : undefined;
      const r = await resolveStream(stream, debrids, ac.signal, userCommitted, forceP2p, hint);
      if (ac.signal.aborted) return;
      if (!r.ok) {
        if (r.code === "web-page" && r.webUrl) {
          openInAppBrowser(r.webUrl, stream.title ?? stream.name ?? meta.name);
          opened = true;
          setResolving(null);
          return;
        }
        setFailedStreams((prev) => new Set(prev).add(stream));
        const isDebridSide = isDebridFailure(r.code, r.tried);
        if (isDebridSide && scheduleSameSourceRetry(stream, userCommitted, forceP2p)) return;
        if (isDebridSide && debrids.length > 0) {
          debridFailStreakRef.current += 1;
          if (debridFailStreakRef.current >= 2) {
            setDebridDown(true);
            if (autoActive) setAutoExhausted(true);
            return;
          }
        } else {
          debridFailStreakRef.current = 0;
        }
        const willRetry = autoActive && autoAttemptIdx + 1 < autoCandidatesLength;
        if (!willRetry) setResolveError(humanError(r.code));
        advanceAuto();
        return;
      }
      debridFailStreakRef.current = 0;
      let playUrl = r.data.url;
      if (intent !== "download" && r.data.headers && Object.keys(r.data.headers).length > 0) {
        try {
          const proxied = await registerStreamProxy(r.data.url, r.data.headers);
          playUrl = proxied.url;
        } catch (e) {
          setFailedStreams((prev) => new Set(prev).add(stream));
          const willRetry = autoActive && autoAttemptIdx + 1 < autoCandidatesLength;
          if (!willRetry)
            setResolveError("Could not start the local stream proxy. Pick another stream.");
          advanceAuto();
          return;
        }
      }
      const preflight =
        intent === "download" || r.via === "p2p" || r.via === "direct"
          ? ({ ok: true } as const)
          : await preflightCheck(playUrl, ac.signal);
      if (ac.signal.aborted) return;
      if (!preflight.ok && preflight.reason === "stub") {
        setFailedStreams((prev) => new Set(prev).add(stream));
        const reasonStr = `preflight_stub_${preflight.sizeBytes ?? 0}b`;
        markStreamDead({ url: r.data.url }, reasonStr, PREFLIGHT_STUB_TTL_MS);
        console.warn(
          `[picker] preflight detected stub (${preflight.sizeBytes ?? "unknown"} bytes); skipping`,
        );
        if (!autoActive && !forceP2p && engineP2pEligible(stream)) {
          setResolving(null);
          setP2pConfirm({ stream, forceP2p: true });
          return;
        }
        if (scheduleSameSourceRetry(stream, userCommitted, forceP2p)) return;
        recordStubEvent(reasonStr);
        const willRetry = autoActive && autoAttemptIdx + 1 < autoCandidatesLength;
        advanceAuto();
        if (!willRetry && !autoActive) {
          setResolveError(
            "This source isn't ready on your debrid yet. Try it again in a moment or pick another.",
          );
        }
        return;
      }
      const streamRef = {
        infoHash: stream.infoHash ?? null,
        fileIdx: r.data.fileIdx ?? stream.fileIdx ?? null,
        addonId: stream.addonId ?? null,
        title: stream.title ?? null,
        parsedTitle: stream.parsedTitle ?? null,
        resolution: stream.resolution ?? null,
        quality: formatStreamQuality(stream),
        releaseGroup: stream.releaseGroupNormalized ?? null,
        source: stream.source ?? null,
        bingeGroup: stream.behaviorHints?.bingeGroup ?? null,
        size: stream.size ?? null,
        cachedSlugs: Object.entries(stream.cached ?? {})
          .filter(([, v]) => v === true)
          .map(([k]) => k),
      };
      if (intent === "download") {
        const label =
          [stream.resolution, stream.source].filter(Boolean).join(" ") ||
          stream.parsedTitle ||
          stream.title ||
          stream.name ||
          stream.addonName ||
          null;
        void enqueueDownload({
          meta,
          episode,
          streamLabel: label,
          playback: snapshotDownloadPlaybackContext({
            imdbId: imdbId ?? undefined,
            imdbIdVerified: imdbIdVerified === true,
            episode,
            subtitleHints: subtitleHintsFromStreamRef(streamRef),
          }),
          url: r.data.url,
          headers: r.data.headers,
        });
        opened = true;
        setResolving(null);
        onDownloadStarted?.(label);
        return;
      }
      if (inSession && canInvite && inviteSentRef.current == null) {
        claimHost(true);
        sendInvite(buildPlayInvite(meta, episode));
        inviteSentRef.current = `${meta.id}|${episode?.season ?? ""}|${episode?.episode ?? ""}`;
      }
      openPlayer({
        meta,
        imdbId: imdbId ?? undefined,
        imdbIdVerified: imdbIdVerified === true,
        episode,
        url: playUrl,
        title: episode ? episode.name || `Episode ${episode.episode}` : meta.name,
        subtitle: episode
          ? `${meta.name} · S${episode.imdbSeason ?? episode.season} · E${episode.imdbEpisode ?? episode.episode}`
          : meta.releaseInfo,
        notWebReady: r.data.notWebReady,
        subtitles: r.data.subtitles,
        attempt: attempt ?? 0,
        autoFired: autoPickRef.current,
        resume: !!resume,
        streamRef,
      });
      opened = true;
      sameSourceRetryRef.current = 0;
      if (meta.id && !meta.id.startsWith("iptv:")) {
        const entry = {
          infoHash: stream.infoHash ?? null,
          fileIdx: r.data.fileIdx ?? stream.fileIdx ?? null,
          addonId: stream.addonId ?? null,
          url: playUrl,
          title: meta.name,
          parsedTitle: stream.parsedTitle ?? null,
          resolution: stream.resolution ?? null,
          source: stream.source ?? null,
          size: stream.size ?? null,
          bingeGroup: stream.behaviorHints?.bingeGroup ?? null,
          cachedSlugs: Object.entries(stream.cached ?? {})
            .filter(([, v]) => v === true)
            .map(([k]) => k),
        };
        savePlayback(meta.id, entry, episode?.season, episode?.episode);
        if (seasonLock && episode && meta.type === "series") {
          saveSeasonLock(meta.id, entry, episode.season ?? null);
        }
      }
    } finally {
      if (!opened && !ac.signal.aborted) {
        setResolving(null);
      }
    }
  };

  const startResolve = (stream: ScoredStream, committed: boolean, forceP2p = false) => {
    setResolveError(null);
    setQueuedHash(null);
    sameSourceRetryRef.current = 0;
    if (retryTimerRef.current != null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    setResolving({ stream });
    void resolveAndOpen(stream, committed, forceP2p);
  };

  const onPlay = (stream: ScoredStream, committed = true, skipP2pConfirm = false, auto = false) => {
    autoPickRef.current = auto;
    if (!stream.url && stream.externalUrl) {
      openUrl(stream.externalUrl);
      return;
    }
    if (!stream.url && stream.ytId) {
      openUrl(`https://www.youtube.com/watch?v=${stream.ytId}`);
      return;
    }
    if (
      intent !== "download" &&
      committed &&
      !skipP2pConfirm &&
      !p2pAutoConsent &&
      !isCached(stream) &&
      engineP2pEligible(stream) &&
      (hasUncachedMarker(stream) || (!stream.url && debrids.length === 0))
    ) {
      setP2pConfirm({ stream });
      return;
    }
    startResolve(stream, committed);
  };

  const confirmP2p = () => {
    const c = p2pConfirm;
    setP2pConfirm(null);
    if (c?.stream) startResolve(c.stream, true, c.forceP2p ?? false);
  };
  const cancelP2p = () => setP2pConfirm(null);

  const onCache = async (stream: ScoredStream) => {
    setResolveError(null);
    setQueuedHash(null);
    if (!stream.infoHash) {
      setResolveError(humanError("no-source"));
      return;
    }
    const target = debrids.find((d) => d.queueCache);
    if (!target?.queueCache) {
      setResolveError("Your debrid service doesn't support queueing torrents from Harbor yet.");
      return;
    }
    setResolving({ stream });
    const ac = new AbortController();
    resolveAcRef.current?.abort();
    resolveAcRef.current = ac;
    const r = await target.queueCache(stream.infoHash, ac.signal);
    if (ac.signal.aborted) return;
    setResolving(null);
    if (!r.ok) {
      setResolveError(humanError(r.code));
      return;
    }
    setQueuedHash(stream.infoHash);
  };

  useEffect(
    () => () => {
      resolveAcRef.current?.abort();
      if (retryTimerRef.current != null) window.clearTimeout(retryTimerRef.current);
    },
    [],
  );

  const resetDebridDown = () => {
    debridFailStreakRef.current = 0;
    setDebridDown(false);
  };

  const abortResolve = () => {
    resolveAcRef.current?.abort();
    resolveAcRef.current = null;
    if (retryTimerRef.current != null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    sameSourceRetryRef.current = 0;
  };

  return {
    onPlay,
    onCache,
    queuedHash,
    debridDown,
    resetDebridDown,
    abortResolve,
    p2pConfirm,
    confirmP2p,
    cancelP2p,
  };
}
