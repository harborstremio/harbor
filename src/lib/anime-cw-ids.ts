const KEY = "harbor.anime-cw-ids.v2";
// A played cour can differ from the catalog id's canonical entry (playing a
// Stone Ocean episode records Stone Ocean), so playback mappings live apart
// from the detail page's canonical mapping — opening a catalog id must not
// jump to whichever cour was played last.
const PLAY_KEY = "harbor.anime-play-ids.v1";
const MAX = 400;

const ANIME_SCHEME = /^(kitsu|mal|anilist|anidb):/;
// Catalog ids that can carry a recorded anime mapping: Cinemeta's IMDb ids and
// TMDB's tv ids — both resolve to the same anime entries.
const CATALOG_ID = /^(?:tt\d+|tmdb:tv:)/;

function readKey(key: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeKey(key: string, map: Record<string, string>): void {
  try {
    const keys = Object.keys(map);
    let out = map;
    if (keys.length > MAX) {
      out = {};
      for (const k of keys.slice(keys.length - MAX)) out[k] = map[k];
    }
    localStorage.setItem(key, JSON.stringify(out));
  } catch {
    /* ignore */
  }
}

function record(key: string, catalogId: string, animeId: string): void {
  if (!CATALOG_ID.test(catalogId) || !ANIME_SCHEME.test(animeId)) return;
  const map = readKey(key);
  if (map[catalogId] === animeId) return;
  delete map[catalogId];
  map[catalogId] = animeId;
  writeKey(key, map);
}

/** Catalog id -> the anime entry the detail page resolved (canonical). */
export function recordAnimeCwId(catalogId: string, animeId: string): void {
  record(KEY, catalogId, animeId);
}

/** Catalog id -> the anime entry a playback actually used (a specific cour). */
export function recordAnimePlayId(catalogId: string, animeId: string): void {
  record(PLAY_KEY, catalogId, animeId);
}

/** Any recorded anime entry: the played cour first, then the canonical one. */
export function getAnimeCwId(catalogId: string): string | null {
  if (!CATALOG_ID.test(catalogId)) return null;
  return readKey(PLAY_KEY)[catalogId] ?? readKey(KEY)[catalogId] ?? null;
}

/** Only the detail page's canonical mapping — what detection may be seeded from. */
export function getAnimeCanonicalId(catalogId: string): string | null {
  if (!CATALOG_ID.test(catalogId)) return null;
  return readKey(KEY)[catalogId] ?? null;
}
