export type PublicFile = { id:string; name:string; bytes:number|null; sha256:string|null; state:'available'|'review'|'limited'|'restricted'|'missing'|'unknown'; speedLimit:number|null };
export type PublicFiles = { title:string; files:PublicFile[]; selectedId:string|null };
export type PublicDownload = { url:string; name:string; expectedBytes:number|null; expectedSha256:string|null };
export const PUBLIC_BATCH_LIMIT=200;
export const canPreparePublicFile=(file:PublicFile)=>file.state==='available'||file.state==='unknown';
export function publicFileSelection(result:PublicFiles,selected:ReadonlySet<string>){return result.files.filter(file=>selected.has(file.id)&&canPreparePublicFile(file))}
export function publicBatchError(reason:unknown):{key:string;file?:string}|null {
 const value=typeof reason==='object'&&reason!==null?reason as {code?:unknown;file?:unknown;message?:unknown}:null;
 const code=typeof value?.code==='string'?value.code:reason instanceof Error?reason.message:String(reason);
 if(code==='public_batch_canceled')return null;
 const key=code==='public_batch_busy'?'games.sources.batch.busy':code==='public_batch_limit'?'games.sources.batch.limit':code==='transfer_batch_names'?'games.download.transfer_batch_names':code.includes('games_source_public_prepare_batch')&&/not found|unknown command/i.test(code)?'games.sources.batch.restart':publicFileError(code);
 return {key,...(typeof value?.file==='string'&&value.file.length<=2048&&!/[\x00-\x1f\x7f]/.test(value.file)?{file:value.file}:{})};
}
export const PUBLIC_SOURCE_HOSTS = {pixeldrain:'Pixeldrain', archive:'Internet Archive', mediafire:'MediaFire'} as const;
export type PublicSourceHost = keyof typeof PUBLIC_SOURCE_HOSTS;
function archivePath(path:string){return path.length>0&&path.length<=2048&&!/[\\\x00-\x1f\x7f]/.test(path)&&path.split('/').length<=32&&path.split('/').every(part=>!!part&&part!=='.'&&part!=='..')}
export function sourcePublicHost(value:string):PublicSourceHost|null {
 try {
  const url=new URL(value);
  if(!['http:','https:'].includes(url.protocol)||url.port||url.username||url.password||value.length>8192||/[\\\x00-\x1f\x7f]/.test(value))return null;
  const rawPath=value.split('://')[1]?.replace(/^[^/]*\//,'').split(/[?#]/)[0]??'';
  if(decodeURIComponent(rawPath).split('/').some(part=>part==='.'||part==='..'))return null;
  if(['pixeldrain.com','www.pixeldrain.com'].includes(url.hostname))return /^\/(?:[ul]\/[-\w]+|api\/file\/[-\w]+(?:\/info)?|api\/list\/[-\w]+)\/?$/.test(url.pathname)&&url.pathname.split('/').every(part=>part.length<=64)?'pixeldrain':null;
  if(['archive.org','www.archive.org'].includes(url.hostname)){
   const route=decodeURIComponent(url.pathname),match=/^\/(details|download|metadata)\/([A-Za-z0-9][\w.-]{0,99})(?:\/(.*))?$/.exec(route);
   return match&&(!match[3]||match[1]==='download'&&archivePath(match[3]))?'archive':null;
  }
  if(['mediafire.com','www.mediafire.com'].includes(url.hostname)){
   if(url.pathname==='/'&&/^\?[A-Za-z0-9]{1,64}$/.test(url.search))return 'mediafire';
   if(/%2f|%5c|%0[0-9a-f]|%1[0-9a-f]|%7f/i.test(url.pathname))return null;
   return /^\/(?:file|view|download)\/[A-Za-z0-9]{1,64}(?:\/[^/]+(?:\/file)?)?\/?$/.test(url.pathname)?'mediafire':null;
  }
  return null;
 }catch{return null}
}
export function publicFilePage(origin:string,fileId?:string):string {
 const host=sourcePublicHost(origin);
 if(host==='pixeldrain'&&fileId&&/^[-\w]{1,64}$/.test(fileId))return `https://pixeldrain.com/u/${fileId}`;
 if(host==='archive'&&fileId&&archivePath(fileId)){
  const item=decodeURIComponent(new URL(origin).pathname).split('/')[2];
  return `https://archive.org/download/${encodeURIComponent(item)}/${fileId.split('/').map(encodeURIComponent).join('/')}`;
 }
 return origin;
}
export function publicFileError(reason:unknown){
 const code=reason instanceof Error?reason.message:String(reason);
 return `games.sources.public.${code==='public_review'?'review':code==='public_restricted'?'restricted':code==='public_rate_limit'?'limited':code==='public_missing'?'missing':code==='public_limit'?'limit':code==='public_metadata'||code==='public_url'?'invalid':'failed'}`;
}
