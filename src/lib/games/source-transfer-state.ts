import {transferStateKey,transferProgressBytes} from "./transfer-relink";
import { normalizeMagnet } from "./magnet";
import type { SourceFile } from "./sources";
import type { GameTorrent } from "./torrents";
import type { GameTransfer } from "./transfers";

/** A release title is not an identity: mirrors can contain different files. */
export function sourceTransfer(file: Pick<SourceFile,"kind"|"url">, torrents: GameTorrent[], transfers: GameTransfer[]) {
  if(file.kind==="magnet") {
    const magnet=normalizeMagnet(file.url);if(!magnet)return;
    const hash=new URL(magnet).searchParams.get("xt")?.slice(9);
    const record=torrents.find(record=>record.infoHash.toLowerCase()===hash);
    if(record)return {id:record.id,key:`games.torrent.state.${record.status}`,status:record.status,received:record.received,total:record.totalBytes,kind:"torrent" as const};
  } else if(file.kind==="direct" || file.kind==="page") {
    // Public adapters and connected services retain the selected source separately
    // from browser authentication and resolved CDN URLs, which can expire/change.
    const matching=transfers.filter(record=>record.sourceLink===file.url||(file.kind==="direct"?record.url===file.url:record.sourcePage===file.url));
    const record=matching.filter(record=>record.status!=="canceled").sort((a,b)=>b.createdAt-a.createdAt)[0];
    if(record?.batchId){
      const batch=matching.filter(item=>item.batchId===record.batchId&&item.profile===record.profile);
      const order=["failed","canceled","canceling","retrying","downloading","checking","connecting","queued","pausing","paused","complete"];
      const current=[...batch].sort((a,b)=>order.indexOf(a.status)-order.indexOf(b.status))[0];
      const total=batch.every(item=>(item.total??item.expectedBytes)!=null)?batch.reduce((sum,item)=>sum+(item.total??item.expectedBytes)!,0):null;
      return {id:current.id,key:`games.download.state.${current.status}`,status:current.status,received:batch.reduce((sum,item)=>sum+item.received,0),total,kind:"direct" as const};
    }
    if(record)return {id:record.id,key:transferStateKey(record),status:record.status,...transferProgressBytes(record),kind:"direct" as const};
  }
}
