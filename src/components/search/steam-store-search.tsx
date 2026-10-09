import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, RotateCw } from "lucide-react";
import { isTauri } from "@tauri-apps/api/core";
import { openUrl as openNativeUrl } from "@tauri-apps/plugin-opener";
import { useT, useUiLanguage } from "@/lib/i18n";
import { openExternalUrlStrict } from "@/lib/window";
import { Dropdown } from "@/components/dropdown";
import { loadSteamStoreSearch } from "@/lib/games/catalog";
import { readSteamStorePreferences, writeSteamStorePreferences, steamStorePreferencesKey, steamStoreUrl, STORE_COUNTRIES, type SteamStorePage, type SteamStorePreferences } from "@/lib/games/steam-store-search";
import { useSteamImports } from "@/hooks/use-steam-imports";
import { useSteamLibrary } from "@/hooks/use-steam-library";
import { useSteamAccount } from "@/hooks/use-steam-account";
import { GameArt } from "@/views/games/game-art";
import { SteamMark } from "@/views/games/game-detail-marks";
import "./steam-store-search.css";

export function SteamStoreSearch({query,profile,active,onAction}:{query:string;profile:string;active:boolean;onAction:()=>void}) {
  const t=useT(),language=useUiLanguage(),root=useRef<HTMLElement>(null),controller=useRef<AbortController|null>(null),live=useRef(true);
  const [settings,setSettings]=useState<{profile:string;value:SteamStorePreferences;ready:boolean}>({profile,value:{country:"auto",showLibrary:true},ready:false});
  const [settingsError,setSettingsError]=useState(false),[retry,setRetry]=useState(0),[state,setState]=useState<{key:string;page:SteamStorePage|null;busy:boolean;error:boolean}>({key:"",page:null,busy:false,error:false});
  const [openError,setOpenError]=useState(false),[opening,setOpening]=useState<number|null>(null);
  const addedFocus=useRef<{key:string;id:number}|null>(null);
  const prefs=settings.profile===profile?settings.value:{country:"auto",showLibrary:true},ready=settings.profile===profile&&settings.ready;
  const term=query.trim().slice(0,180),key=JSON.stringify([profile,term,prefs.country]);
  const stateKey=useRef(key);stateKey.current=key;
  const page=state.key===key?state.page:null,busy=state.key===key&&state.busy,error=state.key===key&&state.error;
  useLayoutEffect(()=>{const target=addedFocus.current;if(!target||busy)return;addedFocus.current=null;if(target.key!==key||!active)return;const link=root.current?.querySelector<HTMLAnchorElement>(`[data-store-app="${target.id}"] .steam-store-result-title`);link?.focus({preventScroll:true});link?.scrollIntoView({block:"nearest"});},[key,active,busy,page?.games.length]);
  const imports=useSteamImports(profile),installed=useSteamLibrary(active&&prefs.showLibrary),account=useSteamAccount(profile,active&&prefs.showLibrary);
  useEffect(()=>{live.current=true;return()=>{live.current=false;controller.current?.abort();};},[]);
  const read=()=>{try{setSettings({profile,value:readSteamStorePreferences(profile),ready:true});setSettingsError(false);}catch{setSettingsError(true);setSettings({profile,value:{country:"auto",showLibrary:true},ready:true});}};
  useEffect(()=>{read();const storage=(event:StorageEvent)=>{if(event.key===null||event.key===steamStorePreferencesKey(profile))read();},change=(event:Event)=>{if((event as CustomEvent).detail===profile)read();};window.addEventListener("storage",storage);window.addEventListener("harbor:steam-store-preferences",change);return()=>{window.removeEventListener("storage",storage);window.removeEventListener("harbor:steam-store-preferences",change);};},[profile]);
  const update=(patch:Partial<SteamStorePreferences>)=>{try{setSettings({profile,value:writeSteamStorePreferences(profile,patch),ready:true});setSettingsError(false);}catch{setSettingsError(true);}};
  const automatic=t("games.storeSearch.automatic");
  const regions=useMemo(()=>{const names=new Intl.DisplayNames([language],{type:"region"});return [{value:"auto",label:automatic},...STORE_COUNTRIES.map(value=>({value,label:names.of(value)??value})).sort((a,b)=>a.label.localeCompare(b.label,language))];},[language,automatic]);
  useEffect(()=>{
    controller.current?.abort();setOpenError(false);setOpening(null);
    if(!active||!ready||!term){setState({key,page:null,busy:false,error:false});return;}
    const abort=new AbortController();controller.current=abort;setState({key,page:null,busy:true,error:false});
    const timer=setTimeout(()=>{void loadSteamStoreSearch(term,prefs.country,0,abort.signal,retry>0).then(value=>{if(!abort.signal.aborted)setState({key,page:value,busy:false,error:false});},()=>{if(!abort.signal.aborted)setState({key,page:null,busy:false,error:true});});},400);
    return()=>{clearTimeout(timer);abort.abort();};
  },[key,active,ready,retry]);
  const more=async()=>{
    if(busy||page?.nextOffset==null)return;
    const abort=new AbortController();controller.current?.abort();controller.current=abort;
    setState({key,page,busy:true,error:false});const previousCount=page.games.length;
    try{const next=await loadSteamStoreSearch(term,prefs.country,page.nextOffset,abort.signal);if(abort.signal.aborted||!live.current)return;
      const games=[...page.games,...next.games.filter(game=>!page.games.some(previous=>previous.id===game.id))];
      if(games[previousCount]?.steamId)addedFocus.current={key,id:games[previousCount].steamId!};
      setState({key,page:{...next,games,...(page.cachedAt||next.cachedAt?{cachedAt:Math.min(...[page.cachedAt,next.cachedAt].filter((value):value is number=>value!==undefined))}:{})},busy:false,error:false});
    }catch{if(!abort.signal.aborted&&live.current)setState({key,page,busy:false,error:true});}
  };
  const open=async(id:number,client=false)=>{
    if(opening!==null)return;const requested=key;setOpening(id);setOpenError(false);
    try{const url=steamStoreUrl(id,prefs.country,client);if(client)await openNativeUrl(url);else await openExternalUrlStrict(url);onAction();}catch{if(live.current&&stateKey.current===requested)setOpenError(true);}finally{if(live.current&&stateKey.current===requested)setOpening(null);}
  };
  const known=new Set([...imports.data.games.map(item=>item.game.steamId),...(installed.scan?.games??[]).map(game=>game.appId),...(account.status.snapshot?.libraryVisible?account.status.snapshot.games.map(game=>game.appId):[])]);
  return <section className="steam-store-search" ref={root} aria-label={t("games.storeSearch.title")}>
    <header><div><h2><SteamMark/>{t("games.storeSearch.title")}</h2><p>{t("games.storeSearch.hint")}</p></div><div className="steam-store-region"><span>{t("games.storeSearch.region")}</span><Dropdown value={prefs.country} onChange={country=>update({country})} options={regions} ariaLabel={t("games.storeSearch.region")}/></div></header>
    <label className="steam-store-library-setting"><input type="checkbox" checked={prefs.showLibrary} onChange={event=>update({showLibrary:event.target.checked})}/>{t("games.storeSearch.showLibrary")}</label>
    {settingsError&&<p className="steam-store-message" role="alert">{t("games.storeSearch.settingsError")}<button onClick={read}>{t("common.retry")}</button></p>}
    {openError&&<p className="steam-store-message" role="alert">{t("games.storeSearch.openError")}</p>}
    {!term&&<p className="steam-store-empty">{t("games.storeSearch.empty")}</p>}
    {page?.cachedAt&&<p className="steam-store-message" role="status">{t("games.storeSearch.saved",{date:new Date(page.cachedAt).toLocaleString(language)})}<button onClick={()=>setRetry(value=>value+1)}><RotateCw size={16}/>{t("common.retry")}</button></p>}
    {error&&<p className="steam-store-message" role="alert">{t("games.storeSearch.error")}<button onClick={()=>page?void more():setRetry(value=>value+1)}>{t("common.retry")}</button></p>}
    {!!term&&!busy&&!error&&page&&!page.games.length&&<p className="steam-store-empty">{t("games.noResults")}</p>}
    <div aria-busy={busy} className="steam-store-results">{page?.games.map(game=><article key={game.id} className="steam-store-result" data-store-app={game.steamId}>
      <a className="steam-store-result-title" href={steamStoreUrl(game.steamId!,prefs.country)} onClick={event=>{event.preventDefault();void open(game.steamId!);}}><span className="steam-store-art"><GameArt src={game.capsule}/></span><span><strong>{game.name}</strong><small>{game.comingSoon?t("games.storeSearch.comingSoon"):game.releaseTimestamp?new Date(game.releaseTimestamp*1000).toLocaleDateString(language,{year:"numeric",month:"short",day:"numeric"}):game.platforms.join(" · ")}</small>{prefs.showLibrary&&known.has(game.steamId)&&<small className="steam-store-known">{t("games.storeSearch.inLibrary")}</small>}</span></a>
      <div className="steam-store-price">{game.offer.kind==="paid"?<>{game.offer.discount&&<span>−{game.offer.discount}%</span>}<div>{game.offer.original&&<del dir="auto">{game.offer.original}</del>}<strong dir="auto">{game.offer.final}</strong></div></>:<span className="steam-store-price-note">{t(game.offer.kind==="free"?"games.free":"games.storeSearch.unavailable")}</span>}</div>
      <div className="steam-store-actions"><button disabled={opening!==null} onClick={()=>void open(game.steamId!)}><ArrowUpRight size={18}/>{t("games.storeSearch.web")}</button>{isTauri()&&<button disabled={opening!==null} onClick={()=>void open(game.steamId!,true)}><SteamMark/>{t("games.storeSearch.client")}</button>}</div>
    </article>)}</div>
    {busy&&<p className="steam-store-message" role="status">{t("common.loading")}</p>}
    {page?.nextOffset!=null&&!error&&<button className="steam-store-more" disabled={busy} onClick={()=>void more()}>{t("games.library.showMore")}</button>}
  </section>;
}
