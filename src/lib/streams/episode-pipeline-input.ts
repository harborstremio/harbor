import type { Addon } from "@/lib/addons";
import { isAddonNativeMeta, type Meta } from "@/lib/cinemeta";
import type { DebridStore } from "@/lib/debrid/types";
import { readPlayback } from "@/lib/playback-history";
import type { Settings } from "@/lib/settings";
import type { PlayEpisode } from "@/lib/view";
import { resolveAddonRanks } from "./addon-priority";
import type { PipelineInput } from "./pipeline";
import type { Stream } from "./types";

function runtimeMinutes(runtime: string | number | undefined): number | undefined {
  if (runtime == null) return undefined;
  if (typeof runtime === "number") return runtime > 0 ? runtime : undefined;
  const m = /(\d+)/.exec(runtime);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function embeddedStreams(meta: Meta, episode: PlayEpisode | undefined): Stream[] {
  const vids = meta.videos ?? [];
  if (vids.length === 0) return [];
  const pick = episode?.videoId
    ? vids.find((v) => v.id === episode.videoId)
    : episode
      ? vids.find(
          (v) =>
            (v.season ?? null) === episode.season &&
            ((v.episode ?? v.number) ?? null) === episode.episode,
        )
      : vids.find((v) => v.id === meta.id) ?? (vids.length === 1 ? vids[0] : undefined);
  const raw = pick?.streams ?? [];
  return raw.map(
    (s) =>
      ({
        ...s,
        addonId: meta.addonOrigin?.id ?? "embedded",
        addonName: meta.addonOrigin?.name ?? "Addon",
        addonUrl: meta.addonOrigin?.base,
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
}): PipelineInput {
  const { meta, episode, imdbId, streamIds, addons, debrids, settings, strictMode, filterDisabled, animeTitles } = params;
  const embedded = embeddedStreams(meta, episode);
  const addonNative = isAddonNativeMeta(meta);
  const requestType = addonNative
    ? meta.type
    : episode
      ? "series"
      : meta.type === "series"
        ? "series"
        : "movie";
  const animeReq = streamIds.some((id) => id.startsWith("kitsu:") || id.startsWith("mal:"));
  // Continuous anime (One Piece) number episodes absolutely, so Kitsu's episode number diverges
  // from the IMDb per-season number (1169 vs 14); season is meaningless there. Seasonal anime
  // (SAO) have real seasons — Kitsu's season can be mislabeled, so the IMDb pair is authoritative.
  const continuousAnime =
    animeReq &&
    episode?.imdbEpisode != null &&
    episode?.episode != null &&
    episode.episode !== episode.imdbEpisode;
  const effSeason = continuousAnime
    ? episode?.season ?? null
    : episode?.imdbSeason ?? episode?.season;
  const effEpisode = continuousAnime
    ? episode?.episode ?? null
    : episode?.imdbEpisode ?? episode?.episode;
  const altPair =
    animeReq &&
    episode?.imdbSeason != null &&
    episode?.imdbEpisode != null &&
    (episode.imdbSeason !== effSeason || episode.imdbEpisode !== effEpisode)
      ? { season: episode.imdbSeason, episode: episode.imdbEpisode }
      : null;
  const prevGroup =
    episode && typeof effSeason === "number" && typeof effEpisode === "number" && effEpisode > 1
      ? readPlayback(meta.id, effSeason, effEpisode - 1)?.releaseGroup ?? undefined
      : undefined;
  return {
    request: {
      type: requestType,
      ids: streamIds,
    },
    query: {
      type: episode ? "series" : meta.type === "series" ? "series" : "movie",
      imdbId: imdbId ?? "",
      title: meta.name,
      year: parseInt(meta.releaseInfo ?? "", 10) || undefined,
      season: animeReq && episode?.imdbSeason == null ? undefined : effSeason,
      episode: animeReq && episode?.imdbEpisode == null ? episode?.episode : effEpisode,
    },
    addons,
    debrids,
    isAnime: animeReq,
    presetStreams: embedded.length > 0 ? embedded : undefined,
    addonTimeoutMs: Math.max(8, Math.min(120, settings.addonTimeoutSec ?? 30)) * 1000,
    addonRanks: resolveAddonRanks(addons, settings.streamPriority),
    trust: {
      kind: episode ? "series" : meta.type === "series" ? "series" : "movie",
      expectedTitle: meta.name,
      releaseDate: meta.releaseDate ?? null,
      expectedYear: parseInt(meta.releaseInfo ?? "", 10) || null,
      expectedSeason: effSeason ?? null,
      expectedEpisode: effEpisode ?? null,
      altExpectedSeason: altPair?.season ?? null,
      altExpectedEpisode: altPair?.episode ?? null,
      continuousAnime,
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
