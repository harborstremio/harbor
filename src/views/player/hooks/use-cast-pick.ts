import { guessContentType, type CastDeviceInfo, type CastSubInfo, type CastSubStyle } from "@/lib/cast";
import { useDebridClients } from "@/lib/debrid/registry";
import type { PlayerBridge, PlayerSnapshot, TrackInfo } from "@/lib/player/bridge";
import { getPlaybackPosition } from "@/lib/player/playback-clock";
import type { Settings } from "@/lib/settings";
import type { PlayerSrc } from "@/lib/view";
import { useCallback, useEffect, useState, type RefObject } from "react";

import { resolveCompatibleCastUrl } from "../cast-resolve";
import type { useCastSession } from "./use-cast-session";

type CastSession = ReturnType<typeof useCastSession>;

const UNIVERSAL_SAFE_PROFILE = {
  max_height: 1080 as const,
  force_h264: true,
  force_aac: true,
  force_stereo: true,
  max_video_kbps: 5000,
};

function subFormatFromTrack(track: TrackInfo): CastSubInfo["format"] {
  const codec = (track.codec ?? "").toLowerCase();
  const source = `${codec} ${(track.externalFilename ?? "").toLowerCase()}`;
  if (source.includes("ass") || source.includes("ssa")) return "ass";
  if (source.includes("vtt") || source.includes("webvtt")) return "vtt";
  return "srt";
}

function buildCastSub(tracks: TrackInfo[]): CastSubInfo | null {
  const selected = tracks.find((t) => t.selected);
  if (!selected) return null;
  if (selected.external) {
    if (!selected.externalFilename) return null;
    return {
      kind: "external",
      url: selected.externalFilename,
      format: subFormatFromTrack(selected),
      off: false,
    };
  }
  const embeddedIndex = tracks.filter((t) => !t.external).indexOf(selected);
  if (embeddedIndex < 0) return null;
  return { kind: "embedded", src_index: embeddedIndex, off: false };
}

function buildCastSubStyle(s: Settings): CastSubStyle {
  return {
    font_size: s.subFontSize,
    font_color: s.subFontColor,
    border_color: s.subBorderColor,
    border_size: s.subBorderSize,
    margin_y: s.subMarginY,
    align_x: s.subAlignX,
  };
}

export function useCastPick(params: {
  src: PlayerSrc;
  debrids: ReturnType<typeof useDebridClients>;
  snapRef: RefObject<PlayerSnapshot>;
  bridgeRef: RefObject<PlayerBridge | null>;
  settings: Settings;
  burnSubsOnTv: boolean;
  closeCastMenu: () => void;
  pickCastDevice: CastSession["pickCastDevice"];
  setCastErrorInfo: CastSession["setCastErrorInfo"];
}) {
  const { src, debrids, snapRef, bridgeRef, settings, burnSubsOnTv, closeCastMenu, pickCastDevice, setCastErrorInfo } =
    params;
  const [castIncompatError, setCastIncompatError] = useState<string | null>(null);
  const [castTranscoding, setCastTranscoding] = useState(false);

  useEffect(() => {
    if (!castIncompatError) return;
    const t = window.setTimeout(() => setCastIncompatError(null), 8000);
    return () => window.clearTimeout(t);
  }, [castIncompatError]);

  const onPickDevice = useCallback(
    async (device: CastDeviceInfo) => {
      if (device.audio_only) {
        setCastIncompatError(
          `${device.name} is an audio-only device. Harbor can't transcode video to audio yet, so this device can only stream audio files. Pick a TV, Chromecast, or display-equipped device to stream video.`,
        );
        closeCastMenu();
        return;
      }
      const snap = snapRef.current;
      const resolved = await resolveCompatibleCastUrl(src, device, debrids, {
        width: snap.videoWidth,
        height: snap.videoHeight,
      });
      if (resolved.kind === "incompatible") {
        const hint =
          resolved.candidatesChecked === 0
            ? `${resolved.caps.label} can't play this stream (${resolved.reasons.join(", ")}). Click "Pick another" first to load alternatives, then try casting again.`
            : `${resolved.caps.label} can't play this stream (${resolved.reasons.join(", ")}) and none of the ${resolved.candidatesChecked} available alternatives match its capabilities.`;
        setCastIncompatError(hint);
        closeCastMenu();
        return;
      }
      if (resolved.kind === "needs-ffmpeg") {
        const installCmd = navigator.userAgent.includes("Mac")
          ? "brew install ffmpeg"
          : navigator.userAgent.includes("Linux")
            ? "sudo apt install ffmpeg"
            : "winget install Gyan.FFmpeg";
        setCastErrorInfo({
          title: "Install ffmpeg",
          message: `${resolved.caps.label} can't decode this stream natively (${resolved.reasons.join(", ")}). Harbor uses ffmpeg to convert it into a format your TV understands.`,
          steps: [
            `Open a terminal and run: ${installCmd}`,
            "Restart Harbor after the install completes.",
            "Open the cast menu and try this device again.",
          ],
          deviceName: device.name,
        });
        closeCastMenu();
        return;
      }
      if (resolved.kind === "swapped") {
        console.info(
          `[cast] swapped stream for ${resolved.caps.label}: ${resolved.reasons.join(", ")} -> ${resolved.alt.parsedTitle ?? resolved.alt.title ?? "alt"}`,
        );
      }
      if (resolved.kind === "transcode") {
        console.info(`[cast] transcoding for ${resolved.caps.label}: ${resolved.reasons.join(", ")}`);
      }
      const isLiveIptv = src.meta.id?.startsWith("iptv:") ?? false;
      const burnSub = burnSubsOnTv ? buildCastSub(snap.subtitleTracks) : null;
      const forceTranscode = resolved.kind === "transcode" || isLiveIptv || burnSub != null;
      const profile = forceTranscode ? UNIVERSAL_SAFE_PROFILE : undefined;
      setCastTranscoding(forceTranscode);
      await pickCastDevice(
        device,
        {
          url: resolved.url,
          title: src.title,
          poster: src.meta.poster ?? undefined,
          contentType: forceTranscode
            ? "application/x-mpegURL"
            : guessContentType(resolved.url, src.streamRef?.title ?? src.title),
          startTimeSec: isLiveIptv ? 0 : getPlaybackPosition(),
          headers: isLiveIptv ? { "user-agent": "VLC/3.0.20 LibVLC/3.0.20" } : undefined,
          transcode: forceTranscode,
          profile,
          subtitle: burnSub,
          subStyle: burnSub ? buildCastSubStyle(settings) : null,
        },
        () => bridgeRef.current?.pause(),
      );
    },
    [src, debrids, snapRef, bridgeRef, settings, burnSubsOnTv, closeCastMenu, pickCastDevice, setCastErrorInfo],
  );

  return { castIncompatError, setCastIncompatError, castTranscoding, setCastTranscoding, onPickDevice };
}
