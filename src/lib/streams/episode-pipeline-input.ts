import type { Addon } from "@/lib/addons";
import { isAddonNativeMeta, type Meta } from "@/lib/cinemeta";
import type { DebridStore } from "@/lib/debrid/types";
import { readPlayback } from "@/lib/playback-history";
import type { Settings } from "@/lib/settings";
import type { PlayEpisode } from "@/lib/view";

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
      ? vids.find((v) => (v.season ?? null) === episode.season && (v.episode ?? v.number ?? null) === episode.episode)
      : (vids.find((v) => v.id === meta.id) ?? (vids.length === 1 ? vids[0] : undefined));
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
}): PipelineInput {
  const { meta, episode, imdbId, streamIds, addons, debrids, settings, strictMode, filterDisabled } = params;
  const embedded = embeddedStreams(meta, episode);
  const addonNative = isAddonNativeMeta(meta);
  const requestType = addonNative ? meta.type : episode ? "series" : meta.type === "series" ? "series" : "movie";
  const animeReq = streamIds.some((id) => id.startsWith("kitsu:") || id.startsWith("mal:"));
  const effSeason = episode?.imdbSeason ?? episode?.season;
  const effEpisode = episode?.imdbEpisode ?? episode?.episode;
  const prevGroup =
    episode && typeof effSeason === "number" && typeof effEpisode === "number" && effEpisode > 1
      ? (readPlayback(meta.id, effSeason, effEpisode - 1)?.releaseGroup ?? undefined)
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
    },
    score: {
      activeDebrids: debrids.map((d) => d.slug),
      preferredLanguages: settings.preferredLanguages,
      releaseDate: meta.releaseDate ?? null,
      mediaKind: meta.type === "series" || episode ? "series" : "movie",
      runtimeMinutes: runtimeMinutes(meta.runtime),
      inTheaters: meta.inTheaters === true,
      bandwidthMbps: settings.bandwidthMbps > 0 ? settings.bandwidthMbps : undefined,
      preferSingleAudioTrack: !("__TAURI_INTERNALS__" in window) || settings.playerEngine === "html5",
      preferAddonId: meta.addonOrigin?.id,
      preferredReleaseGroup: prevGroup,
      respectAddonOrder: settings.streamSort === "addon",
    },
  };
}
