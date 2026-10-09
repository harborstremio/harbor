import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, Layers, Link2, Search } from 'lucide-react';
import { Row } from '@/components/row';
import { Dropdown } from '@/components/dropdown';
import { useT } from '@/lib/i18n';
import { useRecentSourceBrowse } from '@/hooks/use-recent-source-browse';
import type { RecentSourceRelease } from '@/lib/games/recent-sources';
import type { SourceGameArtwork } from '@/lib/games/source-display';
import type { GameSummary } from '@/lib/games/types';
import type { GameSources } from '@/hooks/use-game-sources';
import type { GameTransfers } from '@/hooks/use-game-transfers';
import { GameSourceFailures } from './game-source-failures';
import { GameSourceIcon } from './game-source-icon';
import { RecentSourceDialog } from './game-recent-dialog';
import { RecentSourceCard } from './game-recent-card';
import './game-recent-sources.css';
import './game-rails.css';

function RecentRailTail({active,loading,more}:{active:boolean;loading:boolean;more:()=>void}) {
 const ref=useRef<HTMLDivElement>(null),next=useRef(more);next.current=more;
 useEffect(()=>{
  const node=ref.current;if(!node||!active||loading)return;
  // Re-observe after a batch settles, even if the user is still at the same edge.
  const observer=new IntersectionObserver(events=>{if(events.some(event=>event.isIntersecting))next.current();},{root:node.closest('.harbor-row-track'),rootMargin:'0px 800px'});
  observer.observe(node);return()=>observer.disconnect();
 },[active,loading]);
 return <div ref={ref} className="games-recent-skeleton" aria-hidden="true"/>;
}

export function GameRecentSources({sources,downloads,active,manage,open,browse,full=false,back,shellBackAvailable=false}:{
 sources:GameSources;downloads:GameTransfers;active:boolean;manage:()=>void;open:(game:GameSummary,origin?:HTMLElement)=>void;
 browse?:()=>void;full?:boolean;back?:()=>void;shellBackAvailable?:boolean;
}) {
 const t=useT(),root=useRef<HTMLElement>(null),sentinel=useRef<HTMLDivElement>(null),heading=useId();
 const [near,setNear]=useState(false),[sourceId,setSourceId]=useState('all'),[query,setQuery]=useState(''),[sort,setSort]=useState<'newest'|'oldest'>('newest'),[period,setPeriod]=useState('all');
 const [selection,setSelection]=useState<{item:RecentSourceRelease;art:SourceGameArtwork|null|undefined}>(),[detailError,setDetailError]=useState(false);
 const now=useMemo(()=>Date.now(),[sources.sources]);
 const enabled=useMemo(()=>sources.sources.filter(source=>source.enabled),[sources.sources]);
 const filtered=useMemo(()=>enabled.filter(source=>sourceId==='all'||source.id===sourceId),[enabled,sourceId]);
 const filters=useMemo(()=>({query,sort,since:period==='all'?0:now-Number(period)*86400000,now}),[query,sort,period,now]);
 const recent=useRecentSourceBrowse(filtered,filters,active&&near&&sources.ready);
 const loading=sources.loading||recent.loading,entries=recent.entries;
 useEffect(()=>{if(sourceId!=='all'&&!enabled.some(source=>source.id===sourceId))setSourceId('all');},[enabled,sourceId]);
 const visible=full||!sources.ready||enabled.length>0;
 useEffect(()=>{const node=root.current;if(!node)return;const observer=new IntersectionObserver(events=>setNear(events.some(event=>event.isIntersecting)),{rootMargin:'350px'});observer.observe(node);return()=>observer.disconnect();},[visible]);
 useEffect(()=>{if(!active)setSelection(undefined);setDetailError(false);},[active,sourceId,query,sort,period]);
 useEffect(()=>{
  const node=sentinel.current;if(!full||!active||!node||loading||recent.failed.length||!recent.hasMore)return;
  const observer=new IntersectionObserver(events=>{if(events.some(event=>event.isIntersecting))recent.more();},{rootMargin:'600px'});observer.observe(node);return()=>observer.disconnect();
 },[full,active,loading,recent.hasMore,recent.failed.length,entries.length]);
 const publish=(key:string,art:SourceGameArtwork|null)=>setSelection(previous=>previous?.item.key===key?{...previous,art}:previous);
 const cards=entries.map(item=><RecentSourceCard key={item.key+':'+item.source.id} item={item} active={active&&near} downloads={downloads} open={open} files={(item,art)=>{setDetailError(false);setSelection({item,art});}} publish={publish} error={()=>setDetailError(true)}/>);
 const continuation=!full&&recent.hasMore&&!recent.failed.length;
 // Replace the old tail when cards arrive so scroll snap cannot follow it to the new end.
 const placeholders=loading||continuation?Array.from({length:full?12:6},(_,i)=>i===0&&continuation?<RecentRailTail key={`recent-loading-${entries.length}-0`} active={active&&near&&sources.ready} loading={loading} more={recent.more}/>:<div key={`recent-loading-${entries.length}-${i}`} className="games-recent-skeleton" aria-hidden="true"/>):null;
 if(!visible)return null;
 return <section ref={root} className={`games-section games-inset games-recent-sources${full?' games-recent-page':''}`} aria-labelledby={heading}>
  {full&&!shellBackAvailable&&<button className="games-text-action games-recent-back" onClick={back}><ArrowLeft size={18}/>{t('common.back')}</button>}
  <div className="games-section-heading"><div>{full?<h1 id={heading} tabIndex={-1}>{t('games.recent.title')}</h1>:<h2 id={heading}>{t('games.recent.title')}</h2>}<p>{t('games.recent.note')}</p></div><div className="games-recent-controls"><button className="games-text-action" onClick={manage}>{t('games.sources.manage')}<ArrowUpRight size={16}/></button>{!full&&browse&&<button className="games-text-action" onClick={browse}>{t('games.recent.viewAll')}<ArrowRight size={16}/></button>}</div></div>
  {full&&<div className="games-recent-filters">
   <div className="games-search"><Search size={17}/><input value={query} onChange={event=>setQuery(event.target.value)} maxLength={500} aria-label={t('games.recent.search')} placeholder={t('games.recent.search')}/></div>
   <Dropdown value={sourceId} onChange={setSourceId} ariaLabel={t('games.recent.source')} options={[{value:'all',label:t('games.unified.allSources'),left:<Layers size={17}/>},...enabled.map(source=>({value:source.id,label:source.name,left:<GameSourceIcon className="games-recent-filter-icon" url={source.url} homepage={source.homepage} icon={source.icon} name={source.name}/>}))]}/>
   <Dropdown value={period} onChange={setPeriod} ariaLabel={t('games.recent.date')} options={[{value:'all',label:t('games.guides.date.all'),left:<CalendarDays size={16}/>},{value:'7',label:t('games.guides.date.week')},{value:'30',label:t('games.guides.date.month')}]}/>
   <Dropdown value={sort} onChange={value=>setSort(value as 'newest'|'oldest')} ariaLabel={t('games.recent.sort')} options={[{value:'newest',label:t('games.roms.sort.newest')},{value:'oldest',label:t('games.roms.sort.oldest')}]}/>
  </div>}
  {full?<div className="games-recent-grid" aria-busy={loading}>{cards}{placeholders}</div>:<Row className="games-content-rail" min={144} shape="portrait" scrollKey={`games:recent-sources:${sources.profile}`} onEndReached={recent.more}>{cards}{placeholders}</Row>}
  {full&&recent.hasMore&&!recent.failed.length&&<div ref={sentinel} className="games-recent-continuation"><button className="games-button" disabled={loading} onClick={recent.more}>{t(loading?'common.loading':'games.catalog.more')}</button></div>}
  {detailError&&<p className="games-inline-status" role="alert">{t('games.launchers.unavailable')}</p>}
  {!sources.loading&&!sources.ready?<div className="games-inline-status" role="alert"><span>{t(sources.error)}</span><button className="games-button" onClick={()=>void sources.reload()}>{t('common.retry')}</button></div>:recent.failed.length?<GameSourceFailures error="games.sources.partialRecent" failed={recent.failed} busy={loading} retry={()=>sources.sources.some(item=>item.catalogIssue)?void sources.reload():recent.retry()} manage={manage}/>:!loading&&!entries.length&&<div className="games-recent-empty"><Link2 size={24}/><p>{t(!enabled.length?'games.recent.empty':full&&(query||sourceId!=='all'||period!=='all')?'games.noResults':'games.recent.undated')}</p><button className="games-button" onClick={()=>{if(full&&enabled.length){setQuery('');setSourceId('all');setPeriod('all');setSort('newest');}else manage();}}>{t(full&&enabled.length?'games.catalog.reset':'games.sources.manage')}</button></div>}
  {active&&selection&&<RecentSourceDialog key={selection.item.key} item={selection.item} art={selection.art??undefined} loading={selection.art===undefined} downloads={downloads} close={()=>setSelection(undefined)} open={open}/>}
 </section>;
}
