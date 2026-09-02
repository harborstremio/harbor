import { useSettings } from "@/lib/settings";
import { isWindowsDesktop } from "@/lib/platform";
import { isRtxHdrBlocked, isRtxVsrBlocked } from "@/lib/player/rtx-video-policy";
import { useT } from "@/lib/i18n";
import { SettingGroup } from "../kit";
import { ToggleRow } from "../shared";
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

function Tag({ text, accent }: { text: string; accent?: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider ${
        accent ? "bg-accent-soft text-accent" : "bg-canvas text-ink-muted"
      }`}
    >
      {text}
    </span>
  );
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

  const rtxHdrSub = t("Upconverts SDR video to HDR on an Nvidia RTX GPU (turn on RTX Video HDR in the Nvidia app; needs GPU decode). Experimental. Unavailable while SVP is active for the current video.");
  const rtxVsrSub = t("Upscales SDR video with AI on an Nvidia RTX GPU (turn on RTX Video Super Resolution in the Nvidia app; needs GPU decode). Experimental. Unavailable while SVP is active for the current video.");

  return (
    <div className="flex flex-col gap-3">
      <SettingGroup label={t("HDR")}>
        {options.map((o) => {
          const selected = current === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => update(MODE_FLAGS[o.id])}
              className={`flex items-start gap-3.5 rounded-md px-4 py-3.5 text-start transition-colors ${
                selected ? "bg-raised" : "bg-elevated hover:bg-raised"
              }`}
            >
              <span
                className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full transition-colors ${
                  selected ? "bg-accent" : "bg-canvas"
                }`}
              >
                {selected && <span className="h-2 w-2 rounded-full bg-canvas" />}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-[13.5px] font-medium leading-snug text-ink">{o.label}</span>
                  {o.recommended && <Tag accent text={t("Recommended")} />}
                  {o.experimental && <Tag text={t("Experimental")} />}
                </span>
                <span className="text-[12.5px] leading-relaxed text-ink-subtle">{o.sub}</span>
              </span>
            </button>
          );
        })}
      </SettingGroup>
      <DisplayPanelSelector />
      {isWindowsDesktop() && (
        <ToggleRow
          label={t("RTX Video HDR")}
          leading={<Tag text={t("Nvidia only")} />}
          sub={rtxHdrSub}
          lockReason={rtxHdrUnavailable ? rtxHdrSub : undefined}
          value={settings.playerRtxHdr}
          onChange={(v) => update({ playerRtxHdr: v })}
        />
      )}
      {isWindowsDesktop() && (
        <ToggleRow
          label={t("RTX Video Super Resolution")}
          leading={<Tag text={t("Nvidia only")} />}
          sub={rtxVsrSub}
          lockReason={rtxVsrUnavailable ? rtxVsrSub : undefined}
          value={settings.playerRtxVsr}
          onChange={(v) => update({ playerRtxVsr: v })}
        />
      )}
    </div>
  );
}
