import { NavChevron } from "@/components/nav-arrow";
import { useEffect, useRef, useState } from "react";
import { useT, useUiLanguage } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { loadMostPlayedGames, type GameHighlight } from "@/lib/games/catalog";
import { loadGameNews } from "@/lib/games/community-fetch";
import type { GameNews } from "@/lib/games/community";
import type { GameSummary } from "@/lib/games/types";
import { GameArt } from "./game-art";
import { GameHeroLogo } from "./game-hero-logo";
import { useLiveRefresh } from "./use-live-refresh";

type Update = GameNews & { game:GameHighlight };
function NewsPlaceholder({feature=false,hidden=false}:{feature?:boolean;hidden?:boolean}) {
  return <article className={`${feature?'is-feature ':''}games-feed-placeholder${hidden?' is-ghost':''}`} aria-hidden="true">
    <div className="games-feed-article"><div className="games-feed-art"/><div className="games-feed-copy"><time>&nbsp;</time><h3><i/><i/></h3><p><i/><i/></p></div></div>
    <div className="games-feed-game"><i/><span/></div>
  </article>;
}
export function GameNewsFeed({active,open}:{active:boolean;open:(game:GameSummary)=>void}) {
  const t=useT(),language=useUiLanguage(),root=useRef<HTMLElement>(null),[seen,setSeen]=useState(false),[items,setItems]=useState<Update[]>([]),[loading,setLoading]=useState(false),[loaded,setLoaded]=useState(false),[failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0),[page,setPage]=useState(0);
  const refresh=useLiveRefresh(active&&seen,11*60_000);
  useEffect(()=>{const node=root.current;if(!node)return;const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setSeen(true);observer.disconnect();}},{rootMargin:'350px'});observer.observe(node);return()=>observer.disconnect();},[]);
  useEffect(()=>{
    if(!active||!seen)return;
    const request=new AbortController();setLoading(true);setFailed(false);
    void loadMostPlayedGames().then(async chart=>{
      const games=chart.games.slice(0,10),results=await Promise.allSettled(games.map(game=>loadGameNews(game.steamId!,request.signal).then(news=>news.filter(item=>item.date*1000<=Date.now()+300_000&&item.date*1000>=Date.now()-90*86400_000).slice(0,1).map(item=>({...item,game})))));
      if(request.signal.aborted)return;
      if(results.every(result=>result.status==='rejected'))throw Error('News unavailable');
      const updates=results.flatMap(result=>result.status==='fulfilled'?result.value:[]).sort((a,b)=>b.date-a.date);
      setItems(updates);setLoaded(true);
    }).catch(()=>{if(!request.signal.aborted)setFailed(true);}).finally(()=>{if(!request.signal.aborted)setLoading(false);});
    return()=>request.abort();
  },[active,seen,attempt,refresh]);
  const pages=Math.ceil(items.length/3),current=Math.min(page,Math.max(0,pages-1));
  const visible=items.slice(current*3,current*3+3),initialLoading=!loaded&&!failed&&!items.length;
  return <section ref={root} className="games-section games-inset games-news-feed" aria-busy={loading}>
    <div className="games-section-heading"><div><h2>{t('games.feed.title')}</h2><p>{t('games.feed.note')}</p></div><div className="games-page-controls"><button className="games-text-action games-feed-refresh" disabled={loading} onClick={()=>setAttempt(n=>n+1)}><span aria-hidden={loading}>{t('games.feed.refresh')}</span><span aria-hidden={!loading}>{t('games.feed.refreshing')}</span></button><div className="games-page-controls games-feed-pagination" aria-hidden={pages<2}><button className="games-icon-button" disabled={!current||pages<2} aria-label={t('common.previous')} onClick={()=>setPage(current-1)}><NavChevron dir="left" size={18}/></button><button className="games-icon-button" disabled={current===pages-1||pages<2} aria-label={t('common.next')} onClick={()=>setPage(current+1)}><NavChevron dir="right" size={18}/></button></div></div></div>
    {(!!items.length||initialLoading)&&<div className="games-feed-grid">{visible.map((item,index)=><article key={item.id} className={index===0?'is-feature':''}>
      <a className="games-feed-article" href={item.url} target="_blank" rel="noreferrer" onClick={event=>{event.preventDefault();openUrl(item.url);}}><div className="games-feed-art"><GameArt src={item.image||item.game.capsule} fallback={item.game.capsule}/></div><div className="games-feed-copy"><time dateTime={new Date(item.date*1000).toISOString()}>{new Date(item.date*1000).toLocaleDateString(language,{month:'short',day:'numeric',year:'numeric'})}</time><h3>{item.title}</h3><p>{item.body}</p></div></a>
      <button className="games-feed-game" onClick={()=>open(item.game)} aria-label={item.game.name}>
        <GameHeroLogo className="games-feed-logo" sources={[]} name={item.game.name} steamId={item.game.steamId} platformIds={[]} ready active={active} preferCurrentSteamLogo/>
        <span className="games-feed-identity"><strong>{item.game.name}</strong>{!!item.game.publishers?.length&&<small>{t("games.publisher")} · {item.game.publishers.join(" · ")}</small>}</span>
      </button>
    </article>)}{Array.from({length:3-visible.length},(_,index)=><NewsPlaceholder key={`placeholder-${index}`} feature={!visible.length&&index===0} hidden={!initialLoading}/>)}</div>}
    {initialLoading&&<span className="sr-only" role="status">{t('common.loading')}</span>}
    {failed&&<div className="games-inline-status" role="alert"><span>{t('games.feed.error')}</span><button className="games-button" onClick={()=>setAttempt(n=>n+1)}>{t('common.retry')}</button></div>}
    {loaded&&!items.length&&!loading&&!failed&&<p className="games-inline-status">{t('games.feed.empty')}</p>}
    {(!!items.length||initialLoading)&&<p className="games-feed-source" aria-hidden={initialLoading} style={initialLoading?{visibility:'hidden'}:undefined}>{t('games.feed.source')}</p>}
  </section>;
}
