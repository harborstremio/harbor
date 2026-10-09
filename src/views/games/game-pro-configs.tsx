import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Crosshair, Download, ChevronRight, ArrowLeft, RefreshCw } from "lucide-react";
import { useT } from "@/lib/i18n";
import { downloadText } from "@/lib/download-text";
import { useSectionBack } from "@/lib/section-back";
import { loadProConfig, loadProPlayers, loadMoreProPlayers, proGamePath, type ProConfig, type ProConfigGame, type ProPlayer } from "@/lib/games/pro-configs";
import { PlayerPortrait } from "./pro-player-portrait";
import { GuideSourceLink } from "./guide-shared";
import { ProCrosshair } from "./pro-crosshair";
import { ConfigCopy, ConfigGroups, groupText } from "./pro-config-groups";
import { ProShowcases, ProSkinList, ProTeammates } from "./pro-config-extras";

export function GameProConfigs({game,gameName,query,active}:{game:ProConfigGame;gameName:string;query:string;active:boolean}) {
  const t=useT(),[players,setPlayers]=useState<ProPlayer[]|null>(null),[selected,setSelected]=useState<ProPlayer|null>(null),[config,setConfig]=useState<ProConfig|null>(null);
  const [failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0),[next,setNext]=useState<number>(),[moreBusy,setMoreBusy]=useState(false),[moreFailed,setMoreFailed]=useState(false);
  const root=useRef<HTMLElement>(null),origin=useRef({id:"",top:0}),restore=useRef(false),moreRequest=useRef<AbortController|null>(null);
  const backToPlayers=()=>{restore.current=true;setFailed(false);setSelected(null);};
  useSectionBack(backToPlayers,active&&!!selected);
  useLayoutEffect(()=>{
    const container=root.current?.closest<HTMLElement>(".games-view");
    if(restore.current&&!selected){restore.current=false;container?.scrollTo({top:origin.current.top,behavior:"instant"});root.current?.querySelector<HTMLElement>(`[data-pro-player="${origin.current.id}"]`)?.focus({preventScroll:true});}
    else if(selected&&container&&root.current){const toolbar=container.querySelector<HTMLElement>(".games-guides-toolbar");const inset=parseFloat(getComputedStyle(container).getPropertyValue("--games-chrome-inset"))||0;container.scrollTop+=root.current.getBoundingClientRect().top-container.getBoundingClientRect().top-inset-(toolbar?.offsetHeight??0)-16;root.current.querySelector<HTMLElement>("h2")?.focus({preventScroll:true});}
  },[selected]);
  useEffect(()=>{
    if(!active)return;
    const request=new AbortController();setFailed(false);
    if(selected){setConfig(null);void loadProConfig(selected,game,request.signal).then(value=>{if(!request.signal.aborted)setConfig(value);},()=>{if(!request.signal.aborted)setFailed(true);});}
    else if(!players)void loadProPlayers(game,request.signal,gameName).then(value=>{if(!request.signal.aborted){setPlayers(value.items);setNext(value.next);}},()=>{if(!request.signal.aborted)setFailed(true);});
    return()=>request.abort();
  },[game,gameName,selected,active,attempt,players]);
  useEffect(()=>()=>moreRequest.current?.abort(),[]);
  const loadMore=async()=>{
    if(!next||moreBusy)return;
    const request=new AbortController();moreRequest.current=request;setMoreBusy(true);setMoreFailed(false);
    try{
      const unique=new Map(players?.map(p=>[p.id,p])),before=unique.size;let pageNumber:number|undefined=next;
      // The featured pages overlap the directory. Follow real next links until
      // this action adds profiles, with a bounded request budget.
      for(let round=0;round<4&&pageNumber&&unique.size===before;round++){
        const page=await loadMoreProPlayers(game,pageNumber,request.signal);
        for(const player of page.items){const existing=unique.get(player.id);unique.set(player.id,existing?{...existing,image:existing.image||player.image}:player);}
        pageNumber=page.next;
      }
      if(!request.signal.aborted){setPlayers([...unique.values()]);setNext(pageNumber);}
    }
    catch{if(!request.signal.aborted)setMoreFailed(true);}finally{if(!request.signal.aborted)setMoreBusy(false);}
  };
  const openPlayer=(player:ProPlayer)=>{origin.current={id:player.id,top:root.current?.closest(".games-view")?.scrollTop??0};setConfig(null);setFailed(false);setSelected(player);};
  const filtered=players?.filter(player=>`${player.name} ${player.team} ${player.edition??""}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const source=selected?.url??`https://prosettings.net/games/${proGamePath(game)}/`;
  const sourceName=selected?.source??"ProSettings.net";
  const date=selected?.published??config?.updated;
  const settingsText=config&&selected?[selected.name,selected.edition??gameName,source,date??"",
    ...config.groups.map(groupText),
    ...(config.showcases??[]).map(showcase=>showcase.items.map(item=>`${item.tag||t("games.guides.gear")}: ${item.name}`).join("\n")),
    config.skins?.length?`${t("games.guides.skins")}\n${config.skins.map(skin=>skin.name).join("\n")}`:"",
  ].filter(Boolean).join("\n\n"):"";
  return <section className="games-pro-configs" ref={root}>
    <div className="games-guides-section-title"><h2 tabIndex={-1}>{selected?selected.name:t("games.guides.configs")}</h2>{(selected||(game!=="css"&&game!=="cod"))&&<GuideSourceLink href={source}>{sourceName}</GuideSourceLink>}</div>
    {selected?<div className="games-pro-player-heading"><PlayerPortrait key={selected.id} player={config?.portrait?{...selected,image:config.portrait}:selected} active={active}/><div><button className="games-pro-return" onClick={backToPlayers}><ArrowLeft size={16}/>{t("games.guides.players")}</button>{selected.team&&<p>{selected.team}</p>}<p>{selected.edition??gameName}{date&&<> · <time dateTime={date}>{new Date(date).toLocaleDateString(document.documentElement.lang||undefined,{year:"numeric",month:"short",day:"numeric",...(date.length===10?{timeZone:"UTC"}:{})})}</time></>}</p>{selected.snapshot&&<p className="games-pro-archive-note">{t("games.guides.archived")}</p>}</div></div>:<p className="games-pro-note">{t("games.guides.configNote")}{players&&<span className="games-pro-count">{t("games.guides.playerCount",{count:filtered?.length??0})}</span>}</p>}
    {failed?<div className="games-guides-empty" role="alert"><Crosshair size={30}/><h3>{t("games.guides.sourceErrorTitle")}</h3><p>{t("games.guides.error")}</p><button className="games-button" onClick={()=>setAttempt(n=>n+1)}><RefreshCw size={16}/>{t("common.retry")}</button></div>:selected?config?<div className="games-guide-content-enter" key={selected.id}>
      <div className="games-pro-setup"><ProCrosshair config={config} game={game}/><div className="games-pro-import"><Crosshair size={25}/><div><h3>{t("games.guides.useConfig")}</h3><p>{t(`games.guides.import.${game}`)}</p><div className="games-pro-copy-actions">{config.crosshair&&<ConfigCopy value={config.crosshair} label={t("games.guides.copyCrosshair")}/>} {config.commands&&<ConfigCopy value={config.commands} label={t("games.guides.copyCommands")}/>}<ConfigCopy value={settingsText} label={t("games.guides.copySettings")}/><ConfigExport text={settingsText} name={`${selected.name} ${gameName} settings`}/></div></div></div></div>
      <ConfigGroups groups={config.groups} code={config.crosshair}/>
      {!!config.skins?.length&&<ProSkinList skins={config.skins}/>}
      {!!config.showcases?.length&&<ProShowcases showcases={config.showcases}/>}
      {!!config.teammates?.length&&<ProTeammates mates={config.teammates} active={active} onSelect={openPlayer}/>}
    </div>:<ProSkeleton detail/>:!players?<ProSkeleton/>:<>
      <div className="games-pro-players">{filtered?.map(player=><button key={player.id} data-pro-player={player.id} onClick={()=>openPlayer(player)}><PlayerPortrait player={player} active={active}/><span><strong>{player.name}</strong><small>{player.edition??player.team}</small></span><ChevronRight size={18}/></button>)}</div>
      {!filtered?.length&&<p className="games-pro-note">{t("games.guides.noPlayers")}</p>}
      {next&&<div className="games-guides-pagination">{moreFailed&&<p role="status">{t("games.guides.error")}</p>}<button className="games-button" disabled={moreBusy} onClick={()=>void loadMore()}>{t(moreBusy?"common.loading":moreFailed?"common.retry":"games.guides.more")}</button></div>}
    </>}
  </section>;
}
function ConfigExport({text,name}:{text:string;name:string}) {
  const t=useT(),[busy,setBusy]=useState(false);
  const safe=name.replace(/[^\p{L}\p{N} ._-]/gu," ").replace(/\s+/g," ").trim()||"harbor-config";
  return <span><button className="games-button" disabled={busy||!text} onClick={async()=>{setBusy(true);try{await downloadText(`${safe}.txt`,text,["txt"],"Harbor");}finally{setBusy(false);}}}><Download size={16}/> {t("games.guides.exportAll")}</button></span>;
}
function ProSkeleton({detail=false}:{detail?:boolean}) {
  const t=useT();return <div className={detail?"games-pro-setting-groups":"games-pro-players"} role="status" aria-label={t("common.loading")}>{Array.from({length:detail?4:12},(_,i)=><div key={i} className={`games-pro-skeleton ${detail?"is-detail":""}`} aria-hidden><i/><span><b/><em/></span></div>)}</div>;
}
