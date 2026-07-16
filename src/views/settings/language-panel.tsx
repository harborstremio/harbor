import { Github } from "@/components/icons/github-icon";
import { useState } from "react";
import { Dropdown, type DropdownOption } from "@/components/dropdown";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { Section, ToggleRow } from "./shared";
import { SubtitleStylePanel } from "./player-panel";
import { LanguagesPicker } from "./streaming-panel";
import { DisplayLanguageSection } from "./language-panel/display-language-section";
import { ALL_LANGUAGE_NAMES } from "@/lib/subtitles/language";

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

export function LanguagePanel() {
  const { settings, update } = useSettings();
  const t = useT();
  const [blockDraft, setBlockDraft] = useState(settings.trackBlockWords.join(", "));
  return (
    <>
      <DisplayLanguageSection />
      <Section
        title={t("Subtitle languages")}
        subtitle={t(
          "When playback starts, Harbor automatically finds and loads a subtitle in one of these languages, so you never have to search by hand. The first available match wins, so put your main language first.",
        )}
      >
        <LanguagesPicker
          value={settings.preferredSubLangs}
          onChange={(langs) => update({ preferredSubLangs: langs })}
        />
        <ToggleRow
          label={t("Start with subtitles off")}
          sub={t(
            "Harbor still finds and loads subtitles so they're one click away in the player, it just won't turn them on automatically.",
          )}
          value={settings.subtitlesOffByDefault}
          onChange={(v) => update({ subtitlesOffByDefault: v })}
        />
        <ToggleRow
          label={t("Prefer embedded subtitles")}
          sub={t(
            "When the file ships its own subtitle track, keep it selected instead of switching to a downloaded one. Embedded tracks are usually the best synced.",
          )}
          value={settings.preferEmbeddedSubs}
          onChange={(v) => update({ preferEmbeddedSubs: v })}
        />
        <ToggleRow
          label={t("Forced subs with native audio")}
          sub={t(
            "When the audio already matches your subtitle language, pick a forced track (foreign dialogue and signs only) instead of full subtitles. If the file has no forced track, subtitles stay off.",
          )}
          value={settings.forcedSubsWhenNativeAudio}
          onChange={(v) => update({ forcedSubsWhenNativeAudio: v })}
        />
        <ToggleRow
          label={t("Upgrade subtitles when better ones load")}
          sub={t(
            "Downloaded subtitles can arrive a moment after playback starts. Leave this off to keep whatever subtitle is already showing; turn it on to switch to the best language match as soon as it loads.",
          )}
          value={settings.subtitleAutoUpgrade}
          onChange={(v) => update({ subtitleAutoUpgrade: v })}
        />
        <ToggleRow
          label={t("Choose subtitles before playback")}
          sub={t(
            "After you pick a source, show a subtitle picker so you can set the exact track and language before the video starts. Off by default, Harbor keeps picking one for you automatically.",
          )}
          value={settings.subtitlePreselect}
          onChange={(v) => update({ subtitlePreselect: v })}
        />
        <div className="flex flex-col gap-1.5 pt-1">
          <p className="text-[13.5px] font-medium text-ink">
            {t("Never auto-select tracks containing")}
          </p>
          <p className="text-[12px] leading-relaxed text-ink-subtle">
            {t(
              "Comma-separated words. Audio or subtitle tracks whose name matches any of these are skipped during automatic selection. You can still pick them by hand in the player.",
            )}
          </p>
          <input
            type="text"
            value={blockDraft}
            onChange={(e) => {
              setBlockDraft(e.target.value);
              update({
                trackBlockWords: e.target.value
                  .split(",")
                  .map((w) => w.trim())
                  .filter(Boolean),
              });
            }}
            placeholder={t("commentary, descriptive")}
            className="h-11 w-full max-w-[340px] rounded-xl border border-edge-soft bg-canvas/40 px-3.5 text-[13.5px] text-ink outline-none transition-colors focus:border-edge"
          />
        </div>
      </Section>

      <Section
        title={t("Subtitle style")}
        subtitle={t("How subtitles look during playback. Live preview below.")}
      >
        <SubtitleStylePanel />
      </Section>

      <Section
        title={t("Metadata language")}
        subtitle={t(
          "Titles, overviews, and taglines from TMDB display in this language when a translation exists. Needs a TMDB key.",
        )}
      >
        <Dropdown
          value={settings.tmdbLanguage}
          onChange={(v) => update({ tmdbLanguage: v })}
          options={[{ value: "", label: t("English (default)") }, ...TMDB_LANGUAGES]}
          className="w-full max-w-[340px]"
        />
        <ToggleRow
          label={t("Translate titles")}
          sub={t(
            "On shows titles in your metadata language (English by default). Off keeps each title's original language, so anime and foreign films show their native names.",
          )}
          value={settings.translateTitles}
          onChange={(v) => update({ translateTitles: v })}
        />
        {settings.tmdbLanguage !== "" && (
          <ToggleRow
            label={t("Translate overviews")}
            sub={t(
              "Translate plot descriptions and taglines into the language above. Turn off to keep English overviews.",
            )}
            value={settings.translateDescriptions}
            onChange={(v) => update({ translateDescriptions: v })}
          />
        )}
      </Section>

      <Section
        title={t("Image languages")}
        subtitle={t(
          'Posters, logos, and title art load in the first available language from this list, falling back down the order. "Original" uses the title\'s own language. Put your main language first. Needs a TMDB key.',
        )}
      >
        <LanguagesPicker
          value={settings.tmdbImageLangs}
          onChange={(langs) => update({ tmdbImageLangs: langs })}
          options={IMAGE_LANG_OPTIONS}
          placeholder={t("Search languages")}
        />
      </Section>

      <Section
        title={t("Audio languages")}
        subtitle={t(
          "When a release ships multiple audio tracks, Harbor selects the first match from this list.",
        )}
      >
        <LanguagesPicker
          value={settings.preferredAudioLangs}
          onChange={(langs) => update({ preferredAudioLangs: langs })}
        />
      </Section>

      <Section
        title={t("Preferred languages")}
        subtitle={t("Streams in these languages rank first. Toggle below to drop everything else.")}
      >
        <LanguagesPicker
          value={settings.preferredLanguages}
          onChange={(langs) => update({ preferredLanguages: langs })}
        />
        <ToggleRow
          label={t("Only show streams in my languages")}
          sub={t(
            "Hides streams with no detected preferred language. Multi-audio releases count as a match.",
          )}
          value={settings.requirePreferredLanguage}
          onChange={(v) => update({ requirePreferredLanguage: v })}
        />
        <div className="mt-2 flex flex-col gap-3 rounded-xl border border-edge-soft bg-canvas/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] leading-relaxed text-ink-muted sm:max-w-[480px]">
            {t(
              "Heads up: Harbor was built in English. Multi-language support is partial, so your addons usually catch what Harbor's own filters miss. If you speak another language and want to help fill the gaps, the source is open.",
            )}
          </p>
          <button
            onClick={() => openUrl("https://github.com/harborstremio/harbor")}
            className="flex shrink-0 items-center gap-2 self-start rounded-full border border-edge-soft px-4 py-2 text-[12.5px] font-semibold text-ink transition-colors hover:border-edge sm:self-auto"
          >
            <Github size={13} strokeWidth={2.2} />
            {t("Contribute on GitHub")}
          </button>
        </div>
      </Section>
    </>
  );
}
