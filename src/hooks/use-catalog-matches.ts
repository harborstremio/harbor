import { useEffect, useState } from 'react';
import { matchingReleasePreviewsAsync } from '@/lib/games/source-deferred-matches';
import type { SourceGroupMatch } from '@/lib/games/source-groups';
import { sourceError, type matchingReleases, type GameSource } from '@/lib/games/sources';

export function useCatalogMatches(sources: GameSource[], game: Parameters<typeof matchingReleases>[1]) {
  const key=JSON.stringify([game.id,game.name,game.steamId,game.igdbId,game.platforms,game.sourceOrigin]);
  const total=sources.filter(source=>source.enabled).length;
  const [state,setState]=useState<{sources:GameSource[];key:string;matches:SourceGroupMatch[];error:string;failed:string[];loading:boolean;checked:number}|null>(null);
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    const failed:string[]=[];
    let found:SourceGroupMatch[]=[],checked=0,publishedMatches=false,timer:ReturnType<typeof setTimeout>|undefined;
    const publish=()=>{timer=undefined;if(!controller.signal.aborted)setState({sources,key,matches:[...found],error:'',failed:[],loading:true,checked});};
    setState({sources,key,matches:[],error:'',failed:[],loading:true,checked:0});
    void matchingReleasePreviewsAsync(sources,game,controller.signal,source=>failed.push(source.name),progress=>{
      found=found.concat(progress.matches);checked=progress.checked;
      // First useful result is immediate. Coalesce later sources to avoid one
      // React render per catalog; completed source batches never contain half a release.
      if(found.length&&!publishedMatches){publishedMatches=true;clearTimeout(timer);publish();}
      else if(timer===undefined)timer=setTimeout(publish,100);
    }).then(matches=>{
      clearTimeout(timer);
      if(!controller.signal.aborted)setState({sources,key,matches,error:failed.length?'games.sources.partialResults':'',failed:[...failed],loading:false,checked});
    }).catch(error=>{clearTimeout(timer);if(!controller.signal.aborted)setState({sources,key,matches:[],error:sourceError(error),failed:[...failed],loading:false,checked});});
    return()=>{controller.abort();clearTimeout(timer);found=[];};
  },[sources,key,attempt]);
  const current=state?.sources===sources&&state.key===key;
  return {matches:current?state.matches:[],loading:!current||state.loading,error:current?state.error:'',failed:current?state.failed:[],checked:current?state.checked:0,total,retry:()=>setAttempt(value=>value+1)};
}
