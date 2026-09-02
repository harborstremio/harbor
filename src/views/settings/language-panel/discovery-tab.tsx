import { GitHubIcon } from "@/components/github-icon";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { Section, ToggleRow } from "../shared";
import { SettingRow } from "../kit";
import { LanguagesPicker } from "../streaming-panel";
import { HomeLanguagePicker } from "../home-language-picker";

export function DiscoveryLanguageTab() {
  const { settings, update } = useSettings();
  const t = useT();
  return (
    <>
      <Section
        title={t("Home catalogs")}
        subtitle={t("Only show titles in these original languages on the Home rows. Leave all off to show everything.")}
      >
        <HomeLanguagePicker />
        <ToggleRow
          label={t("Favour titles from where you are")}
          sub={t(
            "Nudge the daily Home rows toward your region and languages so local releases surface instead of the same worldwide list. Turn it off to see the unweighted picks.",
          )}
          value={settings.feedLocaleBias}
          onChange={(v) => update({ feedLocaleBias: v })}
        />
      </Section>

      <Section
        title={t("Stream ranking")}
        subtitle={t("Sources in these languages sort to the top of the picker.")}
      >
        <LanguagesPicker
          value={settings.preferredLanguages}
          onChange={(langs) => update({ preferredLanguages: langs })}
        />
        <ToggleRow
          label={t("Only show streams in my languages")}
          sub={t("Hides streams with no detected preferred language. Multi-audio releases count as a match.")}
          value={settings.requirePreferredLanguage}
          onChange={(v) => update({ requirePreferredLanguage: v })}
        />
      </Section>

      <Section title={t("Help translate Harbor")}>
        <SettingRow
          label={t("Fill the gaps")}
          desc={t("Harbor was built in English. Multi-language support is partial, so your addons usually catch what Harbor's own filters miss. If you speak another language and want to help, the source is open.")}
        >
          <button
            type="button"
            onClick={() => openUrl("https://github.com/harborstremio/harbor")}
            className="harbor-press-pop flex h-9 shrink-0 items-center gap-2 rounded-md bg-canvas px-4 text-[12.5px] font-semibold text-ink transition-colors hover:bg-surface"
          >
            <GitHubIcon size={14} strokeWidth={2.2} />
            {t("Contribute on GitHub")}
          </button>
        </SettingRow>
      </Section>
    </>
  );
}
