/**
 * letterboxd-import/parser.ts
 *
 * Parses a Letterboxd ZIP export (or a pre-extracted directory) into a
 * deduplicated list of films with their actions (rated / watched / watchlist).
 *
 * Only reads: ratings.csv, watched.csv, watchlist.csv
 * Ignores:   diary.csv, reviews.csv, comments.csv, profile.csv, likes/, etc.
 */

import { unzip } from "@/lib/unzip";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type LbxAction = "rated" | "watched" | "watchlist";

/** One unique film from the export, with all applicable actions merged. */
export type LbxFilm = {
  /** Letterboxd canonical URI, e.g. "https://boxd.it/2b0k" — used as the primary key */
  uri: string;
  name: string;
  year: number;
  /** Letterboxd rating (0.5–5.0). Absent if the film was only watched/watchlisted. */
  lbxRating?: number;
  /** Harbor rating = lbxRating × 2 (1–10). Absent when lbxRating is absent. */
  harborRating?: number;
  /** The actions this film carries. A rated film is always also "watched". */
  actions: Set<LbxAction>;
};

export type LbxParseResult = {
  films: LbxFilm[];
  /** Number of unique films that appear in ratings.csv */
  ratedCount: number;
  /** Number of unique films with the "watched" action (includes rated) */
  watchedCount: number;
  /** Number of unique films that appear in watchlist.csv */
  watchlistCount: number;
};

export class LbxImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LbxImportError";
  }
}

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

/** Strip a UTF-8 BOM if present */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Minimal CSV parser.
 * - Handles \r\n and \n line endings
 * - Handles double-quoted fields (commas, newlines, double-quotes inside)
 * - Returns rows as string[] arrays; skips completely blank lines
 */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  const src = stripBom(text);
  let i = 0;

  while (i < src.length) {
    // Skip blank lines
    while (i < src.length && (src[i] === "\r" || src[i] === "\n")) i++;
    if (i >= src.length) break;

    const row: string[] = [];
    let atRowStart = true;

    while (i < src.length && src[i] !== "\n" && !(src[i] === "\r" && src[i + 1] === "\n")) {
      if (atRowStart || src[i] === ",") {
        if (!atRowStart) i++; // skip comma
        atRowStart = false;

        if (i < src.length && src[i] === '"') {
          // Quoted field
          i++; // skip opening quote
          let field = "";
          while (i < src.length) {
            if (src[i] === '"' && src[i + 1] === '"') {
              field += '"';
              i += 2;
            } else if (src[i] === '"') {
              i++; // skip closing quote
              break;
            } else {
              field += src[i++];
            }
          }
          row.push(field);
        } else {
          // Unquoted field — read until comma or end of line
          let field = "";
          while (i < src.length && src[i] !== "," && src[i] !== "\n" && src[i] !== "\r") {
            field += src[i++];
          }
          row.push(field);
        }
      } else {
        // Should not reach here, but advance to avoid infinite loop
        i++;
      }
    }

    // Consume line ending
    if (src[i] === "\r") i++;
    if (src[i] === "\n") i++;

    if (row.length > 0) rows.push(row);
  }

  return rows;
}

/** Build a column-name → index map from the header row */
function headers(rows: string[][]): Record<string, number> {
  if (rows.length === 0) return {};
  const map: Record<string, number> = {};
  for (let i = 0; i < rows[0].length; i++) {
    map[rows[0][i].trim()] = i;
  }
  return map;
}

function cell(row: string[], col: number | undefined): string {
  if (col === undefined || col < 0) return "";
  return (row[col] ?? "").trim();
}

// ---------------------------------------------------------------------------
// File-specific parsers
// ---------------------------------------------------------------------------

type RawRow = { name: string; year: number; uri: string; rating?: number };

function parseRatingsRows(rows: string[][]): RawRow[] {
  if (rows.length < 2) return [];
  const h = headers(rows);
  const out: RawRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const uri = cell(row, h["Letterboxd URI"]);
    const name = cell(row, h["Name"]);
    const yearStr = cell(row, h["Year"]);
    const ratingStr = cell(row, h["Rating"]);
    if (!uri && !name) continue;
    const year = parseInt(yearStr, 10) || 0;
    const rating = ratingStr ? parseFloat(ratingStr) : undefined;
    out.push({ name, year, uri, rating });
  }
  return out;
}

function parseWatchedRows(rows: string[][]): RawRow[] {
  if (rows.length < 2) return [];
  const h = headers(rows);
  const out: RawRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const uri = cell(row, h["Letterboxd URI"]);
    const name = cell(row, h["Name"]);
    const yearStr = cell(row, h["Year"]);
    if (!uri && !name) continue;
    const year = parseInt(yearStr, 10) || 0;
    out.push({ name, year, uri });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Decoder
// ---------------------------------------------------------------------------

const decoder = new TextDecoder("utf-8");

function decodeFile(bytes: Uint8Array): string {
  return decoder.decode(bytes);
}

// ---------------------------------------------------------------------------
// Main parse entry point
// ---------------------------------------------------------------------------

/**
 * Parse a Letterboxd export ZIP buffer into a deduplicated list of LbxFilm objects.
 * Throws `LbxImportError` for clearly invalid input.
 */
export async function parseLbxZip(buffer: ArrayBuffer): Promise<LbxParseResult> {
  let files: Map<string, Uint8Array>;
  try {
    files = await unzip(buffer);
  } catch {
    throw new LbxImportError("The file you selected is not a valid ZIP archive.");
  }

  // Normalize file names to lowercase basenames for robust matching
  const byName = new Map<string, Uint8Array>();
  for (const [path, bytes] of files) {
    const basename = path.split("/").pop()?.toLowerCase() ?? "";
    byName.set(basename, bytes);
  }

  const hasAny =
    byName.has("ratings.csv") ||
    byName.has("watched.csv") ||
    byName.has("watchlist.csv") ||
    byName.has("diary.csv") ||
    byName.has("profile.csv");

  if (!hasAny) {
    throw new LbxImportError(
      "This doesn't look like a Letterboxd export. Expected files like ratings.csv, watched.csv, or watchlist.csv.",
    );
  }

  // Parse each CSV file gracefully (absent = empty result)
  function parseFile<T extends RawRow>(name: string, parser: (rows: string[][]) => T[]): T[] {
    const bytes = byName.get(name);
    if (!bytes) return [];
    try {
      const text = decodeFile(bytes);
      const rows = parseCSV(text);
      return parser(rows);
    } catch {
      return [];
    }
  }

  const ratingsRows = parseFile("ratings.csv", parseRatingsRows);
  const watchedRows = parseFile("watched.csv", parseWatchedRows);
  const watchlistRows = parseFile("watchlist.csv", parseWatchedRows);

  // ---------------------------------------------------------------------------
  // Merge by URI into one deduped map
  // ---------------------------------------------------------------------------

  // Use URI as primary key; fall back to "name:year" for entries without URI
  function filmKey(row: RawRow): string {
    return row.uri || `${row.name.toLowerCase()}:${row.year}`;
  }

  const map = new Map<string, LbxFilm>();

  function upsert(key: string, row: RawRow): LbxFilm {
    const existing = map.get(key);
    if (existing) return existing;
    const film: LbxFilm = {
      uri: row.uri,
      name: row.name,
      year: row.year,
      actions: new Set(),
    };
    map.set(key, film);
    return film;
  }

  // 1. Ratings — these imply "watched" too (can't rate without watching on Letterboxd)
  for (const row of ratingsRows) {
    const key = filmKey(row);
    const film = upsert(key, row);
    film.actions.add("rated");
    film.actions.add("watched");
    if (row.rating !== undefined && !Number.isNaN(row.rating)) {
      film.lbxRating = row.rating;
      film.harborRating = Math.round(row.rating * 2 * 10) / 10; // e.g. 4.5 → 9.0
    }
  }

  // 2. Watched — may not have a rating
  for (const row of watchedRows) {
    const key = filmKey(row);
    const film = upsert(key, row);
    film.actions.add("watched");
  }

  // 3. Watchlist
  for (const row of watchlistRows) {
    const key = filmKey(row);
    const film = upsert(key, row);
    film.actions.add("watchlist");
  }

  const films = Array.from(map.values());

  const ratedCount = films.filter((f) => f.actions.has("rated")).length;
  const watchedCount = films.filter((f) => f.actions.has("watched")).length;
  const watchlistCount = films.filter((f) => f.actions.has("watchlist")).length;

  return { films, ratedCount, watchedCount, watchlistCount };
}
