import { Dropdown } from "@/components/dropdown";
import { Clock, UserCheck } from "lucide-react";
import { useProfiles } from "@/lib/profiles";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { Segmented } from "../shared";
import { SettingGroup, SettingRow } from "../kit";

const INTERVALS = [
  { value: "launch", label: "Every launch" },
  { value: "15m", label: "Every 15 min" },
  { value: "30m", label: "Every 30 min" },
  { value: "never", label: "Never" },
] as const;

type Interval = (typeof INTERVALS)[number]["value"];

export function StartupDefaults() {
  const t = useT();
  const { settings, update } = useSettings();
  const { profiles } = useProfiles();
  if (profiles.length <= 1) return null;
  const interval = settings.profilePromptInterval ?? "launch";
  const defaultId = settings.defaultProfileId ?? "";

  return (
    <SettingGroup label={t("Startup & default")}>
      <SettingRow
        icon={<Clock size={16} strokeWidth={2} />}
        label={t("Who's watching")}
        desc={t("How often the profile screen appears when you have more than one profile.")}
      >
        <Segmented<Interval>
          value={interval}
          options={INTERVALS.map((o) => ({ ...o, label: t(o.label) }))}
          onChange={(v) => update({ profilePromptInterval: v })}
        />
      </SettingRow>
      {profiles.length > 1 && (
        <SettingRow
          icon={<UserCheck size={16} strokeWidth={2} />}
          label={t("Start as")}
          desc={t("Skip Who's watching and always start as this profile.")}
          tip={t("Skip Who's watching and always start as this profile. PIN-locked profiles can't be a default.")}
        >
          <Dropdown
            size="sm"
            value={defaultId}
            onChange={(v) => update({ defaultProfileId: v })}
            className="w-[200px] shrink-0"
            options={[
              { value: "", label: t("Ask each time") },
              ...profiles.filter((p) => !p.passwordHash).map((p) => ({ value: p.id, label: p.name })),
            ]}
          />
        </SettingRow>
      )}
    </SettingGroup>
  );
}
