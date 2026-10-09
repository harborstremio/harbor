const PREFIX = "harbor.manga.art.";
const MAX_AGE = 30 * 24 * 60 * 60 * 1000;

export function readArt(ns: string, key: string): string | null {
  try {
    const raw = localStorage.getItem(`${PREFIX}${ns}.${key}`);
    if (!raw) return null;
    const rec = JSON.parse(raw) as { url: string; at: number };
    if (!rec?.url || Date.now() - rec.at > MAX_AGE) return null;
    return rec.url;
  } catch {
    return null;
  }
}

export function writeArt(ns: string, key: string, url: string): void {
  if (!url) return;
  try {
    localStorage.setItem(`${PREFIX}${ns}.${key}`, JSON.stringify({ url, at: Date.now() }));
  } catch {
    /* quota */
  }
}
