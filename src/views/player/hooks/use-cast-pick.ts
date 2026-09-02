import { useCallback, useEffect, useState, type RefObject } from "react";
import {
  guessContentType,
  type CastDeviceInfo,
  type CastSubInfo,
  type CastSubStyle,
} from "@/lib/cast";
import { useDebridClients } from "@/lib/debrid/registry";
import { t } from "@/lib/i18n";
import type { PlayerBridge, PlayerSnapshot, TrackInfo } from "@/lib/player/bridge";
import { getPlaybackPosition } from "@/lib/player/playback-clock";
import type { Settings } from "@/lib/settings";
import type { PlayerSrc } from "@/lib/view";
import { resolveCompatibleCastUrl } from "../cast-resolve";
import { localizedFfmpegInstallStep, type useCastSession } from "./use-cast-session";

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

function formatCastReasons(reasons: string[]): string {
  return reasons
    .map((reason) => {
      const resolution = /^(\d+)p above device max (\d+)p$/.exec(reason);
      if (resolution) {
        return t("{resolution}p above device max {maxResolution}p", {
          resolution: resolution[1],
          maxResolution: resolution[2],
        });
      }
      switch (reason) {
        case "Dolby Vision unsupported":
          return t("Dolby Vision unsupported");
        case "HDR10 unsupported":
          return t("HDR10 unsupported");
        case "AV1 unsupported":
          return t("AV1 unsupported");
        case "HEVC unsupported":
          return t("HEVC unsupported");
        case "TrueHD audio unsupported":
          return t("TrueHD audio unsupported");
        case "DTS audio unsupported":
          return t("DTS audio unsupported");
        case "E-AC-3 unsupported":
          return t("E-AC-3 unsupported");
        case "AC-3 audio unsupported":
          return t("AC-3 audio unsupported");
        case "MKV container unsupported":
          return t("MKV container unsupported");
        case "audio must be re-encoded":
          return t("audio must be re-encoded");
        default:
          return reason;
      }
    })
    .join(", ");
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
  const {
    src,
    debrids,
    snapRef,
    bridgeRef,
    settings,
    burnSubsOnTv,
    closeCastMenu,
    pickCastDevice,
    setCastErrorInfo,
  } = params;
  const [castIncompatError, setCastIncompatError] = useState<string | null>(null);
  const [castTranscoding, setCastTranscoding] = useState(false);

  useEffect(() => {
    if (!castIncompatError) return;
    const timeoutId = window.setTimeout(() => setCastIncompatError(null), 8000);
    return () => window.clearTimeout(timeoutId);
  }, [castIncompatError]);

  const onPickDevice = useCallback(
    async (device: CastDeviceInfo) => {
      if (device.audio_only) {
        setCastIncompatError(
          t(
            "{deviceName} is an audio-only device. Harbor can't transcode video to audio yet, so this device can only stream audio files. Pick a TV, Chromecast, or display-equipped device to stream video.",
            { deviceName: device.name },
          ),
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
            ? t(
                '{deviceLabel} can\'t play this stream ({reasons}). Click "Pick another" first to load alternatives, then try casting again.',
                {
                  deviceLabel: resolved.caps.label,
                  reasons: formatCastReasons(resolved.reasons),
                },
              )
            : t(
                "{deviceLabel} can't play this stream ({reasons}) and none of the {count} available alternatives match its capabilities.",
                {
                  deviceLabel: resolved.caps.label,
                  reasons: formatCastReasons(resolved.reasons),
                  count: resolved.candidatesChecked,
                },
              );
        setCastIncompatError(hint);
        closeCastMenu();
        return;
      }
      if (resolved.kind === "needs-ffmpeg") {
        setCastErrorInfo({
          title: t("Install ffmpeg"),
          message: t(
            "{deviceLabel} can't decode this stream natively ({reasons}). Harbor uses ffmpeg to convert it into a format your TV understands.",
            {
              deviceLabel: resolved.caps.label,
              reasons: formatCastReasons(resolved.reasons),
            },
          ),
          steps: [
            localizedFfmpegInstallStep(),
            t("Restart Harbor after the install completes."),
            t("Open the cast menu and try this device again."),
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
        console.info(
          `[cast] transcoding for ${resolved.caps.label}: ${resolved.reasons.join(", ")}`,
        );
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
    [
      src,
      debrids,
      snapRef,
      bridgeRef,
      settings,
      burnSubsOnTv,
      closeCastMenu,
      pickCastDevice,
      setCastErrorInfo,
    ],
  );

  return {
    castIncompatError,
    setCastIncompatError,
    castTranscoding,
    setCastTranscoding,
    onPickDevice,
  };
}
