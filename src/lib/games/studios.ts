import { queryIgdb, readIgdbSnapshot } from "./atlas";
import { ATLAS_SUMMARY_FIELDS } from "./igdb-data";
import { parseStudioProfile, parseStudioSearch, parseStudioMarks, studioSearchQuery } from "./studio-data";
import { companyCatalogClause } from "./company-relations";
import { savedMetadataAt } from "./metadata-records";
export type { StudioProfile } from "./studio-data";

export const FEATURED_STUDIOS = [
  { id: 139, name: "Take-Two Interactive" }, { id: 37, name: "Capcom" },
  { id: 908, name: "CD Projekt RED" }, { id: 51, name: "Blizzard Entertainment" },
  { id: 305, name: "Remedy Entertainment" }, { id: 248, name: "Bandai Namco Entertainment" },
  { id: 29, name: "Rockstar Games" }, { id: 20228, name: "2K" },
  { id: 70, name: "Nintendo" }, { id: 112, name: "Sega" },
  { id: 10100, name: "Sony Interactive Entertainment" }, { id: 17966, name: "Xbox Game Studios" },
  { id: 1, name: "Electronic Arts" }, { id: 26, name: "Square Enix" },
  { id: 56, name: "Valve" }, { id: 16565, name: "Bethesda Softworks" },
  { id: 1012, name: "FromSoftware" }, { id: 510, name: "Larian Studios" },
  { id: 401, name: "Naughty Dog" }, { id: 834, name: "Insomniac Games" },
  { id: 170, name: "Kojima Productions" }, { id: 290, name: "IO Interactive" },
  { id: 928, name: "Supergiant Games" }, { id: 7263, name: "Team Cherry" },
  { id: 634, name: "Devolver Digital" }, { id: 11662, name: "Annapurna Interactive" },
  { id: 41, name: "Riot Games" }, { id: 104, name: "Ubisoft" },
] as const;
const companyFields = "involved_companies.company.name,involved_companies.company.logo.image_id,involved_companies.company.description,involved_companies.company.parent.name,involved_companies.company.parent.logo.image_id,involved_companies.company.parent.description,involved_companies.company.parent.parent.name,involved_companies.company.parent.parent.logo.image_id,involved_companies.company.parent.parent.description";

async function studioProfile(id: number, signal?: AbortSignal, snapshot = false, priority = false) {
  if (!Number.isSafeInteger(id) || id <= 0) throw Error("Invalid company");
  const filter = `${companyCatalogClause(id)} & version_parent = null & cover != null & game_type = (0,8,9)`;
  const query = (body: string) => snapshot ? readIgdbSnapshot(body) : queryIgdb(body, signal, false, priority);
  const base = await query(`fields ${ATLAS_SUMMARY_FIELDS},${companyFields}; where ${filter}; sort total_rating_count desc; limit 36;`);
  if (!base) return null;
  const rows = [...base];
  // Keep Take-Two's sports label represented beside its most-discussed story games.
  // Select the latest released NBA 2K from the live family catalog, not a fixed edition.
  if (id === 139 || id === 8 || id === 20228) {
    try {
      const sports = await query(`fields ${ATLAS_SUMMARY_FIELDS},${companyFields}; where ${filter} & name ~ *"NBA 2K"* & first_release_date <= ${Math.floor(Date.now() / 86400_000) * 86400}; sort first_release_date desc; limit 1;`);
      if (sports) rows.unshift(...sports);
    } catch { signal?.throwIfAborted(); }
  }
  if (id === 248) {
    // Regional distribution credits include CD Projekt games; lead Bandai's
    // showcase with its own recognizable publishing series instead.
    const signature = ["Elden Ring", "Tekken", "Dark Souls", "Ace Combat", "Tales", "Dragon Ball", "Katamari", "Pac-Man"];
    rows.sort((a, b) => {
      const rank = (value: unknown) => { const name = (value as {name?: string}).name ?? ""; const index = signature.findIndex(series => name.startsWith(series)); return index < 0 ? signature.length : index; };
      return rank(a) - rank(b);
    });
  }
  return parseStudioProfile(rows, id);
}
export async function loadStudioProfile(id: number, signal?: AbortSignal, priority = true) {
  const profile = await studioProfile(id, signal, false, priority);
  if (!profile) throw Error("Company unavailable");
  return profile;
}
/** One small metadata query for the picker, rather than six complete catalogs. */
export async function loadStudioMarks(ids: readonly number[], signal?: AbortSignal) {
  if (!ids.length || ids.some(id => !Number.isSafeInteger(id) || id <= 0)) return [];
  const fields = "involved_companies.company.name,involved_companies.company.logo.image_id,involved_companies.company.parent.name,involved_companies.company.parent.logo.image_id";
  const rows = await queryIgdb(`fields ${fields}; where (involved_companies.company = (${ids.join(",")}) | involved_companies.company.parent = (${ids.join(",")})) & total_rating_count > 20; sort total_rating_count desc; limit 150;`, signal);
  return parseStudioMarks(rows, ids);
}
export function readStudioProfileSnapshot(id: number) { return studioProfile(id, undefined, true).catch(() => null); }
export async function searchStudios(query: string, signal?: AbortSignal) {
  const rows = await queryIgdb(studioSearchQuery(query), signal);
  return Object.assign(parseStudioSearch(rows, query), { cachedAt: savedMetadataAt(rows) });
}
export async function readStudioSearchSnapshot(query: string) {
  try { const rows = await readIgdbSnapshot(studioSearchQuery(query)); return rows ? Object.assign(parseStudioSearch(rows, query), { cachedAt: savedMetadataAt(rows) }) : null; }
  catch { return null; }
}
