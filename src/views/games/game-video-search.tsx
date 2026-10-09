import { useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { ArrowUpRight } from "lucide-react";
import { Play } from "@/components/icons/play-filled";
import { useT } from "@/lib/i18n";
import { gameVideoSearchUrl } from "@/lib/games/video-search";

export function GameVideoSearchLinks({name}:{name:string}) {
  const t=useT(),[error,setError]=useState(false);
  return <><div className="games-video-search">{(["gameplay","trailer"] as const).map(kind=>{
    const url=gameVideoSearchUrl(name,kind);if(!url)return null;
    return <a key={kind} className="games-button" href={url} target="_blank" rel="noopener noreferrer" onClick={event=>{
      if(!isTauri())return;event.preventDefault();setError(false);
      void import("@tauri-apps/plugin-opener").then(({openUrl})=>openUrl(url)).catch(()=>setError(true));
    }}><Play size={15}/>{t(`games.manage.${kind}`)}<ArrowUpRight size={14}/></a>;
  })}</div>{error&&<p role="alert" className="games-title-error">{t("games.links.openError")}</p>}</>;
}
