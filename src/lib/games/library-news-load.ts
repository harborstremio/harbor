import { loadGameNews } from "./community-fetch";
import type { GameNews } from "./community";
import type { GameSummary } from "./types";

export type LibraryNewsRequest = (appId:number, signal:AbortSignal, refresh?:boolean) => Promise<GameNews[]>;

function abortable<T>(load:()=>Promise<T>, signal:AbortSignal): Promise<T> {
  return new Promise((resolve,reject) => {
    if (signal.aborted) { reject(signal.reason); return; }
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort",abort,{once:true});
    Promise.resolve().then(() => { signal.throwIfAborted(); return load(); }).then(resolve,reject)
      .finally(() => signal.removeEventListener("abort",abort));
  });
}

/** Includes time in the shared two-request Steam queue; late work cannot publish. */
export async function loadLibraryNews(games:GameSummary[], signal:AbortSignal, request:LibraryNewsRequest=loadGameNews, deadline=12_000, refresh=false, feedDeadline=2_000): Promise<PromiseSettledResult<GameNews[]>[]> {
  signal.throwIfAborted();
  const timeout = new AbortController(), combined = AbortSignal.any([signal,timeout.signal]);
  const timer = setTimeout(() => timeout.abort(new DOMException("News deadline","TimeoutError")),deadline);
  try {
    const results: PromiseSettledResult<GameNews[]>[] = new Array(games.length);
    let next=0;
    // Start each feed's deadline only when its worker reaches it, so two stalled
    // feeds cannot consume the entire batch deadline ahead of healthy games.
    const worker=async()=>{
      while(next<games.length){
        const index=next++, feed=new AbortController(), feedSignal=AbortSignal.any([combined,feed.signal]);
        const feedTimer=setTimeout(()=>feed.abort(new DOMException("Feed deadline","TimeoutError")),feedDeadline);
        try { results[index]={status:"fulfilled",value:await abortable(()=>request(games[index].steamId!,feedSignal,refresh),feedSignal)}; }
        catch(reason){results[index]={status:"rejected",reason};}
        finally{clearTimeout(feedTimer);feed.abort();}
      }
    };
    await Promise.all([worker(),worker()]);
    signal.throwIfAborted();
    return results;
  } finally { clearTimeout(timer); timeout.abort(); }
}
