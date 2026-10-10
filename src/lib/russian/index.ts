import {
  RUSSIAN_ANIMATION,
  RUSSIAN_DRAMA,
  RUSSIAN_MODERN_SERIES,
  RUSSIAN_MOVIES,
  RUSSIAN_SOVIET,
  RUSSIAN_TRENDING,
  type RussianRowDef,
} from "./rows";
import { fetchNewYearFilms, inNewYearWindow, NEW_YEAR_FILMS, RUSSIAN_NEW_YEAR } from "./new-year";

export type { RussianRowDef };
export { NEW_YEAR_FILMS, fetchNewYearFilms, inNewYearWindow };

const ALL_ROWS: RussianRowDef[] = [
  RUSSIAN_NEW_YEAR,
  RUSSIAN_MODERN_SERIES,
  RUSSIAN_MOVIES,
  RUSSIAN_SOVIET,
  RUSSIAN_DRAMA,
  RUSSIAN_ANIMATION,
  RUSSIAN_TRENDING,
];

export function russianRows(now: Date = new Date()): RussianRowDef[] {
  return ALL_ROWS.filter((row) => !row.window || row.window(now));
}
