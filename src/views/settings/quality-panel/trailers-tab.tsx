import { Dropdown } from "@/components/dropdown";
import { Film, MousePointerClick, PlayCircle, Volume2 } from "../icons";
import { Nested, SettingRow } from "../kit";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { Section, ToggleRow } from "../shared";
import { TrailerQualityPreview } from "./trailer-quality-preview";

export function TrailersTab() {
  const t = useT();
  const { settings, update } = useSettings();
  return (
    <Section
      title={t("Trailer quality")}
      subtitle={t("How sharp trailers play, and when they start on their own.")}
    >
      <SettingRow
        icon={<Film size={18} strokeWidth={2} />}
        label={t("Playback quality")}
        desc={t("Auto follows your connection speed.")}
        tip={t("How sharp trailers play. Auto follows your connection speed, and the Watch Trailer button targets 1080p. Pick 1080p or Best (up to 4K when the source has it) to force higher. 1080p and Best merge separate video and audio with the bundled ffmpeg, so they take a beat longer to start.")}
      >
        <div className="flex w-full min-w-0 flex-col gap-3">
          <div className="w-[280px] max-w-full">
            <Dropdown
              size="md"
              value={settings.trailerQuality}
              onChange={(v) =>
                update({ trailerQuality: v as "auto" | "360p" | "720p" | "1080p" | "best" })
              }
              options={[
                { value: "auto", label: t("Auto") },
                { value: "360p", label: "360p" },
                { value: "720p", label: "720p" },
                { value: "1080p", label: "1080p" },
                { value: "best", label: t("Best") },
              ]}
            />
          </div>
          <TrailerQualityPreview quality={settings.trailerQuality} />
        </div>
      </SettingRow>

      <ToggleRow
        label={t("Auto-play trailer on detail pages")}
        sub={t("Plays a muted trailer in the backdrop when you open a title. Click the speaker to unmute. Falls back to the image when no trailer is available.")}
        value={settings.detailTrailerAutoplay}
        onChange={(v) => update({ detailTrailerAutoplay: v })}
        leading={
          <PlayCircle
            size={18}
            strokeWidth={2}
            className={settings.detailTrailerAutoplay ? "text-accent" : undefined}
          />
        }
      />
      {settings.detailTrailerAutoplay && (
        <Nested>
          <ToggleRow
            label={t("Start trailers with audio")}
            sub={t("Detail page trailers begin unmuted. Falls back to muted if the browser blocks sound until you interact.")}
            value={settings.detailTrailerAudio}
            onChange={(v) => update({ detailTrailerAudio: v })}
            leading={
              <Volume2
                size={18}
                strokeWidth={2}
                className={settings.detailTrailerAudio ? "text-accent" : undefined}
              />
            }
          />
        </Nested>
      )}
      <ToggleRow
        label={t("Scroll up for the trailer")}
        sub={t("From the very top of a detail page, keep scrolling up to open the trailer. Off by default.")}
        value={settings.scrollUpTrailer}
        onChange={(v) => update({ scrollUpTrailer: v })}
        leading={
          <MousePointerClick
            size={18}
            strokeWidth={2}
            className={settings.scrollUpTrailer ? "text-accent" : undefined}
          />
        }
      />
    </Section>
  );
}
