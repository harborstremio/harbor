import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { Section, Segmented, ToggleRow } from "../shared";
import { SettingGroup, SettingRow, Nested, SettingsWorkbench } from "../kit";
import { SpoilerPreview } from "../spoiler-preview";
import { EpisodeCardPreview } from "../episode-card-previews";
import { EpisodeScalePreview } from "./episode-scale-preview";

export function DetailTab() {
  const { settings, update } = useSettings();
  const t = useT();
  return (
    <>
      <Section
        title={t("Show pages")}
        subtitle={t("How a show or movie detail page behaves when you open it.")}
      >
        <ToggleRow
          label={t("Mark watched button")}
          sub={t(
            "Show a button on the detail page to mark a title or episode as watched. Syncs to Trakt and Simkl if connected.",
          )}
          value={settings.showWatchedButton}
          onChange={(v) => update({ showWatchedButton: v })}
        />
        <ToggleRow
          label={t("Remember your place on show pages")}
          sub={t(
            "Reopen a show at the position where you left it, including its episode list.",
          )}
          value={settings.resumeDetailScroll}
          onChange={(v) => update({ resumeDetailScroll: v })}
        />
        <ToggleRow
          label={t("Cycle the backdrop")}
          sub={t(
            "Fade between available backdrops. A pinned backdrop or reduced-motion preference keeps the image still.",
          )}
          value={settings.heroBackdropCarousel}
          onChange={(v) => update({ heroBackdropCarousel: v })}
        />
        <ToggleRow
          label={t("Blur stream backdrop")}
          sub={t("Soften the artwork behind the stream picker.")}
          value={settings.streamBackdropBlur}
          onChange={(v) => update({ streamBackdropBlur: v })}
        />
      </Section>

      <Section
        title={t("Spoilers")}
        subtitle={t(
          "Keep unwatched episode details hidden. Hover a card in the preview to reveal it temporarily.",
        )}
      >
        <ToggleRow
          label={t("Blur spoilers")}
          sub={t(
            "Hides spoiler-prone episode details in episode lists until you have watched them.",
          )}
          value={settings.hideSpoilers}
          onChange={(v) => update({ hideSpoilers: v })}
        />
        {settings.hideSpoilers && (
          <SettingsWorkbench preview={<SpoilerPreview />}>
            <Nested>
            <SettingGroup label={t("What gets blurred")}>
              <ToggleRow
                label={t("Blur thumbnails")}
                sub={t("Frosts the still image on each unwatched episode in the list.")}
                value={settings.spoilerHideThumbnails}
                onChange={(v) => update({ spoilerHideThumbnails: v })}
              />
              <ToggleRow
                label={t("Blur titles")}
                sub={t("Hides the episode name, which often gives the twist away on its own.")}
                value={settings.spoilerHideTitles}
                onChange={(v) => update({ spoilerHideTitles: v })}
              />
              <ToggleRow
                label={t("Blur descriptions")}
                sub={t("Hides the synopsis text under each unwatched episode.")}
                value={settings.spoilerHideDescriptions}
                onChange={(v) => update({ spoilerHideDescriptions: v })}
              />
              <ToggleRow
                label={t("Blur episode images on detail page")}
                sub={t(
                  "Blurs the hero image and stills on the episode detail page until you click reveal.",
                )}
                value={!!settings.blurEpisodes}
                onChange={(v) => update({ blurEpisodes: v })}
              />
              <ToggleRow
                label={t("Keep the next episode visible")}
                sub={t("Leave the episode you are up to clear and only blur the ones after it.")}
                value={settings.spoilerSkipNext}
                onChange={(v) => update({ spoilerSkipNext: v })}
              />
            </SettingGroup>
            </Nested>
          </SettingsWorkbench>
        )}
      </Section>

      <Section
        title={t("Episode cards")}
        subtitle={t(
          "Show the IMDb rating and synopsis on episodes across the list, grid, and panel layouts.",
        )}
      >
        <SettingGroup label={t("On the card")}>
          <ToggleRow
            label={t("Show IMDb rating on episodes")}
            sub={t(
              "Shows each episode's rating. Add your free OMDb API key for real IMDb scores; without it, ratings fall back to TMDB.",
            )}
            value={settings.showEpisodeRating}
            onChange={(v) => update({ showEpisodeRating: v })}
            preview={<EpisodeCardPreview kind="rating" />}
          />
          <ToggleRow
            label={t("Show episode description")}
            sub={t("Shows the episode synopsis on the cards. Turn it off to hide it.")}
            value={settings.showEpisodeDescription}
            onChange={(v) => update({ showEpisodeDescription: v })}
            preview={<EpisodeCardPreview kind="description" />}
          />
          <SettingRow
            wide
            label={t("Card size")}
            desc={t(
              "How big episode cards are in the strip and grid layouts. Bigger cards show larger artwork.",
            )}
          >
            <Segmented
              value={String(settings.episodeCardScale || 1)}
              options={[
                { value: "1", label: t("Default") },
                { value: "1.2", label: t("Large") },
                { value: "1.45", label: t("Extra large") },
              ]}
              onChange={(v) => update({ episodeCardScale: parseFloat(v) })}
            />
          </SettingRow>
          <EpisodeScalePreview />
          <ToggleRow
            label={t("High-quality episode images")}
            sub={t(
              "Use sharper artwork for large cards. Uses more data and may load more slowly.",
            )}
            value={settings.hdEpisodeImages}
            onChange={(v) => update({ hdEpisodeImages: v })}
            preview={<EpisodeCardPreview kind="hd" />}
          />
        </SettingGroup>

        <SettingGroup label={t("Browsing")}>
          <ToggleRow
            label={t("Hide and skip episodes")}
            sub={t(
              "Adds a Hide option when you right-click an episode. Hidden episodes disappear from the list and are skipped by Up Next. A Show hidden toggle on each show lets you bring them back.",
            )}
            value={settings.episodeHiding}
            onChange={(v) => update({ episodeHiding: v })}
          />
          <ToggleRow
            label={t("Group episodes by story arc")}
            sub={t(
              "Browse by story arc on supported shows, such as One Piece. Requires a TMDB key.",
            )}
            value={settings.episodeArcGroups}
            onChange={(v) => update({ episodeArcGroups: v })}
          />
        </SettingGroup>
      </Section>
    </>
  );
}
