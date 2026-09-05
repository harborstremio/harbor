import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { CROP_PRESETS } from "@/views/player/hooks/use-video-fill";
import { AspectPreview } from "../aspect-preview";
import { ROW_ACTION, SettingRow } from "../kit";
import { Section, Segmented, useSettingsActiveContext } from "../shared";
import { focusJumpTarget } from "./jump-focus";

export function AspectTab() {
  const t = useT();
  const { settings, update } = useSettings();
  const { setActive } = useSettingsActiveContext();
  return (
    <Section
      title={t("Aspect ratio")}
      subtitle={t("Default picture shape on the mpv engine. Fit keeps the source as-is with any black bars; the rest stretch or crop to fill, handy for old 4:3 shows on a widescreen TV.")}
    >
      <Segmented
        value={settings.cropMode}
        options={CROP_PRESETS.map((m) => ({ value: m.id, label: m.label }))}
        onChange={(v) => update({ cropMode: v })}
      />
      <AspectPreview mode={settings.cropMode} />
      <SettingRow
        wide
        label={t("Change the ratio while watching")}
        desc={t("Want to change the ratio mid-playback? The live aspect button is hidden by default to keep the player tidy.")}
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={(e) => {
              const from = e.currentTarget;
              setActive("playerLayout");
              focusJumpTarget(from);
            }}
            className={ROW_ACTION}
          >
            {t("Turn it on in Player layout")}
          </button>
        </div>
      </SettingRow>
    </Section>
  );
}
