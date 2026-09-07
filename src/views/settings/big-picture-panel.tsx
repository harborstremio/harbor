import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { Section, Segmented, ToggleRow } from "./shared";
import { SettingRow } from "./kit";
import { BP_OVERSCAN_VALUES, SOUND_VALUES, bpOverscanLabel, bpSoundLabel } from "../big-picture/bp-settings-catalog";

export function BigPicturePanel() {
  const t = useT();
  const { settings, update } = useSettings();

  const overscanOptions: { value: string; label: string }[] = BP_OVERSCAN_VALUES.map((v) => ({
    value: v,
    label: bpOverscanLabel(t, Number(v)),
  }));

  return (
    <div className="harbor-cascade flex flex-col gap-10">
      <Section title={t("Launch")}>
        <ToggleRow
          label={t("Open in Big Picture")}
          sub={t("Start Harbor in the couch-friendly Big Picture layout whenever the app opens.")}
          value={settings.bigPictureAutoStart}
          onChange={(v) => update({ bigPictureAutoStart: v })}
        />
      </Section>

      <Section title={t("Interface")}>
        <ToggleRow
          label={t("Show the Big Picture button")}
          sub={t("Puts a Big Picture button in the top bar so you can switch to the ten-foot layout in one click. The keyboard shortcut keeps working either way.")}
          value={settings.bigPictureButton}
          onChange={(v) => update({ bigPictureButton: v })}
        />
        <SettingRow wide label={t("Interface sounds")}>
          <Segmented
            value={settings.bigPictureSound}
            options={SOUND_VALUES.map((v) => ({ value: v, label: bpSoundLabel(t, v) }))}
            onChange={(v) => update({ bigPictureSound: v })}
          />
        </SettingRow>
      </Section>

      <Section title={t("Picture")}>
        <ToggleRow
          label={t("Animated backdrop")}
          sub={t("Animate backdrop art on Big Picture screens.")}
          value={settings.bigPictureMosaic}
          onChange={(v) => update({ bigPictureMosaic: v })}
        />
        <SettingRow wide label={t("Edge margin")}>
          <Segmented
            value={settings.bigPictureOverscan === null ? "0" : String(settings.bigPictureOverscan)}
            options={overscanOptions}
            onChange={(v) => update({ bigPictureOverscan: Number(v) })}
          />
        </SettingRow>
      </Section>
    </div>
  );
}