import { useEffect, useRef, useState } from "react";
import { observeWithin } from "@/lib/visibility";
import { ArrowUpRight, ChevronDown, RefreshCw } from "lucide-react";
import { NavChevron } from "@/components/nav-arrow";
import { HoverTooltip } from "@/components/hover-tooltip";
import { useT, useUiLanguage } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { LIBRARY_NEWS_BATCH, libraryNewsCollapsed, libraryNewsGames, libraryNewsItems, mergeLibraryNews, saveLibraryNewsCollapsed, type LibraryNewsFeed } from "@/lib/games/library-news";
import { loadLibraryNews, type LibraryNewsRequest } from "@/lib/games/library-news-load";
import type { GameSummary } from "@/lib/games/types";
import type { UnifiedLibraryGame } from "@/lib/games/unified-library";
import { GameArt } from "./game-art";
import { useLiveRefresh } from "./use-live-refresh";
import "./game-library-news.css";

type Props = { profile:string; games:UnifiedLibraryGame[]; active:boolean; open:(game:GameSummary,origin?:HTMLElement)=>void; request?:LibraryNewsRequest };
export function GameLibraryNews({games,...props}:Props) {
  const targets = libraryNewsGames(games);
  // Hide removed/private/filtered memberships immediately, before effects can run.
  return targets.length ? <LibraryNews key={`${props.profile}:${targets.map(game=>game.steamId).sort((a,b)=>a!-b!).join(",")}`} {...props} targets={targets}/> : null;
}

function LibraryNews({profile,targets:currentTargets,active,open,request}:Omit<Props,"games"> & {targets:GameSummary[]}) {
  // A new recent/pinned order must not discard checked feeds or a reader's page.
  const order=useRef(currentTargets.map(game=>game.steamId!));
  const byId=new Map(currentTargets.map(game=>[game.steamId,game])), targets=order.current.map(id=>byId.get(id)!);
  const t=useT(), language=useUiLanguage(), root=useRef<HTMLElement>(null), lastAttempt=useRef(0), lastLimit=useRef(0), retryButton=useRef<HTMLButtonElement>(null), refreshButton=useRef<HTMLButtonElement>(null);
  const [collapsed,setCollapsed]=useState(()=>libraryNewsCollapsed(profile)), [seen,setSeen]=useState(false), [capacity,setCapacity]=useState(3);
  const [limit,setLimit]=useState(LIBRARY_NEWS_BATCH), [feeds,setFeeds]=useState<LibraryNewsFeed[]>([]), [loading,setLoading]=useState(true), [attempt,setAttempt]=useState(0), [page,setPage]=useState(0);
  const refresh=useLiveRefresh(active&&seen&&!collapsed,11*60_000);
  useEffect(()=>{
    const node=root.current;if(!node)return;
    return observeWithin(node, "300px", entry => { if (entry.isIntersecting) setSeen(true); });
  },[]);
  useEffect(()=>{
    const node=root.current;if(!node)return;
    const observer=new ResizeObserver(entries=>setCapacity(entries[0].contentRect.width<520?1:entries[0].contentRect.width<820?2:3));
    observer.observe(node);return()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    if(!active||!seen||collapsed)return;
    const controller=new AbortController(), expansion=lastLimit.current>0&&limit>lastLimit.current, batch=targets.slice(expansion?lastLimit.current:0,limit);
    lastLimit.current=limit;
    const force=attempt!==lastAttempt.current;lastAttempt.current=attempt;
    setLoading(true);
    void loadLibraryNews(batch,controller.signal,request,undefined,force).then(results=>{
      if(!controller.signal.aborted){
        const recoverFocus=document.activeElement===retryButton.current&&results.every(result=>result.status==="fulfilled");
        setFeeds(previous=>{
          const changed=mergeLibraryNews(batch,results,previous), byId=new Map([...previous,...changed].map(feed=>[feed.game.steamId,feed]));
          return targets.slice(0,limit).flatMap(game=>byId.get(game.steamId)??[]);
        });
        if(recoverFocus)requestAnimationFrame(()=>refreshButton.current?.focus({preventScroll:true}));
      }
    }).finally(()=>{if(!controller.signal.aborted)setLoading(false);}).catch(()=>{});
    return()=>controller.abort();
  },[active,seen,collapsed,limit,attempt,refresh,request]);
  const items=libraryNewsItems(feeds), failed=feeds.filter(feed=>feed.unavailable).length;
  const pages=Math.ceil(items.length/capacity), current=Math.min(page,Math.max(0,pages-1)), visible=items.slice(current*capacity,current*capacity+capacity);
  const initial=loading&&!feeds.length;
  const toggle=()=>setCollapsed(value=>{saveLibraryNewsCollapsed(profile,!value);return !value;});
  const retry=()=>{setAttempt(value=>value+1);};
  return <section ref={root} className="games-library-news" aria-label={t("games.libraryNews.title")}>
    <div className="games-library-news-heading"><h3><button className="games-library-news-toggle" aria-expanded={!collapsed} aria-label={t(collapsed?"games.libraryNews.show":"games.libraryNews.hide")} onClick={toggle}>{t("games.libraryNews.title")}<ChevronDown size={16}/></button></h3>
      {!collapsed&&<div className="games-page-controls"><HoverTooltip label={t("games.libraryNews.refresh")}><button ref={refreshButton} className="games-icon-button" aria-label={t("games.libraryNews.refresh")} aria-disabled={loading} onClick={()=>{if(!loading)retry();}}><RefreshCw size={15} className={loading?"is-scanning":""}/></button></HoverTooltip>{pages>1&&<><span>{current+1} / {pages}</span><button className="games-icon-button" disabled={!current} aria-label={t("common.previous")} onClick={()=>setPage(current-1)}><NavChevron dir="left" size={17}/></button><button className="games-icon-button" disabled={current===pages-1} aria-label={t("common.next")} onClick={()=>setPage(current+1)}><NavChevron dir="right" size={17}/></button></>}</div>}
    </div>
    {!collapsed&&<><p className="games-library-news-note">{t("games.libraryNews.note")}</p>
      {!!items.length||initial?<div key={`${current}:${capacity}`} className="games-library-news-grid" style={{gridTemplateColumns:`repeat(${capacity},minmax(0,1fr))`}} aria-busy={loading}>
        {visible.map(item=><article key={item.key}><a href={item.url} className="games-library-news-article" target="_blank" rel="noreferrer" onClick={event=>{event.preventDefault();openUrl(item.url);}}><div className="games-library-news-art"><GameArt src={item.image||item.game.capsule} fallback={item.game.capsule}/><ArrowUpRight size={18}/></div><div className="games-library-news-copy"><time dateTime={new Date(item.date*1000).toISOString()}>{new Date(item.date*1000).toLocaleDateString(language,{month:"short",day:"numeric",year:"numeric"})}</time>{item.unavailable&&<span>{t("games.libraryNews.stale")}</span>}<h4 dir="auto">{item.title}</h4><p dir="auto">{item.body}</p></div></a><button className="games-library-news-game" onClick={event=>open(item.game,event.currentTarget)}><GameArt src={item.game.capsule}/><span dir="auto">{item.game.name}</span></button></article>)}
        {initial&&Array.from({length:capacity},(_,index)=><article key={index} className="games-library-news-placeholder" aria-hidden="true"><div/><i/><b/><span/></article>)}
      </div>:<p className="games-library-news-empty" role="status">{t(failed>0?"games.libraryNews.failed":"games.libraryNews.empty")}</p>}
      <div className="games-library-news-footer"><span role="status">{t(initial?"games.libraryNews.pending":"games.libraryNews.coverage",{count:feeds.length.toLocaleString(language),total:targets.length.toLocaleString(language)})}</span>{limit<targets.length&&<button className="games-text-action" aria-disabled={loading} onClick={()=>{if(loading)return;if(limit+LIBRARY_NEWS_BATCH>=targets.length)refreshButton.current?.focus({preventScroll:true});setPage(0);setLimit(value=>value+LIBRARY_NEWS_BATCH);}}>{t("games.libraryNews.more")}</button>}</div>
      {failed>0&&<div className="games-library-news-error" role="status">{(items.length>0||failed<feeds.length)&&<span>{t("games.libraryNews.partial",{count:failed.toLocaleString(language)})}</span>}<button ref={retryButton} className="games-text-action" aria-disabled={loading} onClick={()=>{if(!loading)retry();}}>{t("common.retry")}</button></div>}
    </>}
  </section>;
}
