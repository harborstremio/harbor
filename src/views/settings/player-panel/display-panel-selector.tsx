import { Monitor } from "lucide-react";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { SettingRow } from "../kit";
import { Segmented } from "../shared";
import { DisplayPanelPreview } from "./display-panel-preview";

export function DisplayPanelSelector() {
  const { settings, update } = useSettings();
  const t = useT();
  return (
    <SettingRow
      icon={<Monitor size={18} />}
      label={t("Display panel")}
      desc={t("Pick OLED for perfect-black panels to unlock shadow detail in tonemapped HDR.")}
    >
      <div className="flex w-full flex-col gap-3">
        <Segmented
          value={settings.playerDisplayPanel}
          options={[
            { value: "auto", label: t("Auto") },
            { value: "oled", label: "OLED" },
            { value: "lcd", label: "LCD" },
          ]}
          onChange={(playerDisplayPanel) => update({ playerDisplayPanel })}
        />
        <DisplayPanelPreview panel={settings.playerDisplayPanel} />
      </div>
    </SettingRow>
  );
}
