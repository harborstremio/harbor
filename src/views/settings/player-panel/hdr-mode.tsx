import { useSettings } from "@/lib/settings";
import { isWindowsDesktop } from "@/lib/platform";
import { isRtxHdrBlocked } from "@/lib/player/rtx-hdr-policy";
import { useT } from "@/lib/i18n";
import { DisplayPanelSelector } from "./display-panel-selector";

type HdrMode = "sdr" | "hdrWindow" | "hdrEmbedded";

const MODE_FLAGS: Record<
  HdrMode,
  {
    playerHdrToSdr: boolean;
    playerHdrOpaqueWindow: boolean;
    playerHdrStage: "auto" | "off" | "always";
  }
> = {
  sdr: { playerHdrToSdr: true, playerHdrOpaqueWindow: false, playerHdrStage: "off" },
  hdrWindow: { playerHdrToSdr: false, playerHdrOpaqueWindow: true, playerHdrStage: "off" },
  hdrEmbedded: { playerHdrToSdr: false, playerHdrOpaqueWindow: false, playerHdrStage: "auto" },
};

function deriveMode(s: { playerHdrToSdr: boolean; playerHdrOpaqueWindow: boolean }): HdrMode {
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
      sub: t(
        "Maps HDR down to SDR with bt.2446a. Works on any display. Pick this if HDR looks washed-out or grey.",
      ),
      recommended: true,
    },
    {
      id: "hdrWindow",
      label: t("True HDR, separate window"),
      sub: t(
        "Plays HDR in its own window so Windows shows real HDR and the SDR brightness slider stops dimming it. The most reliable way to get true HDR.",
      ),
    },
    {
      id: "hdrEmbedded",
      label: t("True HDR, embedded"),
      sub: t(
        "Keeps HDR inside Harbor with the controls floating above the video. Subtitles render on the video. If the control bar does not appear, press Esc or use separate window.",
      ),
      experimental: true,
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
        {t("HDR")}
      </span>
      <div className="flex flex-col gap-2.5">
        {options.map((o) => {
          const selected = current === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => update(MODE_FLAGS[o.id])}
              className={`flex items-start gap-3.5 rounded-2xl border px-5 py-4 text-start transition-colors ${
                selected
                  ? "border-ink bg-elevated"
                  : "border-edge-soft bg-canvas/40 hover:border-edge hover:bg-canvas/60"
              }`}
            >
              <span
                className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                  selected ? "border-ink" : "border-edge"
                }`}
              >
                {selected && <span className="h-2.5 w-2.5 rounded-full bg-ink" />}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-semibold text-ink">{o.label}</span>
                  {o.recommended && (
                    <span className="rounded-md bg-accent/15 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-accent">
                      {t("Recommended")}
                    </span>
                  )}
                  {o.experimental && (
                    <span className="rounded-md bg-ink/10 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-ink-muted">
                      {t("Experimental")}
                    </span>
                  )}
                </div>
                <span className="text-[12.5px] leading-snug text-ink-muted">{o.sub}</span>
              </div>
            </button>
          );
        })}
      </div>
      <DisplayPanelSelector />
      {isWindowsDesktop() && (
        <button
          type="button"
          disabled={rtxHdrUnavailable}
          onClick={() => update({ playerRtxHdr: !settings.playerRtxHdr })}
          className={`mt-1 flex items-center justify-between gap-4 rounded-2xl border px-5 py-4 text-start transition-colors ${
            rtxHdrUnavailable
              ? "cursor-not-allowed border-edge-soft bg-canvas/20 opacity-50"
              : settings.playerRtxHdr
                ? "border-ink bg-elevated"
                : "border-edge-soft bg-canvas/40 hover:border-edge hover:bg-canvas/60"
          }`}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-semibold text-ink">{t("RTX Video HDR")}</span>
              <span className="rounded-md bg-ink/10 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-ink-muted">
                {t("Nvidia only")}
              </span>
            </div>
            <span className="text-[12.5px] leading-snug text-ink-muted">
              {t(
                "Upconverts SDR video to HDR on an Nvidia RTX GPU (turn on RTX Video HDR in the Nvidia app; needs GPU decode). Experimental. Unavailable while SVP is active for the current video.",
              )}
            </span>
          </div>
          <span
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
              settings.playerRtxHdr && !rtxHdrUnavailable ? "bg-ink" : "bg-edge"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-canvas transition-transform ${
                settings.playerRtxHdr && !rtxHdrUnavailable
                  ? "translate-x-[22px]"
                  : "translate-x-0.5"
              }`}
            />
          </span>
        </button>
      )}
    </div>
  );
}
