import { useMemo, useRef, useState } from "react";
import { Dropdown } from "@/components/dropdown";
import { SportsReminderButton } from "@/views/sports/reminder-button";
import { esportsSportsGame } from "@/lib/sports/esports-sports-game";
import { NavChevron } from "@/components/nav-arrow";
import { useT, useUiLanguage } from "@/lib/i18n";
import { useInViewport, usePageVisible } from "@/lib/visibility";
import { ESPORTS_GAMES } from "@/lib/sports/esports-catalog";
import { esportsRailMatches } from "@/lib/sports/esports-match-rail";
import type { EsportsFeed, EsportsMatch, EsportsGameId } from "@/lib/sports/esports-feeds";
import { useSportsConsent } from "@/views/sports/access-gate";
import { useEsports } from "@/views/sports/use-esports";
import { EsportsGameLogo, EsportsImage } from "@/views/sports/esports-image";
import { GameArt } from "./game-art";
import "./game-esports.css";

type Props={active:boolean;openEsports?:(match:EsportsMatch)=>void;openSports?:()=>void};
export function GameEsports(props:Props) {
  const consent=useSportsConsent(),t=useT();
  if(!props.openSports||!props.openEsports)return null;
  if(consent.status!=="accepted")return <section className="games-section games-inset games-esports-entry"><div><h2>{t("games.discovery.esportsTitle")}</h2><p>{t("games.discovery.esportsEntry")}</p></div><button className="games-button" onClick={props.openSports}>{t("games.discovery.openSports")}</button></section>;
  return <GameEsportsFeed {...props} openEsports={props.openEsports} openSports={props.openSports}/>;
}

function GameEsportsFeed({active,openEsports,openSports}:Props&Required<Pick<Props,"openEsports"|"openSports">>) {
  const t=useT(),language=useUiLanguage(),root=useRef<HTMLElement>(null),visible=useInViewport(root),pageVisible=usePageVisible();
  const [retry,setRetry]=useState(0),[page,setPage]=useState(0);
  const [filter,setFilter]=useState<EsportsGameId|"all">("all");
  const feed=useEsports(filter,active&&visible&&pageVisible,retry,{profiles:false,teamLogos:true});
  const sources=Object.values(feed.feeds).filter((value):value is EsportsFeed=>!!value&&(filter==="all"||value.game===filter));
  const matches=useMemo(()=>{const logos=new Map(feed.teams.map(team=>[String(team.id),team.logo]));return esportsRailMatches(Object.values(feed.feeds).filter((value):value is EsportsFeed=>!!value&&(filter==="all"||value.game===filter)),feed.now).filter(match=>match.state!=="recent").map(match=>match.game!=="dota2"?match:{...match,teams:match.teams.map(team=>({...team,logo:team.logo||logos.get(team.id)})) as EsportsMatch["teams"]});},[feed.feeds,feed.now,feed.teams,filter]);
  const pages=Math.ceil(matches.length/3),current=Math.min(page,Math.max(0,pages-1)),loading=!!feed.pending.length||!sources.length,failed=sources.length>0&&sources.every(source=>source.status==="unavailable");
  const ready=sources.filter(source=>source.status==="ready"&&!source.partial),incomplete=sources.some(source=>source.status!=="ready"||source.partial);
  return <section className="games-section games-inset games-esports" ref={root}>
    <div className="games-section-heading"><div><h2>{t("games.discovery.esportsTitle")}</h2><p>{t("games.discovery.esportsNote")}</p></div><div className="games-page-controls"><Dropdown size="sm" value={filter} ariaLabel={t("games.discovery.filterGame")} options={[{value:"all",label:t("games.favorites.all")},...ESPORTS_GAMES.filter(game=>["dota2","cs2","valorant","lol","rocketleague"].includes(game.id)).map(game=>({value:game.id,label:game.name}))]} onChange={value=>{setFilter(value as EsportsGameId|"all");setPage(0);}}/><button className="games-text-action" onClick={openSports}>{t("games.discovery.openSports")}</button>{pages>1&&<><button className="games-icon-button" disabled={!current} aria-label={t("common.previous")} onClick={()=>setPage(current-1)}><NavChevron dir="left" size={18}/></button><button className="games-icon-button" disabled={current===pages-1} aria-label={t("common.next")} onClick={()=>setPage(current+1)}><NavChevron dir="right" size={18}/></button></>}</div></div>
    <div className="games-esports-grid" key={`${filter}:${current}`} aria-busy={loading}>{matches.slice(current*3,current*3+3).map(match=>{const game=ESPORTS_GAMES.find(game=>game.id===match.game),live=match.state==="live";return <article key={match.id} className="games-esports-card"><button className="games-esports-card-open" onClick={()=>openEsports(match)} aria-label={`${match.event.name} · ${match.teams.map(team=>team.name).join(" · ")}`}>
      <span className="games-esports-cover">{game&&<><GameArt src={game.art}/><EsportsGameLogo game={game}/></>}<span className={`games-esports-state${live?" is-live":""}`}>{live&&<i/>}{t(live?"Live now":"Upcoming")}</span></span>
      <span className="games-esports-event">{match.event.logo&&<EsportsImage src={match.event.logo} name={match.event.name}/>}<strong>{match.event.name}</strong></span>
      <span className="games-esports-teams">{match.teams.map((team,index)=><span key={`${team.id}-${index}`}><EsportsImage src={team.logo} name={team.name}/><strong>{team.name}</strong>{live&&team.score!==undefined&&<b>{team.score}</b>}</span>)}<span className="games-esports-versus">vs</span></span>
      <span className="games-esports-meta"><span>{match.event.stage}{match.bestOf&&<>{match.event.stage?" · ":""}{t("games.discovery.bestOf",{count:match.bestOf})}</>}</span><time dateTime={new Date(match.startMs).toISOString()}>{new Date(match.startMs).toLocaleDateString(language,{month:"short",day:"numeric"})} · {new Date(match.startMs).toLocaleTimeString(language,{hour:"numeric",minute:"2-digit"})}</time></span>
      </button><div className="games-esports-actions"><button className="games-text-action" onClick={()=>openEsports(match)}>{t("games.discovery.viewEvent")}</button><SportsReminderButton game={esportsSportsGame(match)}/></div>
    </article>;})}{loading&&!matches.length&&[0,1,2].map(index=><div className="games-esports-skeleton" key={index} aria-hidden="true"/>)}</div>
    {!loading&&(!matches.length||incomplete)&&<div className="games-inline-status" role={failed?"alert":"status"}><span>{t(failed?"games.discovery.esportsError":incomplete?"games.discovery.esportsPartial":"games.discovery.esportsEmpty")}</span>{incomplete&&<button className="games-button" onClick={()=>setRetry(value=>value+1)}>{t("common.retry")}</button>}</div>}
    {!!sources.length&&<p className="games-esports-source">{t("games.discovery.esportsCoverage",{ready:ready.length,total:sources.length})}{ready.length>0&&<> · {ready.map(source=>source.source.name).join(" · ")}</>}</p>}
  </section>;
}
