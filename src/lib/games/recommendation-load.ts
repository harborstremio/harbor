import type { GameSummary } from "./types";
import type { SteamRecommendationPool } from "./recommendation-pool";

/** Bound the whole source pair, including queue time; keep sources that already succeeded. */
export async function settleRecommendationSources(
  steam: (signal: AbortSignal) => Promise<SteamRecommendationPool>,
  atlas: (signal: AbortSignal) => Promise<GameSummary[]>,
  signal?: AbortSignal,
  deadlineMs=6000,
): Promise<[PromiseSettledResult<SteamRecommendationPool>,PromiseSettledResult<GameSummary[]>]> {
  signal?.throwIfAborted();
  const request=new AbortController();
  const abort=()=>request.abort(signal?.reason);
  signal?.addEventListener("abort",abort,{once:true});
  const timer=setTimeout(()=>request.abort(new Error("Recommendation source deadline")),deadlineMs);
  const bounded=<T>(load:(signal:AbortSignal)=>Promise<T>)=>new Promise<T>((resolve,reject)=>{
    const cancel=()=>reject(request.signal.reason);
    request.signal.addEventListener("abort",cancel,{once:true});
    Promise.resolve().then(()=>{request.signal.throwIfAborted();return load(request.signal);}).then(resolve,reject).finally(()=>request.signal.removeEventListener("abort",cancel));
  });
  try {
    const results=await Promise.allSettled([bounded(steam),bounded(atlas)]);
    signal?.throwIfAborted();
    return results;
  } finally {clearTimeout(timer);signal?.removeEventListener("abort",abort);}
}
