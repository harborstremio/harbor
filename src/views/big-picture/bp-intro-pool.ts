const KEY = "harbor.bp.intro.posters";
const CAP = 96;

/**
 * The splash mosaic drawn from the previous session.
 *
 * The pool the shell builds comes out of the home rows, and on a television
 * those rows are still in flight when the splash is on screen, so the first
 * boot after an install draws seeded placeholder blocks instead of art. Keeping
 * the urls means every boot after that opens on real posters at the first
 * frame. Urls only, no metadata: this is art for a backdrop, never a catalog.
 */
export function bpIntroPoolLoad(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((u): u is string => typeof u === "string" && u.length > 0).slice(0, CAP);
  } catch {
    return [];
  }
}

export function bpIntroPoolSave(urls: string[]): void {
  const next = urls.filter((u) => !!u).slice(0, CAP);
  if (next.length < 16) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* a full quota costs the next boot its art, never the session */
  }
}
