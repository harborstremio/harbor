import { useEffect, useId, useRef, useState } from "react";
import { Check, Eye, EyeOff, ImagePlus, MoreHorizontal, Pin, Search, X } from "lucide-react";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { Dropdown } from "@/components/dropdown";
import { useSectionBack } from "@/lib/section-back";
import { useT } from "@/lib/i18n";
import { libraryPreferenceVisible, type LibraryVisibility } from "@/lib/games/library-preferences";
import type { GameLibraryPreferences, ManagedLibraryItem } from "@/hooks/use-game-library-preferences";
import { launcherCatalogLookup } from "@/lib/games/launcher-catalog";
import { GameArtworkPicker } from "./game-artwork-picker";
import { artworkBinding, type LibraryArtwork } from "@/lib/games/igdb-artwork";
import type { GameSummary } from "@/lib/games/types";
import { GameArt } from "./game-art";
import { LibraryStatusSetting } from "./game-library-status";
import { GameMatch } from "./game-match";
import { metadataMatchTarget, type LibraryMetadataMatch } from "@/lib/games/library-metadata";
import { useGameAccess } from "./game-access";
import { customLinkedGame } from "@/lib/games/custom-library";
import { localGames } from "@/lib/games/emulation";
import { romPreferenceId } from "@/lib/games/library-preferences";
import "./game-library-personal.css";

export { libraryPreferenceVisible };
export function LibraryVisibilityFilter({ value, setValue }: { value: LibraryVisibility; setValue: (value: LibraryVisibility) => void }) { const t = useT(); return <Dropdown value={value} onChange={v => setValue(v as LibraryVisibility)} size="sm" ariaLabel={t("games.libraryPersonal.visibility")} options={["visible", "pinned", "hidden"].map(value => ({ value, label: t(`games.libraryPersonal.${value}`) }))} />; }
export function LibraryManageButton({ preferences, item }: { preferences: GameLibraryPreferences; item: ManagedLibraryItem }) { const t = useT(); return <button className="games-icon-button games-library-manage" aria-label={t("games.libraryPersonal.manage", { name: item.name })} title={t("games.libraryPersonal.customize")} disabled={!preferences.ready || preferences.busy} onClick={() => preferences.manage(item)}><MoreHorizontal size={18} /></button>; }
export function LibraryPin({ id, preferences }: { id: string; preferences: GameLibraryPreferences }) { const t = useT(); return preferences.get(id).pinned ? <span className="games-library-pin" title={t("games.libraryPersonal.pinned")}><Pin size={13} fill="currentColor" /><span className="sr-only">{t("games.libraryPersonal.pinned")}</span></span> : null; }
export function LibraryPreferenceError({ preferences }: { preferences: GameLibraryPreferences }) { const t = useT(); return preferences.error ? <div className="games-library-preference-error" role="alert"><span>{t(preferences.error)}</span><button className="games-button" onClick={preferences.refresh}>{t("common.retry")}</button></div> : null; }

export function GameLibraryPreferenceDialog({ preferences }: { preferences: GameLibraryPreferences }) {
  const t = useT(), title = useId(), root = useRef<HTMLDivElement>(null), { closing, close } = useModalExit(() => preferences.manage(null));
  const item = preferences.editing!, value = preferences.get(item.id), image = preferences.cover(item.id,item.game) ?? item.cover;
  const {customLibrary,emulation}=useGameAccess();
  const custom=customLibrary.data.games.find(game=>`custom:${game.id}`===item.id);
  const rom=item.id.startsWith("rom:")?localGames(emulation.data).find(game=>romPreferenceId(game.system,game.path)===item.id):undefined;
  const [matching,setMatching]=useState(false), [choosingArtwork,setChoosingArtwork]=useState(false);
  const [artworkReview,setArtworkReview]=useState<{artwork?:LibraryArtwork;metadata?:LibraryMetadataMatch}>({});
  const catalog = item.game ?? (/^(steam|igdb):[1-9]\d*$/.test(item.id) ? {id:item.id,name:item.name,capsule:"",platforms:[],...(item.id.startsWith("steam:")?{steamId:Number(item.id.slice(6))}:{igdbId:Number(item.id.slice(5))})} as GameSummary : undefined);
  const artworkCandidate = value.metadata ? metadataMatchTarget(value.metadata) : custom?.linked ?? rom?.linked ?? catalog;
  const artworkTarget = artworkCandidate && (artworkCandidate.igdbId || artworkCandidate.steamId || /^igdb:[1-9]\d*$/.test(artworkCandidate.id) || launcherCatalogLookup(artworkCandidate.id,artworkCandidate.catalogSteamId)) ? artworkCandidate : undefined;
  const binding = artworkBinding(item.id, custom?.linked ?? rom?.linked ?? catalog, value.metadata?.igdbId);
  const nested = matching || choosingArtwork;
  const opener = useRef(document.activeElement as HTMLElement | null), returnControl = useRef<string | null>(null);
  useEffect(() => () => { (opener.current?.isConnected ? opener.current : document.querySelector<HTMLElement>('.games-unified-filters button, .games-library-switch button[aria-pressed="true"]'))?.focus({preventScroll:true}); }, []);
  const [expectedMatch,setExpectedMatch]=useState(value.metadata);
  const dismiss = () => { if (!preferences.busy) close(); }; useSectionBack(dismiss, !nested);
  useEffect(() => { if(nested)return; const target = returnControl.current ? root.current?.querySelector<HTMLElement>(`[data-library-control="${returnControl.current}"]`) : root.current?.querySelector<HTMLElement>('button'); target?.focus({preventScroll:true}); returnControl.current=null; const trap = (event: KeyboardEvent) => { if (event.key !== "Tab" || (document.activeElement as Element)?.closest("[data-dropdown-menu]")) return; const items = [...root.current!.querySelectorAll<HTMLElement>('button:not(:disabled)')].filter(el => el.getClientRects().length); if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); } else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus(); } }; document.addEventListener("keydown", trap); return () => { document.removeEventListener("keydown", trap);  }; }, [nested]);
  if(choosingArtwork && artworkTarget)return <GameArtworkPicker key={`${item.id}:${binding}`} game={artworkTarget} binding={binding} value={artworkReview.artwork} localCover={!!value.cover || !!custom?.artwork} error={preferences.error} onSave={next=>preferences.updateArtwork(item.id,next,artworkReview.artwork,artworkReview.metadata)} onClose={()=>setChoosingArtwork(false)}/>;
  if(matching)return <GameMatch localCover={!!value.cover||!!custom?.artwork} game={{name:item.name,path:custom?.config.executable??rom?.path??item.id,system:rom?.system??0,linked:custom?.linked??rom?.linked??(expectedMatch?metadataMatchTarget(expectedMatch):undefined)}} metadataOnly error={custom?customLibrary.error:rom?emulation.error:preferences.error} onMatch={game=>custom?customLibrary.update(custom.id,{linked:customLinkedGame(game)}):rom?emulation.matchGame(rom,game):preferences.updateMetadata(item.id,game,expectedMatch)} onClose={()=>setMatching(false)}/>;
  return <ModalShell closing={closing} onDismiss={dismiss} labelledBy={title} width={460} backdropClassName="games-library-personal-backdrop"><div className="games-library-personal-dialog" ref={root}>
    <header><div><span className="games-section-kicker">{t("games.libraryPersonal.yourLibrary")}</span><h2 id={title}>{item.name}</h2></div><button className="games-icon-button" onClick={dismiss} disabled={preferences.busy} aria-label={t("common.close")}><X size={18} /></button></header>
    <div className="games-library-personal-scroll"><div className="games-library-personal-cover"><GameArt src={image ?? ""} /><div><button className="games-button" disabled={preferences.busy} onClick={() => void preferences.chooseCover(item.id, t("games.libraryPersonal.chooseCover"))}><ImagePlus size={16} />{t("games.libraryPersonal.chooseCover")}</button>{value.cover && <button className="games-library-original" disabled={preferences.busy} onClick={() => void preferences.update([item.id], { cover: null })}>{t("games.libraryPersonal.originalCover")}</button>}<p>{t("games.libraryPersonal.coverNote")}</p></div></div>
      <button className="games-library-personal-option" aria-pressed={value.pinned} disabled={preferences.busy} onClick={() => void preferences.update([item.id], { pinned: !value.pinned })}><Pin size={19} /><span><strong>{t("games.libraryPersonal.pin")}</strong><small>{t("games.libraryPersonal.pinNote")}</small></span><i>{value.pinned && <Check size={13} />}</i></button>
      <button className="games-library-personal-option" aria-pressed={value.hidden} disabled={preferences.busy} onClick={() => void preferences.update([item.id], { hidden: !value.hidden })}>{value.hidden ? <EyeOff size={19} /> : <Eye size={19} />}<span><strong>{t("games.libraryPersonal.hide")}</strong><small>{t("games.libraryPersonal.hideNote")}</small></span><i>{value.hidden && <Check size={13} />}</i></button>
      <button className="games-library-personal-option" data-library-control="match" disabled={preferences.busy} onClick={()=>{returnControl.current="match";setExpectedMatch(value.metadata);preferences.dismissError();setMatching(true);}}><Search size={19}/><span><strong>{t("games.match.title")}</strong><small>{value.metadata?`${value.metadata.name} · IGDB ${value.metadata.igdbId}`:t("games.metadata.note")}</small></span></button>
      {artworkTarget && <button className="games-library-personal-option" data-library-control="artwork" disabled={preferences.busy} onClick={()=>{returnControl.current="artwork";preferences.dismissError();setArtworkReview({artwork:value.artwork,metadata:value.metadata});setChoosingArtwork(true);}}><ImagePlus size={19}/><span><strong>{t("games.artwork.title")}</strong><small>{t("games.artwork.note")}</small></span></button>}
      <LibraryStatusSetting id={item.id} preferences={preferences}/><LibraryPreferenceError preferences={preferences} />
    </div><footer><span>{t("games.libraryPersonal.localNote")}</span><button className="games-button" disabled={preferences.busy} onClick={dismiss}>{t("common.done")}</button></footer>
  </div></ModalShell>;
}
