import { artworkImportPolicy } from "@/lib/games/imported-artwork";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { Section, Segmented, ToggleRow } from "./shared";
import { SettingRow } from "./kit";

export function GameMetadataSetting() {
  const { settings, update } = useSettings(), t = useT();
  const policy=artworkImportPolicy(settings);
  return <Section title={t("Games")}>
    <SettingRow label={t("games.details.agePreference")} desc={t("games.details.agePreferenceNote")}>
      <Segmented value={settings.gameAgeRatingAgency ?? "ESRB"} options={[{ value: "ESRB", label: "ESRB" }, { value: "PEGI", label: "PEGI" }]} onChange={value => update({ gameAgeRatingAgency: value === "PEGI" ? "PEGI" : "ESRB" })}/>
    </SettingRow>
    <SettingRow label={t("games.artwork.selectionSetting")} desc={t("games.artwork.selectionNote")} wide>
      <Segmented value={policy.selection} options={(["first","random","manual"] as const).map(value=>({value,label:t(`games.artwork.policy.${value}`)}))} onChange={value=>update({gameArtworkSelection:value as typeof policy.selection})}/>
    </SettingRow>
    <ToggleRow label={t("games.artwork.screenshotsSetting")} sub={t("games.artwork.screenshotsNote")} value={policy.screenshots} onChange={gameArtworkScreenshots=>update({gameArtworkScreenshots})}/>
    <ToggleRow label={t("games.artwork.iconSetting")} sub={t("games.artwork.iconNote")} value={policy.coverIcon} onChange={gameArtworkCoverIcon=>update({gameArtworkCoverIcon})}/>
  </Section>;
}
