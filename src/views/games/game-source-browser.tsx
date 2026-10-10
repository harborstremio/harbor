import { GameFileIcon } from "./game-file-icon";
import { SourceFilesLoading } from "./game-source-loading";
import {useLayoutEffect,useRef,useState} from 'react';
import {invoke} from '@tauri-apps/api/core';
import {ArrowDown,ArrowUpRight} from 'lucide-react';
import {useT} from '@/lib/i18n';
import {openUrl} from '@/lib/window';
import type {GameTransfers} from '@/hooks/use-game-transfers';
import type {SourceLink} from '@/lib/games/source-links';
import {sourceBrowserError,sourceBrowserHost,BROWSER_SOURCE_HOSTS,type BrowserSourceFile} from '@/lib/games/source-browser';
import './game-source-public.css';

export function SourceBrowserFiles({link,downloads,onDone,closing}:{link:SourceLink;downloads:GameTransfers;onDone:()=>void;closing:boolean}){
 const t=useT(),[file,setFile]=useState<BrowserSourceFile|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const key=sourceBrowserHost(link.url)??'gofile';
 const host=key!=='generic'?BROWSER_SOURCE_HOSTS[key]:(()=>{try{return new URL(link.url).hostname.replace(/^www\./,'')}catch{return BROWSER_SOURCE_HOSTS.generic}})();
 const alive=useRef(true),session=useRef<string|null>(null),saving=downloads.busy.includes('new'),pending=useRef(false);
 const cancel=()=>{const id=session.current;session.current=null;if(id)void invoke('games_source_browser_close',{profile:downloads.profile,session:id}).catch(()=>{});if(alive.current)setBusy(false)};
 useLayoutEffect(()=>{alive.current=!closing;return()=>{alive.current=false;cancel()}},[closing,downloads.profile]);
 const choose=async()=>{
  if(!alive.current||session.current||saving||pending.current||!downloads.available)return;
  const id=crypto.randomUUID();session.current=id;setBusy(true);setError('');downloads.dismissError();
  try{
   const next=await invoke<BrowserSourceFile>('games_source_browser_choose',{profile:downloads.profile,session:id,url:link.url});
   if(alive.current&&session.current===id)setFile(next);
  }catch(reason){if(alive.current&&session.current===id)setError(sourceBrowserError(reason)??'')}
  finally{if(session.current===id){session.current=null;if(alive.current)setBusy(false)}}
 };
 const download=async()=>{
  if(!alive.current||!file||busy||saving||pending.current)return;pending.current=true;
  try{if(await downloads.start({url:file.url,sourceLink:link.url,browserTicket:file.browserTicket,name:link.title,game:link.game},file.name)&&alive.current)onDone()}
  finally{pending.current=false}
 };
 return <><div className="games-source-link-body games-source-public-body">
  {!downloads.available?<p>{t('games.sources.links.desktop')}</p>:<>
   <p>{t('games.sources.browser.intro',{host})}</p>
   <p className="games-source-browser-fallback">{t('games.sources.browser.fallback',{host})}</p>
   {busy?<div role="status"><SourceFilesLoading/><p>{t('games.sources.browser.waiting',{host})}</p><button className="games-button" onClick={cancel}>{t('common.cancel')}</button></div>:file&&<><div className="games-ad-file"><GameFileIcon name={file.name}/><span><strong>{file.name}</strong><small>{t('games.sources.browser.selected')}</small></span></div><button className="games-source-public-open" disabled={saving} onClick={()=>void choose()}>{t('games.sources.browser.another')}</button></>}
  </>}
 </div>{(error||downloads.error)&&<div className="games-source-batch-error" role="alert">{t(error||downloads.error,{host})}</div>}
 <footer><button className="games-source-public-open" onClick={()=>void openUrl(link.url)}>{t('games.sources.public.open',{host})}<ArrowUpRight size={14}/></button>
  {downloads.available&&!busy&&<button className="games-button games-button-primary" disabled={saving} aria-busy={saving} onClick={()=>void(file?download():choose())}><ArrowDown size={16}/>{t(saving?'games.torrent.starting':file?(downloads.selectionOnly?'games.download.relink.review':'games.sources.links.destination'):'games.sources.browser.choose',{host})}</button>}
 </footer></>;
}
