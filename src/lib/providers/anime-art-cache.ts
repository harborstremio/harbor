import { registerEvictable } from "@/lib/maintenance";
import { registerCache } from "@/lib/memory-profiler";

export type AnimeArt = { bg?: string; logo?: string; backdrops?: string[] };
type Entry = AnimeArt & { t: number };

const KEY = "harbor.anime.art.v2";
const CAP = 1000;
const TTL = 60 * 24 * 60 * 60 * 1000;
const mem = new Map<string, Entry>();
let loaded = false;

registerCache("anime:art", () => mem.size);
registerEvictable("anime-art", (aggressive) => {
  if (aggressive) {
    mem.clear();
    loaded = false;
  }
});

function ensure(): void {
  if (loaded) return;
  loaded = true;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}") as { map?: Record<string, Entry> };
    const now = Date.now();
    for (const [k, e] of Object.entries(raw.map ?? {})) {
      if (e && now - e.t < TTL) mem.set(k, e);
    }
  } catch {
    /* ignore */
  }
}

function persist(): void {
  const entries = [...mem.entries()];
  const trimmed =
    entries.length > CAP ? entries.sort((a, b) => b[1].t - a[1].t).slice(0, CAP) : entries;
  try {
    localStorage.setItem(KEY, JSON.stringify({ map: Object.fromEntries(trimmed) }));
  } catch {
    /* ignore */
  }
}

export function peekAnimeArt(key: string | undefined | null): AnimeArt | undefined {
  if (!key) return undefined;
  ensure();
  return mem.get(key);
}

export function saveAnimeArt(key: string | undefined | null, art: AnimeArt): void {
  if (!key || (!art.bg && !art.logo && !art.backdrops?.length)) return;
  ensure();
  const prev = mem.get(key);
  const next: Entry = {
    bg: art.bg ?? prev?.bg,
    logo: art.logo ?? prev?.logo,
    backdrops: art.backdrops?.length ? art.backdrops : prev?.backdrops,
    t: Date.now(),
  };
  if (prev && next.bg === prev.bg && next.logo === prev.logo && next.backdrops === prev.backdrops) return;
  mem.set(key, next);
  persist();
}
