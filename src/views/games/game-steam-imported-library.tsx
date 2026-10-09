import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import { loadGameArtwork } from "@/lib/games/catalog";
import type { GameArtwork, GameSummary } from "@/lib/games/types";
import type { SteamImportLibrary } from "@/hooks/use-steam-imports";
import type { GameLibraryPreferences } from "@/hooks/use-game-library-preferences";
import { type LibraryVisibility, libraryPreferenceVisible } from "@/lib/games/library-preferences";
import { GameSteamImport } from "./game-steam-import";
import { GameArt } from "./game-art";
import { LibraryManageButton, LibraryPin, LibraryVisibilityFilter } from "./game-library-personal";
import { useLibrarySelection, LibrarySelectButton, LibrarySelectionBar, LibrarySelectionMark } from "./game-library-selection";

export function GameSteamImportedLibrary({ library, represented, preferences, query, active, open, collect }: {
  library: SteamImportLibrary; represented: Set<number>; preferences: GameLibraryPreferences; query: string; active: boolean;
  open: (game: GameSummary) => void; collect?: (games: GameSummary[]) => void;
}) {
  const t = useT(), trigger = useRef<HTMLButtonElement>(null), more = useRef<HTMLButtonElement>(null);
  const [importOpen,setImportOpen] = useState(false), [error,setError] = useState(""), [busy,setBusy] = useState<number | null>(null), [visibility,setVisibility] = useState<LibraryVisibility>("visible"), [limit,setLimit] = useState(36), [art,setArt] = useState<Record<number,GameArtwork>>({});
  const live = useRef(true), owner = useRef(library.profile); owner.current = library.profile;
  useEffect(() => { live.current=true; return () => {live.current=false;}; }, []);
  useEffect(() => {setImportOpen(false);setError("");setBusy(null);setVisibility("visible");setLimit(36);}, [library.profile]);
  useEffect(() => {if(!active)setImportOpen(false);}, [active]);
  useEffect(() => setLimit(36), [query,visibility]);
  const title = (game: GameSummary) => preferences.title(game.id,game.name);
  const all = library.data.games.filter(item => !represented.has(item.game.steamId!));
  const games = all.filter(item => libraryPreferenceVisible(preferences.data.entries[item.game.id],visibility) && preferences.matchesTitle(item.game.id,item.game.name,query)).sort((a,b) => Number(preferences.get(b.game.id).pinned)-Number(preferences.get(a.game.id).pinned) || b.addedAt-a.addedAt || title(a.game).localeCompare(title(b.game)));
  const shown = games.slice(0,limit), ids = shown.map(item => item.game.steamId).join(",");
  useEffect(() => { if(!active || !ids)return;let current=true;void loadGameArtwork(ids.split(",").map(Number)).then(value=>{if(current)setArt(previous=>({...previous,...value}));},()=>{});return()=>{current=false;}; }, [active,ids]);
  useEffect(() => {if(!active||!more.current)return;const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))setLimit(value=>value+36);},{root:more.current.closest('.games-scroll'),rootMargin:'160px'});observer.observe(more.current);return()=>observer.disconnect();},[active,limit,games.length]);
  const summary = (game:GameSummary) => ({...game,...art[game.steamId!]});
  const selection=useLibrarySelection({items:games.map(item=>({id:item.game.id,name:title(item.game),...preferences.get(item.game.id),game:summary(item.game)})),scope:JSON.stringify([library.profile,query,visibility]),active,update:preferences.update,collect});
  const remove = async (id:number) => {if(busy!==null)return;const profile=library.profile;setBusy(id);setError("");try{await library.update([], [id]);if(live.current&&owner.current===profile)requestAnimationFrame(()=>trigger.current?.focus({preventScroll:true}));}catch{if(live.current&&owner.current===profile)setError("games.steamImport.writeError");}finally{if(live.current&&owner.current===profile)setBusy(null);}};
  return <section className="games-steam-imported">
    <div className="games-section-heading"><div><h3>{t("games.steamImport.importedTitle")}</h3><p>{t("games.steamImport.note")}</p></div><button className="games-button" ref={trigger} disabled={!library.ready} onClick={()=>setImportOpen(true)}>{t("games.steamImport.title")}</button></div>
    {(library.error||error)&&<div className="games-library-notice" role="alert"><span>{t(library.error||error)}</span><button onClick={()=>{library.refresh();setError("");}}>{t("common.retry")}</button></div>}
    {!!all.length&&<><div className="games-library-toolbar"><span>{t("games.library.count",{count:games.length})}</span><div className="games-library-filters"><LibrarySelectButton selection={selection} disabled={!preferences.ready||preferences.busy||!games.length}/><LibraryVisibilityFilter value={visibility} setValue={setVisibility}/></div></div><LibrarySelectionBar selection={selection}/>
      {games.length?<div className="games-library-grid" data-selection={selection.mode}>{shown.map(item=>{const game=summary(item.game);return <article className="games-library-card" key={game.id} data-steam-import={game.steamId}>
        <button className="games-library-card-art" aria-label={t("games.library.gameDetails",{name:title(game)})} {...selection.props(game.id,title(game),()=>open(game))}><GameArt src={preferences.cover(game.id)??game.portrait??game.capsule} fallback={game.capsule}/><LibraryPin id={game.id} preferences={preferences}/><LibrarySelectionMark selection={selection} id={game.id}/><span className="games-library-card-open"><ArrowUpRight size={22}/></span></button>
        <div className="games-library-card-copy"><button {...selection.props(game.id,title(game),()=>open(game))}>{title(game)}</button><p>{t("games.steamImport.manual")}</p></div>
        <div className="games-library-card-footer"><button className="games-button games-launch" onClick={()=>open(game)}>{t("games.library.details")}</button><LibraryManageButton preferences={preferences} item={{id:game.id,name:title(game),cover:game.portrait??game.capsule}}/><button className="games-icon-button" disabled={busy!==null} aria-label={t("games.steamImport.remove",{name:title(game)})} title={t("games.steamImport.remove",{name:title(game)})} onClick={()=>void remove(game.steamId!)}><Trash2 size={18}/></button></div>
      </article>;})}</div>:<p className="games-provenance">{t("games.noResults")}</p>}
      {shown.length<games.length&&<button className="games-button games-library-more" ref={more} onClick={()=>setLimit(value=>value+36)}>{t("games.library.showMore")}</button>}
    </>}
    {importOpen&&active&&<GameSteamImport key={library.profile} library={library} existing={new Set([...represented,...library.data.games.map(item=>item.game.steamId!)])} onClose={()=>setImportOpen(false)}/>}
  </section>;
}
