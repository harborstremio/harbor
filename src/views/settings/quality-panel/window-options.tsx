import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { normalizeFullscreenMode, type FullscreenMode } from "@/lib/fullscreen-state";
import { SettingRow, SettingsWorkbench } from "../kit";
import { Section, Segmented, ToggleRow } from "../shared";
import { Anchored } from "../player-panel/choice";
import { FullscreenPreview } from "../fullscreen-preview";
import { VolumeHudPreview } from "../player-panel/volume-hud-preview";

export function PlayerWindowOptions() {
  const { settings, update } = useSettings();
  const t = useT();
  return (
    <>
      <Section title={t("Fullscreen")}>
        <SettingsWorkbench compact preview={<FullscreenPreview mode={normalizeFullscreenMode(settings.fullscreenMode)} />}>
          <Anchored id="set-what-fullscreen-does">
            <Anchored id="set-fullscreen-mode">
              <SettingRow wide label={t("What fullscreen does")}>
                <select
                  aria-label={t("What fullscreen does")}
                  value={normalizeFullscreenMode(settings.fullscreenMode)}
                  onChange={(event) => update({ fullscreenMode: event.target.value as FullscreenMode })}
                  className="h-11 w-full max-w-[300px] rounded-[8px] border border-edge-soft bg-elevated px-3 text-[15px] text-ink"
                >
                  <option value="fullscreen">{t("True fullscreen")}</option>
                  <option value="borderless">{t("Borderless window")}</option>
                  <option value="maximized">{t("Maximize")}</option>
                </select>
              </SettingRow>
            </Anchored>
          </Anchored>
          <ToggleRow
            label={t("Stay in fullscreen after closing the player")}
            sub={t("Keep Harbor fullscreen when you close the player.")}
            value={settings.keepFullscreenOnExit}
            onChange={(v) => update({ keepFullscreenOnExit: v })}
          />
          <ToggleRow
            label={t("Restore window position after fullscreen")}
            sub={t("Return the window to its previous position. Turn off to center it instead.")}
            value={settings.fullscreenRestorePosition}
            onChange={(v) => update({ fullscreenRestorePosition: v })}
          />
        </SettingsWorkbench>
      </Section>
      <Section title={t("Volume pop-up")}>
        <SettingsWorkbench compact preview={settings.playerVolumeHud ? <VolumeHudPreview position={settings.playerVolumeHudPosition} /> : null}>
          <ToggleRow
            label={t("Volume pop-up while watching")}
            sub={t("Show the volume level when you adjust it with the player controls hidden.")}
            value={settings.playerVolumeHud}
            onChange={(v) => update({ playerVolumeHud: v })}
          />
          {settings.playerVolumeHud && (
            <SettingRow wide label={t("Pop-up position")}>
              <Segmented
                value={settings.playerVolumeHudPosition}
                options={[
                  { value: "center", label: t("Center") },
                  { value: "top", label: t("Top") },
                  { value: "top-left", label: t("Top left") },
                  { value: "top-right", label: t("Top right") },
                ]}
                onChange={(playerVolumeHudPosition) => update({ playerVolumeHudPosition })}
              />
            </SettingRow>
          )}
        </SettingsWorkbench>
      </Section>
    </>
  );
}
