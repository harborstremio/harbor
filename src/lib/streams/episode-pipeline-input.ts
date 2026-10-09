import { addonBasesForOrigin, type Addon } from "@/lib/addons";
import { isAddonNativeMeta, type Meta } from "@/lib/cinemeta";
import type { DebridStore } from "@/lib/debrid/types";
import { readPlayback } from "@/lib/playback-history";
import type { Settings } from "@/lib/settings";
import type { PlayEpisode } from "@/lib/view";
import { resolveAddonRanks } from "./addon-priority";
import { animeAbsoluteFromScopedId } from "./anime-identity-core";
import type { PipelineInput } from "./pipeline";
import { PLUGIN_ADDON_PREFIX, isPluginAddon, pluginAddonById, pluginIdFromCatalogueBase, pluginsForAddon } from "./plugins/addon";
import { unverifiedAnimeSeasonId } from "./stream-ids";
import type { Stream } from "./types";

function runtimeMinutes(runtime: string | number | undefined): number | undefined {
  if (runtime == null) return undefined;
  if (typeof runtime === "number") return runtime > 0 ? runtime : undefined;
  const m = /(\d+)/.exec(runtime);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function embeddedStreams(
  meta: Meta,
  episode: PlayEpisode | undefined,
  addonBase: string | undefined,
): Stream[] {
  const vids = meta.videos ?? [];
  if (vids.length === 0) return [];
  const pick = episode?.videoId
    ? vids.find((v) => v.id === episode.videoId)
    : episode
      ? vids.find(
          (v) =>
            (v.season ?? null) === episode.season &&
            (v.episode ?? v.number ?? null) === episode.episode,
        )
      : (vids.find((v) => v.id === meta.id) ?? (vids.length === 1 ? vids[0] : undefined));
  const raw = pick?.streams ?? [];
  return raw.map(
    (s) =>
      ({
        ...s,
        addonId: meta.addonOrigin?.id ?? "embedded",
        addonName: meta.addonOrigin?.name ?? "Addon",
        addonUrl: addonBase,
      }) as unknown as Stream,
  );
}

export function buildEpisodePipelineInput(params: {
  meta: Meta;
  episode: PlayEpisode | undefined;
  imdbId: string | null;
  streamIds: string[];
  addons: Addon[];
  debrids: DebridStore[];
  settings: Settings;
  strictMode: boolean;
  filterDisabled: boolean;
  animeTitles?: string[] | null;
  /** Resolve the item's own plugin when it names one, even where plugins are otherwise kept out.
   * Background work opts out, so the switch keeps plugins out of it entirely. */
  resolvePinnedPlugin?: boolean;
}): PipelineInput {
  const {
    meta,
    episode,
    imdbId,
    streamIds,
    addons,
    debrids,
    settings,
    strictMode,
    filterDisabled,
    animeTitles,
  } = params;
  const originBases = addonBasesForOrigin(addons, meta.addonOrigin);
  // An item that names the plugin that listed it is that plugin's to answer, even where plugins
  // are otherwise kept out: this is the item's own source being resolved, not plugins being
  // browsed. Without this a saved plugin row plays nowhere the moment the outside-tab switch is
  // off, because the switch keeps every plugin addon out of the list above.
  let effectiveAddons = addons;
  let pinnedId: string | undefined;
  // The master switch wins: with every plugin paused there is nothing to resolve an item with,
  // however it names its source.
  if (params.resolvePinnedPlugin !== false && settings.pluginsEnabled) {
    pinnedId = originBases
      .map((base) => pluginIdFromCatalogueBase(base))
      .find((id) => id != null);
    // A plugin row names its plugin by id rather than by base, and a saved row may have kept
    // only that; either way the name is enough when it belongs to an installed plugin.
    if (!pinnedId && meta.addonOrigin?.id && pluginAddonById(meta.addonOrigin.id)) {
      pinnedId = meta.addonOrigin.id;
    }
  }
  // The pin is honoured only while its addon answers: a repository grouping that already covers
  // the plugin is left to answer as a group rather than being asked twice.
  let appendedBase: string | undefined;
  if (pinnedId) {
    const url = `${PLUGIN_ADDON_PREFIX}${pinnedId}`;
    const covered = effectiveAddons.some(
      (a) =>
        a.transportUrl === url ||
        (isPluginAddon(a) && pluginsForAddon(a).some((p) => `${PLUGIN_ADDON_PREFIX}${p.id}` === url)),
    );
    if (!covered) {
      const only = pluginAddonById(pinnedId);
      if (only) {
        effectiveAddons = [...effectiveAddons, only];
        appendedBase = url;
      }
    }
  }
  const embedded = embeddedStreams(meta, episode, originBases[0]);
  const addonNative = isAddonNativeMeta(meta);
  const requestType = addonNative
    ? meta.type
    : episode
      ? "series"
      : meta.type === "series"
        ? "series"
        : "movie";
  const animeReq = streamIds.some((id) => id.startsWith("kitsu:") || id.startsWith("mal:"));
  const unverifiedAnimeId = unverifiedAnimeSeasonId(meta.id, episode);
  const animeIdUnverified =
    unverifiedAnimeId != null &&
    streamIds.includes(unverifiedAnimeId) &&
    streamIds[0] !== unverifiedAnimeId &&
    !streamIds.some((id) => id !== unverifiedAnimeId && /^(kitsu|mal|anidb|anilist):/.test(id));
  const animeAbsoluteEpisode = animeReq
    ? (streamIds.map(animeAbsoluteFromScopedId).find((n) => n != null) ?? null)
    : null;
  // Split-franchise cours (Bleach TYBW) are numbered entry-relative while addon
  // streams often use provider coords (cour 4 ep 1 = S17E41). Accept both so the
  // episode filter keeps streams in either numbering and drops clear mismatches.
  const animeEpisodeAliases =
    animeReq &&
    episode?.imdbEpisode != null &&
    episode?.episode != null &&
    episode.imdbEpisode !== episode.episode
      ? new Set<number>([episode.imdbEpisode])
      : null;
  const imdbEpAligned =
    !animeReq || episode?.imdbEpisode == null || episode.episode === episode.imdbEpisode;
  const effSeason = imdbEpAligned ? (episode?.imdbSeason ?? episode?.season) : episode?.season;
  const effEpisode = imdbEpAligned ? (episode?.imdbEpisode ?? episode?.episode) : episode?.episode;
  const prevGroup =
    episode && typeof effSeason === "number" && typeof effEpisode === "number" && effEpisode > 1
      ? (readPlayback(meta.id, effSeason, effEpisode - 1)?.releaseGroup ?? undefined)
      : undefined;
  return {
    request: {
      type: requestType,
      ids: streamIds,
      animeIdUnverified,
      context: {
        imdbId: imdbId ?? null,
        title: meta.name,
        year: parseInt(meta.releaseInfo ?? "", 10) || null,
        season: effSeason ?? null,
        episode: effEpisode ?? null,
        absoluteEpisode: animeAbsoluteEpisode,
      },
    },
    query: {
      type: episode ? "series" : meta.type === "series" ? "series" : "movie",
      imdbId: imdbId ?? "",
      title: meta.name,
      year: parseInt(meta.releaseInfo ?? "", 10) || undefined,
      season: animeReq && episode?.imdbSeason == null ? undefined : effSeason,
      episode: animeReq && episode?.imdbEpisode == null ? episode?.episode : effEpisode,
    },
    addons: effectiveAddons,
    debrids,
    isAnime: animeReq,
    animeAbsoluteEpisode,
    animeEpisodeAliases,
    presetStreams: embedded.length > 0 ? embedded : undefined,
    addonTimeoutMs: Math.max(8, Math.min(120, settings.addonTimeoutSec ?? 30)) * 1000,
    addonRanks: resolveAddonRanks(effectiveAddons, settings.streamPriority),
    forcedAddonBases: (() => {
      const forced = originBases.map((base) => ({ base, id: meta.id }));
      if (appendedBase) forced.push({ base: appendedBase, id: meta.id });
      return forced.length > 0 ? forced : undefined;
    })(),
    trust: {
      kind: episode ? "series" : meta.type === "series" ? "series" : "movie",
      expectedTitle: meta.name,
      releaseDate: meta.releaseDate ?? null,
      expectedYear: parseInt(meta.releaseInfo ?? "", 10) || null,
      expectedSeason: effSeason ?? null,
      expectedEpisode: effEpisode ?? null,
      strict: strictMode,
      disabled: filterDisabled || addonNative || embedded.length > 0,
      preferredLanguages: settings.preferredLanguages,
      preferredAudioLangs: settings.preferredAudioLangs,
      requirePreferredLanguage: strictMode && settings.requirePreferredLanguage,
      allowSeasonPacks: !strictMode,
      allowSizeOutliers: !strictMode,
      isAnime: animeReq,
      expectedTitles: animeReq ? (animeTitles ?? null) : null,
    },
    score: {
      activeDebrids: debrids.map((d) => d.slug),
      preferredLanguages: settings.preferredLanguages,
      releaseDate: meta.releaseDate ?? null,
      mediaKind: meta.type === "series" || episode ? "series" : "movie",
      runtimeMinutes: runtimeMinutes(meta.runtime),
      inTheaters: meta.inTheaters === true,
      bandwidthMbps: settings.bandwidthMbps > 0 ? settings.bandwidthMbps : undefined,
      preferSingleAudioTrack:
        !("__TAURI_INTERNALS__" in window) || settings.playerEngine === "html5",
      preferAddonId: meta.addonOrigin?.id,
      preferredReleaseGroup: prevGroup,
      respectAddonOrder: settings.streamSort === "addon",
    },
  };
}
