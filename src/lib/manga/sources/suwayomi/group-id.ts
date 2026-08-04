const GROUP_PREFIX = "group:";

export function encodeMangaGroup(ids: string[]): string {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length <= 1) return unique[0] ?? "";
  return `${GROUP_PREFIX}${unique.map(encodeURIComponent).join(",")}`;
}

export function decodeMangaGroup(id: string): string[] {
  if (!id.startsWith(GROUP_PREFIX)) return id ? [id] : [];
  return id
    .slice(GROUP_PREFIX.length)
    .split(",")
    .filter(Boolean)
    .map((part) => decodeURIComponent(part));
}
