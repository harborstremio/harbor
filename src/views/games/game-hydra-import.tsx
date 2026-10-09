import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FileUp, FolderOpen, Search, X } from 'lucide-react';
import { ModalShell, useModalExit } from '@/components/modal-shell';
import { GamesIcon } from '@/components/icons/games-icon';
import { useT } from '@/lib/i18n';
import { useSectionBack } from '@/lib/section-back';
import { parseHydraReview, type HydraReview } from '@/lib/games/hydra-import-records';
import { applyHydraGames, planHydraGames, type HydraGamePlan } from '@/lib/games/hydra-import';
import { readCustomLibrary, type LaunchConfig } from '@/lib/games/custom-library';
import { sourceUrl, sourceError } from '@/lib/games/sources';
import { sourceInputUrl } from '@/lib/games/source-discovery';
import type { CustomGameLibrary } from '@/hooks/use-custom-game-library';
import type { GameSources } from '@/hooks/use-game-sources';
import { GameSourceIcon } from './game-source-icon';
import { HydraOriginalSettings } from './game-hydra-settings';
import './game-hydra-import.css';

const validate = (config: LaunchConfig) => invoke<LaunchConfig>('games_validate_custom_launch', {config});
async function read(profile:string,directory:string,signal:AbortSignal) {
  const session=crypto.randomUUID(),cancel=()=>{void invoke('games_hydra_import_cancel',{profile,session}).catch(()=>{});};
  signal.throwIfAborted();signal.addEventListener('abort',cancel,{once:true});
  try{const result=await invoke('games_hydra_import_review',{args:{profile,session,directory}});signal.throwIfAborted();return parseHydraReview(result);}
  finally{signal.removeEventListener('abort',cancel);}
}
function errorKey(error:unknown) {
  const code=error instanceof Error?error.message:String(error);
  if(code==='hydra_changed')return 'games.hydra.changed';
  if(code==='hydra_space')return 'games.hydra.space';
  if(code==='hydra_busy')return 'games.hydra.busy';
  if(code==='hydra_timeout')return 'games.hydra.timeout';
  if(code==='hydra_limit')return 'games.hydra.limit';
  if(code==='launch_limit')return 'games.custom.launch_limit';
  if(code==='launch_store'||code==='launch_store_write')return 'games.custom.launch_store_write';
  return 'games.hydra.readError';
}
export function GameHydraImport({library,sources,onClose}:{library:CustomGameLibrary;sources:GameSources;onClose:()=>void}) {
  const t=useT(),title=useId(),root=useRef<HTMLDivElement>(null),scroll=useRef<HTMLDivElement>(null),more=useRef<HTMLDivElement>(null);
  const {closing,close}=useModalExit(onClose),live=useRef(true),owner=useRef(library.profile),controller=useRef<AbortController|null>(null),inFlight=useRef(false);
  const [directory,setDirectory]=useState(''),[review,setReview]=useState<HydraReview|null>(null),[plans,setPlans]=useState<HydraGamePlan[]>([]),[selected,setSelected]=useState(new Set<string>()),[query,setQuery]=useState(''),[limit,setLimit]=useState(60);
  const [phase,setPhase]=useState<'idle'|'reading'|'checking'|'applying'>('idle'),[checked,setChecked]=useState(0),[total,setTotal]=useState(0),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [failures,setFailures]=useState<Record<string,string>>({}),[completed,setCompleted]=useState(new Set<string>()),[done,setDone]=useState({games:0,sources:0,existing:0});
  owner.current=library.profile;const profile=library.profile,busy=phase!=='idle';
  const current=()=>live.current&&owner.current===profile&&sources.profile===profile;
  const dismiss=()=>{controller.current?.abort();close();};useSectionBack(dismiss,true);
  useEffect(()=>{
    live.current=true;const origin=document.activeElement as HTMLElement|null;
    root.current?.querySelector<HTMLButtonElement>('[data-hydra-choose]')?.focus({preventScroll:true});
    const trap=(event:KeyboardEvent)=>{
      if(event.key!=='Tab'||!root.current)return;
      const dialog=root.current.closest('[role=dialog]');if([...document.querySelectorAll('[role=dialog][aria-modal=true]')].at(-1)!==dialog)return;
      const nodes=[...root.current.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),summary')].filter(node=>node.getClientRects().length);
      if(event.shiftKey&&(document.activeElement===nodes[0]||!root.current.contains(document.activeElement))){event.preventDefault();nodes.at(-1)?.focus();}
      else if(!event.shiftKey&&(document.activeElement===nodes.at(-1)||!root.current.contains(document.activeElement))){event.preventDefault();nodes[0]?.focus();}
    };
    document.addEventListener('keydown',trap);return()=>{live.current=false;controller.current?.abort();document.removeEventListener('keydown',trap);if(origin?.isConnected)origin.focus({preventScroll:true});};
  },[profile]);
  useEffect(()=>{if(closing)controller.current?.abort();},[closing]);
  useEffect(()=>{if(root.current&&(!(document.activeElement instanceof HTMLElement)||!root.current.contains(document.activeElement)||(document.activeElement as HTMLButtonElement).disabled))root.current.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({preventScroll:true});},[phase,!!review]);
  const known=new Set(sources.sources.map(source=>source.url)), term=query.trim().toLocaleLowerCase();
  const rows=useMemo(()=>[
    ...plans.map(plan=>({key:`game:${plan.original.key}`,name:plan.original.name,plan,source:undefined})),
    ...(review?.report.sources??[]).map(source=>({key:`source:${source.key}`,name:source.name,plan:undefined,source})),
  ],[plans,review]);
  const visible=rows.filter(row=>!term||`${row.name} ${row.source?.url??''}`.toLocaleLowerCase().includes(term));
  const locked=(row:typeof rows[number])=>completed.has(row.key)||!!row.plan?.existing||!!row.source&&known.has(sourceUrl(row.source.url)||sourceInputUrl(row.source.url)||'');
  const chosen=rows.filter(row=>selected.has(row.key)&&!locked(row));
  useEffect(()=>{setLimit(60);scroll.current?.scrollTo({top:0});},[query]);
  useEffect(()=>{if(!more.current||!scroll.current)return;const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))setLimit(value=>value+60);},{root:scroll.current,rootMargin:'160px'});observer.observe(more.current);return()=>observer.disconnect();},[visible.length,limit]);
  const begin=async()=>{
    if(inFlight.current)return;inFlight.current=true;setError('');setNotice('');
    const abort=new AbortController();controller.current=abort;setPhase('reading');
    try{
      const {open}=await import('@tauri-apps/plugin-dialog');const path=await open({directory:true,multiple:false,title:t('games.hydra.choose')});
      if(typeof path!=='string'||!current()||abort.signal.aborted)return;
      setDirectory(path);setReview(null);setPlans([]);setSelected(new Set());setCompleted(new Set());setDone({games:0,sources:0,existing:0});setFailures({});
      const snapshot=await read(profile,path,abort.signal);if(!current())return;
      const values=await planHydraGames(snapshot,readCustomLibrary(profile),abort.signal);
      if(!current()||abort.signal.aborted)return;
      setReview(snapshot);setPlans(values);setLimit(60);setQuery('');
      // Selection is explicit; concealed games and source subscriptions are not enabled implicitly.
      setSelected(new Set());
    }catch(reason){if(current()&&!abort.signal.aborted)setError(errorKey(reason));}
    finally{inFlight.current=false;if(current())setPhase('idle');}
  };
  const apply=async()=>{
    if(!review||!chosen.length||inFlight.current||chosen.some(row=>row.source)&&!sources.ready||!current())return;
    const selection=[...chosen];inFlight.current=true;setPhase('applying');setError('');setNotice('');setFailures({});
    const abort=new AbortController();controller.current=abort;
    try{
      const latest=await read(profile,review.directory,abort.signal);
      if(latest.fingerprint!==review.fingerprint)throw Error('hydra_changed');
      if(!current())return;
      const gameRows=selection.filter(row=>row.plan),sourceRows=selection.filter(row=>row.source);
      if(gameRows.length){
        setPhase('checking');setChecked(0);setTotal(gameRows.length);let lastProgress=0;
        const result=await applyHydraGames(profile,gameRows.map(row=>row.plan!),validate,abort.signal,current,(count,total)=>{
          if(current()&&!abort.signal.aborted&&(count===0||count===total||Date.now()-lastProgress>=100)){lastProgress=Date.now();setChecked(count);}
        });
        if(!current())return;
        setDone(value=>({...value,games:value.games+result.added,existing:value.existing+result.existing}));
        setCompleted(value=>new Set([...value,...gameRows.map(row=>row.key)]));void library.refresh();
      }
      setPhase('applying');
      // Inspect and persist one catalog at a time; large manifests never accumulate in the dialog.
      for(const row of sourceRows){
        abort.signal.throwIfAborted();if(!current())return;
        try{
          const result=await sources.inspect(row.source!.url,abort.signal);
          if(result.kind!=='catalog')throw Error('source_format');
          abort.signal.throwIfAborted();if(!current())return;
          if(!await sources.add(result.url,result.manifest))throw Error('source_storage');
          if(!current())return;setDone(value=>({...value,sources:value.sources+1}));setCompleted(value=>new Set([...value,row.key]));
        }catch(reason){
          if(abort.signal.aborted)throw reason;
          const code=reason instanceof Error?reason.message:String(reason);
          if(code==='source_duplicate'){setDone(value=>({...value,existing:value.existing+1}));setCompleted(value=>new Set([...value,row.key]));}
          else if(current())setFailures(value=>({...value,[row.key]:sourceError(reason)}));
        }
      }
    }catch(reason){if(current())abort.signal.aborted?setNotice('games.hydra.stopped'):setError(errorKey(reason));}
    finally{inFlight.current=false;if(current())setPhase('idle');}
  };
  const toggle=(key:string)=>setSelected(value=>{const next=new Set(value);next.has(key)?next.delete(key):next.add(key);return next;});
  return <ModalShell closing={closing} onDismiss={dismiss} labelledBy={title} width={760} backdropClassName="games-hydra-backdrop"><div className="games-hydra-import" ref={root}>
    <header><div><FileUp size={23} aria-hidden="true"/><h2 id={title}>{t('games.hydra.title')}</h2></div><button className="games-icon-button" onClick={dismiss} aria-label={t('common.close')}><X size={19}/></button></header>
    <p className="games-hydra-intro">{t('games.hydra.note')}</p>
    <div className="games-hydra-location"><button className="games-button" data-hydra-choose disabled={busy} onClick={()=>void begin()}><FolderOpen size={17}/>{t('games.hydra.choose')}</button>{directory&&<bdi title={directory}>{directory}</bdi>}</div>
    {busy&&<p className="games-hydra-status" role="status">{t(phase==='reading'?'games.hydra.reading':phase==='checking'?'games.hydra.checking':'games.hydra.applying',{count:checked,total})}</p>}
    {!!review&&<>
      <div className="games-hydra-tools"><label><Search size={17}/><input value={query} maxLength={200} onChange={event=>setQuery(event.target.value)} placeholder={t('games.hydra.search')} aria-label={t('games.hydra.search')}/></label><div><button className="games-button" disabled={busy} onClick={()=>setSelected(value=>new Set([...value,...visible.filter(row=>!locked(row)).map(row=>row.key)]))}>{t('games.hydra.select')}</button><button className="games-button" disabled={busy||!selected.size} onClick={()=>setSelected(new Set())}>{t('games.hydra.clear')}</button></div></div>
      <div className="games-hydra-list" ref={scroll}>
        <p className="games-hydra-count">{t('games.hydra.count',{games:plans.length,sources:review.report.sources.length})}</p>
        {visible.slice(0,limit).map(row=><article key={row.key} className="games-hydra-row"><label><input type="checkbox" checked={selected.has(row.key)&&!locked(row)} disabled={busy||locked(row)} onChange={()=>toggle(row.key)}/>{row.source?<GameSourceIcon url={row.source.url} name={row.name} className="games-hydra-mark"/>:<GamesIcon size={25}/>}<span><strong>{row.name}</strong><small>{t(completed.has(row.key)?'games.hydra.imported':locked(row)?row.source?'games.hydra.sourceExists':'games.steamImport.existing':row.plan?row.plan.checkOnImport?'games.hydra.checkOnImport':row.plan.pending?row.plan.original.executable?'games.hydra.pending':'games.hydra.missing':'games.hydra.ready':'games.sources.manage')}</small>{row.source&&<small><bdi>{new URL(row.source.url).hostname}</bdi></small>}</span></label>{row.plan&&<HydraOriginalSettings game={row.plan.original} pending={row.plan.pending&&!row.plan.checkOnImport&&!row.plan.existing}/>}{failures[row.key]&&<p role="alert">{t(failures[row.key])}</p>}</article>)}
        {!visible.length&&<p className="games-hydra-status">{t('games.noResults')}</p>}{visible.length>limit&&<div ref={more} className="games-hydra-more" aria-hidden="true"/>}
        {(review.report.invalidGames+review.report.invalidSources+review.report.deletedGames)>0&&<p className="games-hydra-status">{t('games.hydra.skipped',{count:review.report.invalidGames+review.report.invalidSources+review.report.deletedGames})}</p>}
      </div>
    </>}
    {(done.games+done.sources+done.existing)>0&&<p className="games-hydra-status" role="status">{t('games.hydra.done',done)}{done.existing>0&&<> {t('games.hydra.kept',{count:done.existing})}</>}</p>}
    {notice&&<p className="games-hydra-status" role="status">{t(notice)}</p>}{error&&<p className="games-hydra-error" role="alert">{t(error)}</p>}
    <footer><p>{t('games.hydra.scope')}</p>{busy?<button className="games-button" onClick={()=>{controller.current?.abort();setNotice('games.hydra.stopped');}}>{t('common.cancel')}</button>:<button className="games-button games-button-primary" disabled={!chosen.length||chosen.some(row=>row.source)&&!sources.ready} onClick={()=>void apply()}><FileUp size={16}/>{t('games.hydra.apply',{count:chosen.length})}</button>}</footer>
  </div></ModalShell>;
}
