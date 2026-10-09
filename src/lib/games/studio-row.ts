import { ATLAS_SUMMARY_FIELDS, igdbSteamIds, parseAtlasGame, type GameConnection } from './igdb-data';
import { companyCatalogClause, companyCatalogIds } from './company-relations';
import type { GameSummary } from './types';

type CompanyCredit = { id?: number; parent?: CompanyCredit };
/** A label's catalog includes its published games and its own child studios, not sibling labels. */
export function studioGames(rows: unknown[], companyId: number): GameSummary[] {
  const family = new Set(companyCatalogIds(companyId));
  return rows.filter(value => {
    const credits=(value as {involved_companies?:{company?:CompanyCredit;developer?:boolean;publisher?:boolean}[]})?.involved_companies;
    return Array.isArray(credits) && credits.some(credit => (credit?.developer === true || credit?.publisher === true)
      && [credit.company, credit.company?.parent, credit.company?.parent?.parent].some(company => company?.id !== undefined && family.has(company.id)));
  }).map(parseAtlasGame);
}

export function detailStudioCompany(developer: string | undefined, metadata: { developers: GameConnection[]; publishers: GameConnection[] } | null): GameConnection | undefined {
  if (!metadata) return;
  if (!developer) return metadata.developers[0] ?? metadata.publishers[0];
  const normalize = (name: string) => name.normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
  return [...metadata.developers, ...metadata.publishers].find(company => normalize(company.name) === normalize(developer));
}
export function mergeStudioGames(current:GameSummary, ...groups:GameSummary[][]):GameSummary[] {
  const ids=new Set([current.id]),steam=new Set(current.steamId?[current.steamId]:[]),igdb=new Set(current.igdbId?[current.igdbId]:[]);
  return groups.flat().filter(game=>{
    if(ids.has(game.id)||game.steamId&&steam.has(game.steamId)||game.igdbId&&igdb.has(game.igdbId))return false;
    ids.add(game.id);if(game.steamId)steam.add(game.steamId);if(game.igdbId)igdb.add(game.igdbId);return true;
  });
}
export const STUDIO_PAGE_SIZE = 24;
export function studioRowQuery(companyId: number, offset = 0, undated = false): string {
  if (!Number.isSafeInteger(offset) || offset < 0) throw Error('Invalid studio offset');
  const fields = `${ATLAS_SUMMARY_FIELDS},involved_companies.company.name,involved_companies.company.parent.name,involved_companies.company.parent.parent.name,involved_companies.developer,involved_companies.publisher`;
  const where = `${companyCatalogClause(companyId, !undated)} & version_parent = null & cover != null & game_type = (0,8,9)`;
  return `fields ${fields}; where ${where}${undated ? ' & first_release_date = null & external_games.external_game_source = 1' : ''}; sort total_rating_count desc; limit ${STUDIO_PAGE_SIZE}; offset ${offset};`;
}
export function studioPage(rows: unknown[], companyId: number, offset: number) {
  return { games: studioGames(rows, companyId), nextOffset: rows.length === STUDIO_PAGE_SIZE ? offset + STUDIO_PAGE_SIZE : null };
}
export async function loadStudioRowPage(companyId:number,offset:number,signal:AbortSignal) {
  const {queryIgdb}=await import('./atlas');
  const [rows, undated] = await Promise.all([
    queryIgdb(studioRowQuery(companyId, offset), signal),
    // Keep public playtests discoverable on arrival; the main cursor still covers the entire catalog.
    offset === 0 ? queryIgdb(studioRowQuery(companyId, 0, true), signal).catch(() => []) : Promise.resolve([]),
  ]);
  signal.throwIfAborted();
  const page = studioPage(rows, companyId, offset);
  return { ...page, games: [...studioGames(undated.filter(row => igdbSteamIds(row).length > 0), companyId), ...page.games] };
}

