import { useEffect, useMemo, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { isManuallyWatched, remoteWatchedKeys, subscribeManualWatched } from "@/lib/manual-watched";
import { episodeFromVideoId, type LibraryItem } from "@/lib/stremio";
import type { PlayEpisode } from "@/lib/view";
import { bpPlayEpisode, type BpEpisodeIds } from "../bp-episode-ids";
import { useBpEpisodeWindow } from "../bp-episode-window";
import { useBpEpisodeArt } from "../use-bp-episode-art";
import { useBpEpisodeFacts, type BpEpisodeFact } from "./use-bp-episode-facts";

export type BpEp = PlayEpisode & { key: string; group: number; label: number };

const MAX_REACH = 180;

export type BpEpisodeStripState = {
  seasons: number[];
  seasonCounts: ReadonlyMap<number, number>;
  active: number;
  onSeason: (season: number) => void;
  episodes: BpEp[];
  total: number;
  base: number;
  end: number;
  grow: (to: number) => void;
  anchor: (index: number) => void;
  /**
   * Where in `episodes` the resume point sits, or -1. The view parks its track
   * here on arrival, so it is an index into the rendered list and not a season
   * or episode number: the two disagree on every cour-mapped title.
   */
  resumeIndex: number;
  backdrop?: string;
  stillsOf: (ep: BpEp) => string[];
  factOf: (ep: BpEp) => BpEpisodeFact | undefined;
  watchedOf: (ep: BpEp) => boolean;
  progressOf: (ep: BpEp) => number;
};

// Kitsu reports season 1 for every episode of every cour, so the band a card
// belongs to has to come from the mapped imdb season or a two cour title
// collapses into one undifferentiated strip. season and episode stay the source
// pair: the watched keys and the resume entry are both written under it.
function collect(meta: Meta, ids: BpEpisodeIds): Map<number, BpEp[]> {
  const bySeason = new Map<number, BpEp[]>();
  for (const v of meta.videos ?? []) {
    const season = v.season ?? 0;
    const episode = v.episode ?? v.number ?? 0;
    if (season <= 0 || episode <= 0) continue;
    const mapped = bpPlayEpisode(v, ids);
    const group = mapped.imdbSeason ?? season;
    const list = bySeason.get(group) ?? [];
    list.push({
      ...mapped,
      key: v.id ?? `${season}-${episode}`,
      group,
      label: mapped.imdbEpisode ?? episode,
    });
    bySeason.set(group, list);
  }
  for (const list of bySeason.values()) {
    list.sort((a, b) => a.label - b.label || a.episode - b.episode);
  }
  return bySeason;
}

const NO_STILLS: string[] = [];

// useBpEpisodeArt resolves a tmdb tv id from any tt shell it is handed, so
// running it for a movie or for a title the anime chain already owns bills a
// round trip whose answer is thrown away. The idle meta starves that lookup
// without taking the hook out of the render order.
const IDLE_META: Meta = { id: "", type: "movie", name: "" };

export function useBpEpisodeStrip({
  meta,
  ids,
  tvId,
  imdbId,
  cwEntry,
  enabled,
}: {
  meta: Meta;
  ids: BpEpisodeIds;
  tvId: number | null;
  imdbId: string | null;
  cwEntry?: LibraryItem | null;
  enabled: boolean;
}): BpEpisodeStripState {
  const live = enabled ? meta : IDLE_META;
  const { bySeason, seasonCounts } = useMemo(() => {
    const grouped = collect(live, ids);
    const counts: ReadonlyMap<number, number> = new Map(
      [...grouped].map(([k, v]) => [k, v.length] as const),
    );
    return { bySeason: grouped, seasonCounts: counts };
  }, [live.id, live.videos?.length, ids]);
  const seasons = useMemo(() => [...bySeason.keys()].sort((a, b) => a - b), [bySeason]);
  const [season, setSeason] = useState<number | null>(null);
  const [watchedTick, setWatchedTick] = useState(0);

  useEffect(() => subscribeManualWatched(() => setWatchedTick((n) => n + 1)), []);

  const remote = useMemo(() => {
    void watchedTick;
    return remoteWatchedKeys(live.id);
  }, [live.id, watchedTick]);

  const resumeAt = useMemo(() => {
    const dur = cwEntry?.state?.duration ?? 0;
    const off = cwEntry?.state?.timeOffset ?? 0;
    if (dur <= 0 || off <= 0) return null;
    const episode = cwEntry?.state?.episode ?? 0;
    const parsed =
      episode > 0
        ? { season: cwEntry?.state?.season ?? 1, episode }
        : episodeFromVideoId(cwEntry?.state?.video_id ?? "");
    if (!parsed?.episode) return null;
    return { season: parsed.season, episode: parsed.episode, ratio: Math.min(1, off / dur) };
  }, [
    cwEntry?.state?.season,
    cwEntry?.state?.episode,
    cwEntry?.state?.video_id,
    cwEntry?.state?.timeOffset,
    cwEntry?.state?.duration,
  ]);

  // The resume entry is written under the source pair, so the band it belongs to
  // has to be looked up rather than assumed equal to the season it names.
  const groupOf = useMemo(() => {
    const m = new Map<string, number>();
    for (const [g, list] of bySeason) for (const e of list) m.set(`${e.season}:${e.episode}`, g);
    return m;
  }, [bySeason]);

  const defaultSeason =
    (resumeAt ? groupOf.get(`${resumeAt.season}:${resumeAt.episode}`) : undefined) ??
    seasons[0] ??
    0;
  const active = season ?? defaultSeason;

  const all = useMemo(() => bySeason.get(active) ?? [], [bySeason, active]);
  const total = all.length;

  // The source pair, matching progressOf: bpResumeMark aims Play at the same
  // episode without advancing past a finished one, so the card the strip parks
  // on is always the card the Play button would play.
  const rawResume = useMemo(
    () =>
      resumeAt
        ? all.findIndex((e) => e.season === resumeAt.season && e.episode === resumeAt.episode)
        : -1,
    [all, resumeAt],
  );
  const parkIndex = rawResume >= 0 && rawResume < Math.min(total, MAX_REACH) ? rawResume : -1;
  const reach = parkIndex < 0 ? 0 : Math.min(parkIndex + 12, MAX_REACH);
  const win = useBpEpisodeWindow(total, reach, `${live.id}:${active}`);
  const { base, end } = win;
  const episodes = useMemo(
    () => (base === 0 && end >= total ? all : all.slice(base, end)),
    [all, base, end, total],
  );

  // The art chain keys on the mapped pair: a TMDB still for a cour two episode
  // lives at S2E9, never at the S1E5 the kitsu meta reports.
  const artRefs = useMemo(
    () =>
      episodes.map((e) => ({
        key: e.key,
        season: e.imdbSeason ?? e.season,
        episode: e.imdbEpisode ?? e.episode,
        absoluteNumber: e.absoluteNumber,
        still: e.still,
      })),
    [episodes],
  );
  const art = useBpEpisodeArt(live, artRefs, active);
  const facts = useBpEpisodeFacts(enabled ? tvId : null, active, enabled ? imdbId : null);

  return {
    seasons,
    seasonCounts,
    active,
    onSeason: setSeason,
    episodes,
    total,
    base,
    end,
    grow: win.grow,
    anchor: win.anchor,
    resumeIndex: parkIndex,
    backdrop: live.background,
    stillsOf: (ep) => art.get(ep.key) ?? NO_STILLS,
    factOf: (ep) => facts.get(`${ep.imdbSeason ?? ep.season}:${ep.imdbEpisode ?? ep.episode}`),
    watchedOf: (ep) =>
      isManuallyWatched(live.id, ep.season, ep.episode) ||
      remote.has(`${ep.season}:${ep.episode}`),
    progressOf: (ep) =>
      resumeAt && resumeAt.season === ep.season && resumeAt.episode === ep.episode
        ? resumeAt.ratio
        : 0,
  };
}
