export type TransferStatus="queued"|"connecting"|"retrying"|"downloading"|"checking"|"pausing"|"paused"|"canceling"|"canceled"|"complete"|"failed";
export type DownloadGame={id:string;name:string;artwork?:string;logo?:string;sourceName?:string;contentKind?:"game"|"patch"|"mod"|"extra"};
export function downloadGame(value:DownloadGame|undefined):DownloadGame|undefined {
  const text=(input:unknown,max:number)=>typeof input==="string"&&input.trim().length>0&&new TextEncoder().encode(input).length<=max&&!/[\x00-\x1f\x7f]/.test(input)?input.trim():undefined;
  const id=text(value?.id,256),name=text(value?.name,500);if(!id||!name)return undefined;
  const art=(input:unknown)=>{if(typeof input!=="string"||input.length>2048||/[\s\x00-\x1f\x7f]/.test(input))return undefined;try{
    const url=new URL(input),query=[...url.searchParams];
    const steam=url.hostname.endsWith(".steamstatic.com")||url.hostname==="steamstatic.com"||url.hostname==="steamcdn-a.akamaihd.net";
    if(steam&&query.length===1&&query[0][0]==="t"&&/^\d{1,16}$/.test(query[0][1]))url.search="";
    return ["http:","https:"].includes(url.protocol)&&!url.username&&!url.password&&!url.search&&!url.hash?url.href:undefined;
  }catch{return undefined;}};
  const contentKind=["game","patch","mod","extra"].includes(value?.contentKind??"")?value!.contentKind:undefined;
  return {id,name,artwork:art(value?.artwork),logo:art(value?.logo),sourceName:text(value?.sourceName,200),...(contentKind?{contentKind}:{})};
}
export type GameTransfer={batchId?:string|null;checkingPartial?:number|null;preparation?:import("./download-preparation").PreparationChoice|null;id:string;profile:string;name:string;url:string;sourcePage?:string;sourceLink?:string;destination:string;status:TransferStatus;received:number;total:number|null;expectedBytes:number|null;expectedSha256:string|null;sha256:string|null;validator:string|null;createdAt:number;updatedAt:number;error:string|null;bytesPerSecond:number;diskBytesPerSecond?:number;game?:DownloadGame;queueOrder?:number};
export const canOrderTransfer=(status:TransferStatus)=>["queued","paused","failed"].includes(status);
export function compareTransferQueue(a:GameTransfer,b:GameTransfer){
  const group=(r:GameTransfer)=>canOrderTransfer(r.status)?1:isTransferActive(r.status)?0:2;
  const section=group(a)-group(b);if(section)return section;
  if(group(a)===2)return b.createdAt-a.createdAt||a.id.localeCompare(b.id);
  return (a.queueOrder??a.createdAt)-(b.queueOrder??b.createdAt)||a.createdAt-b.createdAt||a.id.localeCompare(b.id);
}
export type DownloadRequest={url:string;name?:string;expectedBytes?:number;expectedSha256?:string;game?:DownloadGame;browserTicket?:string;sourceLink?:string};
export type BatchDownloadRequest=DownloadRequest&{filename:string};
export function validateDownloadBatch(files:BatchDownloadRequest[]){
  if(!files.length||files.length>200)throw new Error('transfer_limit');
  const names=new Set<string>();
  for(const file of files){
    const name=file.filename,key=name.toLowerCase();
    if(!name||name.trim()!==name||name.endsWith('.')||name.startsWith('.harbor-')||new TextEncoder().encode(name).length>255||/[<>:"/\\|?*\x00-\x1f\x7f]/.test(name)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)||names.has(key))throw new Error('transfer_batch_names');
    names.add(key);
  }
}
export const isTransferActive=(status:TransferStatus)=>["queued","connecting","retrying","downloading","checking","pausing","canceling"].includes(status);
export const transferError=(error:unknown)=>{const code=error instanceof Error?error.message:String(error);return /^transfer_[a-z_]+$/.test(code)?`games.download.${code}`:"games.download.failed";};
export function downloadName(value:string){
  const name=(value.split(/[\\/]/).pop()||"").replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g,"_").trim().slice(0,180).replace(/[. ]+$/,"")||"download";
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)?`_${name}`:name;
}
export function downloadFilename(value:string){
  try {const url=new URL(value);if(!["https:","http:"].includes(url.protocol)||url.username||url.password)throw Error();return downloadName(decodeURIComponent(url.pathname.split("/").pop()||"download"));}catch{return "download";}
}
export function transferBytes(value:number){
  if(value<1024)return `${Math.max(0,Math.round(value))} B`;
  const units=["KB","MB","GB","TB"];let current=value/1024,index=0;while(current>=1024&&index<units.length-1){current/=1024;index++;}
  return `${current.toLocaleString(undefined,{maximumFractionDigits:current<10?1:0})} ${units[index]}`;
}
