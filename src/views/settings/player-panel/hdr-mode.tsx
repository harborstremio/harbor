import { useSettings } from "@/lib/settings";
import { isWindowsDesktop } from "@/lib/platform";
import { isRtxHdrBlocked, isRtxVsrBlocked } from "@/lib/player/rtx-video-policy";
import { useT } from "@/lib/i18n";
import { SettingGroup } from "../kit";
import { ToggleRow } from "../shared";
import { ChoiceBlock, Tag } from "./choice";
import { DisplayPanelSelector } from "./display-panel-selector";

type HdrMode = "sdr" | "hdrWindow" | "hdrEmbedded";

const MODE_FLAGS: Record<
  HdrMode,
  { playerHdrToSdr: boolean; playerHdrOpaqueWindow: boolean; playerHdrStage: "auto" | "off" | "always" }
> = {
  sdr: { playerHdrToSdr: true, playerHdrOpaqueWindow: false, playerHdrStage: "off" },
  hdrWindow: { playerHdrToSdr: false, playerHdrOpaqueWindow: true, playerHdrStage: "off" },
  hdrEmbedded: { playerHdrToSdr: false, playerHdrOpaqueWindow: false, playerHdrStage: "auto" },
};

function deriveMode(s: {
  playerHdrToSdr: boolean;
  playerHdrOpaqueWindow: boolean;
}): HdrMode {
  if (s.playerHdrOpaqueWindow) return "hdrWindow";
  if (s.playerHdrToSdr) return "sdr";
  return "hdrEmbedded";
}

export function HdrModePicker() {
  const { settings, update } = useSettings();
  const t = useT();
  const current = deriveMode(settings);
  const svpAlwaysActive =
    settings.playerSvp && settings.svpVpyPath.length > 0 && settings.svpScope === "all";
  const rtxHdrUnavailable = isRtxHdrBlocked(settings.playerHdrToSdr, svpAlwaysActive);
  const rtxVsrUnavailable = isRtxVsrBlocked(svpAlwaysActive);

  const options: Array<{
    id: HdrMode;
    label: string;
    sub: string;
    recommended?: boolean;
    experimental?: boolean;
  }> = [
    {
      id: "sdr",
      label: t("Tonemap to SDR"),
      sub: t("Maps HDR down to SDR with bt.2446a. Works on any display. Pick this if HDR looks washed-out or grey."),
      recommended: true,
    },
    {
      id: "hdrWindow",
      label: t("True HDR, separate window"),
      sub: t("Plays HDR in its own window so Windows shows real HDR and the SDR brightness slider stops dimming it. The most reliable way to get true HDR."),
    },
    {
      id: "hdrEmbedded",
      label: t("True HDR, embedded"),
      sub: t("Keeps HDR inside Harbor with the controls floating above the video. Subtitles render on the video. If the control bar does not appear, press Esc or use separate window."),
      experimental: true,
    },
  ];

  const rtxHdrSub = t("Nvidia RTX GPUs only. Upconverts SDR video to HDR on the GPU (turn on RTX Video HDR in the Nvidia app; needs GPU decode). Experimental. Unavailable while SVP is active for the current video.");
  const rtxVsrSub = t("Nvidia RTX GPUs only. Upscales SDR video with AI on the GPU (turn on RTX Video Super Resolution in the Nvidia app; needs GPU decode). Experimental. Unavailable while SVP is active for the current video.");

  return (
    <>
      <SettingGroup label={t("HDR")}>
        {options.map((o) => (
          <ChoiceBlock
            key={o.id}
            selected={current === o.id}
            onClick={() => update(MODE_FLAGS[o.id])}
            label={o.label}
            sub={o.sub}
            tags={
              o.recommended ? (
                <Tag accent text={t("Recommended")} />
              ) : o.experimental ? (
                <Tag text={t("Experimental")} />
              ) : undefined
            }
          />
        ))}
      </SettingGroup>

      <SettingGroup label={t("Display")}>
        <DisplayPanelSelector />
        {isWindowsDesktop() && (
          <ToggleRow
            label={t("RTX Video HDR")}
            sub={rtxHdrSub}
            lockReason={rtxHdrUnavailable ? rtxHdrSub : undefined}
            value={settings.playerRtxHdr}
            onChange={(v) => update({ playerRtxHdr: v })}
          />
        )}
        {isWindowsDesktop() && (
          <ToggleRow
            label={t("RTX Video Super Resolution")}
            sub={rtxVsrSub}
            lockReason={rtxVsrUnavailable ? rtxVsrSub : undefined}
            value={settings.playerRtxVsr}
            onChange={(v) => update({ playerRtxVsr: v })}
          />
        )}
      </SettingGroup>
    </>
  );
}
