export function normalizeSearchQuery(query: string): string {
  return query.normalize("NFKC").trim().toLowerCase().replace(/\s+/gu, " ");
}
