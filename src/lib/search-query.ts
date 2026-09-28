export function normalizeSearchQuery(query: string): string {
  return query.normalize("NFKC").trim().toLowerCase().replace(/\s+/gu, " ");
}

type SearchCandidate = {
  name?: string;
  title?: string;
  original_name?: string;
  original_title?: string;
  popularity?: number;
};

export function isBetterSearchMatch(
  query: string,
  candidate: SearchCandidate,
  current: SearchCandidate | null,
): boolean {
  if (!current) return true;
  const normalized = normalizeSearchQuery(query);
  const exact = (item: SearchCandidate) =>
    [item.name, item.title, item.original_name, item.original_title].some(
      (title) => title && normalizeSearchQuery(title) === normalized,
    );
  const candidateExact = exact(candidate);
  const currentExact = exact(current);
  if (candidateExact !== currentExact) return candidateExact;
  return (candidate.popularity ?? 0) > (current.popularity ?? 0);
}
