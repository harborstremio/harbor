export type EventKind =
  | "open"
  | "dwell"
  | "play"
  | "watchlist"
  | "watched"
  | "vote_up"
  | "vote_down";

export type ProfileSnapshot = {
  cast: number[];
  directors: number[];
  creators: number[];
  genres: string[];
  keywords: number[];
  decade?: string;
  language?: string;
};

export type DiscoverEvent = {
  id: string;
  kind: EventKind;
  ts: number;
  meta?: ProfileSnapshot;
};

export type Affinity = {
  cast: Record<number, number>;
  directors: Record<number, number>;
  creators: Record<number, number>;
  genres: Record<string, number>;
  keywords: Record<number, number>;
  decades: Record<string, number>;
  languages: Record<string, number>;
  totalEvents: number;
  lastUpdated: number;
};

export type DiscoverStore = {
  events: DiscoverEvent[];
  affinity: Affinity;
};

export const freshAffinity = (): Affinity => ({
  cast: {},
  directors: {},
  creators: {},
  genres: {},
  keywords: {},
  decades: {},
  languages: {},
  totalEvents: 0,
  lastUpdated: 0,
});
