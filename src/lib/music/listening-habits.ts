import type { MusicTrack } from "./types";

export type HabitMoment = {
  id: string;
  titleKey: string;
  subtitleKey: string;
  queries: readonly string[];
};

type Window = { id: string; from: [number, number]; to: [number, number]; queries: string[] };

const SEASONS: readonly Window[] = [
  { id: "spooky", from: [10, 1], to: [11, 1], queries: ["halloween", "spooky", "dark ambient"] },
  { id: "festive", from: [11, 25], to: [12, 31], queries: ["christmas", "holiday", "winter"] },
  { id: "newYear", from: [1, 1], to: [1, 7], queries: ["new year", "party", "fresh start"] },
  { id: "valentines", from: [2, 7], to: [2, 15], queries: ["love songs", "romance", "slow jams"] },
  { id: "winter", from: [1, 8], to: [2, 6], queries: ["winter", "cosy", "fireside"] },
  { id: "winter", from: [2, 16], to: [2, 28], queries: ["winter", "cosy", "fireside"] },
  { id: "spring", from: [3, 1], to: [5, 31], queries: ["spring", "fresh", "feel good"] },
  { id: "summer", from: [6, 1], to: [8, 31], queries: ["summer", "beach", "sunshine"] },
  { id: "autumn", from: [9, 1], to: [9, 30], queries: ["autumn", "mellow", "acoustic"] },
  { id: "autumn", from: [11, 2], to: [11, 24], queries: ["autumn", "mellow", "acoustic"] },
];

const DAY_PARTS: readonly { id: string; until: number; queries: string[] }[] = [
  { id: "lateNight", until: 5, queries: ["late night", "after hours", "night drive"] },
  { id: "morning", until: 11, queries: ["morning", "wake up", "coffee"] },
  { id: "afternoon", until: 17, queries: ["focus", "afternoon", "concentration"] },
  { id: "evening", until: 22, queries: ["evening", "dinner", "unwind"] },
  { id: "lateNight", until: 24, queries: ["late night", "after hours", "night drive"] },
];

function ordinal(month: number, day: number): number {
  return month * 100 + day;
}

function moment(id: string, queries: readonly string[], group: string): HabitMoment {
  return {
    id,
    titleKey: `music.habit.${group}.${id}`,
    subtitleKey: `music.habit.${group}.${id}.subtitle`,
    queries,
  };
}

export function seasonalMoment(now: Date): HabitMoment | null {
  const today = ordinal(now.getMonth() + 1, now.getDate());
  for (const window of SEASONS) {
    const from = ordinal(window.from[0], window.from[1]);
    const to = ordinal(window.to[0], window.to[1]);
    if (today >= from && today <= to) return moment(window.id, window.queries, "season");
  }
  return null;
}

export function dayPart(now: Date): HabitMoment {
  const hour = now.getHours();
  const part = DAY_PARTS.find((entry) => hour < entry.until) ?? DAY_PARTS[DAY_PARTS.length - 1];
  return moment(part.id, part.queries, "daypart");
}

export function normalizeArtist(name: string): string {
  return name
    .toLocaleLowerCase()
    .replace(/\s*(feat\.?|ft\.?|with|&|,|x)\s.*$/i, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function artistTally(
  tracks: readonly MusicTrack[],
  limit = 12,
): { name: string; plays: number }[] {
  const counts = new Map<string, { name: string; plays: number }>();
  for (const track of tracks) {
    const key = normalizeArtist(track.artist ?? "");
    if (!key) continue;
    const held = counts.get(key);
    if (held) held.plays += 1;
    else counts.set(key, { name: track.artist, plays: 1 });
  }
  return [...counts.values()]
    .filter((entry) => entry.plays > 1)
    .sort((a, b) => b.plays - a.plays || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export function forgottenFavourites(
  liked: readonly MusicTrack[],
  recents: readonly MusicTrack[],
  limit = 18,
): MusicTrack[] {
  const heard = new Set(recents.map((track) => track.id));
  const artists = new Set(recents.map((track) => normalizeArtist(track.artist ?? "")));
  return liked
    .filter((track) => !heard.has(track.id) && !artists.has(normalizeArtist(track.artist ?? "")))
    .slice(0, limit);
}
