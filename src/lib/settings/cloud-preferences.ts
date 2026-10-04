import type { Settings } from "./types";
import { normalizeLanguage } from "@/lib/i18n/languages";

// Deliberately opt-in: Settings also contains credentials, local paths and GPU-specific
// controls. Adding a new Settings field must never put it on the account by accident.
const BOOLEAN_FIELDS = [
  "blurComments", "blurEpisodes", "showImdbBadge", "showSubtitleIndicator",
  "showTmdbBadge", "showRtBadge", "showMalBadge", "showLetterboxdBadge",
  "showTraktBadge", "showDetailRatings", "showQualityBadge", "showCardBadges",
  "posterBackdropExpansion", "posterFocusedCard", "top10Ribbon", "awardTabs",
  "heroBackdropCarousel", "heroTrailers", "heroTrailerAudio", "detailTrailerAutoplay",
  "detailTrailerAudio", "resumePrompt", "resumePlayback", "contentAdvisoryToast",
  "contentAdvisoryShowIgnore", "showWatchedButton", "showEpisodeRating",
  "showEpisodeDescription", "episodeHiding", "hdEpisodeImages", "episodeArcGroups",
  "playerScreenLockEnabled", "seasonSourceLock", "rememberLastStream",
  "keepSourceNextEpisode", "subBold", "subHideSdh", "subtitlesOffByDefault",
  "preferEmbeddedSubs", "subtitleAutoUpgrade", "subtitlePreselect", "autoSkipIntro",
  "autoSkipRecap", "autoSkipOutro", "autoSkipAd", "showSkipButton",
  "forcedSubsWhenNativeAudio", "autoPlayNextEpisode", "stillWatching",
  "hideWatchedInCatalogs", "hideUnreleased", "hideSpoilers", "spoilerHideThumbnails",
  "spoilerHideTitles", "spoilerHideDescriptions", "spoilerSkipNext",
  "homeNewEpisodes", "libraryBookmarkedOnly", "preferCustomMetaAddon",
  "animeOnlyInAnimeRoom", "cwAdvanceNext", "cwHideCaughtUp",
  "translateTitles", "translateDescriptions", "hoverPreviewEnabled",
] as const satisfies readonly (keyof Settings)[];

const STRING_LIST_FIELDS = [
  "preferredLanguages", "homeLanguages", "preferredSubLangs", "preferredAudioLangs",
  "tmdbImageLangs", "trackBlockWords",
] as const satisfies readonly (keyof Settings)[];

const ENUM_FIELDS = {
  badgePlacement: ["top", "bottom"],
  contentAdvisoryTheme: ["colored", "monochrome"],
  episodeLayout: ["list", "strip", "grid"],
  episodeSort: ["oldest", "newest"],
  heroFeed: ["trending", "trakt", "simkl", "classic"],
  homeMode: ["harbor", "classic"],
  librarySort: ["recent", "title", "year"],
  pickerLayout: ["condensed", "stremio"],
  posterEffect: ["blur", "fade", "off"],
  posterQuality: ["balanced", "high", "max"],
  qualityBadgeStyle: ["bar", "chips"],
  subAlignX: ["left", "center", "right"],
  subAssOverride: ["no", "yes", "force", "scale", "strip"],
  subSecondaryPlacement: ["top", "bottom"],
  subStyle: ["shadow", "outline", "box"],
  streamSort: ["harbor", "addon"],
  watchlistBadge: ["off", "topStart", "topEnd", "bottomStart", "bottomEnd"],
} as const satisfies Partial<Record<keyof Settings, readonly string[]>>;

const NUMBER_FIELDS = {
  cardBadgeLimit: [0, 12],
  defaultPlaybackSpeed: [0.25, 4],
  episodeCardScale: [0.5, 2],
  nextEpisodeLeadSec: [-1, 600],
  posterRadius: [0, 50],
  posterScale: [0.5, 2],
  seekBackStepSec: [1, 300],
  seekForwardStepSec: [1, 300],
  skipButtonHideSec: [0, 120],
  stillWatchingAfter: [1, 20],
  subBorderSize: [0, 20],
  subBoxOpacity: [0, 1],
  subFontSize: [8, 120],
  subLineSpacing: [-20, 100],
  subMarginY: [0, 200],
  subOpacity: [0, 1],
  subSecondaryScale: [0.25, 2],
} as const satisfies Partial<Record<keyof Settings, readonly [number, number]>>;

const TEXT_FIELDS = ["secondarySubLang"] as const satisfies readonly (keyof Settings)[];
const LANGUAGE_FIELDS = ["uiLanguage", "tmdbLanguage", "region"] as const satisfies readonly (keyof Settings)[];
const COLOR_FIELDS = ["subFontColor", "subBorderColor", "subBoxColor"] as const satisfies readonly (keyof Settings)[];

const FIELDS = new Set<string>([
  ...BOOLEAN_FIELDS, ...STRING_LIST_FIELDS, ...Object.keys(ENUM_FIELDS),
  ...Object.keys(NUMBER_FIELDS), ...TEXT_FIELDS, ...LANGUAGE_FIELDS, ...COLOR_FIELDS,
]);
const MAX_WIRE_CHARS = 20_000;

function valid(key: string, value: unknown): boolean {
  if ((BOOLEAN_FIELDS as readonly string[]).includes(key)) return typeof value === "boolean";
  if ((STRING_LIST_FIELDS as readonly string[]).includes(key)) {
    return Array.isArray(value) && value.length <= 32 &&
      value.every((item) => typeof item === "string" && item.length <= 80);
  }
  if (Object.hasOwn(ENUM_FIELDS, key)) {
    return typeof value === "string" &&
      (ENUM_FIELDS as Record<string, readonly string[]>)[key].includes(value);
  }
  if (Object.hasOwn(NUMBER_FIELDS, key)) {
    const [min, max] = (NUMBER_FIELDS as Record<string, readonly [number, number]>)[key];
    return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
  }
  if ((TEXT_FIELDS as readonly string[]).includes(key)) {
    return typeof value === "string" && value.length <= 80;
  }
  if ((COLOR_FIELDS as readonly string[]).includes(key)) {
    return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
  }
  if (key === "region") return typeof value === "string" && /^[A-Z]{2}$/.test(value);
  if (key === "tmdbLanguage") return typeof value === "string" &&
    (value === "" || /^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(value));
  if (key === "uiLanguage") return typeof value === "string" &&
    normalizeLanguage(value) === value;
  return false;
}

export function hasCloudPreference(patch: Partial<Settings>): boolean {
  return Object.keys(patch).some((key) => FIELDS.has(key));
}

export function encodeCloudPreferences(settings: Settings): string {
  const values: Record<string, unknown> = {};
  for (const key of FIELDS) {
    const value = settings[key as keyof Settings];
    if (valid(key, value)) values[key] = value;
  }
  return JSON.stringify({ version: 1, values });
}

export function decodeCloudPreferences(raw: unknown): Partial<Settings> | null {
  if (typeof raw !== "string" || raw.length > MAX_WIRE_CHARS) return null;
  try {
    const payload: unknown = JSON.parse(raw);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
    const { version, values } = payload as Record<string, unknown>;
    if (version !== 1 || !values || typeof values !== "object" || Array.isArray(values)) return null;
    const patch: Record<string, unknown> = {};
    for (const key of FIELDS) {
      const value = (values as Record<string, unknown>)[key];
      if (valid(key, value)) patch[key] = value;
    }
    return Object.keys(patch).length ? patch as Partial<Settings> : null;
  } catch {
    return null;
  }
}
