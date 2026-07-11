import type { Meta } from "@/lib/cinemeta";
import { tmdbSearchMovie } from "@/lib/providers/tmdb";

import type { ArabicRowDef } from "./rows";

export const EGYPTIAN_CLASSICS: { title: string; year: number }[] = [
  { title: "Cairo Station", year: 1958 },
  { title: "The Land", year: 1969 },
  { title: "The Beginning and the End", year: 1960 },
  { title: "The Night of Counting the Years", year: 1969 },
  { title: "The Nightingale's Prayer", year: 1959 },
  { title: "Struggle in the Valley", year: 1954 },
  { title: "Cairo 30", year: 1966 },
  { title: "The Sin", year: 1965 },
  { title: "The Yacoubian Building", year: 2006 },
  { title: "The Blue Elephant", year: 2014 },
];

export async function fetchEgyptianClassics(key: string): Promise<Meta[]> {
  if (!key) return [];
  const resolved = await Promise.all(EGYPTIAN_CLASSICS.map((c) => tmdbSearchMovie(key, c.title, c.year)));
  const seen = new Set<string>();
  const out: Meta[] = [];
  for (const m of resolved) {
    if (!m || seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  return out;
}

export const ARABIC_CLASSICS: ArabicRowDef = {
  id: "classics",
  titleKey: "arabic.row.classics",
  english: "Egyptian Cinema Classics",
  type: "movie",
  fetch: (key, page) => (page > 1 ? Promise.resolve([]) : fetchEgyptianClassics(key)),
};
