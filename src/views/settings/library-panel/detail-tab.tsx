import { Check, Ruler } from "lucide-react";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { Section, Segmented, ToggleRow } from "../shared";
import { SettingGroup, SettingRow, Nested } from "../kit";
import { SpoilerPreview } from "../spoiler-preview";
import { EpisodeCardPreview } from "../episode-card-previews";

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
          leading={<Check size={16} strokeWidth={2.6} className="text-ink-muted" />}
          sub={t(
            "Show a button on the detail page to mark a title or episode as watched. Syncs to Trakt and Simkl if connected.",
          )}
          value={settings.showWatchedButton}
          onChange={(v) => update({ showWatchedButton: v })}
        />
        <ToggleRow
          label={t("Remember your place on show pages")}
          sub={t(
            "When you reopen a show you were already browsing, jump straight back to your spot (usually the episode list) instead of starting at the top. The jump happens before the page shows, so there is no flash.",
          )}
          value={settings.resumeDetailScroll}
          onChange={(v) => update({ resumeDetailScroll: v })}
        />
        <ToggleRow
          label={t("Cycle the backdrop")}
          sub={t(
            "Slowly fade between a show's backdrop images while you read the page, instead of holding one still. Only runs when the show has more than one backdrop, and never when you have pinned one or asked for reduced motion.",
          )}
          value={settings.heroBackdropCarousel}
          onChange={(v) => update({ heroBackdropCarousel: v })}
        />
      </Section>

      <Section
        title={t("Spoilers")}
        subtitle={t(
          "Blur episode artwork, titles, and descriptions for episodes you have not watched yet, on both shows and anime. Hover an episode to peek.",
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
          <Nested>
            <SettingGroup label={t("What gets blurred")}>
              <ToggleRow
                label={t("Blur thumbnails")}
                value={settings.spoilerHideThumbnails}
                onChange={(v) => update({ spoilerHideThumbnails: v })}
              />
              <ToggleRow
                label={t("Blur titles")}
                value={settings.spoilerHideTitles}
                onChange={(v) => update({ spoilerHideTitles: v })}
              />
              <ToggleRow
                label={t("Blur descriptions")}
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
              <ToggleRow
                label={t("Blur stream backdrop")}
                sub={t("Adds a blurred glass effect behind the stream picker panel.")}
                value={settings.streamBackdropBlur}
                onChange={(v) => update({ streamBackdropBlur: v })}
              />
            </SettingGroup>
          </Nested>
        )}
        <SpoilerPreview />
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
            icon={<Ruler size={16} />}
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
          <ToggleRow
            label={t("High-quality episode images")}
            sub={t(
              "Loads full-resolution episode artwork (original) instead of lighter w300 images. Turn off for slow connections or low-end devices.",
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
              "Adds a Seasons/Arcs switch on shows that have a story-arc grouping (like One Piece), so you can browse by saga instead of scrolling seasons. Needs a TMDB key. Off by default.",
            )}
            value={settings.episodeArcGroups}
            onChange={(v) => update({ episodeArcGroups: v })}
          />
        </SettingGroup>
      </Section>
    </>
  );
}
