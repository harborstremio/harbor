import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { SettingRow } from "../kit";
import { Section, Segmented, ToggleRow } from "../shared";
import { QualityBadgePreview } from "./quality-badge-preview";

export function OnScreenTab() {
  const t = useT();
  const { settings, update } = useSettings();
  return (
    <>
      <Section
        title={t("Stream quality in player")}
        subtitle={t("Show what you are actually watching, under the title in the player.")}
      >
        <ToggleRow
          label={t("Show stream quality under the title")}
          sub={t("Displays the resolution, HDR format and audio (e.g. 4K · Dolby Vision · TrueHD 7.1) under the movie or episode title while playing. Off by default.")}
          value={settings.showQualityInfo}
          onChange={(v) => update({ showQualityInfo: v })}
        />
        <SettingRow
          label={t("Quality badge style")}
          desc={t("How the 4K and HDR tags beside the title look. Bar draws a vertical accent line and reveals each line as it appears; Chips shows small outlined pills that slide in.")}
        >
          <div className="flex w-full flex-col gap-3">
            <Segmented
              value={settings.qualityBadgeStyle}
              options={[
                { value: "bar", label: t("Bar") },
                { value: "chips", label: t("Chips") },
              ]}
              onChange={(v) => update({ qualityBadgeStyle: v as "bar" | "chips" })}
            />
            <QualityBadgePreview style={settings.qualityBadgeStyle} />
          </div>
        </SettingRow>
      </Section>

      <Section
        title={t("Player chrome")}
        subtitle={t("Small controls that sit around playback rather than in the picture.")}
      >
        <ToggleRow
          label={t("Show controls when pausing with keyboard")}
          sub={t("Show the player controls when you pause or resume using the keyboard. Turn off to keep them hidden so they do not cover subtitles.")}
          value={settings.keyboardPauseShowsControls}
          onChange={(v) => update({ keyboardPauseShowsControls: v })}
        />
        <ToggleRow
          label={t("Sleep timer in the top bar")}
          sub={t("Adds a timer button next to Downloads. Set a time or episode limit from anywhere; playback pauses when it runs out.")}
          value={settings.navbarSleepTimer}
          onChange={(v) => update({ navbarSleepTimer: v })}
        />
      </Section>
    </>
  );
}
