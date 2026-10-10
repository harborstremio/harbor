import { detailEditionTarget } from "./detail-edition";
import { atlasSavedRelease, steamSavedRelease, type SavedReleaseInfo, type SavedReleaseResult } from "./saved-releases";
import type { GameSummary } from "./types";
import { RELEASE_METADATA_FIELDS } from "./release-data";
import { parseAtlasGame } from "./igdb-data";
import { savedMetadataAt } from "./metadata-records";

export type SavedReleaseRequest=(game:GameSummary,signal:AbortSignal,force?:boolean)=>Promise<SavedReleaseInfo|undefined>;
export const requestSavedRelease:SavedReleaseRequest=async(game,signal,force=false)=>{
  const target=detailEditionTarget(game);signal.throwIfAborted();
  if(target.steamId&&target.id===`steam:${target.steamId}`){const {loadGameRelease}=await import("./catalog");signal.throwIfAborted();const detail=await loadGameRelease(target.steamId,signal,force);return steamSavedRelease(detail.release,detail.comingSoon,detail.cachedAt);}
  if(target.igdbId&&Number.isSafeInteger(target.igdbId)&&target.igdbId>0&&target.id===`igdb:${target.igdbId}`){
    const {queryIgdb}=await import("./atlas");signal.throwIfAborted();
    const rows=await queryIgdb(`fields name,${RELEASE_METADATA_FIELDS}; where id = ${target.igdbId}; limit 1;`,signal,force);
    const raw=rows.find(value=>(value as {id?:unknown}).id===target.igdbId);if(!raw)throw Error("Release metadata unavailable");
    return atlasSavedRelease(parseAtlasGame(raw).releaseHistory??[],savedMetadataAt(rows));
  }
  return undefined;
};

/** Bounded batches; completion belongs to the exact saved identity, never its title. */
export async function loadSavedReleases(games:GameSummary[],signal:AbortSignal,onResult:(id:string,result:SavedReleaseResult)=>void,request:SavedReleaseRequest=requestSavedRelease,deadline=14_000,force=false) {
  signal.throwIfAborted();let next=0;
  const worker=async()=>{
    while(next<games.length&&!signal.aborted){
      const game=games[next++],controller=new AbortController(),combined=AbortSignal.any([signal,controller.signal]);
      let listener:()=>void=()=>{};
      const timer=setTimeout(()=>controller.abort(new DOMException("Release deadline","TimeoutError")),deadline);
      try {
        const cancelled=new Promise<never>((_,reject)=>{listener=()=>reject(combined.reason);combined.addEventListener("abort",listener,{once:true});});
        const info=await Promise.race([Promise.resolve().then(()=>{combined.throwIfAborted();return request(game,combined,force);}),cancelled]);
        if(!signal.aborted)onResult(game.id,{info,failed:false});
      }catch{if(!signal.aborted)onResult(game.id,{failed:true});}
      finally{clearTimeout(timer);combined.removeEventListener("abort",listener);controller.abort();}
    }
  };
  await Promise.all([worker(),worker()]);signal.throwIfAborted();
}
