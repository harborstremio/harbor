import { AlertTriangle } from "../icons";
import { useEffect, useState } from "react";
import { isWindowsDesktop } from "@/lib/platform";
import { probeMpv, type MpvProbe } from "@/lib/player/mpv";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { ROW_DESC, SettingGroup, SettingRow } from "../kit";
import { ToggleRow } from "../shared";
import { BandwidthInput } from "./bandwidth-section";
import { ChoiceBlock, Tag } from "./choice";
import { DesktopOnlyBlock, isTauri } from "./internals";
import { HdrModePicker } from "./hdr-mode";
import { DisplayPanelSelector } from "./display-panel-selector";

export function PlayerEnginePanel() {
  const { settings, update } = useSettings();
  const t = useT();
  const [mpvProbe, setMpvProbe] = useState<MpvProbe | null>(null);

  useEffect(() => {
    if (!isTauri) return;
    let cancelled = false;
    void probeMpv().then((p) => {
      if (!cancelled) setMpvProbe(p);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
      sub: t("Harbor's full video engine. Plays anything you throw at it."),
    },
  ];

  return (
    <DesktopOnlyBlock>
      <div className="flex flex-col gap-5">
        <SettingGroup label={t("Engine")}>
          {choices.map((c) => (
            <ChoiceBlock
              key={c.id}
              selected={settings.playerEngine === c.id}
              onClick={() => update({ playerEngine: c.id })}
              label={c.label}
              sub={c.sub}
              tags={c.recommended ? <Tag accent text={t("Recommended")} /> : undefined}
            />
          ))}
          <ToggleRow
            label={t("Embed mpv inside Harbor window")}
            sub={t("Renders mpv inline so playback lives in Harbor itself. Turn off to open it in a separate window instead.")}
            value={settings.playerMpvEmbed}
            onChange={(v) => update({ playerMpvEmbed: v })}
          />
          {mpvProbe && !mpvProbe.available && (
            <div className="flex items-start gap-2.5 rounded-[10px] bg-elevated px-4 py-3">
              <AlertTriangle size={18} strokeWidth={2.2} className="mt-[2px] shrink-0 text-danger" />
              <span className="flex min-w-0 flex-1 flex-col gap-2">
                <span className={`max-w-[66ch] ${ROW_DESC}`}>
                  {t(
                    "libmpv did not load, so playback falls back to HTML5 and formats like MKV may refuse to play. On Linux, install your distribution's libmpv package, then restart Harbor.",
                  )}
                </span>
                {mpvProbe.error && (
                  <span className="break-words rounded-[6px] bg-canvas px-2.5 py-1.5 font-mono text-[15.5px] leading-[22px] text-ink-subtle">
                    {mpvProbe.error}
                  </span>
                )}
              </span>
            </div>
          )}
        </SettingGroup>

        {isWindowsDesktop() ? (
          <HdrModePicker />
        ) : (
          <SettingGroup label={t("HDR")}>
            <ToggleRow
              label={t("HDR-to-SDR tonemapping")}
              sub={t("Maps HDR sources to SDR using bt.2446a. Recommended on SDR displays.")}
              value={settings.playerHdrToSdr}
              onChange={(v) => update({ playerHdrToSdr: v })}
            />
            <DisplayPanelSelector />
          </SettingGroup>
        )}

        <SettingGroup label={t("Casting")}>
          <SettingRow label={t("Device compatibility")} desc={t("Harbor checks the receiving device and uses ffmpeg when the stream needs conversion.")}>
            <span className="text-[15px] text-ink-muted">{t("Automatic")}</span>
          </SettingRow>
        </SettingGroup>

        <SettingGroup label={t("Connection")}>
          <BandwidthInput />
        </SettingGroup>

        {isWindowsDesktop() && (
          <SettingGroup label={t("Picture")}>
            <ToggleRow
              label={t("Line-free video mode")}
              sub={t("Forces a compatibility present mode that removes a thin bright line some monitors show at the screen edge. Side effects: 4K playback can drop to a slideshow and HDR content looks dimmer, because this mode bypasses the HDR display path. Leave off unless you see that line. Restart playback to apply.")}
              value={settings.playerD3d11Flip}
              onChange={(v) => update({ playerD3d11Flip: v })}
            />
          </SettingGroup>
        )}
      </div>
    </DesktopOnlyBlock>
  );
}
