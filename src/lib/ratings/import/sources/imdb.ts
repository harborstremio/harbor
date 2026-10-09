import { isRated, normalizeScore, scoreIsValid } from "../types";
import type { ImportedRating, ImportProgress, ImportSourceInput, RatingsSource } from "../types";

const TCONST = /^tt\d+$/;
const PROGRESS_STEP = 500;

const SERIES_TYPES = new Set(["tvseries", "tvminiseries", "miniseries"]);

const SKIP_TYPES = new Set([
  "tvepisode",
  "episode",
  "tvpilot",
  "videogame",
  "podcastseries",
  "podcastepisode",
]);

const CONST_KEYS = ["const"];
const SCORE_KEYS = ["your rating", "you rated"];
const TITLE_KEYS = ["title"];
const ORIGINAL_TITLE_KEYS = ["original title"];
const TYPE_KEYS = ["title type", "title_type"];
const YEAR_KEYS = ["year"];
const DATE_KEYS = ["date rated", "date added", "created", "modified"];

type Columns = {
  id: number;
  score: number;
  title: number;
  originalTitle: number;
  type: number;
  year: number;
  date: number;
};

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
}

function parseCsvRows(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let dirty = false;

  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c !== '"') {
        field += c;
        continue;
      }
      if (text[i + 1] === '"') {
        field += '"';
        i += 1;
        continue;
      }
      quoted = false;
      continue;
    }
    if (c === '"') {
      quoted = true;
      dirty = true;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      dirty = true;
      continue;
    }
    if (c === "\r") continue;
    if (c === "\n") {
      if (dirty || field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
        dirty = false;
      }
      continue;
    }
    field += c;
    dirty = true;
  }

  if (dirty || field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function normalizeHeader(header: string[]): string[] {
  return header.map((h) => h.trim().toLowerCase().replace(/\s+/g, " "));
}

function indexOfKey(header: string[], keys: string[]): number {
  for (const key of keys) {
    const i = header.indexOf(key);
    if (i >= 0) return i;
  }
  return -1;
}

function readColumns(header: string[]): Columns | null {
  const h = normalizeHeader(header);
  const id = indexOfKey(h, CONST_KEYS);
  const score = indexOfKey(h, SCORE_KEYS);
  const title = indexOfKey(h, TITLE_KEYS);
  if (id < 0 || score < 0 || title < 0) return null;
  return {
    id,
    score,
    title,
    originalTitle: indexOfKey(h, ORIGINAL_TITLE_KEYS),
    type: indexOfKey(h, TYPE_KEYS),
    year: indexOfKey(h, YEAR_KEYS),
    date: indexOfKey(h, DATE_KEYS),
  };
}

function cell(row: string[], i: number): string {
  return i >= 0 && i < row.length ? row[i].trim() : "";
}

function mediaTypeOf(raw: string): "movie" | "series" | null {
  const key = raw.toLowerCase().replace(/[^a-z]/g, "");
  if (!key) return "movie";
  if (SKIP_TYPES.has(key)) return null;
  if (SERIES_TYPES.has(key)) return "series";
  return "movie";
}

function toYear(raw: string): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw.slice(0, 4));
  return Number.isInteger(n) && n > 1800 && n < 2200 ? n : undefined;
}

function toEpochMs(raw: string): number | undefined {
  if (!raw) return undefined;
  const n = Date.parse(raw);
  return Number.isFinite(n) ? n : undefined;
}

function toRating(row: string[], cols: Columns): ImportedRating | null {
  const imdb = cell(row, cols.id);
  if (!TCONST.test(imdb)) return null;

  const raw = Number(cell(row, cols.score));
  if (!isRated(raw)) return null;
  const score = normalizeScore(raw, "point10");
  if (!scoreIsValid(score)) return null;

  const mediaType = mediaTypeOf(cell(row, cols.type));
  if (!mediaType) return null;

  const title = (cell(row, cols.title) || cell(row, cols.originalTitle)).slice(0, 300);
  if (!title) return null;

  return {
    sourceId: "imdb",
    score,
    mediaType,
    title,
    year: toYear(cell(row, cols.year)),
    ratedAt: toEpochMs(cell(row, cols.date)),
    ids: { imdb },
  };
}

const EXPORT_HINT =
  "On imdb.com open Your Ratings, choose Export, then upload the ratings.csv you download.";

async function fetchRatings(
  input: ImportSourceInput,
  onProgress: (p: Partial<ImportProgress>) => void,
  signal?: AbortSignal,
): Promise<ImportedRating[]> {
  const file = input.file;
  if (!file) throw new Error(`Choose your IMDb ratings.csv file first. ${EXPORT_HINT}`);

  throwIfAborted(signal);
  onProgress({ phase: "fetch", fetched: 0 });

  const text = await file.text();
  throwIfAborted(signal);

  const rows = parseCsvRows(text);
  const header = rows[0];
  if (!header || rows.length < 2) {
    throw new Error(`That CSV has no rows. ${EXPORT_HINT}`);
  }

  const cols = readColumns(header);
  if (!cols) {
    throw new Error(
      `That file does not look like an IMDb export. It needs a header row with Const, Your Rating and Title columns. ${EXPORT_HINT}`,
    );
  }

  const total = rows.length - 1;
  onProgress({ phase: "fetch", fetched: 0, total });

  const out: ImportedRating[] = [];
  for (let i = 1; i < rows.length; i += 1) {
    if (i % PROGRESS_STEP === 0) {
      throwIfAborted(signal);
      onProgress({ phase: "fetch", fetched: i });
    }
    const rating = toRating(rows[i], cols);
    if (rating) out.push(rating);
  }

  throwIfAborted(signal);
  onProgress({ phase: "fetch", fetched: total });

  if (!out.length) {
    throw new Error(
      "That export has no rated titles. A watchlist or list export leaves Your Rating empty, so export from Your Ratings instead.",
    );
  }
  return out;
}

export const imdbSource: RatingsSource = {
  id: "imdb",
  label: "IMDb",
  kind: "file",
  available: () => true,
  fetchRatings,
};
