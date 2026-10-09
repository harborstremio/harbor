import { GameFileIcon } from './game-file-icon';
import { SourceFilesLoading } from './game-source-loading';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ArrowDown, ArrowUpRight, Check, ShieldCheck, Square, SquareCheck } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { openUrl } from '@/lib/window';
import type { GameTransfers } from '@/hooks/use-game-transfers';
import type { SourceLink } from '@/lib/games/source-links';
import { canPreparePublicFile, publicBatchError, publicFileError, publicFilePage, publicFileSelection, PUBLIC_BATCH_LIMIT, PUBLIC_SOURCE_HOSTS, sourcePublicHost, type PublicFiles, type PublicDownload } from '@/lib/games/source-public-files';
import { transferBytes, validateDownloadBatch } from '@/lib/games/transfers';
import './game-source-public.css';

export function SourcePublicFiles({link,downloads,onDone,closing}:{link:SourceLink;downloads:GameTransfers;onDone:()=>void;closing:boolean}){
 const t=useT(),[result,setResult]=useState<PublicFiles|null>(null),[selected,setSelected]=useState<Set<string>>(new Set()),[focused,setFocused]=useState(''),[limit,setLimit]=useState(50),[busy,setBusy]=useState(false),[error,setError]=useState<{key:string;file?:string}|null>(null);
 const alive=useRef(true),pending=useRef(false),body=useRef<HTMLDivElement>(null),operation=useRef<{profile:string;session:string}|null>(null);
 const host=PUBLIC_SOURCE_HOSTS[sourcePublicHost(link.url)??'pixeldrain'];
 useLayoutEffect(()=>{
  alive.current=!closing;
  return()=>{alive.current=false;const current=operation.current;operation.current=null;if(current)void invoke('games_source_public_cancel_batch',current).catch(()=>{});};
 },[closing,downloads.profile,link.url]);
 const multiple=(result?.files.length??0)>1&&!downloads.selectionOnly;
 const file=result?.files.find(item=>item.id===focused),saving=downloads.busy.includes('new');
 const eligible=useMemo(()=>result?.files.filter(canPreparePublicFile)??[],[result]);
 const chosen=useMemo(()=>result?publicFileSelection(result,selected):[],[result,selected]);
 const allSelected=eligible.length>0&&chosen.length===eligible.length;
 const canSelectAll=eligible.length<=PUBLIC_BATCH_LIMIT;
 const review=async()=>{
  if(!alive.current||pending.current||saving||!downloads.available)return;pending.current=true;setBusy(true);setError(null);
  try{
   const next=await invoke<PublicFiles>('games_source_public_review',{args:{url:link.url}});
   if(!alive.current)return;
   const initial=next.files.find(item=>item.id===next.selectedId)??next.files[0];
   setResult(next);setFocused(initial?.id??'');setSelected(new Set(initial&&canPreparePublicFile(initial)?[initial.id]:[]));setLimit(50);
  }catch(reason){if(alive.current)setError({key:publicFileError(reason)})}finally{pending.current=false;if(alive.current)setBusy(false)}
 };
 const download=async()=>{
  if(!alive.current||!chosen.length||pending.current||saving||!downloads.available)return;pending.current=true;setBusy(true);setError(null);downloads.dismissError();
  let session:string|undefined;
  try{
   let files:PublicDownload[];
   if(chosen.length===1){files=[await invoke<PublicDownload>('games_source_public_prepare',{args:{url:link.url,file:chosen[0].id}})];}
   else{
    session=crypto.randomUUID();operation.current={profile:downloads.profile,session};
    files=await invoke<PublicDownload[]>('games_source_public_prepare_batch',{args:{profile:downloads.profile,session,url:link.url,files:chosen.map(item=>item.id)}});
   }
   if(!alive.current)return;
   if(files.length!==chosen.length)throw Error('public_metadata');
   const requests=files.map(item=>({url:item.url,sourceLink:link.url,name:link.title,filename:item.name,game:link.game,expectedBytes:item.expectedBytes??undefined,expectedSha256:item.expectedSha256??undefined}));
   if(requests.length>1)validateDownloadBatch(requests);
   const started=requests.length===1?await downloads.start(requests[0],requests[0].filename):await downloads.startBatch(requests);
   if(started&&alive.current)onDone();
  }catch(reason){if(alive.current)setError(publicBatchError(reason))}finally{if(operation.current?.session===session)operation.current=null;pending.current=false;if(alive.current)setBusy(false)}
 };
 const visible=result?.files.slice(0,limit)??[];
 // Reveal the provider-selected member, including links pointing past the first page.
 useEffect(()=>{if(!result)return;const index=result.files.findIndex(item=>item.id===focused);if(index>=limit)setLimit(Math.ceil((index+1)/50)*50)},[result,focused,limit]);
 useLayoutEffect(()=>{const container=body.current,item=container?.querySelector<HTMLElement>('[data-current="true"]');if(!container||!item)return;const row=item.getBoundingClientRect(),viewport=container.getBoundingClientRect();if(row.bottom>viewport.bottom)container.scrollTop+=row.bottom-viewport.bottom;else if(row.top<viewport.top)container.scrollTop-=viewport.top-row.top},[focused,limit,result]);
 const toggle=(id:string)=>{
  if(busy||saving)return;setFocused(id);setError(null);downloads.dismissError();
  setSelected(previous=>{const next=new Set(multiple?previous:[]);if(multiple&&next.has(id))next.delete(id);else if(next.size<PUBLIC_BATCH_LIMIT)next.add(id);return next;});
 };
 return <><div className="games-source-link-body games-source-public-body" ref={body} aria-busy={busy}>
  {!downloads.available?<p>{t('games.sources.links.desktop')}</p>:<>
   {!result&&!busy&&<p>{t('games.sources.public.intro',{host})}</p>}
   {busy&&!result&&<SourceFilesLoading heading rows={new URL(link.url).pathname.startsWith('/l/')?3:1}/>}
   {result&&<><div className="games-source-public-heading"><strong>{result.title}</strong><small>{t('games.sources.public.count',{count:result.files.length.toLocaleString()})}</small></div>
    {multiple&&<><div className="games-source-file-selection"><span role="status">{t('games.sources.batch.selected',{count:chosen.length.toLocaleString()})}</span><button disabled={busy||saving||!eligible.length||!canSelectAll&&!chosen.length} onClick={()=>{setSelected(new Set(allSelected||!canSelectAll?[]:eligible.map(item=>item.id)));setError(null);downloads.dismissError()}}>{t(allSelected||!canSelectAll&&chosen.length?'games.sources.batch.clear':'games.sources.batch.all')}</button></div>{!canSelectAll&&<p>{t('games.sources.batch.limit')}</p>}</>}
    {result.files.length===0?<p>{t('games.sources.public.empty')}</p>:<div className="games-source-link-files" role="group" aria-label={t('games.sources.links.files')}>
     {visible.map(item=><button key={item.id} role={multiple?'checkbox':undefined} aria-checked={multiple?selected.has(item.id):undefined} aria-pressed={!multiple?selected.has(item.id):undefined} data-current={focused===item.id} disabled={busy||saving||!canPreparePublicFile(item)||!selected.has(item.id)&&selected.size>=PUBLIC_BATCH_LIMIT} onClick={()=>toggle(item.id)}><GameFileIcon name={item.name}/><span><strong>{item.name}</strong><small><bdi>{item.bytes===null?t('games.sources.links.unknownSize'):transferBytes(item.bytes)}</bdi>{!canPreparePublicFile(item)&&' · '+t('games.sources.public.state.'+item.state)}</small></span>{multiple?(selected.has(item.id)?<SquareCheck size={20}/>:<Square size={20}/>):selected.has(item.id)&&<Check size={16}/>}</button>)}
     {result.files.length>limit&&<button disabled={busy||saving} onClick={()=>setLimit(value=>value+50)}>{t('games.sources.links.more')}</button>}
    </div>}
   </>}
  </>}
 </div>{downloads.available&&(file||error||downloads.error||busy)&&<div className="games-source-public-status">
  {busy&&!result&&<div className="games-source-public-facts" aria-hidden="true"><i className="games-source-bone games-source-bone-fact"/></div>}
  {chosen.length===1&&<div className="games-source-public-facts">{chosen[0].sha256&&<span><ShieldCheck size={15}/>{t('games.sources.public.checksum')}</span>}{chosen[0].speedLimit!=null&&<span>{t('games.sources.public.speed',{speed:'\u2068'+transferBytes(chosen[0].speedLimit)+'\u2069'})}</span>}</div>}
  {chosen.length>1&&<p>{t('games.sources.batch.note')}{chosen.every(item=>item.bytes!==null)&&<> · <bdi>{transferBytes(chosen.reduce((sum,item)=>sum+item.bytes!,0))}</bdi></>}</p>}
  {file&&!canPreparePublicFile(file)&&<p role="status">{t('games.sources.public.'+file.state,{host})}</p>}
  {error&&<p role="alert" className="games-source-link-error">{error.file&&<><bdi>{t('games.sources.batch.failedFile',{file:error.file})}</bdi>{' '}</>}{t(error.key,{host})}</p>}{downloads.error&&<p role="alert">{t(downloads.error)}</p>}
 </div>}<footer><button className="games-source-public-open" onClick={()=>void openUrl(publicFilePage(link.url,multiple?undefined:file?.id))}>{t('games.sources.public.open',{host})}<ArrowUpRight size={14}/></button>
  {downloads.available&&(!result?<button className="games-button games-button-primary" aria-disabled={busy} onClick={()=>void review()}>{t(busy?'common.loading':error?'common.retry':'games.sources.public.files')}</button>:eligible.length?<button className="games-button games-button-primary" disabled={busy||saving||!chosen.length} onClick={()=>void download()}><ArrowDown size={16}/>{t(busy?'games.sources.links.preparing':downloads.selectionOnly?'games.download.relink.review':chosen.length>1?'games.sources.batch.destination':'games.sources.links.destination')}</button>:<button className="games-button" disabled={busy} onClick={()=>void review()}>{t('common.retry')}</button>)}
 </footer></>;
}
