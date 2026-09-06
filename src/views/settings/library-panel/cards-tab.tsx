import { useEffect, useRef } from "react";
import { Award, Captions, Check, Eye, HardDrive, Sparkles, Tag, Trophy, Type } from "../icons";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { ROW_DESC, Section, Segmented, ToggleRow } from "../shared";
import { SettingGroup, SettingRow, Nested, SettingsWorkbench } from "../kit";
import { SongCardStylePicker } from "../song-card-style-picker";
import { HoverStyleGallery } from "../hover-style-preview";
import { CardOverlayPreview } from "../card-overlay-preview";
import { RatingsMatrix } from "../ratings-matrix";
import { CardBadgesPanel, CardScoresPreview, WatchlistControl, type PreviewFlags } from "../card-badges-panel";

export function CardsTab() {
  const { settings, update } = useSettings();
  const t = useT();

  const badgeFlags: PreviewFlags = {
    showImdb: settings.showImdbBadge && !!settings.tmdbKey,
    showTmdb: settings.showTmdbBadge && !!settings.tmdbKey,
    showRt: settings.showRtBadge && !!settings.omdbKey,
    showPopcorn: settings.showPopcornBadge && !!settings.mdblistKey,
    showMetacritic: settings.showMetacriticBadge && !!settings.mdblistKey,
    showLetterboxd: settings.showLetterboxdBadge && !!settings.mdblistKey,
    showMdblist: settings.showMdblistBadge && !!settings.mdblistKey,
    showTrakt: settings.showTraktBadge && !!settings.mdblistKey,
    showMal: settings.showMalBadge,
    showSimkl: settings.showSimklBadge,
  };
  const enabledBadgeCount =
    (badgeFlags.showImdb || badgeFlags.showTmdb || badgeFlags.showMal ? 1 : 0) +
    (badgeFlags.showRt ? 1 : 0) +
    (badgeFlags.showPopcorn ? 1 : 0) +
    (badgeFlags.showMetacritic ? 1 : 0) +
    (badgeFlags.showLetterboxd ? 1 : 0) +
    (badgeFlags.showMdblist ? 1 : 0) +
    (badgeFlags.showTrakt ? 1 : 0) +
    (badgeFlags.showSimkl ? 1 : 0);

  const prevBadgeCountRef = useRef(enabledBadgeCount);
  useEffect(() => {
    const prev = prevBadgeCountRef.current;
    prevBadgeCountRef.current = enabledBadgeCount;
    if (enabledBadgeCount > prev && enabledBadgeCount > settings.cardBadgeLimit) {
      update({ cardBadgeLimit: Math.min(6, enabledBadgeCount) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabledBadgeCount]);

  return (
    <>
      <Section title={t("On the poster")}>
        <ToggleRow
          label={t("Show tags on cards")}
          leading={<Tag size={18} strokeWidth={2} />}
          sub={t(
            "The New, In Cinema, Rerun, and Awards chips. Turn off for a cleaner grid. Score chips are separate, below.",
          )}
          value={settings.showCardBadges}
          onChange={(v) => update({ showCardBadges: v })}
        />
        <SettingsWorkbench compact preview={<CardOverlayPreview />}>
          <ToggleRow
            label={t("Award tab on cards")}
            newId="library:award-tab"
            leading={<Award size={18} strokeWidth={2} />}
            sub={t(
              "Show a laurel tab on award-winning titles. Choose its position below.",
            )}
            value={settings.awardTabs}
            onChange={(v) => update({ awardTabs: v })}
          />
          {settings.awardTabs && (
            <Nested>
              <SettingRow
                wide
                label={t("Award tab position")}
                desc={t("Where the laurel tab sits relative to the score chips on the poster.")}
              >
                <Segmented
                  value={settings.awardTabPosition}
                  options={[
                    { value: "above", label: t("Above ratings") },
                    { value: "below", label: t("Below ratings") },
                    { value: "top", label: t("Top of card") },
                  ]}
                  onChange={(v) => update({ awardTabPosition: v as "above" | "below" | "top" })}
                />
              </SettingRow>
            </Nested>
          )}
          <ToggleRow
            label={t("Top 10 ribbon")}
            newId="library:top-10"
            leading={<Trophy size={18} strokeWidth={2} />}
            sub={t(
              "Mark Top 10 titles with a corner ribbon. Bookmarks move down when they share its corner.",
            )}
            value={settings.top10Ribbon}
            onChange={(v) => update({ top10Ribbon: v })}
          />
          {settings.top10Ribbon && (
            <Nested>
              <SettingRow
                wide
                label={t("Ribbon corner")}
                desc={t("Which top corner of the poster the ribbon folds over.")}
              >
                <Segmented
                  value={settings.top10RibbonSide}
                  options={[
                    { value: "left", label: t("Top left") },
                    { value: "right", label: t("Top right") },
                  ]}
                  onChange={(v) => update({ top10RibbonSide: v as "left" | "right" })}
                />
              </SettingRow>
            </Nested>
          )}
          <WatchlistControl
            value={settings.watchlistBadge}
            onChange={(v) => update({ watchlistBadge: v })}
          />
        </SettingsWorkbench>
        <ToggleRow
          label={t("Watched badge")}
          sub={t("Puts a check on titles you have already finished.")}
          leading={<Check size={18} strokeWidth={2.4} />}
          value={settings.showWatchedBadge}
          onChange={(v) => update({ showWatchedBadge: v })}
        />
        <ToggleRow
          label={t("Show an “on disk” badge on cards")}
          leading={<HardDrive size={18} strokeWidth={2} />}
          sub={t(
            "Marks movies and shows across Home, the catalogs, and detail pages when a matching file already exists in your local library.",
          )}
          value={settings.showLocalLibraryBadge}
          onChange={(v) => update({ showLocalLibraryBadge: v })}
        />
        <ToggleRow
          label={t("Show DUB badge on anime cards")}
          leading={<Captions size={18} strokeWidth={2} />}
          sub={t("Flags anime with an English dub. Also tags dub / sub / dual on stream sources.")}
          value={settings.showDubBadge}
          onChange={(v) => update({ showDubBadge: v })}
        />
      </Section>

      <Section title={t("Scores")}>
        <SettingsWorkbench compact preview={<CardScoresPreview settings={settings} flags={badgeFlags} enabledBadgeCount={enabledBadgeCount} />}>
        <RatingsMatrix settings={settings} update={update} />
        <CardBadgesPanel
          settings={settings}
          update={update}
          enabledBadgeCount={enabledBadgeCount}
        />
        {settings.showMalBadge && (
          <SettingRow
            label={t("Anime card rating source")}
            desc={t(
              "Pick which score anime cards show. IMDb falls back to MAL when a title has no IMDb rating yet.",
            )}
          >
            <Segmented
              value={settings.animeCardRating}
              options={[
                { value: "mal", label: t("MAL") },
                { value: "imdb", label: t("IMDb") },
              ]}
              onChange={(v) => update({ animeCardRating: v as "mal" | "imdb" })}
            />
          </SettingRow>
        )}
        </SettingsWorkbench>
      </Section>

      <Section title={t("Titles")}>
        <ToggleRow
          label={t("Hide titles under posters")}
          leading={<Type size={18} strokeWidth={2} />}
          sub={t("Cleaner grid when your poster service already prints the title on the artwork.")}
          value={settings.hidePosterTitles}
          onChange={(v) => update({ hidePosterTitles: v })}
        />
      </Section>

      <SongCardStylePicker />

      <Section title={t("Hover preview")}>
        <ToggleRow
          label={t("Peek at a title on hover")}
          leading={<Eye size={18} strokeWidth={2} />}
          sub={t(
            "Rest the cursor on a poster to peek at the rating, story, and quick actions without opening it. Off by default.",
          )}
          value={settings.hoverPreviewEnabled}
          onChange={(v) => update({ hoverPreviewEnabled: v })}
        />
        {settings.hoverPreviewEnabled && (
          <Nested>
            <SettingGroup label={t("Hover style")}>
              <p className={`max-w-[70ch] ${ROW_DESC}`}>
                {t("Pick the card that appears. Each tile previews the real thing.")}
              </p>
              <HoverStyleGallery
                value={settings.cardHoverStyle}
                customHoverId={settings.customHoverId}
                onChange={(style, customId) =>
                  update(
                    customId != null
                      ? { cardHoverStyle: style, customHoverId: customId }
                      : { cardHoverStyle: style },
                  )
                }
              />
              {(settings.cardHoverStyle === "default" ||
                settings.cardHoverStyle === "marquee") && (
                <SettingRow
                  wide
                  label={t("Open preview")}
                  desc={t("Whether the card grows over the poster or slides out beside it.")}
                >
                  <Segmented
                    value={settings.hoverPreviewPlacement}
                    options={[
                      { value: "over", label: t("On the card") },
                      { value: "side", label: t("To the side") },
                    ]}
                    onChange={(v) => update({ hoverPreviewPlacement: v as "over" | "side" })}
                  />
                </SettingRow>
              )}
            </SettingGroup>
          </Nested>
        )}
        <ToggleRow
          label={t("Poster shine on hover")}
          leading={<Sparkles size={18} strokeWidth={2} />}
          sub={t(
            "A subtle tvOS style light sweep across a poster when you hover it. Off by default; the card lift stays either way.",
          )}
          value={settings.cardHoverShine}
          onChange={(v) => update({ cardHoverShine: v })}
        />
      </Section>
    </>
  );
}
