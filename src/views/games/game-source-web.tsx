import { GameFileIcon } from "./game-file-icon";
import { SourceFilesLoading } from "./game-source-loading";
import {useEffect,useRef,useState} from 'react';
import {invoke} from '@tauri-apps/api/core';
import {ArrowDown,ArrowRight,Check,Folder,RefreshCw} from 'lucide-react';
import {useT,useUiLanguage} from '@/lib/i18n';
import {type GameTransfers} from '@/hooks/use-game-transfers';
import {type CloudDownload,type CloudEntry,type CloudKeys} from '@/lib/games/cloud-files';
import {type CloudWebJob,type CloudWebPage,type WebIntent,webIntentKey} from '@/lib/games/cloud-web-jobs';
import {readWebIntent,claimWebIntent,writeWebIntent} from '@/lib/games/cloud-web-store';
import {sourceLinkError,type SourceLink} from '@/lib/games/source-links';
import {transferBytes} from '@/lib/games/transfers';
import {GameCloudDialog} from './game-cloud';

const pmCopy=new Set(['start','note','kept','uncertain','check','browse','preparing','failed','notFound']);
export function SourceCloudTransfer({link,downloads,keys,openSettings,onDone,provider}:{link:SourceLink;downloads:GameTransfers;keys:CloudKeys;openSettings?:()=>void;onDone:()=>void;provider:'tb'|'pm'}){
 const t=useT(),language=useUiLanguage(),key=keys[provider]?.trim()??'',identity=`${downloads.profile}\n${provider}\n${key}\n${link.url}`,service=provider==='pm'?'Premiumize':'TorBox';
 const copy=(key:string)=>t(`games.sources.${provider==='pm'&&pmCopy.has(key)?'pm':'web'}.${key}`);
 const command=(action:string)=>`games_cloud_${provider==='pm'?'pm':'web'}_${action}`;
 const [intent,setIntent]=useState<WebIntent|null>(null),[job,setJob]=useState<CloudWebJob|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false),[storeKey,setStoreKey]=useState(''),[file,setFile]=useState(''),[limit,setLimit]=useState(50),[scanPage,setScanPage]=useState(0),[scanNext,setScanNext]=useState<number|null>(null),[checked,setChecked]=useState(false),[browse,setBrowse]=useState(false);
 const owner=useRef(identity),alive=useRef(true),pending=useRef(false),revision=useRef(0),body=useRef<HTMLDivElement>(null),focusReturn=useRef<HTMLElement|null>(null);
 const [recent,setRecent]=useState<CloudWebJob[]>([]),[browseFolder,setBrowseFolder]=useState<CloudEntry|null>(null);
 if(owner.current!==identity){owner.current=identity;revision.current++}const currentRevision=revision.current;
 const valid=()=>alive.current&&revision.current===currentRevision;
 const args={provider,key,parent:intent?.remoteId??'',page:0,file:''};
 const fail=(reason:unknown)=>setError(String(reason).includes('web_storage')?'games.sources.web.storage':String(reason)==='cloud_container'?'games.sources.pm.container':sourceLinkError(reason));
 useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[]);
 useEffect(()=>{
  if(busy||!focusReturn.current)return;
  const previous=focusReturn.current;focusReturn.current=null;
  if(document.activeElement===document.body){
   const root=body.current?.closest('.games-source-link-dialog');
   const target=previous.isConnected&&!previous.matches(':disabled')?previous:root?.querySelector<HTMLElement>('.games-source-link-files button')??root?.querySelector<HTMLElement>('.games-web-job-status button,.games-web-job-actions button,footer button');
   target?.focus({preventScroll:true});
  }
 },[busy,job,intent,error]);
 useEffect(()=>{let current=true;setLoaded(false);setIntent(null);setJob(null);setError('');setChecked(false);setFile('');setScanNext(null);setScanPage(0);setRecent([]);setBrowse(false);setBrowseFolder(null);setLimit(50);pending.current=false;setBusy(false);
 if(!key||!downloads.available)return;
 void webIntentKey(downloads.profile,key,link.url,provider).then(async id=>({id,value:await readWebIntent(id)})).then(({id,value})=>{if(current){setStoreKey(id);setIntent(value);setLoaded(true)}}).catch(reason=>{if(current)fail(reason)});
 return()=>{current=false};
 },[identity,downloads.available]);
 const refresh=async()=>{
  if(!intent?.remoteId||pending.current)return;pending.current=true;setBusy(true);setError('');
  try{const next=await invoke<CloudWebJob>(command('status'),{args});if(valid()){setJob(next);setFile(previous=>next.files.some(v=>v.id===previous&&v.kind==='file')?previous:next.files.find(v=>v.kind==='file')?.id??'')}}catch(reason){if(valid()){if((reason instanceof Error?reason.message:String(reason))==='cloud_missing'){setJob(null);setError('games.sources.web.missing')}else fail(reason)}}finally{if(valid()){pending.current=false;setBusy(false)}}
 };
 useEffect(()=>{if(!intent?.remoteId||!key)return;void refresh()},[intent?.remoteId,identity]);
 useEffect(()=>{if(!intent?.remoteId||job?.status!=='preparing')return;let polls=0;const timer=setInterval(()=>{if(document.visibilityState!=='visible')return;if(polls++>=30){clearInterval(timer);return}void refresh()},8000);return()=>clearInterval(timer)},[intent?.remoteId,identity,job?.status]);
 const start=async(again=false)=>{
  if(pending.current||!loaded||!key||!downloads.available)return;focusReturn.current=document.activeElement as HTMLElement;pending.current=true;setBusy(true);setError('');
  try{
   if(again)await writeWebIntent(storeKey,null);
   const claimed=await claimWebIntent(storeKey,{version:1,url:link.url,title:link.title.slice(0,500),remoteId:null,createdAt:Date.now()});
   if(!valid())return;setIntent(claimed.intent);setJob(null);setFile('' );setChecked(false);setScanNext(null);setRecent([]);
   if(!claimed.created)return;
   const remoteId=await invoke<string>(command('create'),{args:{provider,key,url:link.url}});
   const updated={...claimed.intent,remoteId};await writeWebIntent(storeKey,updated);
   if(valid()){pending.current=false;setIntent(updated);setChecked(false)}
  }catch(reason){if(valid())fail(reason)}finally{if(valid()){pending.current=false;setBusy(false)}}
 };
 const check=async(page=0)=>{
  if(pending.current)return;focusReturn.current=document.activeElement as HTMLElement;pending.current=true;setBusy(true);setError('');
  try{const result=provider==='pm'?await invoke<CloudWebPage>(command('list'),{args:{...args,page}}):await invoke<CloudWebPage>('games_cloud_web_find',{args:{provider,key,url:link.url},page});if(!valid())return;
   if(provider==='pm'){setRecent(result.jobs);setChecked(true);setScanPage(page);setScanNext(result.next);return;}
   // Provider hash is the exact submitted URL, never a title-based match.
   if(result.jobs.length){const next=result.jobs[0],updated={...intent!,remoteId:next.id};await writeWebIntent(storeKey,updated);if(valid()){setIntent(updated);setJob(next);setFile(next.files[0]?.id??'')}}
   else{setChecked(true);setScanPage(page);setScanNext(result.next)}
  }catch(reason){if(valid())fail(reason)}finally{if(valid()){pending.current=false;setBusy(false)}}
 };
 const selectJob=async(next:CloudWebJob)=>{
  if(!intent||pending.current)return;focusReturn.current=document.activeElement as HTMLElement;pending.current=true;setBusy(true);setError('');
  try{const updated={...intent,remoteId:next.id};await writeWebIntent(storeKey,updated);if(valid()){setIntent(updated);setJob(null);setRecent([]);setChecked(false);setScanNext(null)}}catch(reason){if(valid())fail(reason)}finally{if(valid()){pending.current=false;setBusy(false)}}
 };
 const retryJob=async()=>{
  if(!job||pending.current)return;focusReturn.current=document.activeElement as HTMLElement;pending.current=true;setBusy(true);setError('');
  try{await invoke(command('retry'),{args:{...args,parent:job.id}});if(valid()){pending.current=false;await refresh()}}catch(reason){if(valid())fail(reason)}finally{if(valid()){pending.current=false;setBusy(false)}}
 };
 const download=async()=>{
  if(!job||pending.current||downloads.busy.includes('new'))return;pending.current=true;setBusy(true);setError('');downloads.dismissError();
  try{const value=await invoke<CloudDownload>(command('download'),{args:{...args,parent:job.id,file}});if(!valid())return;const started=await downloads.start({url:value.url,sourceLink:link.url,name:link.title,game:link.game,expectedBytes:value.expectedBytes??undefined},value.name);if(started&&valid())onDone()}
  catch(reason){if(valid())fail(reason)}finally{if(valid()){pending.current=false;setBusy(false)}}
 };
 const saving=downloads.busy.includes('new');
 return <><div ref={body} className="games-source-link-body games-web-job-body" aria-busy={busy}>
 {!downloads.available?<p>{t('games.sources.links.desktop')}</p>:!key?<div><p>{t('games.sources.links.connect',{name:service})}</p>{openSettings&&<button className="games-button" onClick={openSettings}>{t('games.sources.links.settings')}</button>}</div>:(!loaded||busy&&!job)&&!error?<SourceFilesLoading heading/>:job?<>
 <div className="games-web-job-status"><strong>{job.name||link.title}</strong><span>{copy(job.status)}{job.status==='preparing'&&job.progress!==null&&` · ${Math.round(job.progress*100)}%`}</span><button className="games-icon-button" aria-label={copy('check')} disabled={busy} onClick={()=>void refresh()}><RefreshCw size={16}/></button></div>
 {job.status==='preparing'&&job.progress!==null&&<progress value={job.progress} max={1} aria-label={copy('preparing')}/>}
 {job.status==='ready'&&!job.files.length&&<p>{t('games.sources.links.empty')}</p>}
 {(job.status==='failed'||job.status==='missing')&&<div className="games-web-job-actions"><button className="games-button" disabled={busy} onClick={()=>setBrowse(true)}>{copy('browse')}</button></div>}
 {job.status==='ready'&&<div className="games-source-link-files">{job.files.slice(0,limit).map(item=><button key={item.id} aria-pressed={item.kind==='file'?file===item.id:undefined} disabled={busy||saving} onClick={()=>{if(item.kind==='folder'){setBrowseFolder(item);setBrowse(true)}else setFile(item.id)}}>{item.kind==='folder'?<Folder size={20}/>:<GameFileIcon name={item.name||link.title}/>}<span><strong>{item.name||link.title}</strong><small>{item.kind==='folder'?t('games.sources.pm.folder'):item.bytes?transferBytes(item.bytes):t('games.sources.links.unknownSize')}</small></span>{item.kind==='folder'?<ArrowRight size={16}/>:file===item.id&&<Check size={16}/>}</button>)}{job.files.length>limit&&<button onClick={()=>setLimit(v=>v+50)}>{t('games.sources.links.more')}</button>}</div>}
 </>:intent?.remoteId?<><p role="status">{copy(error==='games.sources.web.missing'?'missing':'preparing')}</p>{error&&<button className="games-button" disabled={busy} onClick={()=>void refresh()}>{copy('check')}</button>}</>:intent?<><p>{copy(busy?'preparing':'uncertain')}</p><div className="games-web-job-actions"><button className="games-button" disabled={busy} onClick={()=>void check(0)}>{copy('check')}</button>{checked&&scanNext!==null&&<button className="games-button" disabled={busy} onClick={()=>void check(scanNext)}>{copy('more')}</button>}<button className="games-button" disabled={busy} onClick={()=>setBrowse(true)}>{copy('browse')}</button></div>
 {provider==='pm'&&recent.length>0&&<div className="games-pm-recovery"><p>{t('games.sources.pm.review')}</p>{recent.map(item=><button key={item.id} disabled={busy} onClick={()=>void selectJob(item)}><span><strong>{item.name||item.id}</strong><small>{copy(item.status)}{item.createdAt!=null&&` · ${new Date(item.createdAt*1000).toLocaleString(language)}`}</small></span><span>{t('games.sources.pm.select')}<ArrowRight size={14}/></span></button>)}</div>}
 {checked&&<p>{scanNext===null?copy('notFound'):t('games.sources.web.nextPage',{page:scanPage+1})}</p>}</>:<p>{copy('note')}</p>}
 {error&&error!=='games.sources.web.missing'&&<p role="alert">{t(error)}</p>}{downloads.error&&<p role="alert">{t(downloads.error)}</p>}
 </div><footer><span>{copy('kept')}</span>{downloads.available&&key&&loaded&&(job?.status==='ready'&&file?<button className="games-button games-button-primary" disabled={busy||saving} onClick={()=>void download()}><ArrowDown size={16}/>{t((downloads.selectionOnly?'games.download.relink.review':'games.sources.links.destination'))}</button>:!intent?<button className="games-button games-button-primary" disabled={busy} onClick={()=>void start()}>{copy('start')}</button>:provider==='pm'&&job?.status==='failed'?<button className="games-button" disabled={busy} onClick={()=>void retryJob()}>{t('games.sources.pm.retry')}</button>:((checked&&scanNext===null&&!job)||job?.status==='failed'||job?.status==='missing'||error==='games.sources.web.missing')?<button className="games-button" disabled={busy} onClick={()=>void start(true)}>{copy('again')}</button>:<button className="games-button" disabled={busy} onClick={()=>setBrowse(true)}>{copy('browse')}</button>)}</footer>
 {browse&&<GameCloudDialog downloads={downloads} keys={keys} initialProvider={provider} initialScope={browseFolder?'torrents':'web'} initialFolder={browseFolder??undefined} openSettings={openSettings} onClose={()=>{setBrowse(false);setBrowseFolder(null)}}/>}</>;
}
