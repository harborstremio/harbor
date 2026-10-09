import { unzip } from "@/lib/unzip";
import { isRated, normalizeScore, scoreIsValid } from "../types";
import type { ImportProgress, ImportSourceInput, ImportedRating, RatingsSource } from "../types";

const CHUNK = 200;
const MAX_TITLE = 300;
const MAX_REVIEW = 4000;
const MIN_YEAR = 1870;
const MAX_YEAR = 2200;
const MAX_STARS = 5;

const FILM_PATH = /letterboxd\.com\/(?:[^/?#\s]+\/)?film\/([^/?#\s]+)/i;
const BOXD_SHORT = /boxd\.it\/([A-Za-z0-9]+)/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const RATING_NUM = /^\d*\.?\d+$/;

type Parsed = { key: string; rating: ImportedRating };

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
}

function parseCsv(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let dirty = false;
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      quoted = true;
      dirty = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      dirty = true;
      i += 1;
      continue;
    }
    if (ch === "\r") {
      i += 1;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      dirty = false;
      i += 1;
      continue;
    }
    field += ch;
    dirty = true;
    i += 1;
  }
  if (dirty || field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function headerIndex(header: string[] | undefined): Map<string, number> {
  const map = new Map<string, number>();
  if (!header) return map;
  for (let i = 0; i < header.length; i += 1) {
    const key = header[i].trim().toLowerCase();
    if (key && !map.has(key)) map.set(key, i);
  }
  return map;
}

function cell(row: string[], idx: Map<string, number>, name: string): string {
  const at = idx.get(name);
  if (at === undefined) return "";
  const value = row[at];
  return typeof value === "string" ? value.trim() : "";
}

function filmSlug(uri: string): string | undefined {
  if (!uri) return undefined;
  const film = FILM_PATH.exec(uri);
  if (film) return film[1].toLowerCase();
  const short = BOXD_SHORT.exec(uri);
  if (short) return short[1];
  return undefined;
}

function parseYear(raw: string): number | undefined {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < MIN_YEAR || n > MAX_YEAR) return undefined;
  return n;
}

function parseDate(raw: string): number | undefined {
  if (!raw) return undefined;
  const ms = Date.parse(ISO_DATE.test(raw) ? `${raw}T00:00:00Z` : raw);
  return Number.isFinite(ms) ? ms : undefined;
}

function cleanReview(raw: string): string | undefined {
  const text = raw.replace(/\r\n?/g, "\n").trim();
  if (!text) return undefined;
  return text.slice(0, MAX_REVIEW);
}

function titleKey(title: string, year: number | undefined): string {
  return `${title.toLowerCase()}|${year ?? ""}`;
}

function rowKey(slug: string | undefined, title: string, year: number | undefined): string {
  return slug ?? titleKey(title, year);
}

function toRating(
  row: string[],
  idx: Map<string, number>,
  reviews: Map<string, string>,
): Parsed | null {
  const title = cell(row, idx, "name").slice(0, MAX_TITLE);
  if (!title) return null;
  const rawCell = cell(row, idx, "rating");
  if (!RATING_NUM.test(rawCell)) return null;
  const raw = Number(rawCell);
  if (!isRated(raw) || raw > MAX_STARS) return null;
  const score = normalizeScore(raw, "point5");
  if (!scoreIsValid(score)) return null;
  const year = parseYear(cell(row, idx, "year"));
  const slug = filmSlug(cell(row, idx, "letterboxd uri"));
  const key = rowKey(slug, title, year);
  const ratedAt = parseDate(cell(row, idx, "date"));
  const review =
    cleanReview(cell(row, idx, "review")) ?? reviews.get(key) ?? reviews.get(titleKey(title, year));
  const rating: ImportedRating = {
    sourceId: "letterboxd",
    score,
    mediaType: "movie",
    title,
    ids: slug ? { letterboxd: slug, slug } : {},
  };
  if (year !== undefined) rating.year = year;
  if (ratedAt !== undefined) rating.ratedAt = ratedAt;
  if (review) rating.review = review;
  return { key, rating };
}

function parseReviews(text: string): Map<string, string> {
  const map = new Map<string, string>();
  const rows = parseCsv(text);
  const idx = headerIndex(rows[0]);
  if (!idx.has("name") || !idx.has("review")) return map;
  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const title = cell(row, idx, "name").slice(0, MAX_TITLE);
    if (!title) continue;
    const review = cleanReview(cell(row, idx, "review"));
    if (!review) continue;
    const slug = filmSlug(cell(row, idx, "letterboxd uri"));
    map.set(titleKey(title, parseYear(cell(row, idx, "year"))), review);
    if (slug) map.set(slug, review);
  }
  return map;
}

function parseRatings(
  text: string,
  reviews: Map<string, string>,
  onProgress: (p: Partial<ImportProgress>) => void,
  signal: AbortSignal | undefined,
): ImportedRating[] {
  const rows = parseCsv(text);
  const idx = headerIndex(rows[0]);
  if (!idx.has("name") || !idx.has("rating")) {
    throw new Error(
      'That file does not look like a Letterboxd export. Expected a CSV with "Name" and "Rating" columns. Upload the export ZIP, or ratings.csv from inside it.',
    );
  }
  const total = Math.max(rows.length - 1, 0);
  onProgress({ phase: "fetch", fetched: 0, total });
  const out = new Map<string, ImportedRating>();
  for (let i = 1; i < rows.length; i += 1) {
    if (i % CHUNK === 0) {
      throwIfAborted(signal);
      onProgress({ phase: "fetch", fetched: i - 1, message: `Row ${i - 1} of ${total}` });
    }
    const parsed = toRating(rows[i], idx, reviews);
    if (!parsed) continue;
    const prev = out.get(parsed.key);
    if (prev && (prev.ratedAt ?? 0) > (parsed.rating.ratedAt ?? 0)) continue;
    out.set(parsed.key, parsed.rating);
  }
  if (out.size === 0) {
    throw new Error(
      "No rated films in that file. Letterboxd ratings run 0.5 to 5 stars, so a Rating column that is empty, or one already converted to a 10 point scale, imports nothing. Upload ratings.csv from your Letterboxd export.",
    );
  }
  onProgress({ phase: "fetch", fetched: total, message: `${out.size} ratings` });
  return [...out.values()];
}

function isZip(bytes: Uint8Array): boolean {
  return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

function pickEntry(files: Map<string, Uint8Array>, name: string): Uint8Array | undefined {
  for (const [path, data] of files) {
    if (path.split("/").pop()?.toLowerCase() === name) return data;
  }
  return undefined;
}

async function readZip(
  buffer: ArrayBuffer,
  decoder: TextDecoder,
): Promise<{ ratings: string; reviews: Map<string, string> }> {
  let files: Map<string, Uint8Array>;
  try {
    files = await unzip(buffer);
  } catch {
    throw new Error("Could not read that ZIP. Unzip it yourself and upload ratings.csv instead.");
  }
  const ratings = pickEntry(files, "ratings.csv");
  if (!ratings) {
    throw new Error(
      "No ratings.csv inside that ZIP. Use the full data export from letterboxd.com/settings/data, not a single list export.",
    );
  }
  const reviewBytes = pickEntry(files, "reviews.csv");
  return {
    ratings: decoder.decode(ratings),
    reviews: reviewBytes ? parseReviews(decoder.decode(reviewBytes)) : new Map(),
  };
}

async function fetchRatings(
  input: ImportSourceInput,
  onProgress: (p: Partial<ImportProgress>) => void,
  signal?: AbortSignal,
): Promise<ImportedRating[]> {
  const file = input.file;
  if (!file) {
    throw new Error(
      "Choose your Letterboxd export first. Export it from letterboxd.com/settings/data (Letterboxd Pro is required), then upload the ZIP or the ratings.csv inside it.",
    );
  }
  throwIfAborted(signal);
  onProgress({ phase: "fetch", fetched: 0, message: "Reading file" });
  const buffer = await file.arrayBuffer();
  throwIfAborted(signal);
  const decoder = new TextDecoder("utf-8");
  const bytes = new Uint8Array(buffer);
  const source = isZip(bytes)
    ? await readZip(buffer, decoder)
    : { ratings: decoder.decode(bytes), reviews: new Map<string, string>() };
  throwIfAborted(signal);
  return parseRatings(source.ratings, source.reviews, onProgress, signal);
}

function hasTmdbKey(): boolean {
  try {
    const raw = localStorage.getItem("harbor.settings");
    if (!raw) return false;
    const key = (JSON.parse(raw) as { tmdbKey?: unknown }).tmdbKey;
    return typeof key === "string" && key.trim().length > 0;
  } catch {
    return false;
  }
}

export const letterboxdSource: RatingsSource = {
  id: "letterboxd",
  label: "Letterboxd",
  kind: "file",
  available: () => hasTmdbKey(),
  fetchRatings,
};
