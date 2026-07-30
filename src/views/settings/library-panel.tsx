import { useEffect, useRef, useState } from "react";
import fanartLogo from "@/assets/addon-logos/fanarttv.svg";
import mdblistLogo from "@/assets/addon-logos/mdblist.png";
import harborStyleImg from "@/assets/onboarding/harborstyle.png";
import traditionalStyleImg from "@/assets/onboarding/traditional.png";
import omdbLogo from "@/assets/addon-logos/omdb.png";
import { useSampleArtwork } from "@/lib/sample-artwork";
import { SpoilerPreview } from "./spoiler-preview";
import { HomeRowPreview } from "./home-layout-previews";
import { HomeLanguagePicker } from "./home-language-picker";
import { EpisodeCardPreview } from "./episode-card-previews";
import { CardOverlayPreview } from "./card-overlay-preview";
import { SongCardStylePicker } from "./song-card-style-picker";
import { HoverStyleGallery } from "./hover-style-preview";
import { CwSnapshotShowcase } from "./cw-snapshot-showcase";
import { AiSearchSection } from "./ai-search-section";
import rpdbLogo from "@/assets/addon-logos/rpdb.png";
import auddLogo from "@/assets/addon-logos/auddio.webp";
import tmdbLogo from "@/assets/addon-logos/tmdb.png";
import tvdbLogo from "@/assets/addon-logos/tvdb.svg";
import animeCatIcon from "@/assets/category/anime.svg";
import livetvCatIcon from "@/assets/category/livetv.svg";
import adultCatIcon from "@/assets/category/adult.svg";
import { useProfiles } from "@/lib/profiles";
import { useSettings } from "@/lib/settings";
import { clearAllSnapshots, snapshotCount } from "@/lib/snapshots";
import { BookOpen, Check, HelpCircle, Tag } from "lucide-react";
import { HoverTooltip } from "@/components/hover-tooltip";
import { useT } from "@/lib/i18n";
import { RegionField } from "./region-cascade";
import { Dropdown, type DropdownOption } from "@/components/dropdown";
import { ExtLink, KeyField, Section, Segmented, ToggleRow } from "./shared";
import { TmdbGuideModal } from "./tmdb-tutorial-modal";
import { TvdbGuideModal } from "./tvdb-tutorial-modal";
import { EpisodeOrderSetting } from "./episode-order-setting";
import { RatingsMatrix } from "./ratings-matrix";
import { CardBadgesPanel, type PreviewFlags } from "./card-badges-panel";

export type LibraryKey = "tmdb" | "omdb" | "rpdb" | "fanart" | "tvdb";

export function LibraryPanel({
  tmdbDraft,
  omdbDraft,
  rpdbDraft,
  fanartDraft,
  tvdbDraft,
  setTmdbDraft,
  setOmdbDraft,
  setRpdbDraft,
  setFanartDraft,
  setTvdbDraft,
  savedKey,
  saveKey,
}: {
  tmdbDraft: string;
  omdbDraft: string;
  rpdbDraft: string;
  fanartDraft: string;
  tvdbDraft: string;
  setTmdbDraft: (v: string) => void;
  setOmdbDraft: (v: string) => void;
  setRpdbDraft: (v: string) => void;
  setFanartDraft: (v: string) => void;
  setTvdbDraft: (v: string) => void;
  savedKey: string | null;
  saveKey: (which: LibraryKey, value: string) => void;
}) {
  const { settings, update } = useSettings();
  const { activeProfile, updateProfile } = useProfiles();
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
  const [mdblistDraft, setMdblistDraft] = useState(settings.mdblistKey);
  const [posterSrvDraft, setPosterSrvDraft] = useState(settings.posterBaseUrl);
  const [auddDraft, setAuddDraft] = useState(settings.auddKey);
  const [songAiDraft, setSongAiDraft] = useState(settings.songIdAiKey);
  const [extraSaved, setExtraSaved] = useState<
    "mdblist" | "postersrv" | "ai" | "audd" | "songai" | null
  >(null);
  const [tmdbGuide, setTmdbGuide] = useState(false);
  const [tvdbGuide, setTvdbGuide] = useState(false);
  const extraTimerRef = useRef<number | null>(null);
  const flashExtra = (k: "mdblist" | "postersrv" | "ai" | "audd" | "songai") => {
    setExtraSaved(k);
    if (extraTimerRef.current) window.clearTimeout(extraTimerRef.current);
    extraTimerRef.current = window.setTimeout(() => setExtraSaved(null), 1800);
  };
  const pushHideContent = (key: "anime" | "sports" | "liveTv" | "adult" | "manga", value: boolean) => {
    const next = { ...settings.hideContent, [key]: value };
    update({ hideContent: next });
    if (activeProfile) updateProfile(activeProfile.id, { hideContent: next });
  };
  return (
    <>
      <TmdbGuideModal open={tmdbGuide} onClose={() => setTmdbGuide(false)} />
      <TvdbGuideModal open={tvdbGuide} onClose={() => setTvdbGuide(false)} />
      <Section
        title={t("Home layout")}
        subtitle={t("How the Home page assembles its rails.")}
      >
        <HomeModePicker
          value={settings.homeMode}
          onChange={(v) => update({ homeMode: v })}
        />
        <ToggleRow
          label={t("Show every addon row")}
          sub={t("By default, addon rails that duplicate the built-in ones (Trending, Popular, Top Rated, etc.) are merged so you don't see the same row twice. Turn this on to show every one, duplicates and all.")}
          value={settings.homeShowAllAddonRows}
          onChange={(v) => update({ homeShowAllAddonRows: v })}
          preview={<HomeRowPreview kind="all-addon-rows" />}
        />
        <ToggleRow
          label={t("Watchlist shows only saved titles")}
          sub={t("Keep the Library Watchlist tab limited to titles you added in Stremio. Turn this off to also include anything Stremio auto-added when you pressed play.")}
          value={settings.libraryBookmarkedOnly}
          onChange={(v) => update({ libraryBookmarkedOnly: v })}
          preview={<HomeRowPreview kind="watchlist-saved" />}
        />
        <ToggleRow
          label={t("Show Playlists tab")}
          sub={t("Adds a Playlists item to the navigation for browsing movies and shows from your M3U or Xtream playlists (the same ones you add for Live TV). Off by default to keep the nav tidy.")}
          value={settings.showPlaylistsTab}
          onChange={(v) => update({ showPlaylistsTab: v })}
          preview={<HomeRowPreview kind="playlists-tab" />}
        />
        <ToggleRow
          label={t("Keep anime in the Anime room only")}
          sub={t("Hides anime from the Home Continue Watching row. It still appears in the Anime tab's own Continue Watching.")}
          value={settings.animeOnlyInAnimeRoom}
          onChange={(v) => update({ animeOnlyInAnimeRoom: v })}
          preview={<HomeRowPreview kind="anime-room" />}
        />
        <div className="flex flex-col gap-2 rounded-xl border border-edge-soft bg-canvas/40 py-3 pl-[30px] pr-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-[14px] font-medium text-ink">{t("When the latest episode ends")}</span>
            <span className="text-[12.5px] leading-relaxed text-ink-subtle">
              {t("Hide until the next episode airs, or keep showing a countdown to when it drops.")}
            </span>
          </div>
          <Segmented
            value={settings.animeCwEnd}
            options={[
              { value: "hide", label: t("Hide") },
              { value: "timer", label: t("Timer") },
            ]}
            onChange={(v) => update({ animeCwEnd: v as "hide" | "timer" })}
          />
        </div>
        <ToggleRow
          label={t("Advance Continue Watching to the next episode")}
          sub={t("When you finish an episode, the Home Continue Watching card moves on to the next episode instead of sitting at 0 minutes left.")}
          value={settings.cwAdvanceNext}
          onChange={(v) => update({ cwAdvanceNext: v })}
          preview={<HomeRowPreview kind="cw-advance" />}
        />
        <ToggleRow
          label={t("Remove shows once you're caught up")}
          sub={t("On by default: once you've watched every episode that has aired, the show leaves Continue Watching and returns when a new episode drops. Turn it off to keep caught-up shows on the row.")}
          value={settings.cwHideCaughtUp}
          onChange={(v) => update({ cwHideCaughtUp: v })}
        />
        <ToggleRow
          label={t("Keep Continue Watching private to each profile")}
          sub={t("Only show Continue Watching for the profile that's active. Each profile sees just its own progress, so what you watch stays hidden from the other profiles that share this Stremio account.")}
          value={settings.cwPerProfile}
          onChange={(v) => update({ cwPerProfile: v })}
        />
        <ToggleRow
          label={t("Hide watched titles in catalogs")}
          sub={t("Movies you've watched and shows you've made progress on stop appearing in the built-in catalog rows, using your local watch history (and Trakt if connected). Continue Watching is never touched.")}
          value={settings.hideWatchedInCatalogs}
          onChange={(v) => update({ hideWatchedInCatalogs: v })}
          preview={<HomeRowPreview kind="hide-watched" />}
        />
        <ToggleRow
          label={t("Hide unreleased titles")}
          sub={t("Movies and shows with a future release date stop appearing in the built-in home catalog rows, so Home only shows what you can watch right now.")}
          value={settings.hideUnreleased}
          onChange={(v) => update({ hideUnreleased: v })}
        />
      </Section>

      <Section
        title={t("Home languages")}
        subtitle={t("Only show titles in these original languages on the Home catalogs. Leave all off to show everything.")}
      >
        <HomeLanguagePicker />
      </Section>

      <Section
        title={t("Show pages")}
        subtitle={t("How a show or movie detail page behaves when you open it.")}
      >
        <ToggleRow
          label={t("Resume where you left off")}
          sub={t("When you reopen a show you were already browsing, jump straight back to your spot (usually the episode list) instead of starting at the top. The jump happens before the page shows, so there is no flash.")}
          value={settings.resumeDetailScroll}
          onChange={(v) => update({ resumeDetailScroll: v })}
        />
      </Section>

      <Section
        title={t("Spoilers")}
        subtitle={t("Blur episode artwork, titles, and descriptions for episodes you have not watched yet, on both shows and anime. Hover an episode to peek.")}
      >
        <ToggleRow
          label={t("Blur spoilers")}
          sub={t("Hides spoiler-prone episode details in episode lists until you have watched them.")}
          value={settings.hideSpoilers}
          onChange={(v) => update({ hideSpoilers: v })}
        />
        {settings.hideSpoilers && (
          <div className="ms-3 flex flex-col gap-1 border-s border-edge-soft/50 ps-4">
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
              sub={t("Blurs the hero image and stills on the episode detail page until you click reveal.")}
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
          </div>
        )}
        <SpoilerPreview />
      </Section>

      <Section
        title={t("Episode cards")}
        subtitle={t("Show the IMDb rating and synopsis on episodes across the list, grid, and panel layouts.")}
      >
        <ToggleRow
          label={t("Show IMDb rating on episodes")}
          sub={t("Shows each episode's rating. Add your free OMDb API key for real IMDb scores; without it, ratings fall back to TMDB.")}
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
        <ToggleRow
          label={t("Hide and skip episodes")}
          sub={t("Adds a Hide option when you right-click an episode. Hidden episodes disappear from the list and are skipped by Up Next. A Show hidden toggle on each show lets you bring them back.")}
          value={settings.episodeHiding}
          onChange={(v) => update({ episodeHiding: v })}
        />
        <ToggleRow
          label={t("High-quality episode images")}
          sub={t("Loads full-resolution episode artwork (original) instead of lighter w300 images. Turn off for slow connections or low-end devices.")}
          value={settings.hdEpisodeImages}
          onChange={(v) => update({ hdEpisodeImages: v })}
          preview={<EpisodeCardPreview kind="hd" />}
        />
        <ToggleRow
          label={t("Group episodes by story arc")}
          sub={t("Adds a Seasons/Arcs switch on shows that have a story-arc grouping (like One Piece), so you can browse by saga instead of scrolling seasons. Needs a TMDB key. Off by default.")}
          value={settings.episodeArcGroups}
          onChange={(v) => update({ episodeArcGroups: v })}
        />
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-[13.5px] font-medium text-ink">{t("Card size")}</span>
            <span className="text-[12.5px] leading-relaxed text-ink-subtle">
              {t("How big episode cards are in the strip and grid layouts. Bigger cards show larger artwork.")}
            </span>
          </div>
          <Segmented
            value={String(settings.episodeCardScale || 1)}
            options={[
              { value: "1", label: t("Default") },
              { value: "1.2", label: t("Large") },
              { value: "1.45", label: t("Extra large") },
            ]}
            onChange={(v) => update({ episodeCardScale: parseFloat(v) })}
          />
        </div>
      </Section>

      <SongCardStylePicker />

      <Section
        title={t("Hover preview")}
        subtitle={t("Rest the cursor on a poster to peek at it without opening. Off by default.")}
      >
        <ToggleRow
          label={t("Hover preview")}
          sub={t("Rest the cursor on a poster to peek at the rating, story, and quick actions without opening it.")}
          value={settings.hoverPreviewEnabled}
          onChange={(v) => update({ hoverPreviewEnabled: v })}
        />
        <ToggleRow
          label={t("Poster shine on hover")}
          sub={t("A subtle tvOS style light sweep across a poster when you hover it. Off by default; the card lift stays either way.")}
          value={settings.cardHoverShine}
          onChange={(v) => update({ cardHoverShine: v })}
        />
        {settings.hoverPreviewEnabled && (
          <div className="mt-4 flex flex-col gap-3">
            <HoverStyleGallery
              value={settings.cardHoverStyle}
              customHoverId={settings.customHoverId}
              onChange={(style, customId) =>
                update(customId != null ? { cardHoverStyle: style, customHoverId: customId } : { cardHoverStyle: style })
              }
            />
            {(settings.cardHoverStyle === "default" || settings.cardHoverStyle === "marquee") && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-edge-soft bg-canvas/40 px-4 py-3">
            <span className="text-[13px] text-ink-muted">{t("Open preview")}</span>
            <div className="flex gap-1.5">
              {(
                [
                  { v: "over", label: t("On the card") },
                  { v: "side", label: t("To the side") },
                ] as const
              ).map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => update({ hoverPreviewPlacement: o.v })}
                  className={`rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                    settings.hoverPreviewPlacement === o.v
                      ? "border-accent bg-accent/15 text-accent"
                      : "border-edge-soft bg-canvas/60 text-ink-muted hover:border-edge hover:text-ink"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
              </div>
            )}
          </div>
        )}
      </Section>

      <Section
        title={t("Continue Watching screenshots")}
        subtitle={t("When you back out of a title, Harbor saves a frame so the Continue Watching card looks like the spot you left. Tune how long they stick around, or wipe them all.")}
      >
        <CwSnapshotShowcase />
        <RetentionPicker
          value={settings.cwSnapshotRetentionDays}
          onChange={(v) => update({ cwSnapshotRetentionDays: v })}
        />
        <ToggleRow
          label={t("Full quality frames")}
          sub={t("Save sharper frames instead of light thumbnails. They look crisper on the card but take more space, so fewer are kept before the oldest roll off.")}
          value={settings.cwSnapshotFullQuality}
          onChange={(v) => update({ cwSnapshotFullQuality: v })}
        />
        <ClearSnapshotsButton />
      </Section>

      <Section
        title={t("Region & language")}
        subtitle={t("Used for streaming availability and the Now Playing release window. Pick a country and Harbor can match the interface, metadata, and subtitle languages to it.")}
      >
        <RegionField />
      </Section>

      <AiSearchSection />

      <Section
        title={t("Metadata providers")}
        subtitle={t("A free TMDB key is highly recommended. It unlocks the full Harbor experience. The rest are optional, and Cinemeta works out of the box without any.")}
      >
        <KeyField
          label={t("TMDB · catalogs and rails")}
          badge={t("Recommended")}
          placeholder={t("v3 API key")}
          value={tmdbDraft}
          onChange={setTmdbDraft}
          onSave={() => saveKey("tmdb", tmdbDraft)}
          saved={savedKey === "tmdb"}
          iconSrc={tmdbLogo}
          headerExtra={
            <HoverTooltip
              side="top"
              align="center"
              label={t("TMDB asks for an app URL when you create the key. Put any URL at all, like https://harbor.app. The only thing you need back is the API key.")}
            >
              <button
                type="button"
                onClick={() => setTmdbGuide(true)}
                className="flex items-center gap-1 rounded-full px-2 py-1 text-[11.5px] font-semibold text-accent transition-colors hover:bg-accent/10"
              >
                <HelpCircle size={13} strokeWidth={2.4} />
                {t("How to get this")}
              </button>
            </HoverTooltip>
          }
          help={
            <>
              Highly recommended. This is what gives you the full Harbor experience: Popular,
              Trending, In Theaters, and per-service rails. Free at{" "}
              <ExtLink href="https://www.themoviedb.org/settings/api">
                themoviedb.org/settings/api
              </ExtLink>
              . Use the v3 key, not the read access token.
            </>
          }
        />
        <ToggleRow
          label={t("Use free IMDb data without a TMDB key")}
          sub={t("With no TMDB key, the About panel pulls cast, crew, and title info from a free IMDb source. TMDB is still used whenever a key is set.")}
          value={settings.imdbApiFallback}
          onChange={(v) => update({ imdbApiFallback: v })}
        />
        <KeyField
          label={t("OMDb · Rotten Tomatoes scores")}
          placeholder={t("8-character key")}
          value={omdbDraft}
          onChange={setOmdbDraft}
          onSave={() => saveKey("omdb", omdbDraft)}
          saved={savedKey === "omdb"}
          iconSrc={omdbLogo}
          help={
            <>
              Free at{" "}
              <ExtLink href="https://www.omdbapi.com/apikey.aspx">
                omdbapi.com/apikey.aspx
              </ExtLink>
              . They email an activation link the first time. Click it, then come back and save.
            </>
          }
        />
        <KeyField
          label={t("RPDB · scores baked into posters")}
          placeholder={t("rpdb key")}
          value={rpdbDraft}
          onChange={setRpdbDraft}
          onSave={() => saveKey("rpdb", rpdbDraft)}
          saved={savedKey === "rpdb"}
          iconSrc={rpdbLogo}
          help={
            <>
              Paid plan at{" "}
              <ExtLink href="https://ratingposterdb.com">ratingposterdb.com</ExtLink>. Once
              saved, every poster gets re-rendered with IMDb, Rotten Tomatoes, and Metacritic
              stamped on it.
            </>
          }
        />
        <KeyField
          label={t("MDBList · Letterboxd and Trakt scores")}
          placeholder={t("mdblist api key")}
          value={mdblistDraft}
          onChange={setMdblistDraft}
          onSave={() => {
            update({ mdblistKey: mdblistDraft.trim() });
            flashExtra("mdblist");
          }}
          saved={extraSaved === "mdblist"}
          iconSrc={mdblistLogo}
          help={
            <>
              Free key at <ExtLink href="https://mdblist.com/preferences/">mdblist.com</ExtLink>.
              Adds Letterboxd and Trakt community ratings to detail pages, covering what OMDb
              misses.
            </>
          }
        />
        <div className="flex items-center gap-2 ps-1">
          <span className="text-[13px] font-medium text-ink-muted">{t("Song ID provider")}</span>
          <div className="flex overflow-hidden rounded-lg border border-edge-soft">
            {(["audd", "ai"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => update({ songIdProvider: p })}
                className={`px-3 py-1 text-[12.5px] font-semibold transition-colors ${
                  settings.songIdProvider === p
                    ? "bg-ink text-canvas"
                    : "bg-canvas/40 text-ink-muted hover:bg-canvas/70 hover:text-ink"
                }`}
              >
                {p === "audd" ? t("AudD") : t("AI (Gemini)")}
              </button>
            ))}
          </div>
        </div>
        {settings.songIdProvider === "ai" ? (
          <KeyField
            label={t("Gemini · in-player song ID")}
            placeholder={t("Gemini API key")}
            value={songAiDraft}
            onChange={setSongAiDraft}
            onSave={() => {
              update({ songIdAiKey: songAiDraft.trim() });
              flashExtra("songai");
            }}
            saved={extraSaved === "songai"}
            help={
              <>
                Identifies the song with Google Gemini (free tier, no usage cap). Get a key at{" "}
                <ExtLink href="https://aistudio.google.com/apikey">aistudio.google.com/apikey</ExtLink>. Windows only.
              </>
            }
          />
        ) : (
          <KeyField
            label={t("AudD · in-player song ID")}
            placeholder={t("AudD API token")}
            value={auddDraft}
            onChange={setAuddDraft}
            onSave={() => {
              update({ auddKey: auddDraft.trim() });
              flashExtra("audd");
            }}
            saved={extraSaved === "audd"}
            iconSrc={auddLogo}
            iconBg="#EE1066"
            help={
              <>
                Powers the Identify-song button in the player. Get a token at{" "}
                <ExtLink href="https://dashboard.audd.io/">dashboard.audd.io</ExtLink>.
              </>
            }
          />
        )}
        <KeyField
          label={t("Custom poster service")}
          placeholder={t("RPDB key above, https://btttr.cc, or a {imdbId} template")}
          value={posterSrvDraft}
          onChange={setPosterSrvDraft}
          onSave={() => {
            update({ posterBaseUrl: posterSrvDraft.trim() });
            flashExtra("postersrv");
          }}
          saved={extraSaved === "postersrv"}
          iconSrc={rpdbLogo}
          help={
            <>
              Leave empty to use your RPDB key above. Or paste{" "}
              <strong>Better Posters</strong> (<code>https://btttr.cc</code>), a bare
              RPDB-compatible server (your RPDB key is still sent), or a full URL template using{" "}
              <code>{"{imdbId}"}</code>, <code>{"{tmdbId}"}</code>, <code>{"{type}"}</code>, or{" "}
              <code>{"{id}"}</code>. PostersPlus needs the template form, e.g.{" "}
              <code>{"postersplus.elfhosted.com/poster?tmdb_id={tmdbId}&imdb_id={imdbId}&type={type}"}</code>.
            </>
          }
        />
        <ToggleRow
          label={t("Hide titles under posters")}
          sub={t("Cleaner grid when your poster service already prints the title on the artwork.")}
          value={settings.hidePosterTitles}
          onChange={(v) => update({ hidePosterTitles: v })}
        />
        <ToggleRow
          label={t("Prefer my installed metadata addon")}
          sub={t("Use a custom meta addon you installed (e.g. a localized Cinemeta) for titles and descriptions instead of the built-in Cinemeta. Falls back to Cinemeta if yours has no data.")}
          value={settings.preferCustomMetaAddon}
          onChange={(v) => update({ preferCustomMetaAddon: v })}
        />
        <ToggleRow
          label={t("Use Cinemeta for title metadata")}
          sub={t("Turn this off to take Cinemeta out entirely and use only your own metadata addons, such as AIOMetadata or AIOStreams. Cinemeta can go stale and show already released episodes as TBA. Leave it on unless you have a metadata addon installed, or titles will have no details.")}
          value={settings.cinemetaEnabled}
          onChange={(v) => update({ cinemetaEnabled: v })}
        />
        <KeyField
          label={t("Fanart.tv · logos and backdrops")}
          placeholder={t("personal key")}
          value={fanartDraft}
          onChange={setFanartDraft}
          onSave={() => saveKey("fanart", fanartDraft)}
          saved={savedKey === "fanart"}
          iconSrc={fanartLogo}
          help={
            <>
              Fills in where TMDB comes up empty (anime, older catalog). Free at{" "}
              <ExtLink href="https://fanart.tv/get-an-api-key/">
                fanart.tv/get-an-api-key
              </ExtLink>
              . Use the "personal" key, not the project one.
            </>
          }
        />
        <KeyField
          label={t("TheTVDB · episode data")}
          placeholder={t("subscriber API key")}
          value={tvdbDraft}
          onChange={setTvdbDraft}
          onSave={() => saveKey("tvdb", tvdbDraft)}
          saved={savedKey === "tvdb"}
          iconSrc={tvdbLogo}
          headerExtra={
            <HoverTooltip
              side="top"
              align="center"
              label={t("The free tier is $0 for personal use. Just pick the first option, no payment needed.")}
            >
              <button
                type="button"
                onClick={() => setTvdbGuide(true)}
                className="flex items-center gap-1 rounded-full px-2 py-1 text-[11.5px] font-semibold text-accent transition-colors hover:bg-accent/10"
              >
                <HelpCircle size={13} strokeWidth={2.4} />
                {t("How to get this")}
              </button>
            </HoverTooltip>
          }
          help={
            <>
              Episode titles, alternate names, network info, and the arc/DVD/absolute orderings.
              Layered on TMDB so the better source wins per field. Free for personal use at{" "}
              <ExtLink href="https://thetvdb.com/api-information">
                thetvdb.com/api-information
              </ExtLink>
              {'. Choose the "Less than $50k per year" tier.'}
            </>
          }
        />
        <EpisodeOrderSetting />
        <div className="mt-2 border-t border-edge-soft/60 pt-5">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
            {t("Card overlays")}
          </p>
          <CardOverlayPreview />
          <div className="flex flex-col gap-4">
            <ToggleRow
              label={t("Show tags on cards")}
              leading={
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-canvas text-ink-muted ring-1 ring-edge-soft">
                  <Tag size={17} strokeWidth={2} />
                </span>
              }
              sub={t("The New, In Cinema, Rerun, and Awards chips. Turn off for a cleaner grid. Score chips are separate, below.")}
              value={settings.showCardBadges}
              onChange={(v) => update({ showCardBadges: v })}
            />
            <ToggleRow
              label={t("Award tab on cards")}
              newId="library:award-tab"
              sub={t("Show a laurel award tab on winning titles, like Netflix. Replaces the corner award chip and sits centered so it clears the rating and watchlist pills. Pick where it sits below.")}
              value={settings.awardTabs}
              onChange={(v) => update({ awardTabs: v })}
            />
            {settings.awardTabs && (
              <div className="flex items-center justify-between gap-4 rounded-xl border border-edge-soft bg-canvas/40 px-4 py-3">
                <span className="text-[13.5px] font-medium text-ink">{t("Award tab position")}</span>
                <Segmented
                  value={settings.awardTabPosition}
                  options={[
                    { value: "above", label: t("Above ratings") },
                    { value: "below", label: t("Below ratings") },
                    { value: "top", label: t("Top of card") },
                  ]}
                  onChange={(v) => update({ awardTabPosition: v as "above" | "below" | "top" })}
                />
              </div>
            )}
            <ToggleRow
              label={t("Top 10 ribbon")}
              newId="library:top-10"
              sub={t("A TOP 10 corner ribbon on the Top 10 rail posters. The watchlist marker auto-moves to the opposite corner so nothing overlaps.")}
              value={settings.top10Ribbon}
              onChange={(v) => update({ top10Ribbon: v })}
            />
            {settings.top10Ribbon && (
              <div className="flex items-center justify-between gap-4 rounded-xl border border-edge-soft bg-canvas/40 px-4 py-3">
                <span className="text-[13.5px] font-medium text-ink">{t("Ribbon corner")}</span>
                <Segmented
                  value={settings.top10RibbonSide}
                  options={[
                    { value: "left", label: t("Top left") },
                    { value: "right", label: t("Top right") },
                  ]}
                  onChange={(v) => update({ top10RibbonSide: v as "left" | "right" })}
                />
              </div>
            )}
            <RatingsMatrix settings={settings} update={update} />
            <div className="flex flex-col gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">{t("Anime")}</p>
              {settings.showMalBadge && (
                <div className="flex items-center justify-between gap-4 rounded-xl border border-edge-soft bg-canvas/40 px-4 py-3">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[13.5px] font-medium text-ink">{t("Anime card rating source")}</span>
                    <span className="text-[12px] leading-snug text-ink-muted">
                      {t("Pick which score anime cards show. IMDb falls back to MAL when a title has no IMDb rating yet.")}
                    </span>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    {(
                      [
                        { id: "mal", label: t("MAL") },
                        { id: "imdb", label: t("IMDb") },
                      ] as const
                    ).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => update({ animeCardRating: s.id })}
                        aria-pressed={settings.animeCardRating === s.id}
                        className={`rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                          settings.animeCardRating === s.id
                            ? "bg-ink text-canvas"
                            : "bg-elevated/50 text-ink-muted ring-1 ring-edge-soft/60 hover:bg-elevated hover:text-ink"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <ToggleRow
                label={t("Show DUB badge on anime cards")}
                leading={
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center">
                    <span className="rounded-md bg-accent/90 px-1.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-canvas ring-1 ring-black/10 shadow-[0_2px_6px_rgba(0,0,0,0.35)]">
                      DUB
                    </span>
                  </span>
                }
                sub={t("Flags anime with an English dub. Also tags dub / sub / dual on stream sources.")}
                value={settings.showDubBadge}
                onChange={(v) => update({ showDubBadge: v })}
              />
            </div>
            <ToggleRow
              label={t("Mark watched button")}
              leading={
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30">
                  <Check size={18} strokeWidth={2.6} />
                </span>
              }
              sub={t("Show a button on the detail page to mark a title or episode as watched. Syncs to Trakt and Simkl if connected.")}
              value={settings.showWatchedButton}
              onChange={(v) => update({ showWatchedButton: v })}
            />
          </div>

          <p className="mb-3 mt-6 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
            {t("Score badges on cards")}
          </p>
          <CardBadgesPanel
            settings={settings}
            update={update}
            flags={badgeFlags}
            enabledBadgeCount={enabledBadgeCount}
          />
        </div>
      </Section>

      <Section
        title={t("Content filters")}
        subtitle={t("Hide entire categories. Toggling these also removes the matching sidebar entries and rails.")}
      >
        <ToggleRow
          label={t("Hide anime")}
          leading={<CatIcon src={animeCatIcon} />}
          sub={t("Removes the Anime tab and every anime title from all rows everywhere: Home, Discover, Top 10, and catalogs. Western animation like Pixar is kept, and you can still find anime by searching.")}
          value={settings.hideContent.anime}
          onChange={(v) => pushHideContent("anime", v)}
        />
        <ToggleRow
          label={t("Hide manga")}
          leading={
            <span className="flex h-10 w-10 shrink-0 items-center justify-center text-ink drop-shadow-[0_2px_6px_rgba(0,0,0,0.4)]">
              <BookOpen size={28} strokeWidth={2} />
            </span>
          }
          sub={t("Removes the Manga tab from the sidebar.")}
          value={settings.hideContent.manga}
          onChange={(v) => pushHideContent("manga", v)}
        />
        <ToggleRow
          label={t("Hide Live TV")}
          leading={<CatIcon src={livetvCatIcon} />}
          sub={t("Removes the Live TV tab from the sidebar.")}
          value={settings.hideContent.liveTv}
          onChange={(v) => pushHideContent("liveTv", v)}
        />
        <ToggleRow
          label={t("Hide adult content")}
          leading={<CatIcon src={adultCatIcon} />}
          sub={t("Filters out streams from adult catalogs and addons. On by default.")}
          value={settings.hideContent.adult}
          onChange={(v) => pushHideContent("adult", v)}
        />
      </Section>

      <Section
        title={t("Local library")}
        subtitle={t("Options for the Library → Local tab: folders you scan from your own drive. When you export metadata, Harbor writes a Kodi-style .nfo and downloads artwork next to each file at the sizes below.")}
      >
        <ToggleRow
          label={t("Show an “on disk” badge on cards")}
          sub={t("Marks movies and shows across Home, the catalogs, and detail pages when a matching file already exists in your local library.")}
          value={settings.showLocalLibraryBadge}
          onChange={(v) => update({ showLocalLibraryBadge: v })}
        />
        <div className="flex items-center justify-between gap-4 rounded-xl bg-canvas/40 px-4 py-3.5">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[13.5px] font-medium text-ink">{t("Minimum file size")}</span>
            <span className="text-[12px] leading-snug text-ink-muted">
              {t("Files smaller than this are skipped when scanning a folder, so clips and samples stay out. Set to 0 to include everything.")}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <input
              type="number"
              min={0}
              value={settings.localMinFileSizeMb}
              onChange={(e) =>
                update({ localMinFileSizeMb: Math.max(0, Math.round(Number(e.target.value) || 0)) })
              }
              className="h-10 w-20 rounded-lg border border-edge-soft bg-canvas/60 px-3 text-[13.5px] text-ink outline-none focus:border-edge"
            />
            <span className="text-[13px] text-ink-muted">{t("MB")}</span>
          </div>
        </div>
        <div className="flex flex-col gap-2 rounded-xl bg-canvas/40 px-4 py-3.5">
          <div className="flex flex-col gap-0.5">
            <span className="text-[13.5px] font-medium text-ink">{t("When a title is in your local library")}</span>
            <span className="text-[12px] leading-snug text-ink-muted">
              {t("What Play does when a movie or episode also exists on your disk. Autoplay always prefers the local copy unless set to Stream.")}
            </span>
          </div>
          <Segmented
            value={settings.localPlaybackMode}
            onChange={(v) => update({ localPlaybackMode: v })}
            options={[
              { value: "ask", label: t("Ask") },
              { value: "local", label: t("Play local") },
              { value: "stream", label: t("Stream") },
            ]}
          />
        </div>
        <div className="mt-2 flex flex-col gap-4 rounded-xl bg-canvas/40 p-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-[13.5px] font-medium text-ink">{t("Export artwork")}</span>
            <span className="text-[12px] leading-snug text-ink-muted">
              {t("The resolution Harbor downloads for each image when you export a title's metadata next to the file on disk.")}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <ArtworkField
              label={t("Poster")}
              ratio="portrait"
              value={settings.nfoPosterSize}
              options={POSTER_SIZES}
              onChange={(v) => update({ nfoPosterSize: v })}
            />
            <ArtworkField
              label={t("Backdrop")}
              ratio="landscape"
              value={settings.nfoBackdropSize}
              options={BACKDROP_SIZES}
              onChange={(v) => update({ nfoBackdropSize: v })}
            />
            <ArtworkField
              label={t("Logo")}
              ratio="logo"
              value={settings.nfoLogoSize}
              options={LOGO_SIZES}
              onChange={(v) => update({ nfoLogoSize: v })}
            />
          </div>
        </div>
      </Section>

    </>
  );
}

const POSTER_SIZES: DropdownOption[] = [
  { value: "w342", label: "342px (small)" },
  { value: "w500", label: "500px (recommended)" },
  { value: "w780", label: "780px (large)" },
  { value: "original", label: "Original" },
];
const BACKDROP_SIZES: DropdownOption[] = [
  { value: "w780", label: "780px (small)" },
  { value: "w1280", label: "1280px (recommended)" },
  { value: "original", label: "Original" },
];
const LOGO_SIZES: DropdownOption[] = [
  { value: "w300", label: "300px (small)" },
  { value: "w500", label: "500px (recommended)" },
  { value: "original", label: "Original" },
];

function ArtworkSwatch({ ratio }: { ratio: "portrait" | "landscape" | "logo" }) {
  const art = useSampleArtwork();
  if (ratio === "logo") {
    return (
      <div className="flex h-11 w-full items-center justify-center rounded-lg bg-elevated/50 px-3 ring-1 ring-edge-soft/60">
        {art.logo ? (
          <img src={art.logo} alt="" draggable={false} className="max-h-6 max-w-full object-contain" />
        ) : (
          <span className="font-display text-[13px] italic tracking-tight text-ink/50">Logo</span>
        )}
      </div>
    );
  }
  const src = ratio === "portrait" ? art.poster : art.background;
  const box = ratio === "portrait" ? "aspect-[2/3] w-[30px]" : "aspect-video w-[68px]";
  return (
    <div className="flex h-11 w-full items-center justify-center rounded-lg bg-elevated/50 ring-1 ring-edge-soft/60">
      <div className={`overflow-hidden rounded-[3px] bg-canvas shadow-sm ${box}`}>
        {src && <img src={src} alt="" draggable={false} className="h-full w-full object-cover" />}
      </div>
    </div>
  );
}

function ArtworkField({
  label,
  ratio,
  value,
  options,
  onChange,
}: {
  label: string;
  ratio: "portrait" | "landscape" | "logo";
  value: string;
  options: DropdownOption[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <ArtworkSwatch ratio={ratio} />
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
        {label}
      </span>
      <Dropdown value={value} options={options} onChange={onChange} />
    </div>
  );
}

function CatIcon({ src }: { src: string }) {
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      className="h-10 w-10 shrink-0 select-none object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.4)]"
    />
  );
}

function HomeModePicker({
  value,
  onChange,
}: {
  value: "harbor" | "classic";
  onChange: (v: "harbor" | "classic") => void;
}) {
  const options: Array<{ id: "harbor" | "classic"; label: string; sub: string; img: string }> = [
    {
      id: "harbor",
      label: "Harbor curated",
      sub: "Hero carousel, Top 10, Trending, In Theaters, per-service rails. Addon catalogs append underneath, deduped.",
      img: harborStyleImg,
    },
    {
      id: "classic",
      label: "Classic Stremio",
      sub: "Continue Watching, then your installed addons. Every catalog renders as its own row, install order, no dedup, no hero.",
      img: traditionalStyleImg,
    },
  ];
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {options.map((opt) => {
        const selected = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`group relative h-[180px] overflow-hidden rounded-2xl border bg-canvas text-start transition-all ${
              selected ? "border-ink shadow-[0_0_0_3px_rgba(255,255,255,0.04)]" : "border-edge-soft hover:border-edge"
            }`}
          >
            <img
              src={opt.img}
              alt=""
              aria-hidden
              draggable={false}
              className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover object-top"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-canvas/95 via-canvas/45 to-transparent"
            />
            <div
              aria-hidden
              className={`pointer-events-none absolute inset-0 bg-canvas/82 transition-opacity duration-300 ease-out ${
                selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              }`}
            />
            <span
              className={`absolute end-3 top-3 z-20 flex h-5 w-5 items-center justify-center rounded-full border-2 bg-canvas/85 transition-colors ${
                selected ? "border-ink" : "border-edge"
              }`}
            >
              {selected && <span className="h-2.5 w-2.5 rounded-full bg-ink" />}
            </span>
            <span
              className={`absolute bottom-4 start-5 z-10 text-[14.5px] font-semibold tracking-tight text-ink drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] transition-opacity duration-300 ${
                selected ? "opacity-0" : "opacity-100 group-hover:opacity-0"
              }`}
            >
              {opt.label}
            </span>
            <div
              className={`absolute inset-5 z-10 flex flex-col justify-center gap-2 transition-opacity duration-300 ${
                selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              }`}
            >
              <span className="text-[15px] font-semibold tracking-tight text-ink">
                {opt.label}
              </span>
              <span className="max-w-[88%] text-[12px] leading-relaxed text-ink-muted">
                {opt.sub}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function RetentionPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const options: Array<{ days: number; label: string }> = [
    { days: 0, label: "None" },
    { days: 7, label: "1 week" },
    { days: 30, label: "30 days" },
    { days: 90, label: "3 months" },
    { days: 180, label: "6 months" },
    { days: 365, label: "1 year" },
  ];
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
        Keep frames for
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const selected = value === opt.days;
          return (
            <button
              key={opt.days}
              type="button"
              onClick={() => onChange(opt.days)}
              className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors ${
                selected
                  ? "bg-ink text-canvas"
                  : "bg-raised text-ink-muted hover:bg-elevated hover:text-ink"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ClearSnapshotsButton() {
  const [count, setCount] = useState<number>(() => snapshotCount());
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const t = window.setTimeout(() => setConfirming(false), 4000);
    return () => window.clearTimeout(t);
  }, [confirming]);
  const onClick = () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    const cleared = clearAllSnapshots();
    setCount(0);
    setConfirming(false);
    void cleared;
  };
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-edge-soft bg-canvas/40 px-3.5 py-2.5">
      <div className="flex flex-col gap-0.5">
        <p className="text-[12.5px] font-medium text-ink">Clear all saved frames</p>
        <p className="text-[11.5px] leading-snug text-ink-subtle">
          {count > 0
            ? `${count} frame${count === 1 ? "" : "s"} stored. Wiping rebuilds them next time you watch.`
            : "No frames stored yet. They'll appear here as you watch things."}
        </p>
      </div>
      <button
        type="button"
        onClick={onClick}
        disabled={count === 0 && !confirming}
        className={`shrink-0 rounded-full px-3.5 py-2 text-[12px] font-semibold transition-colors ${
          confirming
            ? "bg-danger text-white hover:bg-danger/90"
            : "bg-raised text-ink-muted hover:bg-elevated hover:text-ink disabled:opacity-40"
        }`}
      >
        {confirming ? "Confirm clear" : "Clear all"}
      </button>
    </div>
  );
}
