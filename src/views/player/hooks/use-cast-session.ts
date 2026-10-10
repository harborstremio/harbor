import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";
import { t } from "@/lib/i18n";
import { ffmpegInstallStep } from "@/lib/ffmpeg-install";
import {
  castLoad,
  castPause,
  castPlay,
  castSeek,
  castStatus,
  castStop,
  type CastDeviceInfo,
  type CastSubInfo,
  type CastSubStyle,
  type TranscodeProfile,
} from "@/lib/cast";
import type { PlayerBridge, PlayerSnapshot } from "@/lib/player/bridge";
import { VideoAudioCast } from "@/lib/player/video-audio-cast";
import {
  claimCastSession,
  ownsCastSession,
  releaseCastSession,
  withCastSession,
  type CastLease,
} from "@/lib/cast-ownership";
import type { CastErrorInfo } from "../cast-error-modal";

type LoadParams = {
  host: string;
  port: number;
  url: string;
  title: string;
  poster?: string;
  contentType?: string;
  startTimeSec?: number;
  headers?: Record<string, string>;
  transcode?: boolean;
  profile?: TranscodeProfile;
  subtitle?: CastSubInfo | null;
  subStyle?: CastSubStyle | null;
  audioOnly?: boolean;
  audioTrackOrdinal?: number;
};

export function localizedFfmpegInstallStep(): string {
  const step = ffmpegInstallStep();
  if (step === "Open a terminal and run: brew install ffmpeg") {
    return t("Open a terminal and run: brew install ffmpeg");
  }
  if (
    step === "Install ffmpeg using your system package manager (apt, dnf, pacman, zypper, etc.)."
  ) {
    return t("Install ffmpeg using your system package manager (apt, dnf, pacman, zypper, etc.).");
  }
  if (step === "Open a terminal and run: winget install Gyan.FFmpeg") {
    return t("Open a terminal and run: winget install Gyan.FFmpeg");
  }
  return step;
}

function buildActionableCastError(
  err: string,
  deviceName: string,
  deviceKind: CastDeviceInfo["kind"],
): CastErrorInfo | null {
  if (
    deviceKind === "roku" &&
    /ROKU_ECP_BLOCKED|control by mobile apps|network access/i.test(err)
  ) {
    return {
      title: t("Enable Roku Network Access"),
      message: t(
        "Your Roku is set to block control requests from apps on your network, so JL Media Vision can't reach it. This is a one-time setting on the Roku.",
      ),
      steps: [
        t("On your Roku remote, press Home."),
        t("Open Settings, then System, then Advanced system settings."),
        t('Select "Control by mobile apps" and set Network access to "Default".'),
        t("Come back to JL Media Vision and try casting again."),
      ],
      deviceName,
    };
  }
  if (deviceKind === "roku" && /ROKU_ECP_NOT_FOUND/i.test(err)) {
    return {
      title: t("Couldn't reach this Roku"),
      message: t(
        "JL Media Vision found something at this address that looked like a Roku, but it didn't respond like one. The device may be offline or another product picked up the same broadcast.",
      ),
      steps: [
        t("Make sure the Roku is powered on and on the same Wi-Fi as your computer."),
        t("Close the cast menu and reopen it to rescan the network."),
        t("If multiple Rokus appear, pick the one matching your TV's name."),
      ],
      deviceName,
    };
  }
  if (deviceKind === "roku" && /ROKU_MEDIA_ASSISTANT_MISSING|media assistant/i.test(err)) {
    return {
      title: t("Install Media Assistant"),
      message: t(
        "Roku changed its OS to block the built-in Media Player from accepting video from other apps. Media Assistant is a free channel built to take over that job. One-time install on your Roku and casting works.",
      ),
      steps: [
        t("On your Roku, open Streaming Channels from the home screen."),
        t('Search for "Media Assistant" (channel ID 782875, free).'),
        t("Install it."),
        t("Come back to JL Media Vision and try casting again."),
      ],
      deviceName,
    };
  }
  if (/ffmpeg/i.test(err)) {
    return {
      title: t("Install ffmpeg"),
      message: t(
        "JL Media Vision uses ffmpeg to convert streams into formats TVs can play. It's a one-time install and JL Media Vision will pick it up automatically.",
      ),
      steps: [
        localizedFfmpegInstallStep(),
        t("Restart JL Media Vision after the install completes."),
        t("Open the cast menu and try this device again."),
      ],
      deviceName,
    };
  }
  return null;
}

export function useCastSession(
  bridgeRef: RefObject<PlayerBridge | null>,
  snapRef: RefObject<PlayerSnapshot>,
) {
  const [castMenuOpen, setCastMenuOpen] = useState(false);
  const [castMenuAnchor, setCastMenuAnchor] = useState<{ right: number; bottom: number } | null>(
    null,
  );
  const [castDevice, setCastDevice] = useState<CastDeviceInfo | null>(null);
  const [pendingCastDevice, setPendingCastDevice] = useState<CastDeviceInfo | null>(null);
  const [castError, setCastError] = useState<string | null>(null);
  const [castErrorInfo, setCastErrorInfo] = useState<CastErrorInfo | null>(null);
  const [castPlaying, setCastPlaying] = useState<boolean>(true);
  const [castPositionSec, setCastPositionSec] = useState<number>(0);
  const [burnSubsOnTv, setBurnSubsOnTv] = useState<boolean>(true);
  const lastCastPositionRef = useRef<number>(0);
  const castStartTargetRef = useRef<number>(0);
  const castSeekConfirmedRef = useRef<boolean>(false);
  const castDeviceRef = useRef<CastDeviceInfo | null>(null);
  castDeviceRef.current = castDevice;
  const castActiveRef = useRef<boolean>(false);
  castActiveRef.current = castDevice != null;
  const castPlayingRef = useRef<boolean>(true);
  const leaseRef = useRef<CastLease | null>(null);
  const stopRef = useRef<() => Promise<void>>(async () => {});
  const generationRef = useRef(0);
  const owned = useCallback(<T>(work: () => Promise<T>) => {
    const lease = leaseRef.current;
    if (!lease) return Promise.reject(new Error("Cast session was replaced."));
    return withCastSession(lease, work);
  }, []);
  const [audio] = useState(
    () =>
      new VideoAudioCast(
        {
          load: (options) => owned(() => castLoad(options)),
          play: () => owned(castPlay),
          pause: () => owned(castPause),
          seek: (sec) => owned(() => castSeek(sec)),
          stop: async () => {
            const lease = leaseRef.current;
            await owned(castStop);
            releaseCastSession(lease);
          },
          status: () => owned(castStatus),
        },
        bridgeRef,
        () => snapRef.current,
      ),
  );
  const audioState = useSyncExternalStore(audio.subscribe, audio.getSnapshot);
  const audioRouting = audioState.device != null;
  castActiveRef.current = castDevice != null || audioRouting;

  useEffect(() => {
    return () => {
      ++generationRef.current;
      if (ownsCastSession(leaseRef.current)) void stopRef.current().catch(() => {});
    };
  }, []);

  const openCastMenu = useCallback((anchor: { right: number; bottom: number } | null) => {
    setCastMenuAnchor(anchor);
    setCastMenuOpen(true);
  }, []);

  const closeCastMenu = useCallback(() => setCastMenuOpen(false), []);

  const pickCastDevice = useCallback(
    async (
      device: CastDeviceInfo,
      params: Omit<LoadParams, "host" | "port">,
      beforeLoad?: () => void,
    ) => {
      setCastMenuOpen(false);
      setCastError(null);
      const generation = ++generationRef.current;
      try {
        const lease = await claimCastSession("video", () => stopRef.current());
        leaseRef.current = lease;
        if (generation !== generationRef.current) {
          releaseCastSession(lease);
          return;
        }
      } catch (error) {
        setCastError(error instanceof Error ? error.message : String(error));
        return;
      }
      if (device.audio_only) {
        try {
          await audio.start(device, params);
        } catch {
          /* route retains stop/return controls on failure */
        }
        if (!audio.getSnapshot().device) releaseCastSession(leaseRef.current);
        return;
      }
      setPendingCastDevice(device);
      beforeLoad?.();
      const startTarget = params.startTimeSec ?? 0;
      lastCastPositionRef.current = startTarget;
      castStartTargetRef.current = startTarget;
      castSeekConfirmedRef.current = startTarget <= 1;
      const sessionLease = leaseRef.current;
      const res = await owned(() =>
        castLoad({
          host: device.host,
          port: device.port,
          kind: device.kind,
          controlUrl: device.control_url,
          ...params,
        }),
      );
      if (generation !== generationRef.current || !ownsCastSession(sessionLease)) return;
      if (res.ok) {
        setCastDevice(device);
        setPendingCastDevice(null);
      } else {
        setPendingCastDevice(null);
        try {
          await owned(castStop);
          releaseCastSession(sessionLease);
        } catch (error) {
          if (generation !== generationRef.current || !ownsCastSession(sessionLease)) return;
          setCastDevice(device);
          setCastError(String(error));
          return;
        }
        const err = res.error ?? t("Could not cast to {deviceName}.", { deviceName: device.name });
        const actionable = buildActionableCastError(err, device.name, device.kind);
        if (actionable) {
          setCastErrorInfo(actionable);
        } else {
          setCastError(err);
          setTimeout(() => setCastError(null), 8000);
          bridgeRef?.current?.play().catch(() => {});
        }
      }
    },
    [audio, bridgeRef, owned],
  );

  useEffect(() => {
    if (!castDevice) {
      setCastPlaying(true);
      setCastPositionSec(0);
      return;
    }
    let cancelled = false;
    const tick = async () => {
      const lease = leaseRef.current;
      const s = await owned(castStatus).catch((error) => {
        if (!cancelled && ownsCastSession(lease)) setCastError(String(error));
        return null;
      });
      if (cancelled || !s || !ownsCastSession(lease)) return;
      if (s.player_state === "PLAYING") {
        castPlayingRef.current = true;
        setCastPlaying(true);
      } else if (s.player_state === "PAUSED") {
        castPlayingRef.current = false;
        setCastPlaying(false);
      } else if (s.player_state === "BUFFERING") {
        castPlayingRef.current = true;
        setCastPlaying(true);
      }
      if (!castSeekConfirmedRef.current) {
        if (s.position_sec >= castStartTargetRef.current - 5) {
          castSeekConfirmedRef.current = true;
        } else {
          return;
        }
      }
      if (s.position_sec > 0) {
        lastCastPositionRef.current = s.position_sec;
        setCastPositionSec(s.position_sec);
      }
    };
    void tick();
    let id: ReturnType<typeof setTimeout>;
    const poll = async () => {
      await tick();
      if (!cancelled) id = setTimeout(() => void poll(), 1000);
    };
    id = setTimeout(() => void poll(), 1000);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [castDevice, owned]);

  useEffect(() => {
    if (!audioRouting) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      await audio.poll();
      if (!cancelled) timer = setTimeout(() => void poll(), 1000);
    };
    timer = setTimeout(() => void poll(), 1000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [audio, audioRouting]);

  useEffect(() => {
    if (!castDevice) return;
    bridgeRef?.current?.pause();
  }, [castDevice, bridgeRef]);

  const togglePlayCast = useCallback(async () => {
    if (audio.getSnapshot().device) {
      await (audio.getSnapshot().phase === "playing" ? audio.pause() : audio.play()).catch(
        () => {},
      );
      return;
    }
    try {
      if (castPlayingRef.current) {
        await owned(castPause);
        castPlayingRef.current = false;
        setCastPlaying(false);
      } else {
        await owned(castPlay);
        castPlayingRef.current = true;
        setCastPlaying(true);
      }
    } catch (error) {
      setCastError(String(error));
    }
  }, [audio, owned]);

  const playCast = useCallback(async () => {
    if (audio.getSnapshot().device) return audio.play();
    await owned(castPlay);
    castPlayingRef.current = true;
    setCastPlaying(true);
  }, [audio, owned]);

  const pauseCast = useCallback(async () => {
    if (audio.getSnapshot().device) return audio.pause();
    await owned(castPause);
    castPlayingRef.current = false;
    setCastPlaying(false);
  }, [audio, owned]);

  const getCastPosition = useCallback(
    () => (audio.getSnapshot().device ? audio.getSnapshot().position : lastCastPositionRef.current),
    [audio],
  );
  const isCastPlaying = useCallback(
    () =>
      audio.getSnapshot().device ? audio.getSnapshot().phase === "playing" : castPlayingRef.current,
    [audio],
  );

  const stopCast = useCallback(async () => {
    const lease = leaseRef.current;
    if (!ownsCastSession(lease)) return;
    if (audio.getSnapshot().device) {
      await audio.stop();
      releaseCastSession(lease);
      return;
    }
    const finalPos = lastCastPositionRef.current;
    try {
      await owned(castStop);
    } catch (error) {
      setCastError(String(error));
      throw error;
    }
    if (!ownsCastSession(lease)) return;
    releaseCastSession(lease);
    setCastDevice(null);
    setPendingCastDevice(null);
    const bridge = bridgeRef?.current;
    if (bridge && finalPos > 1) {
      bridge.seek(finalPos);
    }
  }, [audio, bridgeRef, owned]);
  stopRef.current = stopCast;

  const returnAudioToComputer = useCallback(async () => {
    const lease = leaseRef.current;
    if (!ownsCastSession(lease)) return;
    try {
      await audio.returnToComputer();
      releaseCastSession(lease);
    } catch {
      /* route remains visible for an explicit retry */
    }
  }, [audio]);

  const seekCast = useCallback(
    async (sec: number) => {
      if (audio.getSnapshot().device) {
        await audio.seek(sec).catch(() => {});
        return;
      }
      try {
        await owned(() => castSeek(sec));
      } catch (error) {
        setCastError(String(error));
        return;
      }
      lastCastPositionRef.current = sec;
      castStartTargetRef.current = sec;
      castSeekConfirmedRef.current = true;
    },
    [audio, owned],
  );

  const dismissCastErrorInfo = useCallback(() => {
    setCastErrorInfo(null);
    if (!castDeviceRef.current && !audio.getSnapshot().device)
      bridgeRef.current?.play().catch(() => {});
  }, [audio, bridgeRef]);

  return {
    castMenuOpen,
    castMenuAnchor,
    castDevice: audioRouting && audioState.phase !== "connecting" ? audioState.device : castDevice,
    pendingCastDevice: audioState.phase === "connecting" ? audioState.device : pendingCastDevice,
    castError: audioState.error ?? castError,
    audioRouting,
    audioPhase: audioState.phase,
    returnAudioToComputer,
    castErrorInfo,
    setCastErrorInfo,
    dismissCastErrorInfo,
    castPlaying: audioRouting ? audioState.phase === "playing" : castPlaying,
    castPositionSec: audioRouting ? audioState.position : castPositionSec,
    burnSubsOnTv,
    setBurnSubsOnTv,
    openCastMenu,
    closeCastMenu,
    pickCastDevice,
    togglePlayCast,
    stopCast,
    seekCast,
    castActiveRef,
    playCast,
    pauseCast,
    getCastPosition,
    isCastPlaying,
  };
}
