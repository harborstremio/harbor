import { useEffect, useId, useRef, useState } from "react";
import { CalendarDays, MapPin, X } from "lucide-react";
import { Row } from "@/components/row";
import { Dropdown } from "@/components/dropdown";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useT, useUiLanguage } from "@/lib/i18n";
import { useSectionBack } from "@/lib/section-back";
import { useView } from "@/lib/view";
import { openUrl } from "@/lib/window";
import { ESPORTS_GAMES, esportsGame, type EsportsGameId } from "@/lib/sports/esports-catalog";
import { officialBroadcastSource, type EsportsStream } from "@/lib/sports/esports-streams";
import { upcomingMajorTournaments, tournamentDates, TOURNAMENTS_CHECKED, type MajorTournament } from "@/lib/games/major-tournaments";
import { StreamPlatform } from "@/views/sports/esports-broadcast";
import { useAccountDialogFocus } from "./game-steam-account";
import { GameArt } from "./game-art";
import "./game-major-tournaments.css";

function TournamentDialog({event,onClose}:{event:MajorTournament;onClose:()=>void}) {
  const t=useT(),language=useUiLanguage(),id=useId(),root=useAccountDialogFocus(),{closing,close}=useModalExit(onClose),{openPlayer}=useView();
  useSectionBack(close,true);
  const watch=(stream:EsportsStream)=>{const source=officialBroadcastSource(stream);if(source){close();openPlayer(source);}else openUrl(stream.url);};
  return <ModalShell width={760} closing={closing} onDismiss={close} labelledBy={id} backdropClassName="games-tournament-scrim"><div ref={root} className="games-tournament-dialog">
    <button className="games-icon-button games-tournament-close" onClick={close} aria-label={t("common.close")}><X size={20}/></button>
    <GameArt className={`games-tournament-hero${event.logo?" is-logo":""}`} src={event.image} eager/>
    <div className="games-tournament-details"><span className="games-section-kicker">{esportsGame(event.game)?.name} · {event.organizer}</span><h2 id={id}>{event.name}</h2>
      <p className="games-tournament-date"><CalendarDays size={17}/>{tournamentDates(event,language)}</p>{event.location&&<p className="games-tournament-location"><MapPin size={16}/>{event.location}</p>}
      <h3>{t("games.tournaments.watch")}</h3><p className="games-tournament-watch-note">{t(event.streams.length?"games.tournaments.channelsNote":"games.tournaments.broadcastPending")}</p>
      <div className="games-tournament-streams">{event.streams.map(stream=><button className="games-button" key={stream.url} onClick={()=>watch(stream)}><StreamPlatform platform={stream.platform}/><span>{stream.title}<small>{stream.platform==="youtube"?"YouTube":stream.platform==="twitch"?"Twitch":stream.platform}</small></span></button>)}</div>
      <a className="games-text-action" href={event.source} onClick={e=>{e.preventDefault();openUrl(event.source);}}>{t("games.tournaments.schedule")}</a>
    </div>
  </div></ModalShell>;
}

export function GameMajorTournaments({active}:{active:boolean}) {
  const t=useT(),language=useUiLanguage(),[filter,setFilter]=useState<EsportsGameId|"all">("all"),[selected,setSelected]=useState<MajorTournament>(),[now,setNow]=useState(Date.now);
  const focus=useRef<HTMLButtonElement|null>(null),events=upcomingMajorTournaments(now,filter),game=filter!=="all"?esportsGame(filter):undefined;
  useEffect(()=>{if(!active){setSelected(undefined);return;}setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),60_000);return()=>clearInterval(timer);},[active]);
  const close=()=>{setSelected(undefined);requestAnimationFrame(()=>focus.current?.focus({preventScroll:true}));};
  const checked=new Date(TOURNAMENTS_CHECKED+"T12:00:00Z").toLocaleDateString(language,{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"});
  return <section className="games-section games-inset games-major-tournaments">
    <div className="games-section-heading"><div><h2>{t("games.tournaments.title")}</h2><p>{t("games.tournaments.note")}</p></div><Dropdown size="sm" value={filter} ariaLabel={t("games.favorites.all")} options={[{value:"all",label:t("games.favorites.all")},...ESPORTS_GAMES.map(game=>({value:game.id,label:game.name}))]} onChange={value=>setFilter(value as EsportsGameId|"all")}/></div>
    {!!events.length&&<Row key={filter} className="games-content-rail" min={280} shape="landscape" arrowsAlways scrollKey={`games:major-tournaments:${filter}`}>
      {events.map(event=><button className="games-tournament-card" key={event.id} onClick={e=>{focus.current=e.currentTarget;setSelected(event);}} aria-label={`${event.name} · ${tournamentDates(event,language)}`}>
        <span className={`games-tournament-art${event.logo?" is-logo":""}`}><GameArt src={event.image}/></span>
        <span className="games-tournament-game">{esportsGame(event.game)?.shortName} · {event.organizer}</span>
        <strong>{event.name}</strong><span className="games-tournament-date"><CalendarDays size={14}/>{tournamentDates(event,language)}</span>
        <span className="games-tournament-watch">{event.streams.map(stream=>stream.platform==="youtube"?"YouTube":stream.platform==="twitch"?"Twitch":stream.platform).filter((value,index,array)=>array.indexOf(value)===index).join(" · ")||t("games.tournaments.schedule")}</span>
      </button>)}
    </Row>}
    {!events.length&&<div className="games-tournaments-empty"><CalendarDays size={24}/><p>{t("games.tournaments.noDates")}</p>{game&&<a href={game.officialUrl} onClick={e=>{e.preventDefault();openUrl(game.officialUrl);}}>{t("games.tournaments.schedule")}</a>}</div>}
    <p className="games-feed-source">{t("games.tournaments.checked",{date:checked})}</p>
    {selected&&active&&<TournamentDialog event={selected} onClose={close}/>}
  </section>;
}
