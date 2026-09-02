import { useEffect, useState } from "react";
import { Globe, RotateCw } from "lucide-react";
import { Dropdown, type DropdownOption } from "@/components/dropdown";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { ALL_LANGUAGE_NAMES } from "@/lib/subtitles/language";
import { Section, ToggleRow } from "../shared";
import { SettingGroup, SettingRow } from "../kit";
import { LanguagesPicker } from "../streaming-panel";
import { RegionField } from "../region-cascade";
import { DisplayLanguageSection } from "./display-language-section";

const IMAGE_LANG_OPTIONS = ["Original", ...ALL_LANGUAGE_NAMES];

const TMDB_LANGUAGES: DropdownOption[] = [
  { value: "es-ES", label: "Español (España)" },
  { value: "es-MX", label: "Español (Latinoamérica)" },
  { value: "fr-FR", label: "Français" },
  { value: "de-DE", label: "Deutsch" },
  { value: "it-IT", label: "Italiano" },
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "pt-PT", label: "Português (Portugal)" },
  { value: "ja-JP", label: "日本語" },
  { value: "ko-KR", label: "한국어" },
  { value: "zh-CN", label: "中文 (简体)" },
  { value: "ar-SA", label: "العربية" },
  { value: "tr-TR", label: "Türkçe" },
  { value: "ru-RU", label: "Русский" },
  { value: "hi-IN", label: "हिन्दी" },
  { value: "pl-PL", label: "Polski" },
  { value: "nl-NL", label: "Nederlands" },
  { value: "uk-UA", label: "Українська" },
];

export function AppLanguageTab() {
  const { settings, update } = useSettings();
  const [langDraft, setLangDraft] = useState(settings.tmdbLanguage);
  useEffect(() => {
    setLangDraft(settings.tmdbLanguage);
  }, [settings.tmdbLanguage]);
  const t = useT();
  return (
    <>
      <Section title={t("Region & language")}>
        <SettingRow
          wide
          label={t("Where you watch from")}
          desc={t(
            "Sets streaming availability and the Now Playing release window. Pick a country and Harbor offers to match the interface, metadata, subtitle, and audio languages to it.",
          )}
        >
          <RegionField />
        </SettingRow>
      </Section>

      <DisplayLanguageSection />

      <Section
        title={t("Titles and descriptions")}
        subtitle={t("The language TMDB serves show and film text in. Separate from the interface language above.")}
      >
        <SettingRow icon={<Globe size={16} strokeWidth={2} />} label={t("Language")}>
          <Dropdown
            value={langDraft}
            onChange={setLangDraft}
            options={[{ value: "", label: t("English (default)") }, ...TMDB_LANGUAGES]}
            className="w-full max-w-[240px]"
          />
        </SettingRow>
        <SettingGroup label={t("What gets translated")}>
          <ToggleRow
            label={t("Translate titles")}
            sub={t("On shows titles in your metadata language (English by default). Off keeps each title's original language, so anime and foreign films show their native names.")}
            value={settings.translateTitles}
            onChange={(v) => update({ translateTitles: v })}
          />
          <ToggleRow
            label={t("Translate overviews")}
            sub={t("Translate plot descriptions and taglines into the language above. Turn off to keep English overviews.")}
            lockReason={
              settings.tmdbLanguage === ""
                ? t("Pick a metadata language above to translate overviews.")
                : undefined
            }
            value={settings.translateDescriptions}
            onChange={(v) => update({ translateDescriptions: v })}
          />
        </SettingGroup>
        {langDraft !== settings.tmdbLanguage && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => update({ tmdbLanguage: langDraft })}
              className="harbor-press-pop flex h-9 items-center gap-1.5 rounded-md bg-ink px-4 text-[12.5px] font-semibold text-canvas"
            >
              <RotateCw size={13} strokeWidth={2.2} />
              {t("Apply and reload")}
            </button>
            <button
              type="button"
              onClick={() => setLangDraft(settings.tmdbLanguage)}
              className="harbor-press-pop h-9 rounded-md px-3 text-[12.5px] font-medium text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
            >
              {t("Cancel")}
            </button>
          </div>
        )}
      </Section>

      <Section
        title={t("Artwork")}
        subtitle={t("Posters, logos, and title art load in the first available language from this list. \"Original\" uses the title's own language. Needs a TMDB key.")}
      >
        <LanguagesPicker
          value={settings.tmdbImageLangs}
          onChange={(langs) => update({ tmdbImageLangs: langs })}
          options={IMAGE_LANG_OPTIONS}
          placeholder={t("Search languages")}
        />
      </Section>
    </>
  );
}
