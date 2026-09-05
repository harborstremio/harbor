import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import type { SyncIndicatorPosition } from "@/lib/sync-toast-position";
import { Section, Segmented, ToggleRow } from "./shared";
import { SettingRow } from "./kit";

const POSITIONS: ReadonlyArray<{ value: SyncIndicatorPosition; label: string }> = [
  { value: "top-left", label: "Top left" },
  { value: "top-right", label: "Top right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-right", label: "Bottom right" },
  { value: "bottom-center", label: "Bottom center" },
];

export function SyncIndicatorSetting() {
  const { settings, update } = useSettings();
  const t = useT();
  return (
    <Section
      title={t("Sync indicator")}
      subtitle={t("The badge that appears over the player when an episode syncs to your tracker.")}
    >
      <ToggleRow
        label={t("Show sync indicator")}
        sub={t("Turn off to hide the sync badge during playback.")}
        value={settings.syncIndicator}
        onChange={(v) => update({ syncIndicator: v })}
      />
      {settings.syncIndicator && (
        <SettingRow
          wide
          label={t("Position")}
          desc={t("Corners keep it clear of subtitles along the bottom.")}
        >
          <Segmented
            value={settings.syncIndicatorPosition}
            options={POSITIONS.map((o) => ({ ...o, label: t(o.label) }))}
            onChange={(v) => update({ syncIndicatorPosition: v })}
          />
        </SettingRow>
      )}
    </Section>
  );
}
