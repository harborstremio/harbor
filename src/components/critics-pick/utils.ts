export function upsizeTmdb(url?: string): string | undefined {
  if (!url) return url;
  return url.replace(/\/t\/p\/(w\d+|original)\//, "/t/p/w1280/");
}

export function profileUrl(path: string | null): string | undefined {
  return path ? `https://image.tmdb.org/t/p/w185${path}` : undefined;
}

export function escapeRx(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function excerptReview(content: string): string {
  const trimmed = content.trim();
  if (trimmed.length <= 320) return trimmed;
  const cutoff = trimmed.slice(0, 320);
  const lastSentence = cutoff.lastIndexOf(". ");
  if (lastSentence > 160) return trimmed.slice(0, lastSentence + 1);
  const lastSpace = cutoff.lastIndexOf(" ");
  return trimmed.slice(0, lastSpace > 0 ? lastSpace : 320) + "…";
}

export function formatReviewDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short" });
}
