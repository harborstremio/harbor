import { useEffect, useId, useRef, useState } from "react";

import { NavChevron } from "@/components/nav-arrow";
import { useT, useUiLanguage } from "@/lib/i18n";
import { useInViewport, usePageVisible } from "@/lib/visibility";
import { openUrl } from "@/lib/window";
import { currentSteamSale, loadSteamSaleEvents, steamSaleDays, steamSalePhase, type SteamSaleEvent } from "@/lib/games/steam-events";
import { GameArt } from "./game-art";
import { GameSaleCards } from "./game-sale-cards";
import { useLiveRefresh } from "./use-live-refresh";
import "./game-steam-sale.css";

export function GameSteamSale({ active }: { active: boolean }) {
  const t=useT(),language=useUiLanguage(),id=useId(),root=useRef<HTMLElement>(null);
  const visible=useInViewport(root),pageVisible=usePageVisible(),running=active&&visible&&pageVisible;
  const [events,setEvents]=useState<SteamSaleEvent[]>([]),[loaded,setLoaded]=useState(false),[failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0),[now,setNow]=useState(Date.now),[expanded,setExpanded]=useState(false);
  const revision=useLiveRefresh(running,6*60*60_000);
  useEffect(()=>{if(!running)return;const request=new AbortController();setFailed(false);void loadSteamSaleEvents(request.signal).then(value=>{if(!request.signal.aborted){setEvents(value);setLoaded(true);}},()=>{if(!request.signal.aborted)setFailed(true);});return()=>request.abort();},[running,revision,attempt]);
  useEffect(()=>{if(!running)return;setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[running]);
  const event=currentSteamSale(events,now),phase=event?steamSalePhase(event,now):null,current=phase==="current";
  const target=event?(current?event.endsAt:event.startsAt):undefined;
  const minutes=target===undefined?null:Math.max(0,Math.ceil((target-now)/60_000));
  const date=(value:string)=>new Date(`${value}T12:00:00Z`).toLocaleDateString(language,{month:"short",day:"numeric",timeZone:"UTC"});
  const upcoming=events.filter(item=>item.id!==event?.id&&steamSalePhase(item,now)==="upcoming");
  const units=minutes===null?[]:[...(minutes>=1440?[{value:Math.floor(minutes/1440),label:"days"}]:[]),{value:Math.floor(minutes/60)%24,label:"hours"},{value:minutes%60,label:"minutes"}];
  const days=event?steamSaleDays(event,now):0;
  const checked=event?new Date(event.observedAt).toLocaleString(language,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}):"";
  const destination=event?(current?event.url:event.sourceUrl):"";
  return <section className="games-section games-inset games-steam-sale" ref={root} aria-labelledby={`${id}-title`}>
    {event?<div className={`games-sale-banner${event.image?" has-art":""}`}>
      {event.image&&<div className="games-sale-media"><div className="games-sale-art" aria-hidden="true"><GameArt src={event.image}/></div></div>}
      <div className="games-sale-main"><div className="games-sale-copy"><span className="games-sale-label"><GameArt src="https://store.akamai.steamstatic.com/public/shared/images/header/logo_steam.svg" alt="Steam"/>{t(current?"games.discovery.sale.live":"games.discovery.sale.next")}</span><h2 id={`${id}-title`}>{event.name}</h2><a className="games-sale-dates" href={event.sourceUrl} onClick={e=>{e.preventDefault();openUrl(event.sourceUrl);}} title={t("games.discovery.sale.checked",{date:checked})}>{t("games.discovery.sale.dateRange",{start:date(event.startDate),end:date(event.endDate)})}</a><GameSaleCards event={event}/></div>
        <div className="games-sale-countdown" role="timer" aria-live="off"><span>{t(current?"games.discovery.sale.ends":"games.discovery.sale.starts")}</span>{minutes!==null?<div className="games-sale-digits">{units.map(unit=><span key={unit.label}><strong>{String(unit.value).padStart(2,"0")}</strong><small>{t(`games.discovery.sale.${unit.label}`)}</small></span>)}</div>:<strong className="games-sale-days">{t(days===0?"games.discovery.sale.today":days===1?"games.discovery.sale.oneDay":"games.discovery.sale.calendarDays",{count:days})}</strong>}</div>
        <div className="games-sale-actions"><a className="games-sale-open" href={destination} onClick={e=>{e.preventDefault();openUrl(destination);}}>{t(current?"games.discovery.sale.visit":"games.discovery.sale.details")}</a>{upcoming.length>0&&<button aria-expanded={expanded} aria-controls={`${id}-calendar`} onClick={()=>setExpanded(value=>!value)}>{t("games.discovery.sale.calendar")}<NavChevron dir={expanded?"up":"down"} size={12}/></button>}</div>
      </div>
      {now-event.observedAt>6*60*60_000&&<p className="games-sale-stale">{t("games.discovery.sale.checked",{date:checked})}</p>}
      {failed&&<div className="games-sale-refresh" role="status"><span>{t("games.discovery.sale.error")}</span><button onClick={()=>setAttempt(value=>value+1)}>{t("common.retry")}</button></div>}
      {expanded&&<div className="games-sale-calendar" id={`${id}-calendar`}>{upcoming.map(item=><div className="games-sale-calendar-entry" key={item.id}><a href={item.sourceUrl} onClick={e=>{e.preventDefault();openUrl(item.sourceUrl);}}><span>{item.name}</span><time dateTime={item.startDate}>{t("games.discovery.sale.dateRange",{start:date(item.startDate),end:date(item.endDate)})}</time></a><GameSaleCards event={item}/></div>)}</div>}
    </div>:failed?<div className="games-sale-unavailable" role="status"><div><h2 id={`${id}-title`}>{t("games.discovery.sale.title")}</h2><p>{t("games.discovery.sale.error")}</p></div><button className="games-button" onClick={()=>setAttempt(value=>value+1)}>{t("common.retry")}</button></div>:loaded?<div className="games-sale-unavailable"><div><h2 id={`${id}-title`}>{t("games.discovery.sale.title")}</h2><p>{t("games.discovery.sale.unannounced")}</p></div></div>:<div className="games-sale-skeleton" aria-busy="true"><h2 id={`${id}-title`} className="sr-only">{t("games.discovery.sale.title")}</h2><span className="sr-only" role="status">{t("common.loading")}</span><div className="games-sale-skeleton-art" aria-hidden="true"/><div className="games-sale-skeleton-row" aria-hidden="true"><span><b/><b/><b/></span><span><b/><b/></span><i/></div></div>}
  </section>;
}
