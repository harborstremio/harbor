import { readAtlasGameSnapshot } from "./atlas";
import { readGameDetailSnapshot } from "./catalog";
import { detailEditionTarget } from "./detail-edition";
import { gameLinks, knownGameLinks, type LibraryLinkItem } from "./library-links";
import type { GameSummary } from "./types";

/** Read existing metadata only; a library organization action must not crawl providers. */
export async function readLibraryLinks(items: readonly LibraryLinkItem[], signal: AbortSignal, progress?: (done:number)=>void): Promise<LibraryLinkItem[]> {
  const result: LibraryLinkItem[] = new Array(items.length); let cursor=0,done=0;
  await Promise.all(Array.from({length:Math.min(4,items.length)},async()=>{
    while (cursor<items.length) {
      signal.throwIfAborted(); const index=cursor++,item=items[index];
      if (item.links) {result[index]={...item,links:gameLinks(item.links)};done++;if(done===items.length||done%25===0)progress?.(done);continue;}
      const fallback: GameSummary | undefined = /^steam:[1-9]\d*$/.test(item.id) ? {id:item.id,steamId:Number(item.id.slice(6)),name:item.name,capsule:"",platforms:[]} : undefined;
      const game=item.game??fallback,target=game?detailEditionTarget(game):null;
      const [steam,atlas]=await Promise.all([target?.steamId?readGameDetailSnapshot(target.steamId):null,game?readAtlasGameSnapshot(game):null]);
      signal.throwIfAborted();result[index]={...item,links:item.links??knownGameLinks(item.id,game,steam,atlas)};
      done++;if (done===items.length||done%25===0) progress?.(done);
    }
  }));
  return result;
}
