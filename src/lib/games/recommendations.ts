import type { GameSummary } from "./types";
import type { SteamInstall } from "./installed";
import { installedSummary } from "./installed";
import { localGames, type EmulationStore } from "./emulation";
import { steamOwnedSummary, type SteamAccountSnapshot } from "./steam-account";
import type { CustomGame } from "./custom-library";
import { launcherGameSummary, type LauncherScan } from "./launchers";
import { gameImage } from "./steam-data";
import { isIgdbImage } from "./igdb-data";

export type RecommendationSeed = { game: GameSummary; reason: "saved" | "played" };
export type GameRecommendation = { game: GameSummary; seed: RecommendationSeed; tags?: string[] };
export type RecommendationChoice = { id: string; name: string; identities: string[]; image?: string };
export type RecommendationPreferences = { version: 1; saved: boolean; recent: boolean; hideLibrary: boolean; hideSaved: boolean; platform: string; hidden: string[]; hiddenGames: RecommendationChoice[]; excludedSeeds: RecommendationChoice[] };
export const recommendationDefaults = (): RecommendationPreferences => ({version:1,saved:true,recent:true,hideLibrary:true,hideSaved:true,platform:"all",hidden:[],hiddenGames:[],excludedSeeds:[]});
export type RecommendationLibraryContext = { steam?: SteamAccountSnapshot | null; custom?: CustomGame[]; launchers?: LauncherScan | null };
export type RecommendationLibrary = { games: GameSummary[]; recent: { game: GameSummary; at: number }[]; steamSyncedAt?: number };

/** These are known library identities, not claims about current launch readiness. */
export function buildRecommendationLibrary(installed: SteamInstall[], emulation: EmulationStore, context: RecommendationLibraryContext = {}, now = Date.now()): RecommendationLibrary {
  const games: GameSummary[] = [], recent: RecommendationLibrary["recent"] = [];
  const add = (game: GameSummary | null | undefined, at = 0, useHistory = true) => {
    if (!game || ![game.steamId, game.igdbId].some(id => typeof id === "number" && Number.isSafeInteger(id) && id > 0)) return;
    games.push(game);
    if (useHistory && Number.isFinite(at) && at > 0 && at <= now) recent.push({ game, at });
  };
  for (const game of installed) add(installedSummary(game), game.lastPlayed * 1000);
  for (const game of localGames(emulation)) add(game.linked, emulation.lastPlayed[game.path]);
  for (const game of context.custom ?? []) add(game.linked, game.lastPlayed, !game.hidden);
  for (const game of context.launchers?.games ?? []) add(launcherGameSummary(game));
  const steam = context.steam?.libraryVisible ? context.steam : null;
  for (const game of steam?.games ?? []) add(steamOwnedSummary(game), game.minutes > 0 ? game.lastPlayed * 1000 : 0);
  return { games, recent: recent.sort((a,b) => b.at - a.at), ...(steam && Number.isFinite(steam.updatedAt) && steam.updatedAt > 0 ? { steamSyncedAt: steam.updatedAt } : {}) };
}

export function recommendationExclusions(saved: GameSummary[], library: RecommendationLibrary, preferences: RecommendationPreferences): GameSummary[] {
  return [...(preferences.hideSaved ? saved : []), ...(preferences.hideLibrary ? library.games : [])];
}
const preferenceKey = (profile: string) => `harbor.games.recommendations.v1:${encodeURIComponent(profile)}`;
const validIdentity = (id: unknown): id is string => typeof id === "string" && /^(steam|igdb):[1-9]\d{0,12}$/.test(id);
const identities = (value: unknown): string[] => Array.isArray(value) ? [...new Set(value.filter(validIdentity))].slice(-2000) : [];
const overlaps = (a: string[], b: string[]) => a.some(id=>b.includes(id));
const image = (value: unknown) => isIgdbImage(value) ? value : gameImage(value) || undefined;
function platformName(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 96 || /[\u0000-\u001f\u007f]/.test(value)) return "";
  const name = value.trim();
  if (/^(PC \(Microsoft Windows\)|Windows)$/i.test(name)) return "Windows";
  if (/^(Mac|macOS)$/i.test(name)) return "macOS";
  if (/^Linux$/i.test(name)) return "Linux";
  return name;
}
/** Match provider names, without treating console generations or emulation as interchangeable. */
export function recommendationPlatformNames(game: GameSummary): string[] {
  const priority = (name: string) => ["Windows", "macOS", "Linux"].includes(name) ? ["Windows", "macOS", "Linux"].indexOf(name) : 3;
  return [...new Set(game.platforms.map(platformName).filter(Boolean))].sort((a,b) => priority(a)-priority(b));
}
export function recommendationsForPlatform(picks: GameRecommendation[], platform: string): GameRecommendation[] {
  return platform === "all" ? picks : picks.filter(pick => recommendationPlatformNames(pick.game).includes(platform));
}
export function gameIdentities(game: Pick<GameSummary,"id"|"steamId"|"igdbId">) { return [...new Set([game.id, ...(game.steamId ? [`steam:${game.steamId}`] : []), ...(game.igdbId ? [`igdb:${game.igdbId}`] : [])])]; }
function readChoices(value: unknown): RecommendationChoice[] {
  if(!Array.isArray(value))return [];
  const choices: RecommendationChoice[]=[];
  for(const raw of value.slice(-500)){
    if(!raw || typeof raw!=="object" || !validIdentity(raw.id) || typeof raw.name!=="string" || !raw.name.trim())continue;
    const aliases=identities([raw.id,...(Array.isArray(raw.identities)?raw.identities:[])]).slice(0,3);
    const previous=choices.find(choice=>overlaps(choice.identities,aliases));
    if(previous){previous.identities=identities([...previous.identities,...aliases]).slice(0,3);continue;}
    choices.push({id:raw.id,name:raw.name.trim().slice(0,200),identities:aliases,image:image(raw.image)});
  }
  return choices;
}
export function recommendationChoice(game: GameSummary): RecommendationChoice {
  const aliases=gameIdentities(game).filter(validIdentity);
  return {id:validIdentity(game.id)?game.id:aliases[0],name:game.name.slice(0,200),identities:aliases,image:image(game.portrait)||image(game.capsule)};
}
export function readRecommendationPreferences(profile: string): RecommendationPreferences {
  try {
    const stored=localStorage.getItem(preferenceKey(profile));if(!stored || stored.length>2*1024*1024)return recommendationDefaults();
    const raw=JSON.parse(stored);if(raw?.version!==1)return recommendationDefaults();
    const hidden=identities(raw.hidden);
    const hiddenGames=readChoices(raw.hiddenGames).filter(choice=>overlaps(choice.identities,hidden));
    return {version:1,saved:raw.saved!==false,recent:raw.recent!==false,hideLibrary:raw.hideLibrary!==false,hideSaved:raw.hideSaved!==false,platform:platformName(raw.platform)||"all",hidden:identities([...hidden,...hiddenGames.flatMap(choice=>choice.identities)]),hiddenGames,excludedSeeds:readChoices(raw.excludedSeeds)};
  } catch { return recommendationDefaults(); }
}
export function writeRecommendationPreferences(profile: string, preferences: RecommendationPreferences) { localStorage.setItem(preferenceKey(profile),JSON.stringify(preferences)); }
export function hideRecommendation(preferences: RecommendationPreferences, game: GameSummary): RecommendationPreferences {
  const choice=recommendationChoice(game);
  const previous=preferences.hiddenGames.filter(item=>overlaps(item.identities,choice.identities));
  choice.identities=identities([...choice.identities,...previous.flatMap(item=>item.identities)]);
  return {...preferences,hidden:identities([...preferences.hidden,...choice.identities]),hiddenGames:[...preferences.hiddenGames.filter(item=>!overlaps(item.identities,choice.identities)),choice].slice(-500)};
}
export function restoreRecommendation(preferences: RecommendationPreferences, choice: RecommendationChoice): RecommendationPreferences {
  const aliases=[...choice.identities,...preferences.hiddenGames.filter(item=>overlaps(item.identities,choice.identities)).flatMap(item=>item.identities)];
  return {...preferences,hidden:preferences.hidden.filter(id=>!aliases.includes(id)),hiddenGames:preferences.hiddenGames.filter(item=>!overlaps(item.identities,aliases))};
}
export function excludeRecommendationSeed(preferences: RecommendationPreferences, game: GameSummary): RecommendationPreferences {
  const choice=recommendationChoice(game);
  return {...preferences,excludedSeeds:readChoices([...preferences.excludedSeeds,choice])};
}
export function restoreRecommendationSeed(preferences: RecommendationPreferences, choice: RecommendationChoice): RecommendationPreferences {
  return {...preferences,excludedSeeds:preferences.excludedSeeds.filter(item=>!overlaps(item.identities,choice.identities))};
}
/** Legacy choices retain their provider ID when no title was stored. No metadata requests are needed. */
export function hiddenRecommendationChoices(preferences: RecommendationPreferences): RecommendationChoice[] {
  const known=new Set(preferences.hiddenGames.flatMap(choice=>choice.identities));
  return [...preferences.hiddenGames,...preferences.hidden.filter(id=>!known.has(id)).map(id=>({id,name:id,identities:[id]}))];
}
export function chooseRecommendationSeeds(saved: GameSummary[], installed: SteamInstall[], emulation: EmulationStore, preferences: RecommendationPreferences, library = buildRecommendationLibrary(installed, emulation)): RecommendationSeed[] {
  // One game may have both a Steam account observation and a local history record.
  const recent: RecommendationLibrary["recent"] = [], recentSeen = new Set<string>();
  for (const entry of library.recent) {
    const aliases = gameIdentities(entry.game);
    if (aliases.some(id => recentSeen.has(id))) continue;
    aliases.forEach(id => recentSeen.add(id)); recent.push(entry);
  }
  const candidates:RecommendationSeed[] = [];
  // Interleave signals so a large saved list cannot drown out recent play history.
  const seen=new Set(preferences.excludedSeeds.flatMap(choice=>choice.identities));
  for(let i=0;i<Math.max(preferences.saved?saved.length:0,preferences.recent?recent.length:0) && candidates.length<4;i++){
    for(const seed of [preferences.saved&&saved[i]?{game:saved[i],reason:"saved" as const}:null,preferences.recent&&recent[i]?{game:recent[i].game,reason:"played" as const}:null]){
      if(!seed || candidates.length===4)continue;
      // Unmatched local/launcher entries cannot request related catalog games yet.
      if(![seed.game.steamId,seed.game.igdbId].some(id=>typeof id==="number"&&Number.isSafeInteger(id)&&id>0))continue;
      const aliases=gameIdentities(seed.game);if(aliases.some(id=>seen.has(id)))continue;
      aliases.forEach(id=>seen.add(id));candidates.push(seed);
    }
  }
  return candidates;
}
export function rankRecommendations(groups: { seed:RecommendationSeed; games:GameSummary[]; matches?:Record<string,string[]> }[], known: GameSummary[], hidden:string[], limit=24): GameRecommendation[] {
  // Reconcile exact aliases across every seed before hiding or choosing the first occurrence.
  // Otherwise a Steam-only result can outrun richer IGDB evidence from a later pool.
  const byIdentity=new Map<string,GameSummary[]>();
  for(const game of [...groups.flatMap(group=>group.games),...known,...groups.map(group=>group.seed.game)])for(const id of gameIdentities(game))byIdentity.set(id,[...byIdentity.get(id)??[],game]);
  const reconcile=(game:GameSummary):GameSummary=>{
    const peers=gameIdentities(game).flatMap(id=>byIdentity.get(id)??[]);
    const steamId=game.steamId??peers.find(peer=>peer.steamId)?.steamId,igdbId=game.igdbId??peers.find(peer=>peer.igdbId)?.igdbId;
    return {...game,steamId,igdbId,platforms:[...new Set([game,...peers].flatMap(peer=>peer.platforms))]};
  };
  const excluded = new Set([...known.flatMap(gameIdentities),...groups.flatMap(group=>gameIdentities(group.seed.game)),...hidden]);
  const result:GameRecommendation[]=[];
  const pools=groups.map(group=>group.games.map(reconcile).filter(game=>!!game.portrait && !gameIdentities(game).some(id=>excluded.has(id))));
  for(let index=0;index<Math.max(0,...pools.map(pool=>pool.length));index++)for(let group=0;group<groups.length;group++){
    const game=pools[group][index];if(!game || gameIdentities(game).some(id=>excluded.has(id)))continue;
    const tags=groups[group].matches?.[game.id];
    result.push({game,seed:groups[group].seed,...(tags?.length?{tags}:{})});gameIdentities(game).forEach(id=>excluded.add(id));if(result.length>=limit)return result;
  }
  return result;
}
