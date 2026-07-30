export type CardKey =
  | "about"
  | "ratings"
  | "canvas"
  | "showcase"
  | "lists"
  | "badges"
  | "activity"
  | "comments";

export const CARD_ORDER_DEFAULT: CardKey[] = [
  "about",
  "ratings",
  "canvas",
  "showcase",
  "lists",
  "badges",
  "activity",
  "comments",
];

export const CARD_LABELS: Record<CardKey, string> = {
  about: "About",
  ratings: "Ratings",
  canvas: "Custom",
  showcase: "Showcase",
  lists: "Lists",
  badges: "Badges",
  activity: "Recent activity",
  comments: "Comments",
};

export type CardLayout = { order?: string[]; hidden?: string[] };

const KNOWN = new Set<string>(CARD_ORDER_DEFAULT);

export function sanitizeLayout(raw: unknown): CardLayout {
  const l = (raw ?? {}) as { order?: unknown; hidden?: unknown };
  const order = Array.isArray(l.order) ? l.order.filter((k): k is string => typeof k === "string" && KNOWN.has(k)) : [];
  const hidden = Array.isArray(l.hidden) ? l.hidden.filter((k): k is string => typeof k === "string" && KNOWN.has(k)) : [];
  return { order: [...new Set(order)], hidden: [...new Set(hidden)] };
}

export function effectiveOrder(layout: CardLayout | undefined, present: CardKey[]): CardKey[] {
  const order = layout?.order?.length ? layout.order : CARD_ORDER_DEFAULT;
  const seen = new Set<string>();
  const out: CardKey[] = [];
  for (const k of order) {
    if (present.includes(k as CardKey) && !seen.has(k)) {
      seen.add(k);
      out.push(k as CardKey);
    }
  }
  for (const k of present) if (!seen.has(k)) out.push(k);
  return out;
}

export function moveCard(order: CardKey[], key: CardKey, dir: -1 | 1): CardKey[] {
  const i = order.indexOf(key);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return order;
  const next = order.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export type StatKey =
  | "watchTime"
  | "episodes"
  | "movies"
  | "read"
  | "friends"
  | "badges";

export const STAT_ORDER: StatKey[] = [
  "watchTime",
  "episodes",
  "movies",
  "read",
  "friends",
  "badges",
];

export const STAT_LABELS: Record<StatKey, string> = {
  watchTime: "Watch Time",
  episodes: "Episodes",
  movies: "Movies",
  read: "Read",
  friends: "Friends",
  badges: "Badges",
};

export type StatLayout = { hidden: string[] };

const KNOWN_STATS = new Set<string>(STAT_ORDER);

export const DEFAULT_STAT_HIDDEN: StatKey[] = ["friends", "badges"];

export function sanitizeStatLayout(raw: unknown): StatLayout {
  const l = raw as { hidden?: unknown } | null | undefined;
  if (!l || !Array.isArray(l.hidden)) return { hidden: [...DEFAULT_STAT_HIDDEN] };
  const hidden = l.hidden.filter((k): k is string => typeof k === "string" && KNOWN_STATS.has(k));
  const uniq = [...new Set(hidden)];
  if (uniq.length >= STAT_ORDER.length) return { hidden: uniq.filter((k) => k !== "watchTime") };
  return { hidden: uniq };
}

export function watchMinutes(c: {
  minutesWatched?: number;
  hoursWatched?: number;
  moviesWatched?: number;
  episodesWatched?: number;
}): number {
  const tracked = Math.max(c.minutesWatched ?? 0, (c.hoursWatched ?? 0) * 60);
  const estimated = (c.moviesWatched ?? 0) * 120 + (c.episodesWatched ?? 0) * 45;
  return Math.max(tracked, estimated);
}
