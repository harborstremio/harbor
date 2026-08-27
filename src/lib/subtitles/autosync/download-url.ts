export function resolveSubtitleDownloadUrl(
  raw: string | null | undefined,
  base: string,
): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const url = new URL(value, base);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}
