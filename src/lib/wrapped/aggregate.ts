import { deriveArchetype } from "./archetype";
import type { HeatCell, TopTitle, WatchEvent, WrappedSource, WrappedStats } from "./types";

const MOVIE_MIN = 115;
const EPISODE_MIN = 42;

function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function aggregateWrapped(
  events: WatchEvent[],
  source: WrappedSource,
  year: number | null,
): WrappedStats {
  const filtered =
    year != null ? events.filter((e) => new Date(e.watchedAt).getFullYear() === year) : events;
  const sorted = [...filtered].sort((a, b) => a.watchedAt - b.watchedAt);

  const byId = new Map<string, TopTitle>();
  const byDay = new Map<string, number>();
  const split = { movies: 0, series: 0, anime: 0 };
  let hours = 0;

  for (const e of sorted) {
    const t = byId.get(e.id);
    if (t) t.count += 1;
    else byId.set(e.id, { title: e.title, count: 1, imdb: e.imdb, id: e.id, type: e.type });
    const dk = dayKey(e.watchedAt);
    byDay.set(dk, (byDay.get(dk) ?? 0) + 1);
    if (e.type === "movie") {
      split.movies += 1;
      hours += MOVIE_MIN / 60;
    } else {
      if (e.type === "anime") split.anime += 1;
      else split.series += 1;
      hours += EPISODE_MIN / 60;
    }
  }

  const heatmap: HeatCell[] = [...byDay.entries()].map(([date, count]) => ({ date, count }));
  let longestBinge = { date: "", count: 0 };
  for (const [date, count] of byDay) if (count > longestBinge.count) longestBinge = { date, count };

  const topTitles = [...byId.values()].sort((a, b) => b.count - a.count).slice(0, 20);

  return {
    source,
    year,
    totalTitles: byId.size,
    totalPlays: sorted.length,
    estimatedHours: Math.round(hours),
    heatmap,
    topTitles,
    topGenres: [],
    topActors: [],
    posters: {},
    split,
    firstPlay: sorted[0] ?? null,
    lastPlay: sorted[sorted.length - 1] ?? null,
    longestBinge,
    archetype: deriveArchetype({ split, longestBinge, totalTitles: byId.size }),
  };
}
