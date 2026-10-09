import { useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { loadSteamShortcutIcon } from "@/lib/games/steam-shortcut-icons";
import type { SteamShortcut } from "@/lib/games/steam-shortcuts";
import type { SteamShortcutsLibrary } from "@/hooks/use-steam-shortcuts";
import { LibrarySourceMark } from "./game-library-marks";
import "./game-steam-shortcut-icon.css";

export function SteamShortcutIcon({game,library,className="",active=true}:{game:SteamShortcut;library:SteamShortcutsLibrary;className?:string;active?:boolean}) {
  const element=useRef<HTMLSpanElement>(null),[art,setArt]=useState<{key:string;image:string}|null>(null);
  const key=JSON.stringify([library.profile,library.settings.root,game.id,game.iconKey]);
  useEffect(()=>{
    if(!active||!isTauri()||!element.current||!game.iconKey)return;
    let current=true;
    const observer=new IntersectionObserver(entries=>{
      if(!entries.some(entry=>entry.isIntersecting))return;
      observer.disconnect();
      void loadSteamShortcutIcon(library.profile,library.settings.root,game).then(image=>{if(current&&image)setArt({key,image});});
    },{rootMargin:"80px"});
    observer.observe(element.current);
    return()=>{current=false;observer.disconnect();};
  },[key,active]);
  return <span ref={element} className={`games-shortcut-icon ${className}`} aria-hidden="true">{art?.key===key?<img src={art.image} alt="" decoding="async"/>:<LibrarySourceMark source="steam" size={28}/>}</span>;
}
