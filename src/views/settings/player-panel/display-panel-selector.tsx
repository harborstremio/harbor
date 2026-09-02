import { Monitor } from "lucide-react";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { SettingRow } from "../kit";
import { Segmented } from "../shared";

export function DisplayPanelSelector() {
  const { settings, update } = useSettings();
  const t = useT();
  return (
    <SettingRow
      icon={<Monitor size={16} />}
      label={t("Display panel")}
      desc={t("Pick OLED for perfect-black panels to unlock shadow detail in tonemapped HDR.")}
    >
      <Segmented
        value={settings.playerDisplayPanel}
        options={[
          { value: "auto", label: t("Auto") },
          { value: "oled", label: "OLED" },
          { value: "lcd", label: "LCD" },
        ]}
        onChange={(playerDisplayPanel) => update({ playerDisplayPanel })}
      />
    </SettingRow>
  );
}
