import { Nested, Picker, RowIcon } from "../theme-panel/display-section";
import { SettingGroup, SettingRow } from "../kit";
import { Film, MousePointerClick, PlayCircle, Volume2 } from "lucide-react";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { Section, ToggleRow } from "../shared";

export function TrailersTab() {
  const t = useT();
  const { settings, update } = useSettings();
  return (
    <Section
      title={t("Trailer quality")}
      subtitle={t("How sharp trailers play, and when they start on their own.")}
    >
      <SettingGroup>
        <SettingRow
          icon={<Film size={16} strokeWidth={1.9} />}
          label={t("Playback quality")}
          desc={t("Auto follows your connection speed.")}
          tip={t("How sharp trailers play. Auto follows your connection speed, and the Watch Trailer button targets 1080p. Pick 1080p or Best (up to 4K when the source has it) to force higher. 1080p and Best merge separate video and audio with the bundled ffmpeg, so they take a beat longer to start.")}
        >
          <Picker
            value={settings.trailerQuality}
            options={[
              { value: "auto", label: t("Auto") },
              { value: "360p", label: "360p" },
              { value: "720p", label: "720p" },
              { value: "1080p", label: "1080p" },
              { value: "best", label: t("Best") },
            ]}
            onChange={(v) => update({ trailerQuality: v as "auto" | "360p" | "720p" | "1080p" | "best" })}
          />
        </SettingRow>
      </SettingGroup>

      <SettingGroup label={t("On detail pages")}>
        <ToggleRow
          label={t("Auto-play trailer on detail pages")}
          sub={t("Plays a muted trailer in the backdrop when you open a title. Click the speaker to unmute. Falls back to the image when no trailer is available.")}
          value={settings.detailTrailerAutoplay}
          onChange={(v) => update({ detailTrailerAutoplay: v })}
          leading={<RowIcon on={settings.detailTrailerAutoplay}><PlayCircle size={16} strokeWidth={2.2} /></RowIcon>}
        />
        {settings.detailTrailerAutoplay && (
          <Nested>
            <ToggleRow
              label={t("Start trailers with audio")}
              sub={t("Detail page trailers begin unmuted. Falls back to muted if the browser blocks sound until you interact.")}
              value={settings.detailTrailerAudio}
              onChange={(v) => update({ detailTrailerAudio: v })}
              leading={<RowIcon on={settings.detailTrailerAudio}><Volume2 size={16} strokeWidth={2.2} /></RowIcon>}
            />
          </Nested>
        )}
        <ToggleRow
          label={t("Scroll up for the trailer")}
          sub={t("From the very top of a detail page, keep scrolling up to open the trailer. Off by default.")}
          value={settings.scrollUpTrailer}
          onChange={(v) => update({ scrollUpTrailer: v })}
          leading={<RowIcon on={settings.scrollUpTrailer}><MousePointerClick size={16} strokeWidth={2.2} /></RowIcon>}
        />
      </SettingGroup>
    </Section>
  );
}
