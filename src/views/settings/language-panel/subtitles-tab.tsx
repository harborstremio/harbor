import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { Section, ToggleRow } from "../shared";
import { LanguagesPicker } from "../streaming-panel";
import { DualSubtitleSection } from "./dual-subtitle-section";

export function SubtitlesLanguageTab() {
  const { settings, update } = useSettings();
  const t = useT();
  return (
    <>
      <Section
        title={t("Subtitle languages")}
        subtitle={t("When playback starts, Harbor finds and loads a subtitle in one of these languages. The first available match wins, so put your main language first.")}
      >
        <LanguagesPicker
          value={settings.preferredSubLangs}
          onChange={(langs) => update({ preferredSubLangs: langs })}
        />
      </Section>

      <DualSubtitleSection />

      <Section
        title={t("Choosing a track")}
        subtitle={t("Which subtitle Harbor lands on when more than one is available.")}
      >
        <ToggleRow
          label={t("Prefer embedded subtitles")}
          sub={t("When the file ships its own subtitle track, keep it selected instead of switching to a downloaded one. Embedded tracks are usually the best synced.")}
          value={settings.preferEmbeddedSubs}
          onChange={(v) => update({ preferEmbeddedSubs: v })}
        />
        <ToggleRow
          label={t("Forced subs with native audio")}
          sub={t("When the audio already matches your subtitle language, pick a forced track (foreign dialogue and signs only) instead of full subtitles. If the file has no forced track, subtitles stay off.")}
          value={settings.forcedSubsWhenNativeAudio}
          onChange={(v) => update({ forcedSubsWhenNativeAudio: v })}
        />
        <ToggleRow
          label={t("Upgrade subtitles when better ones load")}
          sub={t("Downloaded subtitles can arrive a moment after playback starts. Leave this off to keep whatever subtitle is already showing; turn it on to switch to the best language match as soon as it loads.")}
          value={settings.subtitleAutoUpgrade}
          onChange={(v) => update({ subtitleAutoUpgrade: v })}
        />
      </Section>

      <Section
        title={t("Turning them on")}
        subtitle={t("Whether subtitles are showing the moment a video starts.")}
      >
        <ToggleRow
          label={t("Start with subtitles off")}
          sub={t("Harbor still finds and loads subtitles so they're one click away in the player, it just won't turn them on automatically.")}
          value={settings.subtitlesOffByDefault}
          onChange={(v) => update({ subtitlesOffByDefault: v })}
        />
        <ToggleRow
          label={t("Choose subtitles before playback")}
          sub={t("After you pick a source, show a subtitle picker so you can set the exact track and language before the video starts. Off by default, Harbor keeps picking one for you automatically.")}
          value={settings.subtitlePreselect}
          onChange={(v) => update({ subtitlePreselect: v })}
        />
        <ToggleRow
          label={t("Subtitle indicator dot")}
          sub={t("Shows a small green dot on the player's subtitle button while a subtitle track is active. Turn it off if you would rather keep the controls clean.")}
          value={settings.showSubtitleIndicator}
          onChange={(v) => update({ showSubtitleIndicator: v })}
        />
      </Section>
    </>
  );
}
