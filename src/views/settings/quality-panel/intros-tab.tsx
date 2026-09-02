import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { SettingRow } from "../kit";
import { Section, Segmented, ToggleRow } from "../shared";

export function IntrosTab() {
  const t = useT();
  const { settings, update } = useSettings();
  return (
      <Section
        title={t("Skip intros & credits")}
        subtitle={t("Harbor finds intro and credits timing from AniSkip, TheIntroDB, and the file's own chapters, then shows a Skip button at the right moment.")}
      >
        <ToggleRow
          label={t("Show the Skip button")}
          sub={t("Show a Skip Intro / Skip Credits button when Harbor detects one. Turn this off to never show it. You can also tap the X on the button to dismiss a wrong one for the rest of the episode.")}
          value={settings.showSkipButton}
          onChange={(v) => update({ showSkipButton: v })}
        />
        <ToggleRow
          label={t("Auto-skip intros")}
          sub={t("Jump past openings automatically the moment one starts. The Skip button still shows either way, and seeking back into an intro replays it without skipping again.")}
          value={settings.autoSkipIntro}
          onChange={(v) => update({ autoSkipIntro: v })}
        />
        <ToggleRow
          label={t("Auto-skip recaps")}
          sub={t("Automatically jump past recap segments.")}
          value={settings.autoSkipRecap}
          onChange={(v) => update({ autoSkipRecap: v })}
        />
        <ToggleRow
          label={t("Auto-skip credit outros")}
          sub={t("Automatically skip ending credits and trigger the next episode countdown immediately.")}
          value={settings.autoSkipOutro}
          onChange={(v) => update({ autoSkipOutro: v })}
        />
        {settings.showSkipButton && (
          <SettingRow
            wide
            label={t("Auto-hide the Skip button after")}
            desc={t("Hides the button on its own after a few seconds so a wrong one doesn't sit there the whole episode.")}
          >
            <Segmented
              value={String(settings.skipButtonHideSec)}
              options={[
                { value: "0", label: t("Off") },
                { value: "5", label: t("5s") },
                { value: "10", label: t("10s") },
                { value: "15", label: t("15s") },
                { value: "30", label: t("30s") },
              ]}
              onChange={(v) => update({ skipButtonHideSec: Number(v) })}
            />
          </SettingRow>
        )}
      </Section>
  );
}
