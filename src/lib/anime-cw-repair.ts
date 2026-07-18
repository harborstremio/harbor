import { library, libraryPut, type LibraryItem } from "@/lib/stremio";

const TT_ID = /^tt\d+$/;
const ANIME_VID = /^(kitsu|mal|anilist|anidb):/;

export function isCorruptAnimeEntry(i: LibraryItem): boolean {
  if (!TT_ID.test(i._id)) return false;
  if (i.removed && !i.temp) return false;
  const vid = i.state?.video_id ?? "";
  return ANIME_VID.test(vid);
}

export async function findCorruptAnimeEntries(authKey: string): Promise<LibraryItem[]> {
  const items = await library(authKey);
  return items.filter(isCorruptAnimeEntry);
}

export async function healCorruptAnimeEntries(
  authKey: string,
  items: LibraryItem[],
): Promise<number> {
  const now = new Date().toISOString();
  let removed = 0;
  for (const i of items) {
    await libraryPut(authKey, { ...i, removed: true, temp: false, _mtime: now }).catch(() => {});
    removed += 1;
  }
  return removed;
}

export async function collectAnimeDiagnostics(
  authKey: string,
): Promise<{ text: string; count: number }> {
  const items = await library(authKey);
  const rows = items
    .filter((i) => {
      const watched = (i.state?.flaggedWatched ?? 0) > 0 || !!i.state?.video_id;
      const rel =
        TT_ID.test(i._id) || ANIME_VID.test(i._id) || i.type === "series" || i.type === "anime";
      return watched && rel;
    })
    .map((i) => ({
      id: i._id,
      type: i.type,
      name: i.name,
      isAnime: i.isAnime ?? null,
      removed: i.removed ?? false,
      video_id: i.state?.video_id ?? null,
      season: i.state?.season ?? null,
      episode: i.state?.episode ?? null,
      flaggedWatched: i.state?.flaggedWatched ?? 0,
      watchedLen: i.state?.watched ? i.state.watched.length : 0,
      lastWatched: i.state?.lastWatched ?? null,
    }));
  const text = JSON.stringify({ v: "0.9.71", count: rows.length, items: rows }, null, 2);
  return { text, count: rows.length };
}
