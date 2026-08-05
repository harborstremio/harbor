const REVISION_KEY = "harbor.manga.library-revision.v1";

const listeners = new Set<() => void>();

function storedRevision(): number {
  try {
    const value = Number(localStorage.getItem(REVISION_KEY));
    return Number.isFinite(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

let revision = storedRevision();

export function mangaLibraryRevision(): number {
  return Math.max(revision, storedRevision());
}

export function notifyMangaLibraryChanged(): void {
  revision = mangaLibraryRevision() + 1;
  try {
    localStorage.setItem(REVISION_KEY, String(revision));
  } catch {
    /* in-memory revision still invalidates this session */
  }
  for (const listener of listeners) listener();
}

export function subscribeMangaLibraryChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
