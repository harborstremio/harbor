export type WatchType = "movie" | "series" | "anime";

export type WatchEvent = {
  id: string;
  title: string;
  type: WatchType;
  watchedAt: number;
  imdb?: string;
};

export type TopTitle = { title: string; count: number; imdb?: string; id: string; type: WatchType };
export type HeatCell = { date: string; count: number };

export type WrappedSource = "trakt" | "local" | "empty";

export type WrappedStats = {
  source: WrappedSource;
  year: number | null;
  totalTitles: number;
  totalPlays: number;
  estimatedHours: number;
  heatmap: HeatCell[];
  topTitles: TopTitle[];
  topGenres: Array<{ genre: string; count: number }>;
  topActors: Array<{ name: string; count: number; photo?: string }>;
  posters: Record<string, string>;
  split: { movies: number; series: number; anime: number };
  firstPlay: WatchEvent | null;
  lastPlay: WatchEvent | null;
  longestBinge: { date: string; count: number };
  archetype: { id: string; label: string; blurb: string };
};
