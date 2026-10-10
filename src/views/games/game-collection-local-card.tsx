import { Play } from "@/components/icons/play-filled";
import {useEffect,useState} from "react";
import {convertFileSrc,isTauri} from "@tauri-apps/api/core";
import { MoreHorizontal, Settings2 } from "lucide-react";
import {HoverTooltip} from "@/components/hover-tooltip";
import {useT} from "@/lib/i18n";
import {romPlayerMode} from "@/lib/games/embedded-emulation";
import type {ResolvedCollectionGame} from "@/lib/games/personal-collection-library";
import type {GameSummary} from "@/lib/games/types";
import type {CustomGameLibrary} from "@/hooks/use-custom-game-library";
import type {EmulationLibrary} from "@/hooks/use-emulation-library";
import type {GameLibraryPreferences} from "@/hooks/use-game-library-preferences";
import {GameArt} from "./game-art";
import {GameCustomManager} from "./game-custom-library";
import {customLaunchHealth} from "@/lib/games/custom-launch-health";
import {LibrarySourceMark} from "./game-library-marks";

export type CollectionLibraryAccess={customLibrary:CustomGameLibrary;emulation:EmulationLibrary;preferences:GameLibraryPreferences;manageRom:(system:number)=>void};
export function localCollectionArtwork({game,custom,rom}:ResolvedCollectionGame,preferences:GameLibraryPreferences) {
  return custom?.artwork&&isTauri()?convertFileSrc(custom.artwork):preferences.cover(game.id,custom?.linked??rom?.linked??game)??(game.capsule||game.portrait);
}

export function GameCollectionLocalCard({entry,access,active,open}:{entry:ResolvedCollectionGame;access:CollectionLibraryAccess;active:boolean;open:(game:GameSummary)=>void}) {
  const t=useT(),[editing,setEditing]=useState(false);
  const {game,custom,rom}=entry,{customLibrary,emulation,preferences}=access;
  useEffect(()=>{if(!active)setEditing(false);},[active]);
  const missing=!custom&&!rom,linked=custom?.linked??rom?.linked;
  const source=game.local?.kind==="custom"?t("games.custom.nav"):game.platforms.join(" · ");
  const art=localCollectionArtwork(entry,preferences);
  const emulator=rom&&emulation.data.profiles[rom.system];
  const ready=custom?customLaunchHealth(custom,customLibrary.health)?.state==="ready":!!rom&&romPlayerMode(rom,emulator)!=="setup";
  const running=custom?customLibrary.running.some(p=>p.id===custom.id):!!rom&&(emulation.running.some(p=>p.path===rom.path)||emulation.session?.path===rom.path);
  const busy=custom?customLibrary.busy.includes(custom.id):!!emulation.busy;
  const canPlay=!missing&&(custom?customLibrary.available:emulation.available&&!!rom?.available);
  const manage=()=>{if(custom)setEditing(true);else if(game.local?.kind==="rom")access.manageRom(game.local.system);};
  const choose=()=>linked?open({...linked,libraryEntryId:game.id}):manage();
  const play=()=>{if(!canPlay||busy||running)return;if(custom)void customLibrary.launch(custom);else if(rom)void emulation.launch(rom);};
  return <article className="games-collection-local" data-collection-local={game.id}>
    <button className="games-card" disabled={missing} onClick={choose} aria-label={t(linked?"games.library.gameDetails":"games.unified.manage",{name:game.name})}>
      <div className="games-card-art">{art?<GameArt src={art} fallback={game.portrait}/>:<span className="games-collection-local-placeholder"><LibrarySourceMark source={custom||game.local?.kind==="custom"?"custom":"retro"} size={32}/><strong dir="auto">{game.name}</strong></span>}</div>
      <div className="games-card-caption"><h3 dir="auto">{game.name}</h3><span>{source}</span></div>
    </button>
    <div className="games-collection-local-actions">{missing?<span>{t("games.collections.localMissing")}</span>:<>
      <button className="games-button" disabled={busy||running||!canPlay} onClick={ready?play:manage} aria-label={t(ready?"games.library.playGame":custom?"games.launchHealth.repairNamed":"games.emulation.setupGame",{name:game.name})}>{ready?<Play size={14}/>:<Settings2 size={15}/>}<span>{t(running?"games.emulation.running":busy?"games.library.opening":!canPlay?"games.unified.state.unavailable":ready?"games.library.play":custom?"games.launchHealth.repair":"games.emulation.setup")}</span></button>
      <HoverTooltip label={t("games.unified.manage",{name:game.name})}><button className="games-icon-button" onClick={manage} aria-label={t("games.unified.manage",{name:game.name})}><MoreHorizontal size={18}/></button></HoverTooltip>
    </>}</div>
    {editing&&custom&&active&&<GameCustomManager id={custom.id} library={customLibrary} onClose={()=>setEditing(false)}/>}
  </article>;
}
