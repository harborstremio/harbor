import { useEffect, useRef } from "react";
import { Award, Check, Eye, HardDrive, Tag, Trophy, Type } from "lucide-react";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { Section, Segmented, ToggleRow } from "../shared";
import { SettingGroup, SettingRow, Nested } from "../kit";
import { SongCardStylePicker } from "../song-card-style-picker";
import { HoverStyleGallery } from "../hover-style-preview";
import { CardOverlayPreview } from "../card-overlay-preview";
import { RatingsMatrix } from "../ratings-matrix";
import { CardBadgesPanel, WatchlistControl, type PreviewFlags } from "../card-badges-panel";

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
        <CardOverlayPreview />
        <ToggleRow
          label={t("Show tags on cards")}
          leading={<Tag size={16} strokeWidth={2.2} className="text-ink-muted" />}
          sub={t(
            "The New, In Cinema, Rerun, and Awards chips. Turn off for a cleaner grid. Score chips are separate, below.",
          )}
          value={settings.showCardBadges}
          onChange={(v) => update({ showCardBadges: v })}
        />
        <ToggleRow
          label={t("Award tab on cards")}
          newId="library:award-tab"
          leading={<Award size={16} strokeWidth={2.2} className="text-ink-muted" />}
          sub={t(
            "Show a laurel award tab on winning titles, like Netflix. Replaces the corner award chip and sits centered so it clears the rating and watchlist pills. Pick where it sits below.",
          )}
          value={settings.awardTabs}
          onChange={(v) => update({ awardTabs: v })}
        />
        {settings.awardTabs && (
          <Nested>
            <SettingRow label={t("Award tab position")}>
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
          leading={<Trophy size={16} strokeWidth={2.2} className="text-ink-muted" />}
          sub={t(
            "A TOP 10 corner ribbon on the Top 10 rail posters. The watchlist marker auto-moves to the opposite corner so nothing overlaps.",
          )}
          value={settings.top10Ribbon}
          onChange={(v) => update({ top10Ribbon: v })}
        />
        {settings.top10Ribbon && (
          <Nested>
            <SettingRow label={t("Ribbon corner")}>
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
        <ToggleRow
          label={t("Watched badge")}
          sub={t("Puts a check on titles you have already finished.")}
          leading={<Check size={16} strokeWidth={2.6} className="text-ink-muted" />}
          value={settings.showWatchedBadge}
          onChange={(v) => update({ showWatchedBadge: v })}
        />
        <ToggleRow
          label={t("Show an “on disk” badge on cards")}
          leading={<HardDrive size={16} strokeWidth={2.2} className="text-ink-muted" />}
          sub={t(
            "Marks movies and shows across Home, the catalogs, and detail pages when a matching file already exists in your local library.",
          )}
          value={settings.showLocalLibraryBadge}
          onChange={(v) => update({ showLocalLibraryBadge: v })}
        />
        <ToggleRow
          label={t("Show DUB badge on anime cards")}
          leading={
            <span className="rounded bg-accent-soft px-1 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.1em] text-canvas">
              DUB
            </span>
          }
          sub={t("Flags anime with an English dub. Also tags dub / sub / dual on stream sources.")}
          value={settings.showDubBadge}
          onChange={(v) => update({ showDubBadge: v })}
        />
      </Section>

      <Section title={t("Scores")}>
        <RatingsMatrix settings={settings} update={update} />
        <CardBadgesPanel
          settings={settings}
          update={update}
          flags={badgeFlags}
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
      </Section>

      <Section title={t("Titles")}>
        <ToggleRow
          label={t("Hide titles under posters")}
          leading={<Type size={16} strokeWidth={2.2} className="text-ink-muted" />}
          sub={t("Cleaner grid when your poster service already prints the title on the artwork.")}
          value={settings.hidePosterTitles}
          onChange={(v) => update({ hidePosterTitles: v })}
        />
      </Section>

      <SongCardStylePicker />
      <Section
        title={t("Hover preview")}
        subtitle={t("Rest the cursor on a poster to peek at it without opening. Off by default.")}
      >
        <ToggleRow
          label={t("Hover preview")}
          sub={t(
            "Rest the cursor on a poster to peek at the rating, story, and quick actions without opening it.",
          )}
          value={settings.hoverPreviewEnabled}
          onChange={(v) => update({ hoverPreviewEnabled: v })}
        />
        {settings.hoverPreviewEnabled && (
          <Nested>
            <SettingGroup label={t("Preview style")}>
              <SettingRow
                wide
                icon={<Eye size={16} />}
                label={t("Hover style")}
                desc={t("Pick the card that appears. Each tile previews the real thing.")}
              >
                <div className="w-full">
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
                </div>
              </SettingRow>
              {(settings.cardHoverStyle === "default" ||
                settings.cardHoverStyle === "marquee") && (
                <SettingRow
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
