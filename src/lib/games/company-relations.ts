// IGDB splits the current 2K brand (20228) from 2K Games (8), leaving the new
// record without a parent. Take-Two lists 2K as a label on its official site.
// Verified 2026-09-30: https://www.take2games.com/ . These are company identities,
// not a curated game list; catalogs and artwork continue to load from IGDB.
export function companyCatalogClause(id: number, includeSubsidiaries = true): string {
  const aliases = companyCatalogIds(id, includeSubsidiaries);
  const ids = aliases.join(",");
  return includeSubsidiaries
    ? `(involved_companies.company = (${ids}) | involved_companies.company.parent = (${ids}) | involved_companies.company.parent.parent = (${ids}))`
    : `involved_companies.company = (${id})`;
}

export function companyCatalogIds(id: number, includeSubsidiaries = true): number[] {
  if (!Number.isSafeInteger(id) || id <= 0) throw Error("Invalid company");
  return includeSubsidiaries ? id === 139 ? [139, 20228] : id === 8 || id === 20228 ? [8, 20228] : [id] : [id];
}
