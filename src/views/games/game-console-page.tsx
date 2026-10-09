import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, Search, X } from 'lucide-react';
import { Play } from "@/components/icons/play-filled";
import { RomStudioFilter } from "./rom-studio-filter";
import { RomPendingCards } from "./rom-continuation";
import { Row } from '@/components/row';
import { Dropdown } from '@/components/dropdown';
import { useT } from '@/lib/i18n';
import { EMULATION_SYSTEMS } from '@/lib/games/emulation';
import { DEFAULT_ROM_FILTERS, ROM_PLATFORMS, type RomDiscoveryFilters, type RomFranchise } from '@/lib/games/rom-discovery';
import { romCollections } from '@/lib/games/rom-presentation';
import type { GameConnection } from '@/lib/games/igdb-data';
import type { GameSummary } from '@/lib/games/types';
import { GameArt } from './game-art';
import { GameHeroLogo } from './game-hero-logo';
import { romGameArtwork } from '@/lib/games/rom-editorial';
import { GameSkeleton } from './game-loading';
import { GameDataStatus } from './game-data-status';
import { RomCard } from './game-roms';
import { RomCollections } from './game-rom-sections';
import { useRomPage } from './use-rom-page';
import './game-console-page.css';
import './game-rails.css';

type PageData=ReturnType<typeof useRomPage>;
const connections=(items:GameConnection[])=>[...new Map(items.map(item=>[item.id,item])).values()].sort((a,b)=>a.name.localeCompare(b.name));
function ConsoleShelf({data,title,note,platform,open,browse}:{data:PageData;title:string;note:string;platform:number;open:(game:GameSummary)=>void;browse:()=>void}) {
 const t=useT();
 return <section className="games-section games-console-shelf"><div className="games-section-heading"><div><h2>{title}</h2><p>{note}</p></div><button className="games-text-action" onClick={browse}>{t('games.roms.seeAll')}</button></div>
  <Row className="games-content-rail" min={144} shape="portrait" scrollKey={`games:console:${platform}:${title}`} onEndReached={()=>{if(!data.busy&&!data.failed&&data.page?.nextOffset!=null)void data.more();}}>
   {data.page?.games.map(game=><RomCard key={game.igdbId} game={game} platform={platform} open={open}/>)}
   {data.busy&&Array.from({length:6},(_,i)=><GameSkeleton key={`loading-${data.page?.games.length??0}-${i}`} className="games-skeleton-poster"/>)}
  </Row>
  {data.failed&&<div className="games-inline-status" role="alert"><span>{t('games.atlas.error')}</span><button className="games-text-action" onClick={data.retry}>{t('common.retry')}</button></div>}
  {!data.busy&&!data.failed&&!data.page?.games.length&&<p className="games-inline-status">{t('games.roms.noCollection')}</p>}
 </section>;
}

export function GameConsolePage({platform,active,open,back,emulate,menu,shellBackAvailable=false}:{platform:typeof ROM_PLATFORMS[number];active:boolean;open:(game:GameSummary)=>void;back:()=>void;emulate:(id:number)=>void;menu?:ReactNode;shellBackAvailable?:boolean}) {
 const t=useT(),catalogRoot=useRef<HTMLElement>(null),tail=useRef<HTMLDivElement>(null);
 const defaults=useMemo<RomDiscoveryFilters>(()=>({...DEFAULT_ROM_FILTERS,scope:'classics',platform:platform.id}),[platform.id]);
 const [filters,setFilters]=useState(defaults),[near,setNear]=useState(false),[allCollections,setAllCollections]=useState(false),[relationship,setRelationship]=useState('');
 const popular=useRomPage(defaults,active),rated=useRomPage({...defaults,collection:'rated',sort:'rated'},active&&!!popular.page);
 const catalog=useRomPage(filters,active&&near),games=catalog.page?.games??[];
 const library=useMemo(()=>[...new Map([...(popular.page?.games??[]),...(rated.page?.games??[]),...games].map(game=>[game.igdbId,game])).values()],[popular.page,rated.page,catalog.page]);
 const groups=useMemo(()=>romCollections(library),[library]);
 const genreOptions=useMemo(()=>connections(library.flatMap(game=>game.genres)),[library]);
 const modeOptions=useMemo(()=>connections(library.flatMap(game=>game.modes)),[library]);
 const perspectiveOptions=useMemo(()=>connections(library.flatMap(game=>game.perspectives)),[library]);
 const feature=popular.page?.games.find(game=>game.screenshots.length>0||game.hero&&game.hero!==game.portrait);
 const more=useRef(catalog.more);more.current=catalog.more;
 useEffect(()=>{
  const node=catalogRoot.current;if(!active||!node)return;
  const observer=new IntersectionObserver(events=>{if(events.some(event=>event.isIntersecting))setNear(true);},{root:node.closest('.games-view'),rootMargin:'600px'});
  observer.observe(node);return()=>observer.disconnect();
 },[active]);
 useEffect(()=>{
  const node=tail.current;if(!active||!near||!node||catalog.busy||catalog.failed||catalog.page?.nextOffset==null)return;
  const observer=new IntersectionObserver(events=>{if(events.some(event=>event.isIntersecting))void more.current();},{root:node.closest('.games-view'),rootMargin:'1000px'});
  observer.observe(node);return()=>observer.disconnect();
 },[active,near,catalog.busy,catalog.failed,catalog.page?.nextOffset]);
 const showCatalog=(change:Partial<RomDiscoveryFilters>={},name='')=>{
  setFilters({...defaults,...change});setRelationship(name);setNear(true);
  requestAnimationFrame(()=>{catalogRoot.current?.scrollIntoView({block:'start',behavior:'instant'});catalogRoot.current?.querySelector<HTMLElement>('h2')?.focus({preventScroll:true});});
 };
 const chooseCollection=(group:RomFranchise)=>showCatalog({relationship:{kind:group.kind,id:group.id}},group.name);
 const changed=!!(filters.query||filters.studio||filters.genre||filters.mode||filters.perspective||filters.relationship||filters.era!=='all'||filters.collection&&filters.collection!=='all'||filters.sort!=='discussed');
 return <article className={`games-atlas-page games-console-page${filters.query ? " is-searching" : ""}`}>
  {menu&&<header className="games-mast games-inset"><div className="games-mast-title"><strong>{t('nav.games')}</strong></div>{menu}<div className="games-search"><Search size={17}/><input aria-label={`${t('games.roms.search')} · ${platform.name}`} placeholder={`${t('games.search')} · ${platform.short}`} value={filters.query} onChange={event=>{setNear(true);setFilters(value=>({...value,query:event.target.value}));}} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();catalogRoot.current?.scrollIntoView({block:'start',behavior:'instant'});}}}/>{filters.query&&<button className="games-icon-button" aria-label={t('games.clear')} onClick={()=>setFilters(value=>({...value,query:''}))}><X size={16}/></button>}</div></header>}
  <header className="games-console-hero">
   {feature&&<GameArt className="games-console-hero-art" src={feature.hero||feature.screenshots[0]} eager/>}<div className="games-console-hero-shade"/>
   <div className="games-inset games-console-hero-content">
    {!shellBackAvailable&&<button className="games-text-action games-console-back" onClick={back}><ArrowLeft size={17}/>{t('common.back')}</button>}
    <h1 className="games-console-brand" tabIndex={-1}><GameHeroLogo key={platform.id} className="games-console-brand-logo" sources={[platform.image]} name={platform.name} platformIds={[]} ready active={active}/><span>{platform.name}</span></h1>
    {feature?<div className="games-console-feature"><span>{t('games.roms.featured')} · {platform.name}</span><div className="games-console-game-identity"><GameHeroLogo key={feature.id} className="games-console-game-logo" sources={[romGameArtwork(feature.igdbId)?.logo]} name={feature.name} platformIds={[platform.id]} alternativeNames={feature.alternativeTitles?.map(title=>title.name)} gameType={feature.gameType} ready active={active}/><h2>{feature.name}</h2></div><p>{feature.description}</p><div className="games-actions"><button className="games-button games-button-primary" data-game={feature.id} onClick={()=>open(feature)}><Play size={17}/>{t('games.discovery.viewGame')}</button><button className="games-text-action" onClick={()=>showCatalog()}>{t('games.roms.allGames')}</button></div></div>:<div className="games-console-feature">{popular.busy?<><GameSkeleton className="games-skeleton-title"/><GameSkeleton className="games-skeleton-logo"/></>:<><p>{t(popular.failed?'games.atlas.error':'games.roms.noCollection')}</p><button className="games-button" onClick={popular.failed?popular.retry:()=>showCatalog()}>{t(popular.failed?'common.retry':'games.roms.allGames')}</button></>}</div>}
   </div>
  </header>
  <div className="games-inset games-console-body">
   <nav className="games-console-jumps" aria-label={platform.name}><button className="games-text-action" onClick={()=>showCatalog()}>{t('games.roms.allGames')}</button>{(['rated','coop','rpg','platformer'] as const).map(collection=><button key={collection} className="games-text-action" onClick={()=>showCatalog({collection,sort:collection==='rated'?'rated':'discussed'})}>{t(`games.roms.${collection}`)}</button>)}{EMULATION_SYSTEMS.some(system=>system.id===platform.id)&&<button className="games-text-action" onClick={()=>emulate(platform.id)}>{t('games.roms.openLibrary')}</button>}</nav>
   <div hidden={!!filters.query}><ConsoleShelf data={popular} title={t('games.roms.popular')} note={t('games.roms.popularNote')} platform={platform.id} open={open} browse={()=>showCatalog()}/>
   <ConsoleShelf data={rated} title={t('games.roms.rated')} note={t('games.roms.ratedNote')} platform={platform.id} open={open} browse={()=>showCatalog({collection:'rated',sort:'rated'})}/>
   {!!groups.length&&<RomCollections groups={groups} all={allCollections} busy={popular.busy||rated.busy} choose={chooseCollection} more={()=>setAllCollections(true)}/>}</div>
   <section ref={catalogRoot} className="games-section games-console-catalog">
    <div className="games-section-heading"><div><span className="games-section-kicker">{platform.name}</span><h2 tabIndex={-1}>{relationship||t(`games.roms.${filters.collection&&filters.collection!=='all'?filters.collection:'allGames'}`)}</h2><p>{t('games.roms.catalogNote')}</p></div>{changed&&<button className="games-text-action" onClick={()=>showCatalog()}><X size={16}/>{t('games.roms.reset')}</button>}</div>
    <div className="games-console-filters"><div className="games-search"><Search size={17}/><input aria-label={t('games.roms.search')} placeholder={t('games.roms.search')} value={filters.query} onChange={event=>setFilters(value=>({...value,query:event.target.value}))}/></div>
     <RomStudioFilter value={filters.studio} games={library} onChange={studio=>setFilters(old=>({...old,studio}))}/>
     <Dropdown ariaLabel={t('games.roms.genre')} value={String(filters.genre??'all')} onChange={value=>setFilters(old=>({...old,genre:value==='all'?undefined:Number(value)}))} options={[{value:'all',label:t('games.roms.allGenres')},...genreOptions.map(item=>({value:String(item.id),label:item.name}))]}/>
     <Dropdown ariaLabel={t('games.atlas.kind.mode')} value={String(filters.mode??'all')} onChange={value=>setFilters(old=>({...old,mode:value==='all'?undefined:Number(value)}))} options={[{value:'all',label:t('games.atlas.kind.mode')},...modeOptions.map(item=>({value:String(item.id),label:item.name}))]}/>
     <Dropdown ariaLabel={t('games.atlas.kind.perspective')} value={String(filters.perspective??'all')} onChange={value=>setFilters(old=>({...old,perspective:value==='all'?undefined:Number(value)}))} options={[{value:'all',label:t('games.atlas.kind.perspective')},...perspectiveOptions.map(item=>({value:String(item.id),label:item.name}))]}/>
     <Dropdown ariaLabel={t('games.roms.era')} value={filters.era} onChange={value=>setFilters(old=>({...old,era:value as RomDiscoveryFilters['era']}))} options={['all','before1990','1990','2000','2010','2020'].map(value=>({value,label:t(`games.atlas.era.${value}`)}))}/>
     <Dropdown ariaLabel={t('games.catalog.sort')} value={filters.sort} onChange={value=>setFilters(old=>({...old,sort:value as RomDiscoveryFilters['sort']}))} options={['discussed','rated','newest','oldest','name'].map(value=>({value,label:t(`games.roms.sort.${value}`)}))}/>
    </div>
    <div className="games-console-count" role="status">{t(catalog.page?'games.catalog.showing':'games.atlas.loading',{count:games.length})}</div>
    <div className="games-rom-grid games-rom-catalog-grid" aria-busy={catalog.busy}>{games.map(game=><RomCard key={game.igdbId} game={game} platform={platform.id} open={open}/>)}{!catalog.failed&&(catalog.busy||catalog.page?.nextOffset!=null)&&<RomPendingCards/>}</div>
    <div ref={tail} className="games-console-continuation"/>
    {catalog.failed&&<div className="games-state" role="alert"><p>{t('games.atlas.error')}</p><button className="games-button" onClick={catalog.retry}>{t('common.retry')}</button></div>}
    {!catalog.busy&&!catalog.failed&&!games.length&&<div className="games-state"><h3>{t('games.noResults')}</h3><p>{t('games.roms.empty')}</p><button className="games-button" onClick={()=>showCatalog()}>{t('games.roms.reset')}</button></div>}
    <GameDataStatus at={catalog.page?.cachedAt} busy={catalog.busy} refresh={catalog.retry}/>
   </section><p className="games-rom-source">{t('games.roms.source')}</p>
  </div>
 </article>;
}
