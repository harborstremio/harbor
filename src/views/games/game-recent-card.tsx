import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { GameAvailabilityBadge, useGameAvailabilityIndex } from './game-availability';
import { gameAvailability, releaseAvailability } from '@/lib/games/availability';
import { loadRecentSourceArt, readRecentSourceArt } from '@/lib/games/recent-source-art';
import { GameRequestPool } from '@/lib/games/request-pool';
import { withSourceOrigin } from '@/lib/games/source-origin';
import { sourceDownloadTitle } from '@/lib/games/source-title';
import type { RecentSourceRelease } from '@/lib/games/recent-sources';
import type { SourceGameArtwork } from '@/lib/games/source-display';
import type { GameSummary } from '@/lib/games/types';
import type { GameTransfers } from '@/hooks/use-game-transfers';
import { useT, useUiLanguage } from '@/lib/i18n';
import { GameArt } from './game-art';
import { GamePosterSave } from './game-poster-save';
import { GameSourceIcon } from './game-source-icon';
import { GamesIcon } from '@/components/icons/games-icon';
const pool = new GameRequestPool(2);

export function RecentSourceCard({item,active,downloads,open,files,publish,error}:{item:RecentSourceRelease;active:boolean;downloads:GameTransfers;open:(game:GameSummary,origin?:HTMLElement)=>void;files:(item:RecentSourceRelease,art:SourceGameArtwork|null|undefined)=>void;publish:(key:string,art:SourceGameArtwork|null)=>void;error:()=>void}) {
 const root=useRef<HTMLDivElement>(null),[near,setNear]=useState(false),[art,setArt]=useState<SourceGameArtwork|null|undefined>(()=>{const held=readRecentSourceArt(item.release,item.source);return held?held.art??null:undefined;}),[opening,setOpening]=useState<HTMLElement>();
 const t=useT(),language=useUiLanguage(),availability=useGameAvailabilityIndex(),name=sourceDownloadTitle(item.release.title);
 const callbacks=useRef({publish,open,error});callbacks.current={publish,open,error};
 useEffect(()=>{const node=root.current;if(!node)return;const observer=new IntersectionObserver(entries=>setNear(entries.some(entry=>entry.isIntersecting)),{rootMargin:'300px'});observer.observe(node);return()=>observer.disconnect();},[]);
 useEffect(()=>{
  if(!active||!near)return;
  const held=readRecentSourceArt(item.release,item.source);
  if(held){setArt(held.art??null);callbacks.current.publish(item.key,held.art??null);return;}
  const request=new AbortController();
  void pool.run(()=>loadRecentSourceArt(item.release,request.signal,item.source),request.signal).then(value=>{if(!request.signal.aborted){setArt(value??null);callbacks.current.publish(item.key,value??null);}},()=>{if(!request.signal.aborted){setArt(null);callbacks.current.publish(item.key,null);}});
  return()=>request.abort();
 },[active,near,item.key,item.source.checkedAt,item.source.catalog?.version]);
 useEffect(()=>{if(!active)setOpening(undefined);},[active]);
 useEffect(()=>{if(!active||!opening||art===undefined)return;setOpening(undefined);if(art)callbacks.current.open(withSourceOrigin(art.game,item.source,item.release),opening);else callbacks.current.error();},[active,opening,art]);
 const viewGame=(origin:HTMLElement)=>{if(art)callbacks.current.open(withSourceOrigin(art.game,item.source,item.release),origin);else if(art===undefined)setOpening(origin);else callbacks.current.error();};
 const match=art,game=art?.game,adult=game?.adultContent===true;
 const status=releaseAvailability(item.release,downloads.profile,downloads.records,downloads.torrents.records,match?.match==='exact'?gameAvailability(availability,game):undefined);
        return <div ref={root} className="games-recent-card games-save-card" data-release={item.key}>
        <button className="games-recent-details" data-game={"recent:" + item.key} aria-busy={!!opening} aria-label={t(match?.match === "base" ? "games.recent.viewBase" : "games.discovery.viewGame") + ": " + name + (adult ? ". " + t("games.recent.adult") : "")} onClick={event => viewGame(event.currentTarget)}>
        <span className="games-recent-poster">
        <span className="games-recent-art" data-obscured={adult ? "true" : undefined} data-nsfw={adult ? "true" : undefined}>
          <span className="games-recent-art-fallback"><GamesIcon size={42}/><strong>{name}</strong></span>
          {game && <GameArt src={game.portrait || game.capsule} fallback={game.capsule}/>}
          {adult && <span className="games-recent-content-cover">
            <span className="games-recent-content-mark" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none"><path d="M13 8h22a5 5 0 0 1 5 5v22a5 5 0 0 1-5 5H13a5 5 0 0 1-5-5V13a5 5 0 0 1 5-5Z" stroke="currentColor" strokeWidth="2"/>{adult ? <><path d="m14 21 3-2v12m8-6c-5-1-5-7 0-7s5 6 0 7c-6 0-6 7 0 7s6-7 0-7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M34 15v6m-3-3h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></> : <path d="m15 15 18 18M13 24s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>}</svg></span>
            <strong>{adult ? "NSFW" : t("games.recent.artHidden")}</strong>
            <span>{t(adult ? "games.recent.adult" : "games.recent.artUnrated")}</span>
          </span>}
          {art === undefined && <span className="games-recent-art-pending" aria-hidden="true"/>}
          {Date.now() - item.addedAt < 7 * 86_400_000 && <span className="games-recent-new">{t("games.recent.new")}</span>}
          <GameAvailabilityBadge status={status}/>
        </span>
        <GameSourceIcon className="games-recent-source-avatar" url={item.source.url} homepage={item.source.homepage || item.release.sourcePage} icon={item.source.icon} name={item.source.name}/>
        </span>
        <strong title={item.release.title}>{name}</strong>
        <span className="games-recent-origin"><span>{item.source.name}</span><time dateTime={new Date(item.addedAt).toISOString()}>{new Date(item.addedAt).toLocaleDateString(language, { month: "short", day: "numeric", ...(new Date(item.addedAt).getUTCFullYear() !== new Date().getUTCFullYear() ? { year: "numeric" as const } : {}), timeZone: "UTC" })}</time></span>
        </button>
        {game && <GamePosterSave game={withSourceOrigin(game,item.source,item.release)}/>}
        <span className="games-recent-actions"><button className="games-recent-open" aria-label={t("games.recent.open", { name: name, source: item.source.name })} title={t("games.recent.files")} onClick={() => { setOpening(undefined); files(item, art); }}><Download size={20} aria-hidden="true"/></button></span>
      </div>;
}
