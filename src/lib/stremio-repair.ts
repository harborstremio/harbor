import { meta as fetchMeta, narrowMediaType } from "@/lib/cinemeta";
import { animeKitsuMeta } from "@/lib/providers/anime-kitsu-addon";
import { tmdbLiteMeta } from "@/lib/providers/tmdb/tmdb-lite";
import { libraryGetOneStrict, libraryPut, type LibraryItem } from "@/lib/stremio";

const FLAG_PREFIX = "harbor.libraryNameRepair.v1.";
const MAX_ITEMS = 150;
const CONCURRENCY = 4;

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
}

async function canonicalFor(
  item: LibraryItem,
  tmdbKey: string,
): Promise<{ name: string; poster: string | null } | null> {
  const id = item._id;
  try {
    if (id.startsWith("tt")) {
      const m = await fetchMeta(narrowMediaType(item.type), id);
      return m?.name ? { name: m.name, poster: m.poster ?? null } : null;
    }
    if (/^(kitsu|mal|anilist|anidb):/.test(id)) {
      const m = await animeKitsuMeta(id);
      return m?.name ? { name: m.name, poster: m.poster ?? null } : null;
    }
    if (id.startsWith("tmdb:")) {
      const m = await tmdbLiteMeta(tmdbKey, id);
      return m?.name ? { name: m.name, poster: m.poster ?? null } : null;
    }
  } catch {}
  return null;
}

export async function repairLibraryNames(
  authKey: string,
  items: LibraryItem[],
  userId: string,
  tmdbKey: string,
): Promise<number> {
  const flagKey = `${FLAG_PREFIX}${userId || "anon"}`;
  try {
    if (localStorage.getItem(flagKey)) return 0;
  } catch {}

  const touched = items
    .filter((i) => i.state && ((i.state.timeOffset ?? 0) > 0 || i.temp === true))
    .filter((i) => (i.name ?? "").trim().length > 0)
    .slice(0, MAX_ITEMS);

  let repaired = 0;
  const queue = [...touched];
  const worker = async () => {
    for (;;) {
      const item = queue.shift();
      if (!item) return;
      const canon = await canonicalFor(item, tmdbKey);
      if (!canon?.name) continue;
      if (norm(canon.name) === norm(item.name ?? "")) continue;
      let fresh: LibraryItem | null;
      try {
        fresh = await libraryGetOneStrict(authKey, item._id);
      } catch {
        continue;
      }
      if (!fresh) continue;
      if (norm(canon.name) === norm(fresh.name ?? "")) continue;
      try {
        await libraryPut(authKey, {
          ...fresh,
          name: canon.name,
          poster: canon.poster ?? fresh.poster,
          _mtime: fresh._mtime,
        });
        repaired += 1;
        console.info(`[library-repair] "${item.name}" -> "${canon.name}" (${item._id})`);
      } catch {}
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  try {
    localStorage.setItem(flagKey, String(Date.now()));
  } catch {}
  if (repaired > 0) console.info(`[library-repair] repaired ${repaired} corrupted library names`);
  return repaired;
}
