import { GameFileIcon } from "./game-file-icon";
import { SourceFilesLoading } from "./game-source-loading";
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {invoke} from '@tauri-apps/api/core';
import {ArrowDown,ArrowUpRight,Check,RefreshCw} from 'lucide-react';
import {useT} from '@/lib/i18n';
import {openUrl} from '@/lib/window';
import type {GameTransfers} from '@/hooks/use-game-transfers';
import type {CloudDownload} from '@/lib/games/cloud-files';
import {adError,adRejected,adIntent,type AdLink,type AdStatus} from '@/lib/games/cloud-ad-links';
import {webIntentKey,type WebIntent} from '@/lib/games/cloud-web-jobs';
import {claimWebIntent,readWebIntent,replaceWebIntent} from '@/lib/games/cloud-web-store';
import {sourceLinkError,type SourceLink} from '@/lib/games/source-links';
import {transferBytes} from '@/lib/games/transfers';

type PendingSave={before:WebIntent;after:WebIntent;result:AdLink};
export function SourceAllDebrid({link,downloads,apiKey,openSettings,onDone}:{link:SourceLink;downloads:GameTransfers;apiKey:string;openSettings?:()=>void;onDone:()=>void}){
 const t=useT(),identity=JSON.stringify([downloads.profile,apiKey,link.url]);
 const [intent,setIntent]=useState<WebIntent|null>(null),[file,setFile]=useState<CloudDownload|null>(null),[status,setStatus]=useState<AdStatus|null>(null);
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false),[storageKey,setStorageKey]=useState(''),[password,setPassword]=useState(''),[unsaved,setUnsaved]=useState<PendingSave|null>(null);
 const alive=useRef(true),owner=useRef(identity),revision=useRef(0),pending=useRef(false),lastCheck=useRef(0),body=useRef<HTMLDivElement>(null),focusReturn=useRef<HTMLElement|null>(null);
 if(owner.current!==identity){owner.current=identity;revision.current++}const stamp=revision.current;
 const valid=()=>alive.current&&revision.current===stamp;
 const fail=(reason:unknown)=>setError(adError(reason)??sourceLinkError(reason));
 const copy=(key:string)=>t(`games.sources.ad.${key}`);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[]);
 useLayoutEffect(()=>{
  if(busy||!focusReturn.current)return;const old=focusReturn.current;focusReturn.current=null;
  if(document.activeElement===document.body){const root=body.current?.closest('.games-source-link-dialog');(old.isConnected&&!old.matches(':disabled')?old:root?.querySelector<HTMLElement>('.games-source-link-files button,footer button'))?.focus({preventScroll:true})}
 },[busy,intent,file,error,unsaved]);
 useEffect(()=>{
  let current=true;setIntent(null);setFile(null);setStatus(null);setError('');setLoaded(false);setBusy(false);setPassword('');setUnsaved(null);pending.current=false;lastCheck.current=0;
  if(!apiKey||!downloads.available)return;
  void webIntentKey(downloads.profile,apiKey,link.url,'ad').then(async id=>({id,value:adIntent(await readWebIntent(id))})).then(({id,value})=>{if(current){setStorageKey(id);setIntent(value);setLoaded(true)}}).catch(reason=>{if(current)fail(reason)});
  return()=>{current=false};
 },[identity,downloads.available]);
 const adopt=async()=>{const latest=adIntent(await readWebIntent(storageKey));if(valid()){setIntent(latest);setFile(null);setStatus(null);setUnsaved(null)}};
 const commit=async(save:PendingSave)=>{
  if(!await replaceWebIntent(storageKey,save.before,save.after)){await adopt();return}
  if(valid()){setIntent(save.after);setUnsaved(null);setPassword('');setFile(save.result.url?{url:save.result.url,name:save.result.name,expectedBytes:save.result.expectedBytes}:null);setStatus(save.result.delayedId?{status:'preparing',url:null,seconds:null}:null)}
 };
 const prepare=async(again=false)=>{
  if(pending.current||!loaded||!apiKey||!downloads.available)return;
  focusReturn.current=document.activeElement as HTMLElement;pending.current=true;setBusy(true);setError('');downloads.dismissError();
  let claimed:WebIntent|null=null;
  try{
   if(again&&intent&&!await replaceWebIntent(storageKey,intent,null)){await adopt();return}
   const claim=await claimWebIntent(storageKey,{version:1,url:link.url,title:link.title.slice(0,500),remoteId:null,createdAt:Date.now(),requestId:crypto.randomUUID()});
   if(!valid())return;adIntent(claim.intent);setIntent(claim.intent);setFile(null);setStatus(null);
   if(!claim.created)return;claimed=claim.intent;
   const result=await invoke<AdLink>('games_cloud_ad_prepare',{args:{key:apiKey,url:link.url,password}});
   lastCheck.current=Date.now();
   const save={before:claimed,after:{...claimed,remoteId:result.delayedId,file:{name:result.name,expectedBytes:result.expectedBytes}},result};
   // Commit even after dismissal, but never overwrite a newer explicit request.
   try{await commit(save)}catch(reason){if(valid())setUnsaved(save);throw reason}
  }catch(reason){
   if(claimed&&adRejected(reason)){try{if(await replaceWebIntent(storageKey,claimed,null)&&valid())setIntent(null)}catch{if(valid())setError('games.sources.web.storage');return}}
   if(valid())fail(reason);
  }finally{if(valid()){pending.current=false;setBusy(false)}}
 };
 const retrySave=async()=>{
  if(!unsaved||pending.current)return;pending.current=true;setBusy(true);setError('');
  try{await commit(unsaved)}catch(reason){if(valid())fail(reason)}finally{if(valid()){pending.current=false;setBusy(false)}}
 };
 const refresh=async()=>{
  if(!intent?.remoteId||!intent.file||pending.current||unsaved)return;
  focusReturn.current=document.activeElement as HTMLElement;pending.current=true;setBusy(true);setError('');
  try{
   const wait=Math.max(0,8000-(Date.now()-lastCheck.current));if(wait)await new Promise(resolve=>setTimeout(resolve,wait));
   if(!valid())return;lastCheck.current=Date.now();
   const result=await invoke<AdStatus>('games_cloud_ad_status',{args:{key:apiKey,id:intent.remoteId}});
   if(valid()){setStatus(result);setFile(result.status==='ready'&&result.url?{...intent.file,url:result.url}:null)}
  }catch(reason){if(valid())fail(reason)}finally{if(valid()){pending.current=false;setBusy(false)}}
 };
 useEffect(()=>{if(intent?.remoteId&&intent.file&&!unsaved&&document.visibilityState==='visible')void refresh()},[intent?.remoteId,identity]);
 useEffect(()=>{
  if(!intent?.remoteId||status?.status!=='preparing'||unsaved||error)return;let polls=0;
  const timer=setInterval(()=>{if(document.visibilityState!=='visible')return;if(polls++>=30){clearInterval(timer);return}void refresh()},8000);
  return()=>clearInterval(timer);
 },[intent?.remoteId,identity,status?.status,unsaved,error]);
 const saving=downloads.busy.includes('new');
 const download=async()=>{
  if(!file||pending.current||saving)return;pending.current=true;setBusy(true);downloads.dismissError();
  try{const started=await downloads.start({url:file.url,sourceLink:link.url,name:link.title,game:link.game,expectedBytes:file.expectedBytes??undefined},file.name);if(started&&valid())onDone()}
  catch(reason){if(valid())fail(reason)}finally{if(valid()){pending.current=false;setBusy(false)}}
 };
 const canUse=downloads.available&&!!apiKey&&loaded;
 return <><div ref={body} className="games-source-link-body games-web-job-body" aria-busy={busy}>
 {!downloads.available?<p>{t('games.sources.links.desktop')}</p>:!apiKey?<><p>{t('games.sources.links.connect',{name:'AllDebrid'})}</p>{openSettings&&<button className="games-button" onClick={openSettings}>{t('games.sources.links.settings')}</button>}</>:!loaded&&!error?<SourceFilesLoading/>:<>
 {busy&&!file?<SourceFilesLoading/>:file?<div className="games-ad-file"><GameFileIcon name={file.name}/><span><strong>{file.name}</strong><small>{file.expectedBytes?transferBytes(file.expectedBytes):t('games.sources.links.unknownSize')}</small></span><Check size={17}/></div>:intent?.remoteId?<div className="games-web-job-status"><strong>{intent.file?.name||link.title}</strong><span role="status">{status?.status==='failed'?copy('failed'):copy('preparing')}</span><button className="games-icon-button" aria-label={copy('check')} aria-disabled={busy} onClick={()=>void refresh()}><RefreshCw size={16}/></button></div>:<>
 <p>{intent?copy(busy?'preparing':intent.file?'renew':'uncertain'):copy('note')}</p>
 <label className="games-ad-password"><span>{copy('password')}</span><input type="password" autoComplete="off" maxLength={1024} value={password} disabled={busy||!!unsaved} onChange={e=>setPassword(e.target.value)}/></label>
 </>}
 {intent&&!intent.remoteId&&!intent.file&&<button className="games-source-link-origin" onClick={()=>void openUrl('https://alldebrid.com/')}><span>{copy('open')}</span><ArrowUpRight size={14}/></button>}
 </>}
 {error&&<p role="alert">{t(error)}</p>}{downloads.error&&<p role="alert">{t(downloads.error)}</p>}
 </div><footer><span>{intent?.remoteId?copy('kept'):t('games.sources.links.note')}</span>{canUse&&(unsaved?<button className="games-button" disabled={busy} onClick={()=>void retrySave()}>{t('common.retry')}</button>:file?<button className="games-button games-button-primary" disabled={busy||saving} onClick={()=>void download()}><ArrowDown size={16}/>{t((downloads.selectionOnly?'games.download.relink.review':'games.sources.links.destination'))}</button>:!intent?<button className="games-button games-button-primary" aria-disabled={busy} onClick={()=>void prepare()}>{t(busy?'games.sources.links.preparing':'games.sources.links.prepare')}</button>:!intent.remoteId||status?.status==='failed'||error==='games.sources.links.empty'?<button className="games-button" disabled={busy} onClick={()=>void prepare(true)}>{copy('again')}</button>:<button className="games-button" aria-disabled={busy} onClick={()=>void refresh()}>{copy('check')}</button>)}</footer></>;
}
