import { Play } from "@/components/icons/play-filled";
import { useState } from "react";
import { Settings2 } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { useT } from "@/lib/i18n";
import { EMULATION_SYSTEMS, localGames } from "@/lib/games/emulation";
import { fileName } from "@/lib/games/patching";
import type { GameSummary } from "@/lib/games/types";
import type { EmulationLibrary } from "@/hooks/use-emulation-library";
import { romPlayerMode } from "@/lib/games/embedded-emulation";
import { romPreferenceId } from "@/lib/games/library-preferences";

export function GameLocalPlay({game,library,setup}:{game:GameSummary;library:EmulationLibrary;setup:(system:number)=>void}) {
  const t=useT(), [path,setPath]=useState("");
  const copies=localGames(library.data).filter(item=>game.id.startsWith("rom:")?romPreferenceId(item.system,item.path)===game.id:item.linked?.igdbId===game.igdbId&&game.igdbId);
  const selected=copies.find(item=>item.path===path)??copies.find(item=>item.available)??copies[0];
  if(!selected)return null;
  const platform=EMULATION_SYSTEMS.find(item=>item.id===selected.system)!;
  const player=library.data.profiles[selected.system];
  const mode=romPlayerMode(selected,player), embedded=mode==="embedded";
  const ready=mode!=="setup";
  const running=library.running.some(item=>item.path===selected.path),busy=library.busy===selected.path;
  return <div className="games-local-play">
    {copies.length>1&&<Dropdown ariaLabel={t("games.emulation.chooseCopy")} value={selected.path} onChange={setPath} options={copies.map(item=>({value:item.path,label:`${EMULATION_SYSTEMS.find(system=>system.id===item.system)?.short} · ${fileName(item.path)}`}))}/>}
    <button className="games-button games-button-primary" disabled={!!library.busy||!selected.available||running} onClick={()=>ready?void library.launch(selected):setup(selected.system)}>{busy?<span className="games-launch-dots"><i/><i/><i/></span>:running?<span className="games-retro-running"/>:ready?<Play size={24}/>:<Settings2 size={18}/>}<span>{t(running?"games.emulation.running":!selected.available?"games.emulation.unavailableGame":embedded?"games.retro.playInside":ready?"games.emulation.playOn":"games.emulation.setup",{platform:platform.short})}</span></button>
  </div>;
}
