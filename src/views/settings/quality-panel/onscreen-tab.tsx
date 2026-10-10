import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { SettingRow, SettingsWorkbench } from "../kit";
import { Section, Segmented, ToggleRow } from "../shared";
import { QualityBadgePreview } from "./quality-badge-preview";
import { PlayerWindowOptions } from "./window-options";

export function OnScreenTab() {
  const t = useT();
  const { settings, update } = useSettings();
  return (
    <div className="hset-onscreen hset-form-page">
      <Section title={t("Stream quality in player")}>
        <SettingsWorkbench compact preview={settings.showQualityInfo ? <QualityBadgePreview style={settings.qualityBadgeStyle} /> : null}>
          <ToggleRow
            label={t("Show stream quality under the title")}
            sub={t("See the resolution, HDR format and audio while you watch.")}
            value={settings.showQualityInfo}
            onChange={(v) => update({ showQualityInfo: v })}
          />
          {settings.showQualityInfo && (
            <SettingRow wide label={t("Quality badge style")}>
              <Segmented
                value={settings.qualityBadgeStyle}
                options={[{ value: "bar", label: t("Bar") }, { value: "chips", label: t("Chips") }]}
                onChange={(v) => update({ qualityBadgeStyle: v as "bar" | "chips" })}
              />
            </SettingRow>
          )}
        </SettingsWorkbench>
      </Section>
      <Section title={t("Playback controls")}>
        <ToggleRow
          label={t("Show controls when pausing with keyboard")}
          sub={t("Turn off to keep the controls hidden when you pause or resume with the keyboard.")}
          value={settings.keyboardPauseShowsControls}
          onChange={(v) => update({ keyboardPauseShowsControls: v })}
        />
        <ToggleRow
          label={t("Sleep timer in the top bar")}
          sub={t("Add a timer beside Downloads. Pause playback after a set time or number of episodes.")}
          value={settings.navbarSleepTimer}
          onChange={(v) => update({ navbarSleepTimer: v })}
        />
      </Section>
      <PlayerWindowOptions />
    </div>
  );
}
