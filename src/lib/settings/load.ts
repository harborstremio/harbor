import {
  DEFAULT_THEME,
  FONT_PAIRS,
  isKnownPreset,
  type CustomColors,
  type ThemeSettings,
} from "@/lib/theme";
import { languageName } from "@/lib/subtitles/language";
import { sanitizeSeekStep } from "@/lib/seek-step";
import { migrateModelId, providerTabFor } from "@/lib/ai-models";
import {
  sanitizeFullscreenClockFormat,
  sanitizeFullscreenClockSize,
  sanitizeFullscreenClockStyle,
} from "@/lib/local-time";
import { normalizePosterCardSettings } from "@/lib/poster-backdrop-expansion";
import {
  sanitizeSubtitleOffsetPosition,
  sanitizeSubtitleOffsetSize,
} from "@/lib/player/subtitle-offset";

const RETIRED_GEMINI = new Set([
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash-exp",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
  "gemini-1.5-pro",
  "gemini-pro",
  "gemini-3-pro-preview",
]);
import { DEFAULT, STORAGE_KEY } from "./defaults";
import type { Settings } from "./types";
import { adoptLegacyPlaylists, readPlaylists } from "@/lib/iptv/playlists-store";

const HEX_RE = /^#[0-9a-f]{6}$/i;

function sanitizePosterDockTransition(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT.posterDockTransitionMs;
  }
  return Math.min(1500, Math.max(250, Math.round(value)));
}

function sanitizeSettingsPagePreferences(
  value: unknown,
): Settings["settingsPagePreferences"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Settings["settingsPagePreferences"] = {};
  for (const [section, rawPreference] of Object.entries(value)) {
    if (!/^[a-zA-Z][a-zA-Z0-9]{0,47}$/.test(section)) continue;
    if (!rawPreference || typeof rawPreference !== "object" || Array.isArray(rawPreference)) {
      continue;
    }
    const raw = rawPreference as Record<string, unknown>;
    const preference: Settings["settingsPagePreferences"][string] = {};
    if (typeof raw.favorite === "boolean") preference.favorite = raw.favorite;
    if (typeof raw.compact === "boolean") preference.compact = raw.compact;
    if (typeof raw.showIntro === "boolean") preference.showIntro = raw.showIntro;
    result[section] = preference;
  }
  return result;
}

function sanitizeTopbarAppearance(
  value: unknown,
  transparent: unknown,
  glassControls: unknown,
): Settings["topbarAppearance"] {
  if (value === "transparent" || value === "glass" || value === "filled") return value;
  if (glassControls === true) return "glass";
  return transparent === false ? "filled" : "transparent";
}

function legacySeekStep(direction: "back" | "forward"): number | undefined {
  try {
    const raw = localStorage.getItem(`harbor.seek-step.${direction}`);
    if (!raw) return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  } catch {
    return undefined;
  }
}

function sanitizeCustomColors(c: unknown): CustomColors | null {
  if (!c || typeof c !== "object") return null;
  const obj = c as Partial<CustomColors>;
  const keys: Array<keyof CustomColors> = [
    "canvas",
    "surface",
    "elevated",
    "raised",
    "ink",
    "inkMuted",
    "inkSubtle",
    "edge",
    "accent",
    "danger",
  ];
  const out = {} as CustomColors;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v !== "string" || !HEX_RE.test(v)) return null;
    out[k] = v;
  }
  return out;
}

export function sanitizeTheme(t: Partial<ThemeSettings> | undefined): ThemeSettings {
  if (!t) return DEFAULT_THEME;
  const isBuiltIn =
    typeof t.preset === "string" && t.preset !== "custom" && isKnownPreset(t.preset);
  const isUserPreset = typeof t.preset === "string" && t.preset.startsWith("user:");
  const isPreset = isBuiltIn || isUserPreset;
  const isCustom = t.preset === "custom";
  const fontOk = typeof t.fontPair === "string" && t.fontPair in FONT_PAIRS;
  const dimOk = typeof t.backgroundDim === "number" && t.backgroundDim >= 0 && t.backgroundDim <= 1;
  const imgOk =
    t.backgroundImage == null ||
    (typeof t.backgroundImage === "string" && t.backgroundImage.length < 3_000_000);
  const customColors = sanitizeCustomColors(t.customColors);
  const preset: ThemeSettings["preset"] = isPreset
    ? (t.preset as ThemeSettings["preset"])
    : isCustom && customColors
      ? "custom"
      : DEFAULT_THEME.preset;
  return {
    preset,
    fontPair: fontOk ? (t.fontPair as ThemeSettings["fontPair"]) : DEFAULT_THEME.fontPair,
    backgroundDim: dimOk ? (t.backgroundDim as number) : DEFAULT_THEME.backgroundDim,
    backgroundImage: imgOk ? (t.backgroundImage ?? null) : null,
    customColors,
    customFontId: typeof t.customFontId === "string" ? t.customFontId : null,
  };
}

export function loadStoredSettings(rawKey: string = STORAGE_KEY): Settings {
  const raw = localStorage.getItem(rawKey);
  if (!raw) {
    return {
      ...DEFAULT,
      seekBackStepSec: sanitizeSeekStep(legacySeekStep("back"), DEFAULT.seekBackStepSec),
      seekForwardStepSec: sanitizeSeekStep(legacySeekStep("forward"), DEFAULT.seekForwardStepSec),
    };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<Settings> & {
      topbarGlassControls?: boolean;
      _subStyleV2?: boolean;
      _subAssForceV1?: boolean;
      _subAssRespectV2?: boolean;
      _mpvEmbedV2?: boolean;
      _mpvEmbedV3?: boolean;
      _mpvEmbedV4?: boolean;
      _anime4kIndicatorOffV1?: boolean;
      _pickerLayoutStremio?: boolean;
      _pickerLayoutStremioV2?: boolean;
      _stremioDeeplinkOnByDefault?: boolean;
      _contentAdvisoryOnByDefaultV1?: boolean;
      _skipButtonHideSecV2?: boolean;
      _anilistSyncOnV1?: boolean;
      _rememberLastStreamOnV1?: boolean;
      _streamSortAddonV1?: boolean;
      scrapers?: unknown;
      scrapersAcknowledged?: boolean;
      _scrapersV2?: boolean;
      _animeRowsV1?: boolean;
      _tennisWtaV1?: boolean;
      _liquidGlassOptIn?: boolean;
      _navThemeRepairV1?: boolean;
      _playlistsTabV1?: boolean;
      _smoothScrollOptIn?: boolean;
      _streamCacheCapV1?: boolean;
      _d3d11FlipSafeDefaultV1?: boolean;
    };
    if (!parsed._animeRowsV1) {
      const prev = (parsed.animeRows ?? {}) as Partial<Settings["animeRows"]>;
      const hiddenSet = new Set<string>(Array.isArray(prev.hidden) ? prev.hidden : []);
      const anilist = Array.isArray(parsed.animeAnilistRowsHidden)
        ? parsed.animeAnilistRowsHidden
        : [];
      const mal = Array.isArray(parsed.animeMalRowsHidden) ? parsed.animeMalRowsHidden : [];
      if (anilist.includes("yourLists")) hiddenSet.add("yourAnilistLists");
      if (anilist.includes("trending")) hiddenSet.add("anilistTrending");
      if (anilist.includes("top100")) hiddenSet.add("anilistTop100");
      if (mal.includes("yourMalLists")) hiddenSet.add("yourMalLists");
      parsed.animeRows = {
        order: Array.isArray(prev.order) ? prev.order : [],
        hidden: [...hiddenSet],
        renamed: prev.renamed && typeof prev.renamed === "object" ? prev.renamed : {},
      };
      parsed._animeRowsV1 = true;
    }
    if (!parsed._pickerLayoutStremioV2) {
      if (parsed.pickerLayout === "condensed") parsed.pickerLayout = "stremio";
      parsed._pickerLayoutStremio = true;
      parsed._pickerLayoutStremioV2 = true;
    }
    if (!parsed._stremioDeeplinkOnByDefault) {
      parsed.stremioDeeplinkInstall = true;
      parsed._stremioDeeplinkOnByDefault = true;
    }
    if (!parsed._contentAdvisoryOnByDefaultV1) {
      parsed.contentAdvisoryToast = true;
      parsed._contentAdvisoryOnByDefaultV1 = true;
    }
    if (parsed.contentAdvisoryTheme !== "monochrome" && parsed.contentAdvisoryTheme !== "colored") {
      parsed.contentAdvisoryTheme = "colored";
    }
    if (!parsed._skipButtonHideSecV2) {
      if (
        parsed.skipButtonHideSec === 10 ||
        parsed.skipButtonHideSec === 20 ||
        parsed.skipButtonHideSec == null
      ) {
        parsed.skipButtonHideSec = 14;
      }
      parsed._skipButtonHideSecV2 = true;
    }
    if (!parsed._anilistSyncOnV1) {
      parsed.anilistAutoSync = true;
      parsed._anilistSyncOnV1 = true;
    }
    if (!parsed._rememberLastStreamOnV1) {
      parsed.rememberLastStream = true;
      parsed._rememberLastStreamOnV1 = true;
    }
    if (!parsed._streamSortAddonV1) {
      if (parsed.streamSort === "harbor") parsed.streamSort = "addon";
      parsed._streamSortAddonV1 = true;
    }
    if (!parsed._tennisWtaV1) {
      if (Array.isArray(parsed.sportsLeagues) && parsed.sportsLeagues.includes("TENNIS")) {
        if (!parsed.sportsLeagues.includes("TENNIS_WTA")) parsed.sportsLeagues.push("TENNIS_WTA");
      }
      parsed._tennisWtaV1 = true;
    }
    if (
      typeof parsed.songIdAiModel === "string" &&
      RETIRED_GEMINI.has(parsed.songIdAiModel.trim())
    ) {
      parsed.songIdAiModel = DEFAULT.songIdAiModel;
    }
    if (parsed.aiSearchModel) parsed.aiSearchModel = migrateModelId(parsed.aiSearchModel);
    if (parsed.aiSearchProvider !== "groq" && parsed.aiSearchProvider !== "openrouter") {
      parsed.aiSearchProvider = parsed.aiSearchModel
        ? providerTabFor(parsed.aiSearchModel)
        : "openrouter";
    }
    if (!parsed._mpvEmbedV3) {
      parsed.playerMpvEmbed = true;
      parsed._mpvEmbedV3 = true;
    }
    if (!parsed._mpvEmbedV4) {
      parsed.playerMpvEmbed = true;
      parsed._mpvEmbedV4 = true;
    }
    if (!parsed._anime4kIndicatorOffV1) {
      parsed.playerAnime4kIndicator = false;
      parsed._anime4kIndicatorOffV1 = true;
    }
    if (!parsed._subStyleV2) {
      if (parsed.subFontSize === 55) parsed.subFontSize = DEFAULT.subFontSize;
      if (parsed.subBorderSize === 3) parsed.subBorderSize = DEFAULT.subBorderSize;
      if (parsed.subMarginY === 22) parsed.subMarginY = DEFAULT.subMarginY;
      parsed._subStyleV2 = true;
    }
    delete parsed.scrapers;
    delete parsed.scrapersAcknowledged;
    delete parsed._scrapersV2;
    if (!parsed._liquidGlassOptIn) {
      parsed.liquidGlass = false;
      parsed.experimentalLiquidGlassEnabled = false;
      parsed._liquidGlassOptIn = true;
    }
    if (!parsed._smoothScrollOptIn) {
      parsed.smoothScroll = false;
      parsed._smoothScrollOptIn = true;
    }
    if (!parsed._streamCacheCapV1) {
      if (parsed.streamCacheMaxGb === 0 || parsed.streamCacheMaxGb == null) {
        parsed.streamCacheMaxGb = DEFAULT.streamCacheMaxGb;
      }
      if (parsed.streamCacheRetentionHours === 24 || parsed.streamCacheRetentionHours == null) {
        parsed.streamCacheRetentionHours = DEFAULT.streamCacheRetentionHours;
      }
      parsed._streamCacheCapV1 = true;
    }
    if (!parsed._d3d11FlipSafeDefaultV1) {
      // This compatibility mode used to default to on even though it disables
      // D3D11 flip-model presentation and its own UI warns about 4K/HDR
      // slowdowns. Make the safe path the one-time default for existing
      // profiles; users with the rare bright-edge artifact can opt in again.
      parsed.playerD3d11Flip = false;
      parsed._d3d11FlipSafeDefaultV1 = true;
    }
    if (!parsed._playlistsTabV1) {
      const lists = readPlaylists();
      const hasVodSource = Array.isArray(lists) && lists.some((l) => l?.kind !== "epg");
      if (hasVodSource) parsed.showPlaylistsTab = true;
      parsed._playlistsTabV1 = true;
    }
    // Playlists now live in their own store; adopt any stranded legacy field and
    // only drop it once it has been persisted, so a failed write never loses data.
    if ("iptvPlaylists" in parsed) {
      if (adoptLegacyPlaylists(Array.isArray(parsed.iptvPlaylists) ? parsed.iptvPlaylists : [])) {
        delete parsed.iptvPlaylists;
      }
    }
    if (!parsed._navThemeRepairV1) {
      const nav = parsed.navCustomization as Partial<Settings["navCustomization"]> | undefined;
      if (nav && Array.isArray(nav.hidden) && nav.hidden.length > 0) {
        parsed.navCustomization = { ...nav, hidden: [] } as Settings["navCustomization"];
      }
      parsed._navThemeRepairV1 = true;
    }
    const posterCards = normalizePosterCardSettings(parsed);
    return {
      ...DEFAULT,
      ...parsed,
      ...posterCards,
      settingsPagePreferences: sanitizeSettingsPagePreferences(parsed.settingsPagePreferences),
      topbarAppearance: sanitizeTopbarAppearance(
        parsed.topbarAppearance,
        parsed.transparentTopBar,
        parsed.topbarGlassControls,
      ),
      posterDockTransitionMs: sanitizePosterDockTransition(parsed.posterDockTransitionMs),
      fullscreenClockEnabled:
        typeof parsed.fullscreenClockEnabled === "boolean"
          ? parsed.fullscreenClockEnabled
          : DEFAULT.fullscreenClockEnabled,
      fullscreenClockFormat: sanitizeFullscreenClockFormat(parsed.fullscreenClockFormat),
      fullscreenClockStyle: sanitizeFullscreenClockStyle(parsed.fullscreenClockStyle),
      fullscreenClockShowSeconds:
        typeof parsed.fullscreenClockShowSeconds === "boolean"
          ? parsed.fullscreenClockShowSeconds
          : DEFAULT.fullscreenClockShowSeconds,
      fullscreenClockShowEndTime:
        typeof parsed.fullscreenClockShowEndTime === "boolean"
          ? parsed.fullscreenClockShowEndTime
          : DEFAULT.fullscreenClockShowEndTime,
      fullscreenClockSizePx: sanitizeFullscreenClockSize(parsed.fullscreenClockSizePx),
      streaming: { ...DEFAULT.streaming, ...parsed.streaming },
      subOffsetIndicatorEnabled:
        typeof parsed.subOffsetIndicatorEnabled === "boolean"
          ? parsed.subOffsetIndicatorEnabled
          : DEFAULT.subOffsetIndicatorEnabled,
      subOffsetIndicatorPosition: sanitizeSubtitleOffsetPosition(parsed.subOffsetIndicatorPosition),
      subOffsetIndicatorSize: sanitizeSubtitleOffsetSize(parsed.subOffsetIndicatorSize),
      subProvidersEnabled: {
        ...DEFAULT.subProvidersEnabled,
        ...parsed.subProvidersEnabled,
      },
      hideContent: {
        ...DEFAULT.hideContent,
        ...parsed.hideContent,
      },
      homeRows: {
        ...DEFAULT.homeRows,
        ...parsed.homeRows,
      },
      navCustomization: {
        ...DEFAULT.navCustomization,
        ...parsed.navCustomization,
      },
      animeRows: {
        ...DEFAULT.animeRows,
        ...parsed.animeRows,
      },
      letterboxd: {
        ...DEFAULT.letterboxd,
        ...parsed.letterboxd,
      },
      preferredSubLangs: (parsed.preferredSubLangs ?? DEFAULT.preferredSubLangs).map(languageName),
      preferredAudioLangs: (parsed.preferredAudioLangs ?? DEFAULT.preferredAudioLangs).map(
        languageName,
      ),
      castAlwaysTranscode: parsed.castAlwaysTranscode ?? DEFAULT.castAlwaysTranscode,
      showMalBadge: parsed.showMalBadge ?? DEFAULT.showMalBadge,
      badgePlacement:
        parsed.badgePlacement === "top" || parsed.badgePlacement === "bottom"
          ? parsed.badgePlacement
          : DEFAULT.badgePlacement,
      harborColor:
        typeof parsed.harborColor === "string" && HEX_RE.test(parsed.harborColor)
          ? parsed.harborColor
          : DEFAULT.harborColor,
      traktClientId: parsed.traktClientId ?? DEFAULT.traktClientId,
      traktClientSecret: parsed.traktClientSecret ?? DEFAULT.traktClientSecret,
      traktAccessToken: parsed.traktAccessToken ?? DEFAULT.traktAccessToken,
      traktRefreshToken: parsed.traktRefreshToken ?? DEFAULT.traktRefreshToken,
      traktExpiresAt: parsed.traktExpiresAt ?? DEFAULT.traktExpiresAt,
      traktUsername: parsed.traktUsername ?? DEFAULT.traktUsername,
      seekBackStepSec: sanitizeSeekStep(
        parsed.seekBackStepSec ?? legacySeekStep("back"),
        DEFAULT.seekBackStepSec,
      ),
      seekForwardStepSec: sanitizeSeekStep(
        parsed.seekForwardStepSec ?? legacySeekStep("forward"),
        DEFAULT.seekForwardStepSec,
      ),
      seekBackStepShortSec: sanitizeSeekStep(
        parsed.seekBackStepShortSec,
        DEFAULT.seekBackStepShortSec,
      ),
      seekForwardStepShortSec: sanitizeSeekStep(
        parsed.seekForwardStepShortSec,
        DEFAULT.seekForwardStepShortSec,
      ),
      theme: sanitizeTheme(parsed.theme),
      webhooks: {
        ...DEFAULT.webhooks,
        ...parsed.webhooks,
        sources: {
          ...DEFAULT.webhooks.sources,
          ...parsed.webhooks?.sources,
        },
      },
      customCalendar: {
        ...DEFAULT.customCalendar,
        ...parsed.customCalendar,
        trackedPeople: Array.isArray(parsed.customCalendar?.trackedPeople)
          ? parsed.customCalendar.trackedPeople
          : [],
        genres: Array.isArray(parsed.customCalendar?.genres) ? parsed.customCalendar.genres : [],
        watchProviders: Array.isArray(parsed.customCalendar?.watchProviders)
          ? parsed.customCalendar.watchProviders
          : [],
        originCountries: Array.isArray(parsed.customCalendar?.originCountries)
          ? parsed.customCalendar.originCountries
          : [],
        mediaTypes: {
          movie: parsed.customCalendar?.mediaTypes?.movie !== false,
          tv: parsed.customCalendar?.mediaTypes?.tv !== false,
          anime: parsed.customCalendar?.mediaTypes?.anime !== false,
        },
      },
      webhookRules: Array.isArray(parsed.webhookRules) ? parsed.webhookRules : [],
      customStreamFilters: Array.isArray(parsed.customStreamFilters)
        ? parsed.customStreamFilters
        : DEFAULT.customStreamFilters,
      streamPriority: Array.isArray(parsed.streamPriority)
        ? parsed.streamPriority
        : DEFAULT.streamPriority,
      animeFavoriteGenres: Array.isArray(parsed.animeFavoriteGenres)
        ? parsed.animeFavoriteGenres.filter((g): g is number => typeof g === "number")
        : DEFAULT.animeFavoriteGenres,
      animePicksDismissedAt:
        typeof parsed.animePicksDismissedAt === "number"
          ? parsed.animePicksDismissedAt
          : DEFAULT.animePicksDismissedAt,
      animeAnilistRowsHidden: Array.isArray(parsed.animeAnilistRowsHidden)
        ? parsed.animeAnilistRowsHidden.filter((k): k is string => typeof k === "string")
        : DEFAULT.animeAnilistRowsHidden,
      tmdbImageLangs: Array.isArray(parsed.tmdbImageLangs)
        ? parsed.tmdbImageLangs.filter((l): l is string => typeof l === "string")
        : DEFAULT.tmdbImageLangs,
    };
  } catch {
    return DEFAULT;
  }
}
