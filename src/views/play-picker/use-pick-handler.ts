import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Meta } from "@/lib/cinemeta";
import type { DebridStore } from "@/lib/debrid/types";
import { invalidatePreparedDebridLink } from "@/lib/debrid/playback-preparation";
import { savePlayback } from "@/lib/playback-history";
import { saveSeasonLock } from "@/lib/season-lock";
import { markStreamDead, recordStubEvent } from "@/lib/dead-streams";

const PREFLIGHT_STUB_TTL_MS = 15 * 60 * 1000;
const SAME_SOURCE_MAX_RETRIES = 4;
const SAME_SOURCE_RETRY_DELAY_MS = 1500;
const RETRYABLE_ENGINE_FAILURES = new Set([
  "engine-no-peers",
  "engine-not-ready",
  "remote-server-unreachable",
  "remote-server-unreachable-strict",
]);
import { engineP2pEligible } from "@/lib/torrent/stremio-stream";
import { hasUncachedMarker } from "@/lib/streams/cached";
import { preflightCheck } from "@/lib/streams/preflight";
import { resolveStream, shouldPreferP2pDownload } from "@/lib/streams/resolve";
import {
  beginPlaybackTrace,
  finishPlaybackTrace,
  markPlaybackTrace,
} from "@/lib/perf/playback-trace";
import { registerStreamProxy, unregisterStreamProxy } from "@/lib/stream-proxy";
import type { ScoredStream } from "@/lib/streams/types";
import type { PlayInvite } from "@/lib/together/protocol";
import { buildPlayInvite } from "@/lib/together/build-invite";
import { type PlayEpisode, type PlayerSrc } from "@/lib/view";
import { openInAppBrowser, openUrl } from "@/lib/window";
import { enqueueDownload } from "@/lib/download/downloads-store";
import { downloadSeasonFromPack } from "@/lib/download/season-download";
import { isDownloadableSeasonPack } from "@/lib/download/season-pack";
import {
  formatStreamQuality,
  isDebridFailure,
  playError,
  streamIdentity,
  type PickerError,
} from "./picker-utils";

export type ResolvingSelection = { stream: ScoredStream; p2p: boolean };

function playbackSourceClass(
  stream: ScoredStream,
  debridCount: number,
  forceP2p: boolean,
): "direct" | "debrid" | "p2p" | "unknown" {
  if (forceP2p || (!!stream.infoHash && !stream.url && debridCount === 0)) return "p2p";
  if (stream.url) return "direct";
  if (stream.infoHash && debridCount > 0) return "debrid";
  return "unknown";
}

export function usePickHandler({
  meta,
  imdbId,
  imdbIdVerified,
  episode,
  absoluteEpisode,
  attempt,
  resume,
  debrids,
  isCached,
  seasonLock,
  p2pAutoConsent,
  streamMode,
  inSession,
  canInvite,
  inviteSentRef,
  sendInvite,
  claimHost,
  openPlayer,
  intent,
  seasonEpisodes,
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
  absoluteEpisode?: number | null;
  attempt?: number;
  resume?: boolean;
  debrids: DebridStore[];
  isCached: (s: ScoredStream) => boolean;
  seasonLock: boolean;
  p2pAutoConsent: boolean;
  streamMode: "both" | "addons" | "p2p";
  inSession: boolean;
  canInvite: boolean;
  inviteSentRef: React.MutableRefObject<string | null>;
  sendInvite: (invite: PlayInvite) => void;
  claimHost: (fresh: boolean) => void;
  openPlayer: (src: PlayerSrc) => void;
  intent?: "play" | "download";
  seasonEpisodes?: PlayEpisode[];
  autoActive: boolean;
  autoAttemptIdx: number;
  autoCandidatesLength: number;
  autoFiredRef: React.MutableRefObject<boolean>;
  setAutoAttemptIdx: Dispatch<SetStateAction<number>>;
  setAutoExhausted: Dispatch<SetStateAction<boolean>>;
  setFailedStreams: Dispatch<SetStateAction<Set<ScoredStream>>>;
  setResolveError: (error: PickerError | null) => void;
  setResolving: Dispatch<SetStateAction<ResolvingSelection | null>>;
}) {
  const [queuedHash, setQueuedHash] = useState<string | null>(null);
  const [queuedDownloadKeys, setQueuedDownloadKeys] = useState<Set<string>>(() => new Set());
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
    let traceTransferred = false;
    let proxySessionId: string | undefined;
    let proxyTransferred = false;
    const playbackTraceId =
      intent === "download"
        ? undefined
        : beginPlaybackTrace(playbackSourceClass(stream, debrids.length, forceP2p));
    markPlaybackTrace(playbackTraceId, "resolve-start");
    try {
      if (intent === "download" && seasonEpisodes && seasonEpisodes.length > 0) {
        if (!isDownloadableSeasonPack(stream)) {
          setFailedStreams((prev) => new Set(prev).add(stream));
          setResolveError({ kind: "play", code: "download-season-package-required" });
          return;
        }
        const label =
          [stream.resolution, stream.source].filter(Boolean).join(" ") ||
          stream.parsedTitle ||
          stream.title ||
          stream.name ||
          stream.addonName ||
          null;
        const batch = await downloadSeasonFromPack({
          meta,
          episodes: seasonEpisodes,
          stream,
          streamLabel: label,
          debrids,
          signal: ac.signal,
        });
        if (ac.signal.aborted) return;
        if (batch.total === 0) {
          opened = true;
          setQueuedDownloadKeys((prev) => new Set(prev).add(streamIdentity(stream)));
          setResolving(null);
          return;
        }
        if (batch.queued === 0) {
          setFailedStreams((prev) => new Set(prev).add(stream));
          setResolveError({ kind: "play", code: "download-season-no-files" });
          return;
        }
        opened = true;
        setQueuedDownloadKeys((prev) => new Set(prev).add(streamIdentity(stream)));
        setResolving(null);
        if (batch.failed > 0) {
          setResolveError({
            kind: "play",
            code: "download-season-partial",
            queued: batch.queued,
            total: batch.total,
          });
        }
        return;
      }
      const hint = episode
        ? { season: episode.season ?? null, episode: episode.episode ?? null }
        : undefined;
      const allowP2pFallback = streamMode !== "addons" || !!stream.infoHash;
      const r = await resolveStream(
        stream,
        debrids,
        ac.signal,
        userCommitted,
        forceP2p,
        hint,
        allowP2pFallback,
        intent !== "download",
      );
      if (ac.signal.aborted) return;
      if (!r.ok) {
        if (r.code === "web-page" && r.webUrl) {
          openInAppBrowser(r.webUrl, stream.title ?? stream.name ?? meta.name);
          opened = true;
          setResolving(null);
          return;
        }
        if (!RETRYABLE_ENGINE_FAILURES.has(r.code)) {
          setFailedStreams((prev) => new Set(prev).add(stream));
        }
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
        if (!willRetry) setResolveError(playError(r.code));
        advanceAuto();
        return;
      }
      markPlaybackTrace(playbackTraceId, "resolve-ready");
      debridFailStreakRef.current = 0;
      let playUrl = r.data.url;
      const hasProxyHeaders = !!r.data.headers && Object.keys(r.data.headers).length > 0;
      // Native mpv can consume ordinary debrid URLs directly. Keep the local
      // proxy off the startup path unless the source actually requires custom
      // request headers.
      if (intent !== "download" && hasProxyHeaders) {
        try {
          const proxied = await registerStreamProxy(r.data.url, r.data.headers);
          playUrl = proxied.url;
          proxySessionId = proxied.sessionId;
        } catch {
          setFailedStreams((prev) => new Set(prev).add(stream));
          const willRetry = autoActive && autoAttemptIdx + 1 < autoCandidatesLength;
          if (!willRetry) {
            setResolveError({ kind: "play", code: "stream-proxy-start-failed" });
          }
          advanceAuto();
          return;
        }
      }
      const needsPreflight = !(
        intent === "download" ||
        r.via === "p2p" ||
        r.via === "direct" ||
        r.via === "local-download" ||
        r.readiness?.exactUrlValidated === true
      );
      if (needsPreflight) markPlaybackTrace(playbackTraceId, "preflight-start");
      const preflight = needsPreflight
        ? await preflightCheck(playUrl, ac.signal)
        : ({ ok: true } as const);
      if (needsPreflight) markPlaybackTrace(playbackTraceId, "preflight-ready");
      if (ac.signal.aborted) return;
      if (!preflight.ok && preflight.reason === "stub") {
        const preparedDebrid = debrids.find((debrid) => debrid.slug === r.via);
        if (preparedDebrid) invalidatePreparedDebridLink(stream, preparedDebrid, hint);
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
        if (!autoActive && scheduleSameSourceRetry(stream, userCommitted, forceP2p)) return;
        recordStubEvent(reasonStr);
        const willRetry = autoActive && autoAttemptIdx + 1 < autoCandidatesLength;
        advanceAuto();
        if (!willRetry && !autoActive) {
          setResolveError({ kind: "play", code: "debrid-source-not-ready" });
        }
        return;
      }
      if (intent === "download") {
        const label =
          [stream.resolution, stream.source].filter(Boolean).join(" ") ||
          stream.parsedTitle ||
          stream.title ||
          stream.name ||
          stream.addonName ||
          null;
        await enqueueDownload({
          meta,
          episode,
          streamLabel: label,
          url: r.data.url,
          headers: r.data.headers,
        });
        opened = true;
        setQueuedDownloadKeys((prev) => {
          const next = new Set(prev);
          next.add(streamIdentity(stream));
          return next;
        });
        setResolving(null);
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
        episodeEnd: stream.episodeEnd ?? undefined,
        episodeSpan:
          stream.season != null && stream.episode != null
            ? {
                season: stream.season,
                episode: stream.episode,
                episodeEnd: stream.episodeEnd ?? stream.episode,
              }
            : undefined,
        url: playUrl,
        title: episode
          ? episode.name ||
            metaEpisodeName(meta, episode) ||
            `Episode ${absoluteEpisode ?? episode.episode}`
          : meta.name,
        subtitle: episode
          ? absoluteEpisode != null
            ? `${meta.name} · E${absoluteEpisode}`
            : `${meta.name} · S${episode.imdbSeason ?? episode.season} · E${episode.imdbEpisode ?? episode.episode}`
          : meta.releaseInfo,
        notWebReady: r.data.notWebReady,
        subtitles: r.data.subtitles,
        attempt: attempt ?? 0,
        autoFired: autoPickRef.current,
        resume: !!resume,
        playbackTraceId,
        proxySessionId,
        historyUrl: r.data.url,
        streamRef: {
          resolvedFilename:
            r.data.filename ??
            stream.behaviorHints?.filename ??
            stream.behaviorHints?.fileName ??
            null,
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
        },
      });
      markPlaybackTrace(playbackTraceId, "player-opened");
      traceTransferred = true;
      proxyTransferred = true;
      opened = true;
      sameSourceRetryRef.current = 0;
      if (meta.id && !meta.id.startsWith("iptv:")) {
        const entry = {
          infoHash: stream.infoHash ?? null,
          fileIdx: r.data.fileIdx ?? stream.fileIdx ?? null,
          addonId: stream.addonId ?? null,
          url: r.data.url,
          title: meta.name,
          parsedTitle: stream.parsedTitle ?? null,
          resolution: stream.resolution ?? null,
          releaseGroup: stream.releaseGroupNormalized ?? null,
          source: stream.source ?? null,
          size: stream.size ?? null,
          bingeGroup: stream.behaviorHints?.bingeGroup ?? null,
          cachedSlugs: Object.entries(stream.cached ?? {})
            .filter(([, v]) => v === true)
            .map(([k]) => k),
        };
        savePlayback(meta.id, entry, episode?.season, episode?.episode);
        if (seasonLock && episode) {
          const animeId = /^(kitsu|mal|anilist|anidb):/.test(meta.id);
          saveSeasonLock(meta.id, entry, animeId ? null : (episode.season ?? null), animeId);
        }
      }
    } finally {
      if (proxySessionId && !proxyTransferred) {
        void unregisterStreamProxy(proxySessionId).catch(() => {});
      }
      if (playbackTraceId && !traceTransferred) {
        finishPlaybackTrace(playbackTraceId, ac.signal.aborted ? "aborted" : "failed");
      }
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
    const effectiveForceP2p =
      forceP2p || (intent === "download" && shouldPreferP2pDownload(stream));
    const p2p =
      effectiveForceP2p ||
      (intent !== "download" &&
        !!stream.infoHash &&
        !stream.url &&
        engineP2pEligible(stream) &&
        (debrids.length === 0 || (committed && !isCached(stream) && hasUncachedMarker(stream))));
    setResolving({ stream, p2p });
    void resolveAndOpen(stream, committed, effectiveForceP2p);
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
    if (streamMode === "p2p" && committed && stream.infoHash && engineP2pEligible(stream)) {
      startResolve(stream, committed, true);
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
      setP2pConfirm({ stream, forceP2p: true });
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
      setResolveError(playError("no-source"));
      return;
    }
    const target = debrids.find((d) => d.queueCache);
    if (!target?.queueCache) {
      setResolveError({ kind: "play", code: "debrid-queue-unsupported" });
      return;
    }
    setResolving({ stream, p2p: false });
    const ac = new AbortController();
    resolveAcRef.current?.abort();
    resolveAcRef.current = ac;
    try {
      const r = await target.queueCache(stream.infoHash, ac.signal);
      if (ac.signal.aborted) return;
      if (!r.ok) {
        setResolveError(playError(r.code));
        return;
      }
      setQueuedHash(stream.infoHash);
    } catch {
      if (!ac.signal.aborted) setResolveError(playError("error"));
    } finally {
      if (!ac.signal.aborted) setResolving(null);
    }
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
    queuedDownloadKeys,
    debridDown,
    resetDebridDown,
    abortResolve,
    p2pConfirm,
    confirmP2p,
    cancelP2p,
  };
}

function metaEpisodeName(
  meta: { videos?: Array<{ season?: number; episode?: number; number?: number; name?: string; title?: string }> },
  episode: { season: number; episode: number },
): string | undefined {
  const match = meta.videos?.find(
    (v) => (v.season ?? 1) === episode.season && (v.episode ?? v.number) === episode.episode,
  );
  return match?.name || match?.title || undefined;
}
