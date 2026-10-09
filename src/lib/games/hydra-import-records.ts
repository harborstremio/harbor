/** The allowlisted native review contract; also used to validate retained provenance. */
export type HydraGame = {
  key: string; name: string; shop: string; objectId: string;
  executable: string | null; launchOptions: string | null; winePrefix: string | null; proton: string | null;
  addedAt: string | null; lastPlayed: string | null; playtimeMs: number | null; steamPlaytimeMs: number | null;
  playtimeManuallyEdited: boolean; favorite: boolean; pinned: boolean; concealed: boolean; issues: string[];
};
export type HydraSource = { key: string; name: string; url: string };
export type HydraReview = { directory: string; fingerprint: string; sourceBytes: number; report: {
  games: HydraGame[]; sources: HydraSource[]; deletedGames: number; invalidGames: number; invalidSources: number;
} };
export type HydraOrigin = { version: 1; importedAt: number; original: HydraGame };
const fail = (): never => { throw Error('hydra_format'); };
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string,unknown> : fail();
const text = (value: unknown, max: number): string => typeof value === 'string' && value.trim() && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value) ? value : fail();
const optional = (value: unknown, max: number): string | null => value === null ? null : text(value,max);
const bool = (value: unknown): boolean => typeof value === 'boolean' ? value : fail();
const integer = (value: unknown, max: number): number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= max ? value : fail();
export function parseHydraGame(value: unknown): HydraGame {
  const v=object(value), key=text(v.key,242), shop=text(v.shop,40), objectId=text(v.objectId,200);
  if(key!==`${shop}:${objectId}`||!Array.isArray(v.issues)||v.issues.length>32) return fail();
  return {key,shop,objectId,name:text(v.name,500),executable:optional(v.executable,4096),launchOptions:optional(v.launchOptions,16384),winePrefix:optional(v.winePrefix,4096),proton:optional(v.proton,4096),addedAt:optional(v.addedAt,128),lastPlayed:optional(v.lastPlayed,128),
    playtimeMs:v.playtimeMs===null?null:integer(v.playtimeMs,3_600_000_000_000),steamPlaytimeMs:v.steamPlaytimeMs===null?null:integer(v.steamPlaytimeMs,3_600_000_000_000),playtimeManuallyEdited:bool(v.playtimeManuallyEdited),favorite:bool(v.favorite),pinned:bool(v.pinned),concealed:bool(v.concealed),issues:v.issues.map(value=>text(value,80))};
}
export function parseHydraReview(value: unknown): HydraReview {
  const v=object(value), report=object(v.report);
  if(!Array.isArray(report.games)||report.games.length>10000||!Array.isArray(report.sources)||report.sources.length>2048||!/^([a-f0-9]{64})$/.test(String(v.fingerprint)))return fail();
  const games=report.games.map(parseHydraGame), sources=report.sources.map(value=>{const v=object(value),url=text(v.url,4096);let parsed:URL;try{parsed=new URL(url);}catch{return fail();}if(!['http:','https:'].includes(parsed.protocol)||!parsed.hostname||parsed.username||parsed.password)fail();return{key:text(v.key,200),name:text(v.name,500),url};});
  if(new Set(games.map(g=>g.key)).size!==games.length||new Set(sources.map(s=>s.key)).size!==sources.length)fail();
  return {directory:text(v.directory,8192),fingerprint:String(v.fingerprint),sourceBytes:integer(v.sourceBytes,128*1024*1024),report:{games,sources,deletedGames:integer(report.deletedGames,10000),invalidGames:integer(report.invalidGames,10000),invalidSources:integer(report.invalidSources,2048)}};
}
export function parseHydraOrigin(value: unknown): HydraOrigin {
  const v=object(value);if(v.version!==1)fail();
  const importedAt=integer(v.importedAt,Number.MAX_SAFE_INTEGER);if(!importedAt)fail();
  return {version:1,importedAt,original:parseHydraGame(v.original)};
}
