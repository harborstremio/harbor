import { useCallback, useEffect, useRef, type RefObject } from "react";
import { useAuth } from "@/lib/auth";
import { downloadText } from "@/lib/download-text";
import { getCuesAnySource } from "@/lib/subtitles/extract";
import { toSrt } from "@/lib/subtitles/serialize";
import { isWindowsDesktop } from "@/lib/platform";
import { isAssTrack, isImageSubTrack } from "@/lib/player/sub-format";
import { clearImportedSubs } from "@/lib/player/imported-subs";
import { readPlayerVolume } from "@/lib/player-volume";
import { setPlayerActions } from "@/lib/player-actions";
import type { PlayerBridge, PlayerSnapshot } from "@/lib/player/bridge";
import { useSettings } from "@/lib/settings";
import { useSimklScrobble } from "@/lib/simkl/scrobble-hook";
import { useTraktScrobble } from "@/lib/trakt/scrobble-hook";
import {
  claimTorrentPlaybackHandoff,
  confirmTorrentUsage,
  localEngineStreamRef,
  releaseTorrentUsage,
  retainTorrentUsage,
} from "@/lib/torrent/local-engine";
import {
  startFullDownload,
  stopAllFullDownloads,
  stopFullDownload,
} from "@/lib/torrent/full-download";
import type { PlayerSrc } from "@/lib/view";
import { useExitSnapshot } from "./use-exit-snapshot";
import { usePowerInhibit } from "./use-power-inhibit";
import { useResumeAutosave } from "./use-resume-autosave";
import { useStremioSync } from "./use-stremio-sync";
import { useSubDrop } from "./use-sub-drop";
import { useSubStyleApply } from "./use-sub-style-apply";
import { useAssNormalize } from "./use-ass-normalize";
import { useTrackAutoload } from "./use-track-autoload";
import { useSecondarySub } from "./use-secondary-sub";
import { useAutoSync } from "./use-auto-sync";
import { publishAutoSync } from "@/components/player/autosync/autosync-store";
import { useVideoDownload } from "./use-video-download";
import { useWebviewMemory } from "./use-webview-memory";
import { effectiveHdrToSdr } from "@/lib/player/hdr-output-policy";

const HDR_NATIVE_GAMMAS = new Set(["pq", "hlg"]);

export function usePlayerMedia(params: {
  src: PlayerSrc;
  snap: PlayerSnapshot;
  engine: "html5" | "mpv";
  settings: ReturnType<typeof useSettings>["settings"];
  authKey: ReturnType<typeof useAuth>["authKey"];
  bridgeRef: RefObject<PlayerBridge | null>;
  bridgeReady: boolean;
  bridgeKey: string | number;
  svpActive: boolean;
  videoMountRef: RefObject<HTMLDivElement | null>;
  toggleFullscreen: () => void;
  castActiveRef: RefObject<boolean>;
  season: number | undefined;
  episode: number | undefined;
}) {
  const {
    src,
    snap,
    engine,
    settings,
    authKey,
    bridgeRef,
    bridgeReady,
    bridgeKey,
    svpActive,
    videoMountRef,
    toggleFullscreen,
    castActiveRef,
    season,
    episode,
  } = params;

  useWebviewMemory(engine === "mpv");
  const progressRef = useRef(0);
  const torrentPlaybackStartedRef = useRef(false);
  const torrentPlaybackArmedRef = useRef(false);
  useEffect(() => {
    torrentPlaybackStartedRef.current = false;
    torrentPlaybackArmedRef.current = false;
  }, [src.url]);
  useEffect(() => {
    progressRef.current = snap.durationSec > 0 ? snap.positionSec / snap.durationSec : 0;
    const ready = snap.firstFrameReady || snap.positionSec > 0.3;
    if (!ready) {
      torrentPlaybackArmedRef.current = true;
      return;
    }
    if (torrentPlaybackArmedRef.current && !torrentPlaybackStartedRef.current) {
      const engineRef = localEngineStreamRef(src.url);
      if (engineRef) confirmTorrentUsage(engineRef.infoHash);
      torrentPlaybackStartedRef.current = true;
    }
  }, [src.url, snap.firstFrameReady, snap.positionSec, snap.durationSec]);

  const torrentOwnerRef = useRef(`player:${Math.random().toString(36).slice(2)}`);
  useEffect(() => {
    const engineRef = localEngineStreamRef(src.url);
    if (!engineRef) return;
    const hash = engineRef.infoHash;
    const ownerId = torrentOwnerRef.current;
    const keepBg = settings.keepStreamDownloadsInBackground;
    const purge = () =>
      !torrentPlaybackStartedRef.current ||
      settings.streamCacheRetentionHours === 0 ||
      (settings.deleteWatchedDownloads && progressRef.current >= 0.9);
    retainTorrentUsage(hash, ownerId, { preservePendingDelete: true });
    claimTorrentPlaybackHandoff(hash);
    if (settings.torrentFullDownload) startFullDownload(hash, src.url);
    return () => {
      stopFullDownload(hash);
      releaseTorrentUsage(hash, ownerId, {
        deleteFiles: purge(),
        removeWhenUnused: !keepBg,
      });
    };
  }, [
    src.url,
    settings.torrentFullDownload,
    settings.keepStreamDownloadsInBackground,
    settings.streamCacheRetentionHours,
    settings.deleteWatchedDownloads,
  ]);

  useEffect(() => () => stopAllFullDownloads(), []);

  const volumeRestoredRef = useRef(false);
  useEffect(() => {
    if (!bridgeReady) {
      volumeRestoredRef.current = false;
      return;
    }
    if (volumeRestoredRef.current) return;
    if (snap.status !== "playing" && snap.status !== "paused") return;
    const b = bridgeRef.current;
    if (!b) return;
    const saved = readPlayerVolume();
    b.setVolume(saved.volume);
    b.setMuted(saved.muted);
    volumeRestoredRef.current = true;
  }, [bridgeReady, bridgeKey, snap.status]);

  const { resolvedImdbId, resolvedImdbVerified, resolutionSettled, subtitleSearchActive } =
    useTrackAutoload({
      bridgeRef,
      src,
      snap,
      engine,
      settings,
      authKey,
    });

  const autoSync = useAutoSync({ bridgeRef, src, snap, engine, settings });
  const {
    status: asStatus,
    offer: asOffer,
    applyOffer: asApply,
    revert: asRevert,
    retry: asRetry,
    run: asRun,
    stop: asStop,
    feedback: asFeedback,
  } = autoSync;
  useEffect(() => {
    publishAutoSync({
      status: asStatus,
      offer: asOffer,
      applyOffer: asApply,
      revert: asRevert,
      retry: asRetry,
      run: asRun,
      stop: asStop,
      feedback: asFeedback,
    });
    return () => publishAutoSync(null);
  }, [asStatus, asOffer, asApply, asRevert, asRetry, asRun, asStop, asFeedback]);

  const subEmbed = engine === "mpv" && settings.playerMpvEmbed;
  const hdrToSdr = effectiveHdrToSdr(settings);
  const hdrNativeSurface =
    engine === "mpv" &&
    isWindowsDesktop() &&
    !hdrToSdr &&
    HDR_NATIVE_GAMMAS.has(snap.hdrGamma) &&
    (settings.playerHdrOpaqueWindow ||
      (settings.playerMpvEmbed && settings.playerHdrStage !== "off"));
  const selectedSubTrack = snap.subtitleTracks.find((t) => t.selected) ?? null;
  const subAssOverridden = settings.subAssOverride !== "no" && settings.subAssOverride !== "scale";
  const selectedAssSub = isAssTrack(selectedSubTrack);
  const selectedImageSub = isImageSubTrack(selectedSubTrack);
  const subAssNative =
    subEmbed && selectedAssSub && (!subAssOverridden || !selectedSubTrack?.external);
  const subNativeRender = hdrNativeSurface || subAssNative || (subEmbed && selectedImageSub);
  const assNativeActive = selectedAssSub && (subNativeRender || !subEmbed);
  const imageNativeActive = selectedImageSub && (subNativeRender || !subEmbed);
  const assNormalizeScale = useAssNormalize({
    enabled:
      engine === "mpv" && settings.subAssNormalizeSize && assNativeActive && !subAssOverridden,
    sourceUrl: src.url ?? null,
    headers: src.headers,
    track: selectedSubTrack,
    tracks: snap.subtitleTracks,
    targetFontSize: settings.subFontSize,
  });
  const mpvMediaReadyForStyle =
    snap.status !== "idle" &&
    snap.status !== "loading" &&
    (snap.durationSec > 0 ||
      snap.videoWidth > 0 ||
      snap.audioTracks.length > 0 ||
      snap.subtitleTracks.length > 0);
  const suppressHtmlSubs = subAssNative || (subEmbed && selectedImageSub) || hdrNativeSurface;
  useSubStyleApply({
    engine,
    settings,
    assNativeActive,
    imageNativeActive,
    bridgeReady,
    mediaReady: mpvMediaReadyForStyle,
    sourceGamma: snap.hdrGamma,
    bridgeKey,
    svpActive,
    assScale: assNormalizeScale,
    subTrackId: selectedSubTrack?.id,
  });
  useEffect(() => {
    if (!subEmbed && !hdrNativeSurface) return;
    if (!bridgeReady) return;
    bridgeRef.current?.setSubVisible(subNativeRender);
  }, [subEmbed, hdrNativeSurface, subNativeRender, selectedSubTrack?.id, bridgeReady, bridgeKey]);
  useSecondarySub({
    bridgeRef,
    snap,
    sourceUrl: src.url,
    lang: settings.secondarySubLang,
  });
  useEffect(() => {
    clearImportedSubs();
  }, [src.meta.id]);

  const { captureExitSnapshot } = useExitSnapshot({
    src,
    engine,
    status: snap.status,
    durationSec: snap.durationSec,
    videoMountRef,
    resolvedImdbId,
    resolvedImdbVerified,
    seekPreviewEnabled: settings.seekPreviewEnabled,
  });

  useTraktScrobble({ src, snap });
  useSimklScrobble({ src, snap });
  const download = useVideoDownload({
    url: src.url,
    meta: src.meta,
    episode: src.episode,
    headers: src.headers,
  });

  const doDownloadSubtitle = useCallback(async () => {
    const b = bridgeRef.current;
    if (!b) return;
    const base = src.episode
      ? `${src.meta.name ?? "Subtitle"} S${src.episode.season}E${src.episode.episode}`
      : (src.meta.name ?? "Subtitle");
    const fileName = `${base.replace(/[\\/:*?"<>|]+/g, " ").trim() || "Subtitle"}.srt`;
    const res = await getCuesAnySource(b, src.url, src.headers);
    if (res.ok && res.source.cues.length > 0) {
      await downloadText(fileName, toSrt(res.source.cues), ["srt"], "Subtitle");
    }
  }, [bridgeRef, src.meta.name, src.episode, src.url, src.headers]);
  const canDownloadSub = snap.subtitleTracks.some((trk) => trk.selected);

  useEffect(() => {
    setPlayerActions({
      download: download.start,
      toggleFullscreen,
      canDownload: !!src.url,
      downloadSubtitle: doDownloadSubtitle,
      canDownloadSubtitle: canDownloadSub,
      streamUrl: src.url ?? null,
      infoHash: src.streamRef?.infoHash ?? null,
    });
    return () => setPlayerActions(null);
  }, [
    download.start,
    toggleFullscreen,
    src.url,
    src.streamRef?.infoHash,
    doDownloadSubtitle,
    canDownloadSub,
  ]);

  useResumeAutosave({ src, snap, season, episode, resolvedImdbId, resolvedImdbVerified });
  useStremioSync({
    src,
    snap,
    authKey,
    resolvedImdbId,
    resolvedImdbVerified,
    resolutionSettled,
    castActiveRef,
  });
  usePowerInhibit(snap);
  const subDropToast = useSubDrop(
    bridgeRef,
    src.meta.id,
    `${src.meta.id}|${src.episode?.season ?? ""}|${src.episode?.episode ?? ""}`,
  );

  useEffect(() => {
    const name = src.meta.name ?? "";
    const mediaTitle = src.episode
      ? `${name} · S${src.episode.imdbSeason ?? src.episode.season}E${src.episode.imdbEpisode ?? src.episode.episode}${src.episode.name ? ` · ${src.episode.name}` : ""}`
      : name;
    if (!mediaTitle) return;
    bridgeRef.current?.setMediaInfo?.({
      title: mediaTitle,
      artwork: src.meta.poster ?? undefined,
    });
  }, [engine, src.url, src.meta.name, src.meta.poster, src.episode, snap.durationSec]);

  return {
    resolvedImdbId,
    subtitleSearchActive,
    subAssNative: suppressHtmlSubs,
    captureExitSnapshot,
    download,
    subDropToast,
  };
}
