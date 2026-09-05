import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { ROW_ACTION_PRIMARY, SettingRow } from "../kit";
import { Section, ToggleRow, useSettingsActiveContext } from "../shared";
import { focusJumpTarget } from "./jump-focus";

export function XrayTab() {
  const t = useT();
  const { settings, update } = useSettings();
  const { setActive } = useSettingsActiveContext();
  return (
    <Section
      title={t("X-Ray (experimental)")}
      subtitle={t("Amazon-style X-Ray: open the cast while you watch and tap anyone for their bio and everything they have been in. On-device face matching to show who is on screen is coming next. Off by default.")}
    >
      <ToggleRow
        label={t("Enable X-Ray")}
        sub={t("Adds an X-Ray button in the player to see the full cast with photos and tap through to any actor. Needs a TMDB key for photos and filmographies.")}
        value={settings.xrayEnabled}
        onChange={(v) => update({ xrayEnabled: v })}
      />
      {settings.xrayEnabled && (
        <ToggleRow
          label={t("Scan who is on screen while playing")}
          sub={t("Periodically match faces in the current frame against the cast to show who is on screen now. On-device, nothing leaves your machine. Uses a little more CPU while playing.")}
          value={settings.xrayLiveScan}
          onChange={(v) => update({ xrayLiveScan: v })}
          warn={
            settings.xrayLiveScan
              ? t(
                  "Live face scanning loads on-device AI models and can significantly increase RAM, CPU, and GPU usage while playback is active. Turn it off if Harbor slows down or your device gets hot.",
                )
              : undefined
          }
        />
      )}
      {settings.xrayEnabled && !settings.tmdbKey.trim() && (
        <SettingRow
          label={t("X-Ray needs a TMDB key")}
          warn={t("X-Ray reads the cast and their photos from TMDB. Without a TMDB key there is no cast to match against. Add your free key under Library & metadata.")}
        >
          <button
            type="button"
            onClick={(e) => {
              const from = e.currentTarget;
              setActive("library");
              focusJumpTarget(from);
            }}
            className={ROW_ACTION_PRIMARY}
          >
            {t("Library & metadata")}
          </button>
        </SettingRow>
      )}
    </Section>
  );
}
