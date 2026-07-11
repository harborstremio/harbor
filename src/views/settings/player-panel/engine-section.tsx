import { useT } from "@/lib/i18n";
import { isWindowsDesktop } from "@/lib/platform";
import { useSettings } from "@/lib/settings";

import { ToggleRow } from "../shared";
import { BandwidthInput } from "./bandwidth-section";
import { DisplayPanelSelector } from "./display-panel-selector";
import { HdrModePicker } from "./hdr-mode";
import { DesktopOnlyBlock } from "./internals";

export function PlayerEnginePanel() {
  const { settings, update } = useSettings();
  const t = useT();

  const choices: Array<{
    id: "auto" | "html5" | "mpv";
    label: string;
    sub: string;
    recommended?: boolean;
  }> = [
    {
      id: "auto",
      label: t("Auto"),
      sub: t("mpv on the desktop app, HTML5 in the browser. The right engine without thinking about it."),
      recommended: true,
    },
    {
      id: "html5",
      label: "HTML5",
      sub: t("Native webview playback. Smooth and integrated, but limited codec coverage."),
    },
    {
      id: "mpv",
      label: "mpv",
      sub: t("Bundled with Harbor. Plays anything you throw at it."),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <DesktopOnlyBlock>
        <div className="flex flex-col gap-2.5">
          {choices.map((c) => {
            const selected = settings.playerEngine === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => update({ playerEngine: c.id })}
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
                    <span className="text-[15px] font-semibold text-ink">{c.label}</span>
                    {c.recommended && (
                      <span className="rounded-md bg-accent/15 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-accent">
                        {t("Recommended")}
                      </span>
                    )}
                  </div>
                  <span className="text-[12.5px] leading-snug text-ink-muted">{c.sub}</span>
                </div>
              </button>
            );
          })}
        </div>
      </DesktopOnlyBlock>

      <DesktopOnlyBlock>
        <div className="flex flex-col gap-2">
          <ToggleRow
            label={t("Embed mpv inside Harbor window")}
            sub={t(
              "Renders mpv inline so playback lives in Harbor itself. Disable to open it in a separate window instead.",
            )}
            value={settings.playerMpvEmbed}
            onChange={(v) => update({ playerMpvEmbed: v })}
          />
          {isWindowsDesktop() ? (
            <HdrModePicker />
          ) : (
            <>
              <ToggleRow
                label={t("HDR-to-SDR tonemapping")}
                sub={t("Maps HDR sources to SDR using bt.2446a. Recommended on SDR displays.")}
                value={settings.playerHdrToSdr}
                onChange={(v) => update({ playerHdrToSdr: v })}
              />
              <DisplayPanelSelector />
            </>
          )}
          {isWindowsDesktop() && (
            <ToggleRow
              label={t("Line-free video mode")}
              sub={t(
                "Forces a compatibility present mode that removes a thin bright line some monitors show at the screen edge. Side effects: 4K playback can drop to a slideshow and HDR content looks dimmer (this mode bypasses the HDR display path). Leave OFF unless you see that line. Restart playback to apply.",
              )}
              value={settings.playerD3d11Flip}
              onChange={(v) => update({ playerD3d11Flip: v })}
            />
          )}
          <ToggleRow
            label={t("Always re-encode when casting (recommended)")}
            sub={t(
              "On by default. Pipes every cast through ffmpeg as H.264 + AAC + MPEG-TS so Samsung, LG, Sony, and other DLNA TVs accept the stream regardless of source codec. Turn off only if you have a beefy receiver that handles raw HEVC/DTS and want max quality. Requires ffmpeg in PATH.",
            )}
            value={settings.castAlwaysTranscode}
            onChange={(v) => update({ castAlwaysTranscode: v })}
          />
        </div>
      </DesktopOnlyBlock>

      <DesktopOnlyBlock>
        <BandwidthInput />
      </DesktopOnlyBlock>
    </div>
  );
}
