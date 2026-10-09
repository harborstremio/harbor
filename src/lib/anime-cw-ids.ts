const KEY = "harbor.anime-cw-ids.v1";
const MAX = 400;

const ANIME_SCHEME = /^(kitsu|mal|anilist|anidb):/;

function read(): Record<string, string> {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function write(map: Record<string, string>): void {
  try {
    const keys = Object.keys(map);
    let out = map;
    if (keys.length > MAX) {
      out = {};
      for (const k of keys.slice(keys.length - MAX)) out[k] = map[k];
    }
    localStorage.setItem(KEY, JSON.stringify(out));
  } catch {
    /* ignore */
  }
}

export function recordAnimeCwId(ttId: string, animeId: string): void {
  if (!ttId.startsWith("tt") || !ANIME_SCHEME.test(animeId)) return;
  const map = read();
  if (map[ttId] === animeId) return;
  delete map[ttId];
  map[ttId] = animeId;
  write(map);
}

export function getAnimeCwId(ttId: string): string | null {
  if (!ttId.startsWith("tt")) return null;
  return read()[ttId] ?? null;
}
