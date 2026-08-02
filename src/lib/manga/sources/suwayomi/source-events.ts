const REVISION_KEY = "harbor.manga.suwayomi-sources-revision.v1";

const listeners = new Set<(base: string) => void>();

function storedRevision(): number {
  try {
    const value = Number(localStorage.getItem(REVISION_KEY));
    return Number.isFinite(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

let revision = storedRevision();

export function suwayomiSourcesRevision(): number {
  return Math.max(revision, storedRevision());
}

export function notifySuwayomiSourcesChanged(base: string): void {
  revision = suwayomiSourcesRevision() + 1;
  try {
    localStorage.setItem(REVISION_KEY, String(revision));
  } catch {
    /* in-memory revision still invalidates this session */
  }
  for (const listener of listeners) listener(base);
}

export function subscribeSuwayomiSourcesChanged(listener: (base: string) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
