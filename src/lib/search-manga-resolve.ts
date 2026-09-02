import { searchManga } from "@/lib/manga/api";
import type { MangaSummary } from "@/lib/manga/model";

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function bestMangaMatch(hits: MangaSummary[], title: string): MangaSummary | null {
  if (hits.length === 0) return null;
  const target = norm(title);
  const exact = hits.find((m) => norm(m.title) === target);
  if (exact) return exact;
  const starts = hits.find(
    (m) => norm(m.title).startsWith(target) || target.startsWith(norm(m.title)),
  );
  return starts ?? hits[0];
}

// A franchise hit carries an AniList id, and the reader is keyed by manga source id,
// so opening one means resolving it back by title first. Passing the AniList id
// straight to openManga silently opens nothing.
export async function resolveMangaIdByTitle(title: string): Promise<string | undefined> {
  const q = title.trim();
  if (!q) return undefined;
  const hits = await searchManga(q, 0).catch(() => [] as MangaSummary[]);
  return bestMangaMatch(hits, q)?.id;
}
