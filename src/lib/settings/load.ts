import {
  DEFAULT_THEME,
  FONT_PAIRS,
  isKnownPreset,
  type CustomColors,
  type ThemeSettings,
} from "@/lib/theme";
import { languageName } from "@/lib/subtitles/language";
import { sanitizeSeekStep } from "@/lib/seek-step";
import { migrateModelId } from "@/lib/ai-models";
import { resolveUiLanguage } from "@/lib/i18n";
import { DEFAULT, STORAGE_KEY } from "./defaults";
import type { Settings } from "./types";

const HEX_RE = /^#[0-9a-f]{6}$/i;

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
      uiLanguage: resolveUiLanguage(undefined),
      seekBackStepSec: sanitizeSeekStep(legacySeekStep("back"), DEFAULT.seekBackStepSec),
      seekForwardStepSec: sanitizeSeekStep(legacySeekStep("forward"), DEFAULT.seekForwardStepSec),
    };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<Settings> & {
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
      _anilistSyncOnV1?: boolean;
      _rememberLastStreamOnV1?: boolean;
      _streamSortAddonV1?: boolean;
      scrapers?: unknown;
      scrapersAcknowledged?: boolean;
      _scrapersV2?: boolean;
    };
    if (!parsed._pickerLayoutStremioV2) {
      if (parsed.pickerLayout === "condensed") parsed.pickerLayout = "stremio";
      parsed._pickerLayoutStremio = true;
      parsed._pickerLayoutStremioV2 = true;
    }
    if (!parsed._stremioDeeplinkOnByDefault) {
      parsed.stremioDeeplinkInstall = true;
      parsed._stremioDeeplinkOnByDefault = true;
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
    if (parsed.aiSearchModel) parsed.aiSearchModel = migrateModelId(parsed.aiSearchModel);
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
    return {
      ...DEFAULT,
      ...parsed,
      uiLanguage: resolveUiLanguage(parsed.uiLanguage),
      streaming: { ...DEFAULT.streaming, ...(parsed.streaming ?? {}) },
      subProvidersEnabled: {
        ...DEFAULT.subProvidersEnabled,
        ...(parsed.subProvidersEnabled ?? {}),
        wyzie: false,
        opensubtitles: true,
      },
      hideContent: {
        ...DEFAULT.hideContent,
        ...(parsed.hideContent ?? {}),
      },
      homeRows: {
        ...DEFAULT.homeRows,
        ...(parsed.homeRows ?? {}),
      },
      navCustomization: {
        ...DEFAULT.navCustomization,
        ...(parsed.navCustomization ?? {}),
      },
      letterboxd: {
        ...DEFAULT.letterboxd,
        ...(parsed.letterboxd ?? {}),
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
      theme: sanitizeTheme(parsed.theme),
      webhooks: {
        ...DEFAULT.webhooks,
        ...(parsed.webhooks ?? {}),
        sources: {
          ...DEFAULT.webhooks.sources,
          ...(parsed.webhooks?.sources ?? {}),
        },
      },
      customCalendar: {
        ...DEFAULT.customCalendar,
        ...(parsed.customCalendar ?? {}),
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
    return { ...DEFAULT, uiLanguage: resolveUiLanguage(undefined) };
  }
}
