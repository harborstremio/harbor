import type { Meta } from "@/lib/cinemeta";
import { tmdbSearchMovie } from "@/lib/providers/tmdb";
import type { RussianRowDef } from "./rows";

// A fixed canon rather than a discover query: these are the films Russian TV
// actually broadcasts over the New Year holidays, and no genre or date filter
// picks that set out.
export const NEW_YEAR_FILMS: { title: string; year: number }[] = [
  { title: "The Irony of Fate", year: 1975 },
  { title: "Carnival Night", year: 1956 },
  { title: "Gentlemen of Fortune", year: 1971 },
  { title: "Ivan Vasilievich Changes Profession", year: 1973 },
  { title: "Charodei", year: 1982 },
  { title: "Morozko", year: 1964 },
  { title: "The Diamond Arm", year: 1969 },
  { title: "Office Romance", year: 1977 },
  { title: "Moscow Does Not Believe in Tears", year: 1980 },
];

// Mid-December through Old New Year on 14 January, which is the span Russian
// broadcasters treat as the holiday season.
export function inNewYearWindow(now: Date = new Date()): boolean {
  const month = now.getMonth();
  const day = now.getDate();
  return (month === 11 && day >= 10) || (month === 0 && day <= 14);
}

export async function fetchNewYearFilms(key: string): Promise<Meta[]> {
  if (!key) return [];
  const resolved = await Promise.all(
    NEW_YEAR_FILMS.map((f) => tmdbSearchMovie(key, f.title, f.year)),
  );
  const seen = new Set<string>();
  const out: Meta[] = [];
  for (const m of resolved) {
    if (!m || seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  return out;
}

export const RUSSIAN_NEW_YEAR: RussianRowDef = {
  id: "new-year",
  title: "New Year Classics",
  type: "movie",
  window: inNewYearWindow,
  fetch: (key, page) => (page > 1 ? Promise.resolve([]) : fetchNewYearFilms(key)),
};
