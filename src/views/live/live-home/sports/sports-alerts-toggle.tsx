import { Bell } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { ToggleRow } from "@/views/settings/shared";

/** The "Sports alerts" switch; saved at once, apart from the league picks. */
export function SportsAlertsToggle() {
  const t = useT();
  const { settings, update } = useSettings();
  return (
    <ToggleRow
      label={t("Sports alerts")}
      sub={t("Pop-ups for your teams, your athletes and Top 10 games.")}
      value={settings.sportsAlerts}
      onChange={(v) => update({ sportsAlerts: v })}
      leading={<Bell size={16} className="text-ink-subtle" />}
    />
  );
}
