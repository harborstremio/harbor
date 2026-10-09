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
        subtitle={t("Harbor looks for subtitles in this order. Put your preferred language first.")}
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
          sub={t("Keep the subtitle track included in the video file instead of switching to a downloaded one.")}
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
          sub={t("Switch to a better language match if it arrives after playback starts. Leave off to keep the current track.")}
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
          sub={t("Find subtitles without showing them automatically. You can turn them on in the player.")}
          value={settings.subtitlesOffByDefault}
          onChange={(v) => update({ subtitlesOffByDefault: v })}
        />
        <ToggleRow
          label={t("Choose subtitles before playback")}
          sub={t("Choose the exact track and language after picking a source, before the video starts.")}
          value={settings.subtitlePreselect}
          onChange={(v) => update({ subtitlePreselect: v })}
        />
        <ToggleRow
          label={t("Subtitle indicator dot")}
          sub={t("Show a green dot on the player's subtitle button when subtitles are active.")}
          value={settings.showSubtitleIndicator}
          onChange={(v) => update({ showSubtitleIndicator: v })}
        />
      </Section>
    </>
  );
}
