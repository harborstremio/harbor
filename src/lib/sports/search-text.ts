/** Fold accents and Arabic vowel marks without changing the displayed name. */
export function normalizeSportsSearch(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/\u0640/g, "")
    .replace(/\u0649/g, "\u064a")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function matchesTeamSearch(
  team: { name: string; shortName?: string; abbr: string; aliases?: string[] },
  query: string,
): boolean {
  return [team.name, team.shortName, team.abbr, ...(team.aliases ?? [])].some((value) =>
    normalizeSportsSearch(value ?? "").includes(normalizeSportsSearch(query)),
  );
}
