import Hls from "hls.js";
import mpegts from "mpegts.js";
import {
  initialPlayerSnapshot,
  type PlayerBridge,
  type PlayerCapabilities,
  type PlayerSnapshot,
  type PlayerSource,
  type TrackInfo,
} from "../bridge";
import { fetchAndParse, findActiveCue } from "@/lib/subtitles/parser";
import { prepareSubtitle } from "@/lib/subtitles/prepare";
import { subtitleTrackDownloadHeaders } from "@/lib/subtitles/provider-auth";
import { takePreparedSubtitle } from "@/lib/subtitles/prepared-registry";
import type { SubTrack } from "./types";
import { bufferedAhead, readAudioTracks, videoAudio } from "./audio-tracks";
import { mapErrorCode } from "./error-map";
import { noteSubtitleOrigin } from "@/lib/subtitles/subtitle-memory";
import { mountCustomPip } from "./pip";
import { finishPlaybackTrace, markPlaybackTrace } from "@/lib/perf/playback-trace";
import { isPlayerInteractionLocked } from "@/lib/player/interaction-lock";
import { SubtitleSelectionCoordinator } from "@/lib/player/subtitle-selection";
import { PreparedSubtitleSeedBatch } from "@/lib/subtitles/seed-batch";
import { isSafeProviderSubtitleUrl } from "@/lib/subtitles/provider-url";

let DOCUMENT_PIP_KNOWN_BROKEN = false;

export function createHtml5Bridge(): PlayerBridge {
  let video: HTMLVideoElement | null = null;
  let host: HTMLElement | null = null;
  let snap: PlayerSnapshot = initialPlayerSnapshot();
  const listeners = new Set<(s: PlayerSnapshot) => void>();
  let pendingStart: number | null = null;
  let pipWindow: Window | null = null;
  let pipCleanup: (() => void) | null = null;
  let abLoopA: number | null = null;
  let abLoopB: number | null = null;
  let mediaSessionBound = false;
  let pendingVolume = 1;
  let hls: Hls | null = null;
  let tsPlayer: ReturnType<typeof mpegts.createPlayer> | null = null;
  let isLiveSrc = false;
  let audioProbeDone = false;
  const subTracks: SubTrack[] = [];
  let activeSubId: string | null = null;
  let secondarySubId: string | null = null;
  let subDelaySec = 0;
  let cueTickerRaf: number | null = null;
  let lastCueId = "";
  let activeTraceId: string | null = null;
  let mediaRevision = 0;
  const mainSubtitleSelection = new SubtitleSelectionCoordinator();
  const secondarySubtitleSelection = new SubtitleSelectionCoordinator();

  const emit = () => {
    const next: PlayerSnapshot = { ...snap };
    listeners.forEach((l) => l(next));
  };

  const probeAudio = () => {
    if (audioProbeDone || !video) return;
    if (video.paused || video.muted || pendingVolume <= 0) return;
    if (!Number.isFinite(video.currentTime) || video.currentTime < 2.5) return;
    if (hls && Array.isArray(hls.audioTracks) && hls.audioTracks.length > 0) {
      audioProbeDone = true;
      return;
    }
    const c = video as HTMLVideoElement & {
      webkitAudioDecodedByteCount?: number;
      webkitVideoDecodedByteCount?: number;
    };
    if (typeof c.webkitAudioDecodedByteCount !== "number") {
      audioProbeDone = true;
      return;
    }
    audioProbeDone = true;
    if (c.webkitAudioDecodedByteCount === 0 && (c.webkitVideoDecodedByteCount ?? 1) > 0) {
      snap.noAudio = true;
    }
  };

  const refreshSnapshot = () => {
    if (!video) return;
    const hadFirstFrame = snap.firstFrameReady;
    probeAudio();
    snap.positionSec = Number.isFinite(video.currentTime) ? video.currentTime : 0;
    snap.durationSec = Number.isFinite(video.duration) ? video.duration : 0;
    snap.bufferedSec = bufferedAhead(video);
    snap.buffering =
      !video.paused && !video.ended && video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA;
    snap.volume = pendingVolume;
    snap.muted = video.muted;
    snap.rate = video.playbackRate;
    snap.audioTracks = readHlsAudioTracks() ?? readAudioTracks(video);
    snap.subtitleTracks = readCustomSubtitleTracks();
    snap.subDelaySec = subDelaySec;
    snap.videoWidth = video.videoWidth || 0;
    snap.videoHeight = video.videoHeight || 0;
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && snap.videoWidth > 0) {
      snap.firstFrameReady = true;
    }
    if (!hadFirstFrame && snap.firstFrameReady) {
      markPlaybackTrace(activeTraceId, "first-frame");
      finishPlaybackTrace(activeTraceId, "ready");
      activeTraceId = null;
    }
    if (video.error) {
      snap.status = "error";
      snap.errorCode = mapErrorCode(video.error.code);
      snap.errorMessage = video.error.message || null;
    } else if (video.ended) {
      snap.status = "ended";
    } else if (!video.paused) {
      snap.status = "playing";
    } else if (video.readyState >= 3) {
      snap.status = "paused";
    } else {
      snap.status = "loading";
    }
    emit();
  };

  const readHlsAudioTracks = (): TrackInfo[] | null => {
    if (!hls || !Array.isArray(hls.audioTracks) || hls.audioTracks.length === 0) return null;
    const cur = hls.audioTrack;
    return hls.audioTracks.map((t, i) => ({
      id: `hls-${i}`,
      label: t.name || (t.lang ? t.lang.toUpperCase() : `Audio ${i + 1}`),
      lang: t.lang || undefined,
      title: t.name || undefined,
      kind: "audio" as const,
      selected: i === cur,
      default: t.default === true,
    }));
  };

  const readCustomSubtitleTracks = (): TrackInfo[] => {
    return subTracks.map((t) => ({
      id: t.id,
      label: t.title || (t.lang ? t.lang.toUpperCase() : "Subtitle"),
      lang: t.lang,
      title: t.title,
      kind: "subtitle" as const,
      selected: t.id === activeSubId,
      secondary: t.id === secondarySubId,
      external: t.external,
      prepared: t.metadata?.prepared === true || (t.cues != null && t.cues.length > 0),
      autoSelectionEligible: t.metadata?.autoSelectionEligible,
      url: t.originalUrl ?? t.url,
      originalUrl: t.metadata?.originalUrl ?? t.originalUrl,
      downloadAuth: t.metadata?.downloadAuth,
      format: t.metadata?.format,
      release: t.metadata?.release,
      provider: t.metadata?.provider,
      providerDerived: t.metadata?.providerDerived,
      fps: t.metadata?.fps,
      downloads: t.metadata?.downloads,
      author: t.metadata?.author,
      uploadedAt: t.metadata?.uploadedAt,
      rating: t.metadata?.rating,
      productionType: t.metadata?.productionType,
      releaseType: t.metadata?.releaseType,
      hearingImpaired: t.metadata?.hearingImpaired,
      forced: t.metadata?.forced,
      foreignOnly: t.metadata?.foreignOnly,
      machineTranslated: t.metadata?.machineTranslated,
      fromTrusted: t.metadata?.fromTrusted,
      providerMatch: t.metadata?.providerMatch,
      timingStatus: t.metadata?.timingStatus,
      timingMeasurementStatus: t.metadata?.timingMeasurementStatus,
      matchExplanation: t.metadata?.matchExplanation,
      matchScore: t.metadata?.matchScore,
      matchConfidence: t.metadata?.matchConfidence,
      matchReasons: t.metadata?.matchReasons,
      subId: t.metadata?.subId,
    }));
  };

  const tickCues = () => {
    if (!video) return;
    const t = (Number.isFinite(video.currentTime) ? video.currentTime : 0) - subDelaySec;
    let changed = false;
    const track = subTracks.find((s) => s.id === activeSubId);
    if (!track || !track.cues) {
      if (snap.subText !== "") {
        snap.subText = "";
        snap.subStartSec = 0;
        changed = true;
      }
    } else {
      const cue = findActiveCue(track.cues, t);
      const cueId = cue ? `${cue.start}|${cue.text}` : "";
      if (cueId !== lastCueId) {
        lastCueId = cueId;
        snap.subText = cue?.text ?? "";
        snap.subStartSec = cue?.start ?? 0;
        changed = true;
      }
    }
    const second = secondarySubId ? subTracks.find((s) => s.id === secondarySubId) : null;
    const secondCue = second?.cues ? findActiveCue(second.cues, t) : null;
    const secondText = secondCue?.text ?? "";
    if (secondText !== snap.secondarySubText) {
      snap.secondarySubText = secondText;
      changed = true;
    }
    if (changed) emit();
  };

  const cueTickLoop = () => {
    cueTickerRaf = null;
    tickCues();
    cueTickerRaf = window.requestAnimationFrame(cueTickLoop);
  };

  const startCueTicker = () => {
    if (cueTickerRaf != null) return;
    cueTickerRaf = window.requestAnimationFrame(cueTickLoop);
  };

  const stopCueTicker = () => {
    if (cueTickerRaf == null) return;
    window.cancelAnimationFrame(cueTickerRaf);
    cueTickerRaf = null;
  };

  const applyVolume = (v: number) => {
    pendingVolume = v;
    if (!video) return;
    video.volume = Math.min(1, Math.max(0, v));
  };

  const teardownTs = () => {
    if (!tsPlayer) return;
    try {
      tsPlayer.pause();
      tsPlayer.unload();
      tsPlayer.detachMediaElement();
      tsPlayer.destroy();
    } catch {}
    tsPlayer = null;
  };

  const disposeSubtitleTracks = () => {
    for (const track of subTracks) track.cleanup?.();
    subTracks.length = 0;
  };

  const ensureLoaded = (track: SubTrack): Promise<boolean> => {
    if (track.cues) return Promise.resolve(track.cues.length > 0);
    if (track.loadingPromise) return track.loadingPromise;
    const requestMediaRevision = mediaRevision;
    track.loading = true;
    let loadingPromise: Promise<boolean>;
    loadingPromise = (async () => {
      try {
        if (/^https?:/i.test(track.url)) {
          const prepared = await prepareSubtitle({
            url: track.url,
            format: track.metadata?.format,
            encoding: track.metadata?.encoding,
            language: track.lang,
            release: track.metadata?.release,
            filename: track.metadata?.rawFilename,
            requestHeaders: subtitleTrackDownloadHeaders(
              track.metadata?.downloadAuth,
              track.url,
              track.metadata?.providerDerived ?? Boolean(track.metadata?.provider),
            ),
          });
          if (requestMediaRevision !== mediaRevision || !subTracks.includes(track)) {
            prepared.cleanup();
            return false;
          }
          track.cleanup?.();
          track.cleanup = prepared.cleanup;
          track.url = prepared.playableUrl;
          track.cues = prepared.cues;
          track.metadata = {
            ...track.metadata,
            format: prepared.format,
            encoding: prepared.encoding,
            rawFilename: prepared.rawFilename,
            archive: prepared.archive,
            prepared: true,
          };
        } else {
          const cues = await fetchAndParse(track.url, { ...track.metadata, lang: track.lang });
          if (requestMediaRevision !== mediaRevision || !subTracks.includes(track)) return false;
          track.cues = cues;
        }
        return track.cues.length > 0;
      } catch (e) {
        console.warn("[subtitles] failed to load track", {
          provider: track.metadata?.provider,
          release: track.metadata?.release,
          error: e instanceof Error ? e.name : "unknown",
        });
        if (requestMediaRevision === mediaRevision && subTracks.includes(track)) track.cues = [];
        return false;
      } finally {
        delete track.loadingPromise;
        track.loading = false;
        if (requestMediaRevision === mediaRevision && subTracks.includes(track)) {
          refreshSnapshot();
          tickCues();
        }
      }
    })();
    track.loadingPromise = loadingPromise;
    return loadingPromise;
  };

  const onAny = () => {
    if (
      video &&
      abLoopA != null &&
      abLoopB != null &&
      abLoopB > abLoopA &&
      video.currentTime >= abLoopB - 0.05
    ) {
      video.currentTime = abLoopA;
    }
    refreshSnapshot();
    updateMediaSessionPosition();
  };
  const onError = () => {
    refreshSnapshot();
  };
  const onLoaded = () => {
    if (!video) return;
    if (pendingStart != null && Number.isFinite(video.duration)) {
      const max = video.duration - 5;
      if (pendingStart > 5 && pendingStart < max) video.currentTime = pendingStart;
      pendingStart = null;
    }
    refreshSnapshot();
  };

  const bind = () => {
    if (!video) return;
    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("loadeddata", onAny);
    video.addEventListener("durationchange", onAny);
    video.addEventListener("play", onAny);
    video.addEventListener("playing", onAny);
    video.addEventListener("pause", onAny);
    video.addEventListener("ended", onAny);
    video.addEventListener("seeked", onAny);
    video.addEventListener("timeupdate", onAny);
    video.addEventListener("progress", onAny);
    video.addEventListener("ratechange", onAny);
    video.addEventListener("volumechange", onAny);
    video.addEventListener("error", onError);
    video.addEventListener("waiting", onAny);
    video.addEventListener("canplay", onAny);
    videoAudio(video)?.addEventListener?.("change", onAny);
    video.textTracks?.addEventListener?.("change", onAny);
  };

  const bindMediaSession = () => {
    if (mediaSessionBound) return;
    if (!video) return;
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    try {
      ms.setActionHandler("play", () => {
        if (isPlayerInteractionLocked()) return;
        video?.play().catch(() => {});
      });
      ms.setActionHandler("pause", () => {
        if (isPlayerInteractionLocked()) return;
        video?.pause();
      });
      ms.setActionHandler("seekbackward", (details) => {
        if (isPlayerInteractionLocked()) return;
        if (!video) return;
        const offset = details && details.seekOffset != null ? details.seekOffset : 30;
        video.currentTime = Math.max(0, video.currentTime - offset);
      });
      ms.setActionHandler("seekforward", (details) => {
        if (isPlayerInteractionLocked()) return;
        if (!video) return;
        const offset = details && details.seekOffset != null ? details.seekOffset : 30;
        const max = Number.isFinite(video.duration)
          ? video.duration - 0.25
          : video.currentTime + offset;
        video.currentTime = Math.min(max, video.currentTime + offset);
      });
      ms.setActionHandler("seekto", (details) => {
        if (isPlayerInteractionLocked()) return;
        if (!video || details.seekTime == null) return;
        video.currentTime = details.seekTime;
      });
      mediaSessionBound = true;
    } catch (e) {
      console.warn("[html5] media session setup failed", e);
    }
  };

  const updateMediaSessionPosition = () => {
    if (!mediaSessionBound || !video) return;
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession as MediaSession & {
      setPositionState?: (state: {
        duration: number;
        position: number;
        playbackRate: number;
      }) => void;
    };
    if (!ms.setPositionState) return;
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;
    try {
      ms.setPositionState({
        duration: video.duration,
        position: Math.max(0, Math.min(video.duration, video.currentTime)),
        playbackRate: video.playbackRate || 1,
      });
    } catch {}
  };

  const unbind = () => {
    if (!video) return;
    video.removeEventListener("loadedmetadata", onLoaded);
    video.removeEventListener("loadeddata", onAny);
    video.removeEventListener("durationchange", onAny);
    video.removeEventListener("play", onAny);
    video.removeEventListener("playing", onAny);
    video.removeEventListener("pause", onAny);
    video.removeEventListener("ended", onAny);
    video.removeEventListener("seeked", onAny);
    video.removeEventListener("timeupdate", onAny);
    video.removeEventListener("progress", onAny);
    video.removeEventListener("ratechange", onAny);
    video.removeEventListener("volumechange", onAny);
    video.removeEventListener("error", onError);
    video.removeEventListener("waiting", onAny);
    video.removeEventListener("canplay", onAny);
    videoAudio(video)?.removeEventListener?.("change", onAny);
    video.textTracks?.removeEventListener?.("change", onAny);
  };

  return {
    attach(h) {
      host = h;
      const v = document.createElement("video");
      v.playsInline = true;
      v.preload = "auto";
      v.style.width = "100%";
      v.style.height = "100%";
      v.style.objectFit = "contain";
      v.style.background = "black";
      h.appendChild(v);
      video = v;
      bind();
    },
    detach() {
      mediaRevision += 1;
      mainSubtitleSelection.invalidate();
      secondarySubtitleSelection.invalidate();
      unbind();
      stopCueTicker();
      if (hls) {
        try {
          hls.destroy();
        } catch {}
        hls = null;
      }
      teardownTs();
      if (video) {
        try {
          video.pause();
          while (video.firstChild) video.removeChild(video.firstChild);
          video.removeAttribute("src");
          video.load();
        } catch {}
      }
      if (video && host?.contains(video)) host.removeChild(video);
      video = null;
      host = null;
    },
    async load(src: PlayerSource) {
      if (!video) return;
      mediaRevision += 1;
      mainSubtitleSelection.invalidate();
      secondarySubtitleSelection.invalidate();
      if (activeTraceId && activeTraceId !== src.traceId) {
        finishPlaybackTrace(activeTraceId, "replaced");
      }
      activeTraceId = src.traceId ?? null;
      markPlaybackTrace(activeTraceId, "bridge-load");
      isLiveSrc = src.notWebReady === true;
      pendingStart = src.startAtSec ?? null;
      if (hls) {
        try {
          hls.destroy();
        } catch {}
        hls = null;
      }
      teardownTs();
      try {
        if (video.src) {
          video.pause();
          video.removeAttribute("src");
          video.load();
        }
      } catch {}
      while (video.firstChild) video.removeChild(video.firstChild);
      video.muted = false;
      if (video.volume === 0) video.volume = 1;

      const bare = src.url.toLowerCase().split("?")[0];
      const lowerUrl = src.url.toLowerCase();
      const isHls =
        bare.endsWith(".m3u8") || lowerUrl.includes("m3u8") || lowerUrl.includes("/playlist/");
      const isTs =
        bare.endsWith(".ts") ||
        (src.notWebReady === true && !isHls && !/\.(mp4|webm|mov|mkv|mpd)$/.test(bare));
      if (isHls && Hls.isSupported()) {
        hls = new Hls(
          src.notWebReady === true || src.isLive === true
            ? {
                enableWorker: true,
                lowLatencyMode: false,
                liveDurationInfinity: true,
                backBufferLength: 30,
              }
            : { enableWorker: true },
        );
        hls.loadSource(src.url);
        hls.attachMedia(video);
        hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, refreshSnapshot);
        hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, refreshSnapshot);
      } else if (isTs && mpegts.isSupported()) {
        tsPlayer = mpegts.createPlayer(
          { type: "mpegts", url: src.url, isLive: true, cors: true },
          { enableWorker: true, liveBufferLatencyChasing: true, lazyLoadMaxDuration: 4 },
        );
        tsPlayer.attachMediaElement(video);
        tsPlayer.on(mpegts.Events.ERROR, refreshSnapshot);
        tsPlayer.load();
      } else {
        video.src = src.url;
      }
      markPlaybackTrace(activeTraceId, "loadfile-accepted");
      disposeSubtitleTracks();
      activeSubId = null;
      secondarySubId = null;
      subDelaySec = 0;
      lastCueId = "";
      snap.subText = "";
      snap.subStartSec = 0;
      snap.secondarySubText = "";
      snap.subDelaySec = 0;
      if (src.subtitles?.length) {
        const seedRevision = mediaRevision;
        const seedTracks: SubTrack[] = [];
        for (let i = 0; i < src.subtitles.length; i++) {
          const s = src.subtitles[i];
          if (s.trustedSource !== true && !isSafeProviderSubtitleUrl(s.url)) continue;
          const track: SubTrack = {
            id: s.id ?? `seed-${i}`,
            url: s.url,
            originalUrl: s.url,
            lang: s.lang,
            title: undefined,
            external: true,
            cues: null,
            loading: false,
            metadata: {
              originalUrl: s.url,
              providerDerived: s.trustedSource !== true,
              autoSelectionEligible: false,
            },
          };
          subTracks.push(track);
          seedTracks.push(track);
        }
        const seedBatch = new PreparedSubtitleSeedBatch(seedTracks);
        void Promise.all(
          seedTracks.map(async (track) => {
            if (await ensureLoaded(track)) seedBatch.markReady(track);
          }),
        ).then(() => {
          seedBatch.commit(
            () => seedRevision === mediaRevision,
            (readyTracks) => {
              for (const track of readyTracks) {
                if (!subTracks.includes(track)) continue;
                track.metadata = {
                  ...track.metadata,
                  prepared: true,
                  autoSelectionEligible: true,
                };
              }
              refreshSnapshot();
              tickCues();
            },
          );
        });
      }
      snap.subtitleTracks = readCustomSubtitleTracks();
      snap.status = "loading";
      snap.errorCode = null;
      snap.errorMessage = null;
      snap.noAudio = false;
      audioProbeDone = false;
      snap.positionSec = 0;
      snap.durationSec = 0;
      snap.bufferedSec = 0;
      snap.buffering = false;
      snap.firstFrameReady = false;
      startCueTicker();
      emit();
    },
    async play() {
      if (!video) return;
      const v = video;
      if (pendingStart != null && v.readyState < 1) {
        await new Promise<void>((resolve) => {
          let done = false;
          const finish = () => {
            if (done) return;
            done = true;
            v.removeEventListener("loadedmetadata", finish);
            resolve();
          };
          v.addEventListener("loadedmetadata", finish, { once: true });
          setTimeout(finish, 4000);
        });
      }
      if (pendingStart != null && Number.isFinite(v.duration)) {
        const max = v.duration - 5;
        if (pendingStart > 5 && pendingStart < max) v.currentTime = pendingStart;
        pendingStart = null;
      }
      v.muted = false;
      try {
        await v.play();
      } catch {
        v.muted = true;
        try {
          await v.play();
          setTimeout(() => {
            if (v && !v.paused) v.muted = false;
          }, 200);
        } catch {}
      }
    },
    pause() {
      video?.pause();
    },
    frameStep(dir) {
      if (!video) return;
      video.pause();
      const fd = 1 / 24;
      const hi = Number.isFinite(video.duration) ? video.duration - 0.05 : video.currentTime + fd;
      video.currentTime = Math.max(0, Math.min(hi, video.currentTime + dir * fd));
    },
    seek(sec) {
      if (!video) return;
      if (isLiveSrc && video.seekable.length > 0) {
        const lo = video.seekable.start(0);
        const hi = video.seekable.end(0) - 0.5;
        video.currentTime = Math.max(lo, Math.min(sec, hi));
        return;
      }
      if (!Number.isFinite(video.duration)) {
        pendingStart = sec;
        return;
      }
      const max = video.duration - 0.25;
      video.currentTime = Math.max(0, Math.min(sec, max));
    },
    setVolume(v) {
      if (!video) return;
      const clamped = Math.max(0, Math.min(6, v));
      applyVolume(clamped);
      if (clamped > 0) video.muted = false;
      snap.volume = clamped;
      emit();
    },
    setMuted(m) {
      if (video) video.muted = m;
    },
    setRate(r) {
      if (video) video.playbackRate = r;
    },
    setAudioTrack(id) {
      if (hls && Array.isArray(hls.audioTracks) && hls.audioTracks.length > 0) {
        const idx = hls.audioTracks.findIndex(
          (t, i) => String(i) === id || String(t.id) === id || `hls-${i}` === id,
        );
        if (idx >= 0) {
          hls.audioTrack = idx;
          refreshSnapshot();
        }
        return;
      }
      const tracks = video ? videoAudio(video) : null;
      if (!tracks) return;
      for (let i = 0; i < tracks.length; i++) {
        const t = tracks[i];
        t.enabled = String(i) === id || (t as { id?: string }).id === id;
      }
      refreshSnapshot();
    },
    setSubtitleTrack(id) {
      if (id == null) {
        mainSubtitleSelection.invalidate();
        activeSubId = null;
        lastCueId = "";
        snap.subText = "";
        snap.subStartSec = 0;
        refreshSnapshot();
        tickCues();
        return;
      }
      const track = subTracks.find((candidate) => candidate.id === id);
      if (!track) return;
      const request = mainSubtitleSelection.begin(mediaRevision, id, activeSubId);
      void ensureLoaded(track).then((loaded) => {
        const settlement = mainSubtitleSelection.settle(
          request,
          mediaRevision,
          loaded,
          (candidateId) => subTracks.some((candidate) => candidate.id === candidateId),
        );
        if (!settlement.current) return;
        activeSubId = settlement.selectedId;
        lastCueId = "";
        refreshSnapshot();
        tickCues();
      });
    },
    setSecondarySubtitleTrack(id) {
      if (id == null) {
        secondarySubtitleSelection.invalidate();
        secondarySubId = null;
        snap.secondarySubText = "";
      } else {
        const track = subTracks.find((t) => t.id === id);
        if (!track) return;
        const request = secondarySubtitleSelection.begin(mediaRevision, id, secondarySubId);
        void ensureLoaded(track).then((loaded) => {
          const settlement = secondarySubtitleSelection.settle(
            request,
            mediaRevision,
            loaded,
            (candidateId) => subTracks.some((candidate) => candidate.id === candidateId),
          );
          if (!settlement.current) return;
          secondarySubId = settlement.selectedId;
          if (secondarySubId == null) snap.secondarySubText = "";
          refreshSnapshot();
          tickCues();
        });
        return;
      }
      refreshSnapshot();
      tickCues();
    },
    setSubVisible() {},
    setSubDelay(sec) {
      subDelaySec = sec;
      lastCueId = "";
      snap.subDelaySec = sec;
      tickCues();
      emit();
    },
    setAudioDelay() {},
    setPanscan(value) {
      if (video) video.style.objectFit = value > 0 ? "cover" : "contain";
    },
    setVideoZoom() {},
    setAspectOverride() {},
    setStretch(on) {
      if (video && on) video.style.objectFit = "fill";
    },
    setVideoEq() {},
    setAnime4kShaders() {},
    async addSubtitle(url, lang, title, select, metadata): Promise<boolean> {
      const requestMediaRevision = mediaRevision;
      const id = `ext-${subTracks.length}-${Date.now()}`;
      const selectionRequest =
        select === true ? mainSubtitleSelection.begin(mediaRevision, id, activeSubId) : null;
      const prepared = takePreparedSubtitle(url);
      const providerDerived = metadata?.providerDerived ?? Boolean(metadata?.provider);
      if (!prepared && providerDerived && !isSafeProviderSubtitleUrl(url)) return false;
      let resolvedUrl = url;
      if (
        !/^(https?|blob|data):/i.test(url) &&
        typeof window !== "undefined" &&
        "__TAURI_INTERNALS__" in window
      ) {
        try {
          const { convertFileSrc } = await import("@tauri-apps/api/core");
          resolvedUrl = convertFileSrc(url);
        } catch {}
      }
      if (requestMediaRevision !== mediaRevision) {
        prepared?.cleanup();
        return false;
      }
      const track: SubTrack = {
        id,
        url: resolvedUrl,
        originalUrl: metadata?.originalUrl ?? url,
        lang,
        title,
        external: true,
        cues: prepared?.cues ?? null,
        loading: false,
        metadata: prepared
          ? {
              ...metadata,
              format: prepared.format,
              encoding: prepared.encoding,
              rawFilename: prepared.rawFilename,
              archive: prepared.archive,
              prepared: true,
            }
          : metadata,
        cleanup: prepared?.cleanup,
      };
      subTracks.push(track);
      noteSubtitleOrigin(resolvedUrl, url);
      if (selectionRequest) {
        const loaded = await ensureLoaded(track);
        if (requestMediaRevision !== mediaRevision || !subTracks.includes(track)) {
          const index = subTracks.indexOf(track);
          if (index >= 0) {
            subTracks.splice(index, 1);
            track.cleanup?.();
            track.cleanup = undefined;
          }
          return false;
        }
        if (!loaded) {
          const index = subTracks.indexOf(track);
          if (index >= 0) subTracks.splice(index, 1);
          track.cleanup?.();
          track.cleanup = undefined;
        }
        const settlement = mainSubtitleSelection.settle(
          selectionRequest,
          mediaRevision,
          loaded,
          (candidateId) => subTracks.some((candidate) => candidate.id === candidateId),
        );
        if (settlement.current) {
          activeSubId = settlement.selectedId;
          lastCueId = "";
        }
        refreshSnapshot();
        tickCues();
        return loaded;
      }
      refreshSnapshot();
      return true;
    },
    getSelectedTrackCues() {
      const track = subTracks.find((t) => t.id === activeSubId);
      return track?.cues ?? null;
    },
    getSelectedTrackUrl() {
      const track = subTracks.find((t) => t.id === activeSubId);
      return track?.url ?? null;
    },
    setAudioNormalize() {},
    setMediaInfo(info) {
      if (!("mediaSession" in navigator)) return;
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: info.title,
          artist: info.artist ?? "Harbor",
          artwork: info.artwork ? [{ src: info.artwork, sizes: "512x512" }] : [],
        });
      } catch {}
    },
    async screenshot(path) {
      try {
        if (!video || !video.videoWidth) return { ok: false, error: "video not ready" };
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return { ok: false, error: "no 2d context" };
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const blob: Blob | null = await new Promise((res) =>
          canvas.toBlob((b) => res(b), "image/png"),
        );
        if (!blob) return { ok: false, error: "encode failed" };
        if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
          const fs = await import("@tauri-apps/plugin-fs");
          const bytes = new Uint8Array(await blob.arrayBuffer());
          const dir = path.replace(/[\\/][^\\/]+$/, "");
          if (dir && dir !== path) await fs.mkdir(dir, { recursive: true }).catch(() => {});
          await fs.writeFile(path, bytes);
          return { ok: true, path };
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = path.split(/[\\/]/).pop() || "harbor-frame.png";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return { ok: true, path };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
    setAbLoop(a, b) {
      abLoopA = a;
      abLoopB = b;
    },
    async requestPiP() {
      if (!video || !host) return;
      if (pipWindow) return;
      bindMediaSession();
      const dpip = (
        window as Window & {
          documentPictureInPicture?: {
            requestWindow: (o: { width: number; height: number }) => Promise<Window>;
          };
        }
      ).documentPictureInPicture;
      const tryDocumentPip = async (): Promise<boolean> => {
        if (DOCUMENT_PIP_KNOWN_BROKEN) return false;
        if (!dpip || typeof dpip.requestWindow !== "function") return false;
        try {
          const aspectW = Math.max(
            360,
            Math.min(
              560,
              video!.videoWidth ? Math.round((video!.videoWidth / video!.videoHeight) * 280) : 480,
            ),
          );
          const w = await dpip.requestWindow({ width: aspectW, height: 280 });
          mountCustomPip(
            w,
            video!,
            host!,
            () => emit(),
            () => snap,
          );
          pipWindow = w;
          pipCleanup = () => {
            if (!host || !video) {
              pipWindow = null;
              pipCleanup = null;
              return;
            }
            const wasPlaying = !video.paused && !video.ended;
            const time = Number.isFinite(video.currentTime) ? video.currentTime : 0;
            const wasMuted = video.muted;
            const vol = video.volume;
            if (!host.contains(video)) host.appendChild(video);
            video.muted = wasMuted;
            video.volume = vol;
            if (Math.abs(video.currentTime - time) > 0.5) {
              try {
                video.currentTime = time;
              } catch {}
            }
            if (wasPlaying) {
              const tryPlay = () => video!.play().catch(() => {});
              tryPlay();
              setTimeout(() => {
                if (video && video.paused && !video.ended) tryPlay();
              }, 60);
            }
            pipWindow = null;
            pipCleanup = null;
          };
          w.addEventListener("pagehide", pipCleanup, { once: true });
          return true;
        } catch (e) {
          DOCUMENT_PIP_KNOWN_BROKEN = true;
          console.warn("[html5] document PiP unsupported in this host, using native PiP", e);
          return false;
        }
      };

      const useDocPip = await tryDocumentPip();
      if (useDocPip) return;

      const v = video as HTMLVideoElement & {
        requestPictureInPicture?: () => Promise<PictureInPictureWindow>;
        disablePictureInPicture?: boolean;
      };
      if (v.disablePictureInPicture) v.disablePictureInPicture = false;
      if (typeof v.requestPictureInPicture === "function") {
        try {
          await v.requestPictureInPicture();
        } catch (e) {
          console.warn("[html5] native PiP failed", e);
        }
      }
    },
    async exitPiP() {
      if (pipWindow) {
        try {
          pipWindow.close();
        } catch {}
        if (pipCleanup) pipCleanup();
      }
      const d = document as Document & { exitPictureInPicture?: () => Promise<void> };
      if (typeof d.exitPictureInPicture === "function") {
        await d.exitPictureInPicture().catch(() => {});
      }
    },
    async requestFullscreen() {
      if (!host) return;
      if (typeof host.requestFullscreen === "function") {
        await host.requestFullscreen().catch(() => {});
      }
    },
    async exitFullscreen() {
      if (typeof document.exitFullscreen === "function") {
        await document.exitFullscreen().catch(() => {});
      }
    },
    capabilities(): PlayerCapabilities {
      const nativePiP =
        "pictureInPictureEnabled" in document ? document.pictureInPictureEnabled : false;
      const docPiP = "documentPictureInPicture" in window;
      return {
        engine: "html5",
        pictureInPicture: !!nativePiP || docPiP,
        airplay:
          typeof (window as { WebKitPlaybackTargetAvailabilityEvent?: unknown })
            .WebKitPlaybackTargetAvailabilityEvent !== "undefined",
        chromecast: false,
        hdrPassthrough: false,
        hardwareDecode: true,
      };
    },
    subscribe(l) {
      listeners.add(l);
      l(snap);
      return () => {
        listeners.delete(l);
      };
    },
    destroy() {
      mediaRevision += 1;
      mainSubtitleSelection.invalidate();
      secondarySubtitleSelection.invalidate();
      finishPlaybackTrace(activeTraceId, "aborted");
      activeTraceId = null;
      stopCueTicker();
      disposeSubtitleTracks();
      activeSubId = null;
      if (hls) {
        try {
          hls.destroy();
        } catch {}
        hls = null;
      }
      teardownTs();
      if (pipWindow) {
        try {
          pipWindow.close();
        } catch {}
        pipWindow = null;
        pipCleanup = null;
      }
      if (mediaSessionBound && "mediaSession" in navigator) {
        try {
          const ms = navigator.mediaSession;
          ms.setActionHandler("play", null);
          ms.setActionHandler("pause", null);
          ms.setActionHandler("seekbackward", null);
          ms.setActionHandler("seekforward", null);
          ms.setActionHandler("seekto", null);
          ms.metadata = null;
        } catch {}
        mediaSessionBound = false;
      }
      unbind();
      if (video) {
        try {
          video.pause();
          while (video.firstChild) video.removeChild(video.firstChild);
          video.removeAttribute("src");
          video.load();
        } catch {}
      }
      if (video && video.parentElement) {
        video.parentElement.removeChild(video);
      }
      video = null;
      host = null;
      listeners.clear();
    },
  };
}
