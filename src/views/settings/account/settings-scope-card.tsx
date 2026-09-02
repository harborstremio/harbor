import { SlidersHorizontal } from "lucide-react";
import { useProfiles } from "@/lib/profiles";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { Segmented } from "../shared";
import { SettingRow } from "../kit";

const OPTIONS = [
  ["shared", "Share settings with all profiles", "One set of preferences everyone on this Harbor uses."],
  ["independent", "Use independent settings for this profile", "This profile keeps its own preferences, separate from everyone else."],
] as const;

const SCOPES = [
  { value: "shared", label: "Shared" },
  { value: "independent", label: "Independent" },
] as const;

type Scope = (typeof SCOPES)[number]["value"];

export function SettingsScopeCard() {
  const t = useT();
  const { activeProfile, updateProfile } = useProfiles();
  const { setSettingsLinked } = useSettings();
  if (!activeProfile) return null;
  const linked = activeProfile.settingsLinked !== false;
  const setScope = (next: boolean) => {
    if (next === linked) return;
    setSettingsLinked(next);
    updateProfile(activeProfile.id, { settingsLinked: next });
  };
  const active = linked ? OPTIONS[0] : OPTIONS[1];

  return (
    <SettingRow
      icon={<SlidersHorizontal size={16} strokeWidth={2} />}
      label={t("Settings for this profile")}
      desc={t(active[1])}
      tip={t(active[2])}
    >
      <Segmented<Scope>
        value={linked ? "shared" : "independent"}
        options={SCOPES.map((o) => ({ ...o, label: t(o.label) }))}
        onChange={(v) => setScope(v === "shared")}
      />
    </SettingRow>
  );
}
