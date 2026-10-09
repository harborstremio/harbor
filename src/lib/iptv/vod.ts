import type { IptvPlaylist } from "./types";
import { classifyChannel } from "./vod-classify";
import { cleanTitle, extractYear, parseSeriesEpisode, showTitleFromEpisode } from "./vod-title";

export type VodMovie = {
  id: string;
  title: string;
  year: number | null;
  logo: string | null;
  group: string | null;
  url: string;
  playlistId: string;
  playlistName: string;
};

export type VodEpisode = {
  season: number;
  episode: number;
  title: string;
  url: string;
  logo: string | null;
  durationSec?: number | null;
  plot?: string | null;
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
};

export type VodLibrary = { movies: VodMovie[]; series: VodSeries[] };

export function isExternalPlaylistId(id: string): boolean {
  return id.startsWith("iptv:") || id.startsWith("vod:");
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function numberFallbackEpisodes(episodes: VodEpisode[]): void {
  const fallback = episodes.filter((e) => e.episode === 0);
  if (fallback.length === 0) return;
  fallback.sort((a, b) => a.url.localeCompare(b.url));
  fallback.forEach((e, i) => {
    e.episode = i + 1;
  });
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
        const year = extractYear(ch.name);
        const dedupe = `${pl.id}|${norm(title)}|${year ?? ""}`;
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
        };
        seriesMap.set(key, series);
      }
      if (!series.logo && ch.logo) series.logo = ch.logo;
      if (xtreamSeriesId) {
        series.xtreamSeriesId = xtreamSeriesId;
        continue;
      }
      const se = parseSeriesEpisode(ch.name);
      series.episodes.push({
        season: se?.season ?? 1,
        episode: se?.episode ?? 0,
        title: cleanTitle(ch.name),
        url: ch.url,
        logo: ch.logo,
      });
    }
  }

  const series = [...seriesMap.values()];
  for (const s of series) {
    numberFallbackEpisodes(s.episodes);
    s.episodes.sort((a, b) => a.season - b.season || a.episode - b.episode);
    s.seasons = [...new Set(s.episodes.map((e) => e.season))].sort((a, b) => a - b);
  }
  movies.sort((a, b) => a.title.localeCompare(b.title));
  series.sort((a, b) => a.title.localeCompare(b.title));
  return { movies, series };
}
