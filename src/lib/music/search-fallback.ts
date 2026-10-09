import {
  collapseWhitespace,
  normalizeName,
  stripInvisible,
  stripNoiseSuffix,
} from "./search-normalize";

export type MusicQueryIntent = { title?: string; artist?: string; album?: string };
export type QueryRungKind = "album" | "song" | "artist";

/** `exact` rungs still pin the artist, so the UI can say whether it had to broaden. */
export type QueryRung = { query: string; kind: QueryRungKind; exact: boolean };

export type LadderText = { clean?: (text: string) => string; key?: (text: string) => string };

export type LadderOutcome<T> = {
  query: string | null;
  index: number;
  results: T | null;
  tried: string[];
  errors: Array<{ query: string; error: unknown }>;
};

export type LadderRun<T> = { hasResults?: (value: T) => boolean; cancelled?: () => boolean };

const TRAILING_GROUP = /\s*[([{][^()[\]{}]*[)\]}]\s*$/u;

const PLACEHOLDER_ARTISTS = new Set(
  [
    "unknown",
    "unknown artist",
    "various",
    "various artists",
    "va",
    "n/a",
    "na",
    "none",
    "no artist",
    "untitled",
    "Неизвестный исполнитель",
    "Неизвестен",
    "Разные исполнители",
    "غير معروف",
    "فنانون متنوعون",
  ].map(normalizeName),
);

const collapse = (text: string | undefined) => collapseWhitespace(stripInvisible(text ?? ""));

const isPlaceholderArtist = (text: string) => PLACEHOLDER_ARTISTS.has(normalizeName(text));

/**
 * search-normalize decides what is semantically noise. Broadening is a different job: the
 * exact rung above already ran and found nothing, so a bracket it kept for good reasons is
 * still a plausible reason a source missed, and dropping it costs nothing here.
 */
function broaden(text: string): string {
  let value = stripNoiseSuffix(text);
  for (let pass = 0; pass < 4; pass += 1) {
    const next = value.replace(TRAILING_GROUP, "").trim();
    if (!next || next === value) break;
    value = next;
  }
  return collapseWhitespace(value);
}

/**
 * Ordered by how precisely each rung identifies a recording, not by how long it is.
 * The runner stops at the first rung that returns anything, so a vague rung placed too
 * early wins with confident garbage and buries the right answer further down.
 */
export function queryLadder(input: MusicQueryIntent, text: LadderText = {}): QueryRung[] {
  const clean = text.clean ?? broaden;
  const key = text.key ?? normalizeName;

  const rawTitle = collapse(input.title);
  const rawAlbum = collapse(input.album);
  const credited = collapse(input.artist);
  // A placeholder credit returns confident garbage, so drop it unless it is all we have.
  const rawArtist = (rawTitle || rawAlbum) && isPlaceholderArtist(credited) ? "" : credited;

  const tidy = (raw: string) => (raw ? collapse(clean(raw)) || raw : "");
  const title = tidy(rawTitle);
  const album = tidy(rawAlbum);
  const artist = tidy(rawArtist);

  const rungs: QueryRung[] = [];
  const seen = new Set<string>();
  const add = (kind: QueryRungKind, exact: boolean, ...parts: string[]) => {
    if (parts.some((part) => !part)) return;
    const query = parts.join(" ");
    const id = key(query);
    if (!id || seen.has(id)) return;
    seen.add(id);
    rungs.push({ query, kind, exact });
  };

  add("album", true, rawAlbum, rawArtist);
  add("album", true, album, artist);
  add("song", true, rawTitle, rawArtist);
  add("song", true, title, artist);

  // Without an artist no exact rung ran, so the raw wording has not been tried yet.
  const pinned = Boolean(rawArtist);
  const broadRung = (kind: QueryRungKind, raw: string, cleaned: string) => {
    if (!pinned) add(kind, false, raw);
    add(kind, false, cleaned);
  };
  broadRung("song", rawTitle, title);
  broadRung("album", rawAlbum, album);
  add("artist", false, artist);
  return rungs;
}

export function buildQueryLadder(input: MusicQueryIntent, text: LadderText = {}): string[] {
  return queryLadder(input, text).map((rung) => rung.query);
}

/** Shaped for MusicSearchResults, which is empty only when `top` and every list are empty. */
export function hasSearchResults(value: unknown): boolean {
  if (value === null || value === undefined || value === false) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value !== "object") return true;
  const record = value as Record<string, unknown>;
  if (record.top) return true;
  const lists = Object.values(record).filter(Array.isArray);
  return lists.length ? lists.some((list) => list.length > 0) : Object.keys(record).length > 0;
}

/**
 * Sequential on purpose. A broader rung must only run once the more specific one above it
 * came back empty, otherwise the ladder races itself and the least precise query can win.
 */
export async function runQueryLadder<T>(
  ladder: readonly string[],
  search: (query: string) => Promise<T>,
  options: LadderRun<T> = {},
): Promise<LadderOutcome<T>> {
  const hasResults = options.hasResults ?? hasSearchResults;
  const tried: string[] = [];
  const errors: LadderOutcome<T>["errors"] = [];
  let index = 0;
  for (const query of ladder) {
    if (options.cancelled?.()) break;
    tried.push(query);
    try {
      const results = await search(query);
      if (options.cancelled?.()) break;
      if (hasResults(results)) return { query, index, results, tried, errors };
    } catch (error) {
      // One source blowing up must not end the ladder, or a transient error reads as no results.
      errors.push({ query, error });
    }
    index += 1;
  }
  return { query: null, index: -1, results: null, tried, errors };
}
