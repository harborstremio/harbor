import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
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
import { ffmpegInstallStep } from "@/lib/ffmpeg-install";
import type { PlayerBridge } from "@/lib/player/bridge";
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
};

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
      title: "Enable Roku Network Access",
      message:
        "Your Roku is set to block control requests from apps on your network, so Harbor can't reach it. This is a one-time setting on the Roku.",
      steps: [
        "On your Roku remote, press Home.",
        "Open Settings, then System, then Advanced system settings.",
        'Select "Control by mobile apps" and set Network access to "Default".',
        "Come back to Harbor and try casting again.",
      ],
      deviceName,
    };
  }
  if (deviceKind === "roku" && /ROKU_ECP_NOT_FOUND/i.test(err)) {
    return {
      title: "Couldn't reach this Roku",
      message:
        "Harbor found something at this address that looked like a Roku, but it didn't respond like one. The device may be offline or another product picked up the same broadcast.",
      steps: [
        "Make sure the Roku is powered on and on the same Wi-Fi as your computer.",
        "Close the cast menu and reopen it to rescan the network.",
        "If multiple Rokus appear, pick the one matching your TV's name.",
      ],
      deviceName,
    };
  }
  if (deviceKind === "roku" && /ROKU_MEDIA_ASSISTANT_MISSING|media assistant/i.test(err)) {
    return {
      title: "Install Media Assistant",
      message:
        "Roku changed its OS to block the built-in Media Player from accepting video from other apps. Media Assistant is a free channel built to take over that job. One-time install on your Roku and casting works.",
      steps: [
        "On your Roku, open Streaming Channels from the home screen.",
        'Search for "Media Assistant" (channel ID 782875, free).',
        "Install it.",
        "Come back to Harbor and try casting again.",
      ],
      deviceName,
    };
  }
  if (/ffmpeg/i.test(err)) {
    return {
      title: "Install ffmpeg",
      message:
        "Harbor uses ffmpeg to convert streams into formats TVs can play. It's a one-time install and Harbor will pick it up automatically.",
      steps: [
        ffmpegInstallStep(),
        "Restart Harbor after the install completes.",
        "Open the cast menu and try this device again.",
      ],
      deviceName,
    };
  }
  return null;
}

export function useCastSession(bridgeRef?: RefObject<PlayerBridge | null>) {
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

  useEffect(() => {
    return () => {
      if (castDeviceRef.current) void castStop();
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
      setPendingCastDevice(device);
      beforeLoad?.();
      const startTarget = params.startTimeSec ?? 0;
      lastCastPositionRef.current = startTarget;
      castStartTargetRef.current = startTarget;
      castSeekConfirmedRef.current = startTarget <= 1;
      const res = await castLoad({
        host: device.host,
        port: device.port,
        kind: device.kind,
        controlUrl: device.control_url,
        ...params,
      });
      if (res.ok) {
        setCastDevice(device);
        setPendingCastDevice(null);
      } else {
        setPendingCastDevice(null);
        const err = res.error ?? `Could not cast to ${device.name}.`;
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
    [bridgeRef],
  );

  useEffect(() => {
    if (!castDevice) {
      setCastPlaying(true);
      setCastPositionSec(0);
      return;
    }
    let cancelled = false;
    const tick = async () => {
      const s = await castStatus().catch(() => null);
      if (cancelled || !s) return;
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
    const id = window.setInterval(() => void tick(), 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [castDevice]);

  useEffect(() => {
    if (!castDevice) return;
    bridgeRef?.current?.pause();
  }, [castDevice, bridgeRef]);

  const togglePlayCast = useCallback(async () => {
    if (castPlayingRef.current) {
      castPlayingRef.current = false;
      setCastPlaying(false);
      await castPause();
    } else {
      castPlayingRef.current = true;
      setCastPlaying(true);
      await castPlay();
    }
  }, []);

  const playCast = useCallback(async () => {
    castPlayingRef.current = true;
    await castPlay();
  }, []);

  const pauseCast = useCallback(async () => {
    castPlayingRef.current = false;
    await castPause();
  }, []);

  const getCastPosition = useCallback(() => lastCastPositionRef.current, []);
  const isCastPlaying = useCallback(() => castPlayingRef.current, []);

  const stopCast = useCallback(async () => {
    const finalPos = lastCastPositionRef.current;
    await castStop();
    setCastDevice(null);
    const bridge = bridgeRef?.current;
    if (bridge && finalPos > 1) {
      bridge.seek(finalPos);
    }
  }, [bridgeRef]);

  const seekCast = useCallback(async (sec: number) => {
    lastCastPositionRef.current = sec;
    castStartTargetRef.current = sec;
    castSeekConfirmedRef.current = true;
    await castSeek(sec);
  }, []);

  const dismissCastErrorInfo = useCallback(() => {
    setCastErrorInfo(null);
    if (!castDeviceRef.current) bridgeRef?.current?.play().catch(() => {});
  }, [bridgeRef]);

  return {
    castMenuOpen,
    castMenuAnchor,
    castDevice,
    pendingCastDevice,
    castError,
    castErrorInfo,
    setCastErrorInfo,
    dismissCastErrorInfo,
    castPlaying,
    castPositionSec,
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
