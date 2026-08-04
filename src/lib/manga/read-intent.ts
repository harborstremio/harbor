import type { MangaProgressEntry } from "@/lib/manga-progress";

let pending: MangaProgressEntry | null = null;

export function setMangaReadIntent(entry: MangaProgressEntry): void {
  pending = entry;
}

export function takeMangaReadIntent(mangaId: string): MangaProgressEntry | null {
  const p = pending;
  pending = null;
  return p && p.id === mangaId ? p : null;
}
