import { persistCritical } from "@/lib/storage-recovery";

export type EBookListeningProgress = {
  chapterId: string;
  seconds: number;
  updatedAt: number;
};

const key = (profile: string, bookId: string) =>
  `harbor.ebook.audiobook.progress.v1.${encodeURIComponent(profile)}.${encodeURIComponent(bookId)}`;

export function loadEBookListeningProgress(
  profile: string,
  bookId: string,
): EBookListeningProgress | null {
  try {
    const value = JSON.parse(localStorage.getItem(key(profile, bookId)) || "null");
    return value?.chapterId && Number.isFinite(value.seconds) ? value : null;
  } catch {
    return null;
  }
}

export function saveEBookListeningProgress(
  profile: string,
  bookId: string,
  chapterId: string,
  seconds: number,
): void {
  persistCritical(key(profile, bookId), JSON.stringify({
    chapterId,
    seconds: Math.max(0, seconds),
    updatedAt: Date.now(),
  }));
}
