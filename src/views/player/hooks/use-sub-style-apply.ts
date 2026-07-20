import { useEffect } from "react";
import { isLinuxDesktop, isMacDesktop } from "@/lib/platform";
import { applyMotionInterp } from "@/lib/player/motion-interp";
import { applyRtxVideo, resetRtxVideoState } from "@/lib/player/rtx-video";
import { applySubStyle } from "@/lib/player/sub-style";
import type { useSettings } from "@/lib/settings";

export function useSubStyleApply(params: {
  engine: "html5" | "mpv";
  settings: ReturnType<typeof useSettings>["settings"];
  assNativeActive: boolean;
  imageNativeActive: boolean;
  bridgeReady: boolean;
  mediaReady: boolean;
  sourceGamma: string;
  bridgeKey: string | number;
  svpActive: boolean;
}) {
  const {
    engine,
    settings,
    assNativeActive,
    imageNativeActive,
    bridgeReady,
    mediaReady,
    sourceGamma,
    bridgeKey,
    svpActive,
  } = params;

  useEffect(() => {
    if (engine !== "mpv") return;
    if (!bridgeReady) return;
    if (!mediaReady) return;
    void applySubStyle(settings, { assNativeActive, imageNativeActive });
  }, [
    engine,
    bridgeReady,
    mediaReady,
    bridgeKey,
    assNativeActive,
    imageNativeActive,
    settings.subFontSize,
    settings.subFontColor,
    settings.subBorderColor,
    settings.subBorderSize,
    settings.subMarginY,
    settings.subAlignX,
    settings.subAssOverride,
    settings.subStyle,
    settings.subFontFamily,
    settings.subLineSpacing,
    settings.subOpacity,
    settings.subBoxOpacity,
    settings.subBoxColor,
    settings.subBold,
  ]);

  useEffect(() => () => resetRtxVideoState(), [bridgeKey]);

  useEffect(() => {
    if (engine !== "mpv") return;
    if ((isMacDesktop() || isLinuxDesktop()) && settings.playerMpvEmbed) return;
    if (!bridgeReady) return;
    if (!mediaReady || !sourceGamma) {
      void applyRtxVideo(
        { hdr: false, vsr: false, svpActive, hdrToSdr: settings.playerHdrToSdr },
        bridgeKey,
      );
      return;
    }
    void applyMotionInterp(settings.playerMotionInterp && !svpActive);
    void applyRtxVideo(
      {
        hdr: settings.playerRtxHdr,
        vsr: settings.playerRtxVsr,
        svpActive,
        hdrToSdr: settings.playerHdrToSdr,
      },
      bridgeKey,
    );
  }, [
    engine,
    bridgeReady,
    mediaReady,
    sourceGamma,
    bridgeKey,
    svpActive,
    settings.playerMpvEmbed,
    settings.playerMotionInterp,
    settings.playerHdrToSdr,
    settings.playerRtxHdr,
    settings.playerRtxVsr,
  ]);
}
