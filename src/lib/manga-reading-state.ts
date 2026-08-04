export type MangaReadingState = {
  mangaId: string;
  title: string;
  cover?: string;
  chapter: string | null;
  chapterLabel: string;
  page: number;
  totalPages: number;
} | null;

let current: MangaReadingState = null;
const listeners = new Set<() => void>();

export function setMangaReading(state: NonNullable<MangaReadingState>): void {
  current = state;
  for (const l of listeners) l();
}

export function clearMangaReading(): void {
  if (!current) return;
  current = null;
  for (const l of listeners) l();
}

export function getMangaReading(): MangaReadingState {
  return current;
}

export function subscribeMangaReading(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
