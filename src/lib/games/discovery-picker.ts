import type { GameSummary } from "./types";
import type { SteamAccountSnapshot } from "./steam-account";
import { steamOwnedSummary } from "./steam-account";
import type { RecommendationLibrary } from "./recommendations";
import { gameIdentities } from "./recommendations";
import type { CustomGame } from "./custom-library";
import type { RecommendationTag } from "./recommendation-tags";
import type { SteamReviewSummary } from "./rating-data";
import { DEFAULT_CATALOG_FILTERS, type CatalogFilters } from "./catalog-filters";

// Verified against Valve's public tag dictionary on 2026-10-04.
export const DISCOVERY_STYLES = [
  [1199779,"extraction","Extraction Shooter"], [1754,"mmorpg","MMORPG"], [1774,"shooter","Shooter"],
  [1662,"survival","Survival"], [1695,"openWorld","Open World"], [1742,"storyRich","Story Rich"],
  [29482,"soulslike","Souls-like"], [3959,"roguelite","Roguelite"], [1667,"horror","Horror"],
  [1654,"relaxing","Relaxing"], [7332,"building","Base Building"], [1702,"crafting","Crafting"],
  [122,"rpg","RPG"], [9,"strategy","Strategy"], [599,"simulation","Simulation"],
  [1664,"puzzle","Puzzle"], [699,"racing","Racing"], [255534,"automation","Automation"],
  [220585,"colony","Colony Sim"], [1091588,"deckbuilder","Roguelike Deckbuilder"],
] as const;
export const DISCOVERY_MODES = [[4182,"solo","Singleplayer"],[3859,"multiplayer","Multiplayer"],[3843,"onlineCoop","Online Co-Op"],[3841,"couchCoop","Local Co-Op"],[1775,"pvp","PvP"],[6730,"pve","PvE"]] as const;
export type DiscoveryOptions = {
  tags: number[]; modes: number[]; platform: CatalogFilters["platform"]; price: CatalogFilters["price"];
  controller: boolean; scope: "new" | "library" | "any"; direction: "balanced" | "acclaimed" | "hidden" | "recent";
  history: boolean; excluded: number[];
};
export const discoveryDefaults = (): DiscoveryOptions => ({tags:[],modes:[],platform:"all",price:"all",controller:false,scope:"new",direction:"balanced",history:true,excluded:[]});
export type DiscoverySignal = { game: GameSummary; reason: "favorite" | "recent" | "mostPlayed" | "added" | "saved"; weight: number; minutes?: number };
export type DiscoveryCandidate = { game: GameSummary; tags: RecommendationTag[]; reviews?: SteamReviewSummary; hero?: string; description?: string; controller: boolean };
export type DiscoveryPick = DiscoveryCandidate & { score: number; similarity: number; sharedTags: number[]; matchedTags: number[]; missingTags: number[]; seed?: DiscoverySignal; owned: boolean };
export type DiscoveryTaste = { signal: DiscoverySignal; tags: RecommendationTag[] };
export type LibraryObservation = { account: string; ids: number[]; added: { id: number; at: number }[] };

/** Baseline imports are not acquisitions. Only additions observed after that baseline get a date. */
export function observeSteamLibrary(previous: LibraryObservation | null, steam: SteamAccountSnapshot, now = Date.now()): LibraryObservation {
  if (!steam.libraryVisible) return previous?.account === steam.steamId ? previous : {account:steam.steamId,ids:[],added:[]};
  const ids = [...new Set(steam.games.map(g=>g.appId))];
  if (!previous || previous.account !== steam.steamId || !previous.ids.length) return {account:steam.steamId,ids,added:[]};
  const old = new Set(previous.ids), owned = new Set(ids);
  return {account:steam.steamId,ids,added:[...ids.filter(id=>!old.has(id)).map(id=>({id,at:now})),...previous.added.filter(row=>owned.has(row.id)&&row.at>now-30*86400_000)].slice(0,50)};
}

export function discoverySignals(favorites: GameSummary[], saved: GameSummary[], library: RecommendationLibrary, steam: SteamAccountSnapshot | null | undefined, custom: CustomGame[] = [], observation?: LibraryObservation | null, history = true, now = Date.now()): DiscoverySignal[] {
  const result: DiscoverySignal[] = [], seen = new Set<string>();
  const add = (game: GameSummary, reason: DiscoverySignal["reason"], weight: number, minutes?: number) => {
    if ((!game.steamId&&!game.igdbId) || gameIdentities(game).some(id=>seen.has(id))) return;
    gameIdentities(game).forEach(id=>seen.add(id));result.push({game,reason,weight,minutes});
  };
  favorites.slice(0,5).forEach(game=>add(game,"favorite",5));
  if (!history) return result;
  const account = steam?.libraryVisible ? steam : null;
  const recent = [...(account?.games??[])].filter(g=>g.recentMinutes>0).sort((a,b)=>b.recentMinutes-a.recentMinutes);
  recent.slice(0,2).forEach(game=>add(steamOwnedSummary(game),"recent",3.5,game.recentMinutes));
  library.recent.filter(row=>row.at<=now && row.at>=now-30*86400_000).slice(0,2).forEach(row=>add(row.game,"recent",3));
  [...(account?.games??[])].filter(g=>g.minutes>=60).sort((a,b)=>b.minutes-a.minutes).slice(0,2).forEach(game=>add(steamOwnedSummary(game),"mostPlayed",2.5,game.minutes));
  if (account && observation?.account===account.steamId) observation.added.filter(row=>row.at<=now&&row.at>=now-30*86400_000).slice(0,2).forEach(row=>{const game=account.games.find(g=>g.appId===row.id);if(game)add(steamOwnedSummary(game),"added",1.2);});
  custom.filter(g=>!g.hidden&&g.linked&&g.addedAt<=now&&g.addedAt>=now-30*86400_000).sort((a,b)=>b.addedAt-a.addedAt).slice(0,2).forEach(g=>add(g.linked!,"added",1.2));
  saved.slice(0,2).forEach(game=>add(game,"saved",1.5));
  // Explicit favorites always survive the bounded metadata budget.
  const explicit=result.filter(signal=>signal.reason==="favorite");
  const automatic:DiscoverySignal[]=[];
  for(let slot=0;slot<2;slot++)for(const reason of ["recent","mostPlayed","added","saved"] as const){
    const signal=result.filter(item=>item.reason===reason)[slot];if(signal)automatic.push(signal);
  }
  return [...explicit,...automatic];
}

const generic = new Set([19,21,492,597,113,3859,4182,128,1685,7481]);
export function tagVector(tags: readonly RecommendationTag[]): Map<number, number> {
  const sum=tags.reduce((n,t)=>n+Math.sqrt(Math.max(0,t.weight)),0)||1;
  return new Map(tags.map(t=>[t.id,Math.sqrt(Math.max(0,t.weight))/sum*(generic.has(t.id)?0.25:1)]));
}
export function tagSimilarity(a: Map<number,number>, b: Map<number,number>): number {
  let dot=0,aa=0,bb=0;for(const [id,value]of a){aa+=value*value;dot+=value*(b.get(id)??0);}for(const value of b.values())bb+=value*value;
  return aa&&bb?dot/Math.sqrt(aa*bb):0;
}

export function discoveryQueries(options: DiscoveryOptions, taste: DiscoveryTaste[]): CatalogFilters[] {
  const hard=[...new Set([...options.tags,...options.modes])];
  const base: CatalogFilters={...DEFAULT_CATALOG_FILTERS,tags:hard,platform:options.platform,price:options.price,controller:options.controller,sort:options.direction==="recent"?"Released_DESC":"Reviews_DESC"};
  if(options.scope==="library")return [];
  const queries=[base],seen=new Set([hard.slice().sort((a,b)=>a-b).join(",")]);
  // Search actual tag intersections. Every lane retains all explicit constraints.
  for(const seed of taste){
    const specific=seed.tags.filter(tag=>!generic.has(tag.id)&&!hard.includes(tag.id)).slice(0,hard.length?1:2).map(tag=>tag.id);
    if(!specific.length)continue;
    const tags=[...hard,...specific],key=tags.slice().sort((a,b)=>a-b).join(",");
    if(!seen.has(key)){queries.push({...base,tags});seen.add(key);}if(queries.length>=4)break;
  }
  return queries;
}

/** Widen mood preferences in bounded steps. Play modes and practical requirements stay intact. */
export function discoveryQueryStages(options: DiscoveryOptions, taste: DiscoveryTaste[]): CatalogFilters[][] {
  const exact=discoveryQueries(options,taste);
  if(!exact.length||!options.tags.length)return [exact];
  const moods=[...new Set(options.tags)],base=exact[0];
  const seen=new Set(exact.map(query=>query.tags.slice().sort((a,b)=>a-b).join(",")));
  const stage=(groups:number[][])=>groups.flatMap(group=>{
    const tags=[...new Set([...group,...options.modes])],key=tags.slice().sort((a,b)=>a-b).join(",");
    if(seen.has(key))return [];
    seen.add(key);return [{...base,tags}];
  });
  // Try near intersections first, then individual moods and finally the required play mode.
  const near=moods.length>1?stage(moods.slice(0,4).map((_,index)=>moods.filter((_,i)=>i!==moods.length-1-index))):[];
  const broad=stage([...Array.from({length:Math.min(3,moods.length)},(_,i)=>[moods[Math.floor(i*(moods.length-1)/Math.max(1,Math.min(3,moods.length)-1))]]),[]]);
  return [exact,near,broad].filter(queries=>queries.length);
}

export function rankDiscovery(candidates: DiscoveryCandidate[], taste: DiscoveryTaste[], options: DiscoveryOptions, ownedGames: GameSummary[], now=Date.now()): DiscoveryPick[] {
  const owned=new Set(ownedGames.flatMap(gameIdentities)), seedIds=new Set(taste.flatMap(t=>gameIdentities(t.signal.game)));
  const excluded=new Set(options.excluded), moods=[...new Set(options.tags)];
  const vectors=taste.map(t=>({ ...t, vector:tagVector(t.tags) }));
  const totalWeight=vectors.reduce((n,t)=>n+t.signal.weight,0)||1;
  const seen=new Set<string>(),picks:DiscoveryPick[]=[];
  for(const candidate of candidates){
    const game=candidate.game, ids=gameIdentities(game), isOwned=ids.some(id=>owned.has(id)), tags=new Set(candidate.tags.map(t=>t.id));
    if(!game.steamId||game.comingSoon||game.adultContent!==false||excluded.has(game.steamId)||ids.some(id=>seen.has(id)||seedIds.has(id)))continue;
    if(options.scope==="new"&&isOwned||options.scope==="library"&&!isOwned)continue;
    if(options.modes.some(id=>!tags.has(id)))continue;
    if(options.platform!=="all"&&!game.platforms.includes({win:"Windows",mac:"macOS",linux:"Linux"}[options.platform]))continue;
    if(options.price==="free"&&game.price?.amount!==0||options.price==="offers"&&!(game.price&&game.price.discount>0))continue;
    if(options.controller&&!candidate.controller)continue;
    const reviews=candidate.reviews;
    if(options.direction==="acclaimed"&&(!reviews||reviews.positive<85||reviews.count<200))continue;
    if(options.direction==="hidden"&&(!reviews||reviews.positive<80||reviews.count<20||reviews.count>10000))continue;
    if(options.direction==="recent"&&(!game.releaseTimestamp||game.releaseTimestamp*1000<now-365*86400_000||game.releaseTimestamp*1000>now))continue;
    ids.forEach(id=>seen.add(id));
    const vector=tagVector(candidate.tags);
    const similarities=vectors.map(t=>({signal:t.signal,similarity:tagSimilarity(vector,t.vector)})).sort((a,b)=>b.similarity*b.signal.weight-a.similarity*a.signal.weight);
    const affinity=similarities.reduce((n,t)=>n+t.similarity*t.signal.weight,0)/totalWeight;
    const strongest=similarities[0], similarity=affinity*.65+(strongest?.similarity??0)*.35;
    // Shrink small review samples towards 75%; never present this internal rank as a match percentage.
    const quality=reviews?(reviews.positive/100*reviews.count+.75*150)/(reviews.count+150):.65;
    // A primary genre tag is stronger evidence than a low-weight, incidental community tag.
    const strongestTag=Math.max(1,...candidate.tags.map(tag=>tag.weight));
    const intent=options.tags.length?options.tags.reduce((sum,id)=>sum+Math.sqrt((candidate.tags.find(tag=>tag.id===id)?.weight??0)/strongestTag),0)/options.tags.length:0;
    const relevance=vectors.length?(options.tags.length?similarity*.75+intent*.25:similarity):intent;
    const matchedTags=moods.filter(id=>tags.has(id)),missingTags=moods.filter(id=>!tags.has(id));
    const sharedTags=[...new Set([...matchedTags,...candidate.tags.filter(t=>vectors.some(v=>v.vector.has(t.id))&&!generic.has(t.id)).map(t=>t.id)])].slice(0,3);
    picks.push({...candidate,owned:isOwned,similarity,sharedTags,matchedTags,missingTags,seed:strongest&&strongest.similarity>.2?strongest.signal:undefined,score:relevance*.65+quality*.35});
  }
  // Apply diversity to a strong shortlist, not every game in a large accumulated library scan.
  const selected:DiscoveryPick[]=[],pending=[...picks].sort((a,b)=>b.matchedTags.length-a.matchedTags.length||b.score-a.score||(b.reviews?.count??0)-(a.reviews?.count??0)).slice(0,120);
  const candidateVectors=new Map(pending.map(pick=>[pick,tagVector(pick.tags)]));
  while(pending.length){
    const merit=(pick:DiscoveryPick)=>pick.score-(selected.length?Math.max(...selected.slice(-5).map(other=>tagSimilarity(candidateVectors.get(pick)!,candidateVectors.get(other)!)))*.09:0);
    let best=0,bestMerit=merit(pending[0]);
    for(let index=1;index<pending.length;index++){
      // Variety must never move a looser match ahead of an exact or closer match.
      if(pending[index].matchedTags.length!==pending[0].matchedTags.length)break;
      const value=merit(pending[index]);
      if(value>bestMerit||(value===bestMerit&&(pending[index].reviews?.count??0)>(pending[best].reviews?.count??0))){best=index;bestMerit=value;}
    }
    selected.push(pending.splice(best,1)[0]);
  }
  return selected;
}
