import type { IptvChannel, IptvPlaylist } from "./types";
import { headersFromChannel } from "./channel-headers";
import { classifyChannel } from "./vod-classify";
import { cleanTitle, extractYear, parseSeriesEpisode, showTitleFromEpisode } from "./vod-title";
import { vodQualityLabel } from "./vod-lookup";

export type VodMovie = {
  id: string;
  title: string;
  year: number | null;
  logo: string | null;
  group: string | null;
  url: string;
  playlistId: string;
  playlistName: string;
  headers?: Record<string, string>;
  tmdbId?: number;
  quality?: string;
};

export type VodEpisode = {
  id?: string;
  /** False when the provider did not supply an unambiguous episode number. */
  numbered?: boolean;
  season: number;
  episode: number;
  title: string;
  url: string;
  logo: string | null;
  durationSec?: number | null;
  plot?: string | null;
  headers?: Record<string, string>;
};

export type VodSeries = {
  id: string;
  title: string;
  logo: string | null;
  group: string | null;
  playlistId: string;
  playlistName: string;
  episodes: VodEpisode[];
  seasons: number[];
  xtreamSeriesId?: string;
  year?: number | null;
  tmdbId?: number;
};

export type VodLibrary = { movies: VodMovie[]; series: VodSeries[] };

export function isExternalPlaylistId(id: string): boolean {
  return id.startsWith("iptv:") || id.startsWith("vod:");
}

function attrNumber(ch: IptvChannel, key: string): number | undefined {
  const raw = ch.attrs[key]?.trim();
  if (!raw || !/^\d+$/.test(raw)) return undefined;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 ? n : undefined;
}

function norm(s: string): string {
  return s
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, "-")
    .replace(/^-|-$/g, "");
}

export function vodEpisodeFromChannel(ch: IptvChannel): VodEpisode {
  const parsed = parseSeriesEpisode(ch.name);
  const number = (value: string | undefined) =>
    value != null && /^\d+$/.test(value) && Number.isSafeInteger(Number(value))
      ? Number(value)
      : undefined;
  const season = number(ch.attrs["episode-season"]) ?? parsed?.season;
  const episode = number(ch.attrs["episode-number"]) ?? parsed?.episode;
  return {
    id: ch.id,
    season: season ?? 1,
    episode: episode ?? 0,
    numbered: season != null && episode != null,
    title: ch.attrs["episode-title"] || cleanTitle(ch.name),
    url: ch.url,
    logo: ch.logo,
    durationSec: ch.durationSec,
    plot: ch.attrs["episode-plot"] || null,
    headers: headersFromChannel(ch),
  };
}

export function buildVodLibrary(
  playlists: Iterable<IptvPlaylist>,
  names: Map<string, string>,
): VodLibrary {
  const movies: VodMovie[] = [];
  const movieSeen = new Set<string>();
  const seriesMap = new Map<string, VodSeries>();

  for (const pl of playlists) {
    const plName = names.get(pl.id) ?? pl.name;
    for (const ch of pl.channels) {
      const kind = classifyChannel(ch);
      if (kind === "live") continue;

      if (kind === "movie") {
        const title = cleanTitle(ch.name);
        const year = extractYear(ch.name) ?? attrNumber(ch, "release-year") ?? null;
        const tmdbId = attrNumber(ch, "tmdb-id");
        const quality = vodQualityLabel(ch.name, ch.group);
        // Different provider IDs can be different editions, languages or sources.
        // A title/year match is not evidence that one can be discarded.
        const dedupe = `${pl.id}|${ch.id}`;
        if (movieSeen.has(dedupe)) continue;
        movieSeen.add(dedupe);
        movies.push({
          id: `vod:${ch.id}`,
          title,
          year,
          logo: ch.logo,
          group: ch.group,
          url: ch.url,
          playlistId: pl.id,
          playlistName: plName,
          headers: headersFromChannel(ch),
          ...(tmdbId ? { tmdbId } : {}),
          ...(quality ? { quality } : {}),
        });
        continue;
      }

      const show = showTitleFromEpisode(ch.name) || cleanTitle(ch.name);
      const xtreamSeriesId = ch.attrs["xtream-series-id"]?.trim();
      const key = xtreamSeriesId ? `${pl.id}|xtream:${xtreamSeriesId}` : `${pl.id}|${norm(show)}`;
      let series = seriesMap.get(key);
      if (!series) {
        series = {
          id: xtreamSeriesId
            ? `vod:series:${pl.id}:${xtreamSeriesId}`
            : `vod:series:${pl.id}:${norm(show)}`,
          title: show,
          logo: ch.logo,
          group: ch.group,
          playlistId: pl.id,
          playlistName: plName,
          episodes: [],
          seasons: [],
          xtreamSeriesId: xtreamSeriesId || undefined,
          year: attrNumber(ch, "release-year") ?? extractYear(show) ?? null,
          tmdbId: attrNumber(ch, "tmdb-id"),
        };
        seriesMap.set(key, series);
      }
      if (!series.logo && ch.logo) series.logo = ch.logo;
      if (xtreamSeriesId) {
        series.xtreamSeriesId = xtreamSeriesId;
        continue;
      }
      series.episodes.push(vodEpisodeFromChannel(ch));
    }
  }

  const series = [...seriesMap.values()];
  for (const s of series) {
    s.episodes.sort((a, b) => a.season - b.season || a.episode - b.episode);
    s.seasons = [...new Set(s.episodes.map((e) => e.season))].sort((a, b) => a - b);
  }
  movies.sort((a, b) => a.title.localeCompare(b.title));
  series.sort((a, b) => a.title.localeCompare(b.title));
  return { movies, series };
}
