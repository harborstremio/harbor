import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { Section, ToggleRow } from "./shared";

export function SearchShortcutsSection() {
  const { settings, update } = useSettings();
  const t = useT();
  return <Section title={t("Search shortcuts")}>
    <ToggleRow
      label={t("Steam search shortcut")}
      sub={t("Type “st ” or “st:” to search the Steam store. Turn off to use normal Harbor search for these queries.")}
      value={settings.steamSearchShortcut !== false}
      onChange={steamSearchShortcut => update({ steamSearchShortcut })}
    />
  </Section>;
}
