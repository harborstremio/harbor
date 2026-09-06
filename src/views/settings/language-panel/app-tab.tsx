import { useEffect, useRef, useState } from "react";
import { RotateCw } from "../icons";
import { Dropdown, type DropdownOption } from "@/components/dropdown";
import { tvFocus } from "@/lib/keyboard-navigation";
import { navOwnsFocus } from "@/lib/keyboard-navigation/geometry";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { ALL_LANGUAGE_NAMES } from "@/lib/subtitles/language";
import { Section, ToggleRow } from "../shared";
import { SettingRow } from "../kit";
import { usePageActions } from "../page-actions";
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
  const [imgLangsDraft, setImgLangsDraft] = useState(settings.tmdbImageLangs);
  const anchorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setLangDraft(settings.tmdbLanguage);
  }, [settings.tmdbLanguage]);
  useEffect(() => {
    setImgLangsDraft(settings.tmdbImageLangs);
  }, [settings.tmdbImageLangs]);
  const t = useT();
  const savedImgSig = settings.tmdbImageLangs.join(",");
  const draftImgSig = imgLangsDraft.join(",");
  const dirty = langDraft !== settings.tmdbLanguage || draftImgSig !== savedImgSig;
  const restoreFocus = () => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || !navOwnsFocus(active)) return;
    const trigger = anchorRef.current?.querySelector("button");
    if (trigger) tvFocus(trigger);
  };
  usePageActions(
    dirty
      ? [
          {
            id: `tmdb-lang-cancel:${settings.tmdbLanguage}|${savedImgSig}`,
            label: "Cancel",
            onSelect: () => {
              setLangDraft(settings.tmdbLanguage);
              setImgLangsDraft(settings.tmdbImageLangs);
              restoreFocus();
            },
          },
          {
            id: `tmdb-lang-apply:${langDraft}|${draftImgSig}`,
            label: "Apply and reload",
            tone: "primary",
            icon: <RotateCw size={18} strokeWidth={2.2} />,
            onSelect: () => update({ tmdbLanguage: langDraft, tmdbImageLangs: imgLangsDraft }),
          },
        ]
      : [],
  );
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
        <SettingRow
          wide
          label={t("Language")}
          desc={t("Untranslated text stays in English. Choose a language, then select Apply and reload.")}
        >
          <div ref={anchorRef}>
            <Dropdown
              value={langDraft}
              onChange={setLangDraft}
              options={[{ value: "", label: t("English (default)") }, ...TMDB_LANGUAGES]}
              className="w-[420px] max-w-full"
            />
          </div>
        </SettingRow>
        <ToggleRow
          label={t("Translate titles")}
          sub={t("Show translated names in the language selected above. Turn off to keep original titles.")}
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
      </Section>

      <Section
        title={t("Artwork")}
        subtitle={t("Posters, logos, and title art load in the first available language from this list. \"Original\" uses the title's own language. Needs a TMDB key.")}
      >
        <LanguagesPicker
          value={imgLangsDraft}
          onChange={setImgLangsDraft}
          options={IMAGE_LANG_OPTIONS}
          placeholder={t("Search languages")}
        />
      </Section>
    </>
  );
}
