import { changeCustomLibrary, emptyLaunchConfig, parseCustomLibrary, readCustomLibrary, validateLaunchConfig, type CustomGame, type CustomLibrary, type LaunchConfig } from './custom-library';
import { parseHydraGame, type HydraGame, type HydraReview } from './hydra-import-records';

export type HydraGamePlan = { original: HydraGame; config: LaunchConfig; pending: boolean; issue: string; existing?: string; checkOnImport?: boolean };
export function hydraPathKey(value: string) {
  const path=value.replace(/\\/g,'/').replace(/\/+$/,'');
  return /^[a-z]:\//i.test(path)||path.startsWith('//')?path.toLowerCase():path;
}
export function existingHydraGame(store: CustomLibrary, game: HydraGame, config?: LaunchConfig) {
  const path=config?.executable||game.executable;
  return store.games.find(item=>item.hydra?.original.key===game.key || !!path&&!!item.config.executable&&hydraPathKey(item.config.executable)===hydraPathKey(path)
    || !path&&game.shop==='steam'&&String(item.linked?.steamId)===game.objectId);
}
function libraryIndex(games: CustomGame[]) {
  const keys=new Map<string,number>(),paths=new Map<string,number>(),steam=new Map<string,number>(),items=[...games];
  const remember=(item:CustomGame,index:number)=>{
    const key=item.hydra?.original.key,path=item.config.executable&&hydraPathKey(item.config.executable),id=item.linked?.steamId;
    if(key&&!keys.has(key))keys.set(key,index);
    if(path&&!paths.has(path))paths.set(path,index);
    if(id&&!steam.has(String(id)))steam.set(String(id),index);
  };
  items.forEach(remember);
  return {
    add(item:CustomGame){remember(item,items.length);items.push(item);},
    find(game:HydraGame,config?:LaunchConfig){
      const path=config?.executable||game.executable;
      // Preserve the first matching library entry, regardless of which identity matched.
      const indices=[keys.get(game.key),path?paths.get(hydraPathKey(path)):undefined,!path&&game.shop==='steam'?steam.get(game.objectId):undefined].filter((value):value is number=>value!==undefined);
      return indices.length?items[Math.min(...indices)]:undefined;
    }
  };
}
export async function planHydraGames(review: HydraReview, store: CustomLibrary, signal: AbortSignal): Promise<HydraGamePlan[]> {
  const result:HydraGamePlan[]=[],index=libraryIndex(store.games);
  for(const original of review.report.games){
    signal.throwIfAborted();
    const existing=index.find(original);
    // Review is metadata-only. Only explicitly selected plain paths are checked at import.
    // Raw options and runner settings never silently become a default native launch.
    const checkOnImport=!existing&&!!original.executable&&!original.launchOptions&&!original.winePrefix&&!original.proton&&!original.issues.length;
    result.push({original,config:emptyLaunchConfig(),pending:true,issue:checkOnImport?'hydra_check_on_import':original.executable?'hydra_launch_review':'hydra_no_executable',...(checkOnImport?{checkOnImport:true}:{}),...(existing?{existing:existing.id}:{})});
    if(result.length%256===0)await new Promise<void>(resolve=>setTimeout(resolve,0));
  }
  signal.throwIfAborted();return result;
}
function gameFromPlan(plan: HydraGamePlan, now: number): CustomGame {
  const original=parseHydraGame(plan.original);
  const timestamp=(value:string|null)=>{const n=value?Date.parse(value):NaN;return Number.isSafeInteger(n)&&n>0&&n<=now?n:0;};
  const steamId=original.shop==='steam'&&/^[1-9]\d*$/.test(original.objectId)?Number(original.objectId):0;
  return {id:crypto.randomUUID(),name:original.name.slice(0,160),config:plan.pending?emptyLaunchConfig():validateLaunchConfig(plan.config),linked:steamId>0&&steamId<=0xffffffff?{id:`steam:${steamId}`,steamId,name:original.name,capsule:'',platforms:[]}:null,
    artwork:null,pinned:original.pinned||original.favorite,hidden:original.concealed,addedAt:timestamp(original.addedAt)||now,lastPlayed:timestamp(original.lastPlayed),measuredSeconds:0,
    hydra:{version:1,importedAt:now,original},...(plan.pending?{launchPending:true}:{})};
}
export function mergeHydraGames(store: CustomLibrary, plans: HydraGamePlan[], now=Date.now()): {store:CustomLibrary;added:number;existing:number} {
  const games=[...store.games],index=libraryIndex(games),seen=new Set<string>();let added=0,existing=0;
  for(const plan of plans){
    if(seen.has(plan.original.key))throw Error('hydra_selection');seen.add(plan.original.key);
    if(index.find(plan.original,plan.config)){existing++;continue;}
    if(games.length>=1000)throw Error('launch_limit');
    const game=gameFromPlan(plan,now);games.push(game);index.add(game);added++;
  }
  return {store:parseCustomLibrary(JSON.stringify({...store,games})),added,existing};
}
export async function applyHydraGames(profile: string, plans: HydraGamePlan[], validate: (config: LaunchConfig)=>Promise<LaunchConfig>, signal: AbortSignal, current: ()=>boolean, progress?: (count:number,total:number)=>void) {
  const guard=()=>{signal.throwIfAborted();if(!current())throw Error('hydra_canceled');};guard();
  if(new Set(plans.map(plan=>plan.original.key)).size!==plans.length)throw Error('hydra_selection');
  const index=libraryIndex(readCustomLibrary(profile).games),checked=new Array<HydraGamePlan>(plans.length);let cursor=0,completed=0;
  progress?.(0,plans.length);
  const workers=await Promise.allSettled(Array.from({length:Math.min(3,plans.length)},async()=>{
    while(cursor<plans.length){
      guard();const position=cursor++,plan=plans[position];let value=plan;
      if(!index.find(plan.original,plan.config)&&(!plan.pending||plan.checkOnImport)){
        const config=plan.checkOnImport?{...emptyLaunchConfig(),executable:plan.original.executable!}:plan.config;
        // No writes occur until every selected file check settles. Missing files stay reviewable.
        try{value={...plan,config:validateLaunchConfig(await validate(config)),pending:false,issue:'',checkOnImport:false};}
        catch{value={...plan,config:emptyLaunchConfig(),pending:true,issue:'hydra_launch_review',checkOnImport:false};}
      }
      guard();checked[position]=value;progress?.(++completed,plans.length);
      if(completed%128===0)await new Promise<void>(resolve=>setTimeout(resolve,0));
    }
  }));
  // Native filesystem calls cannot be canceled; drain owned calls before permitting another import.
  guard();const failure=workers.find((worker):worker is PromiseRejectedResult=>worker.status==='rejected');if(failure)throw failure.reason;
  let result={added:0,existing:0};
  await changeCustomLibrary(profile,store=>{signal.throwIfAborted();if(!current())throw Error('hydra_canceled');const merged=mergeHydraGames(store,checked);result={added:merged.added,existing:merged.existing};return merged.store;});
  return result;
}
