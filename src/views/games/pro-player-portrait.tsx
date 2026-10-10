import { useEffect, useRef, useState } from "react";
import { cachedProPortrait, loadProPortrait } from "@/lib/games/pro-portraits";
import type { ProPlayer } from "@/lib/games/pro-configs";

export function PlayerPortrait({player,active}:{player:ProPlayer;active:boolean}){
  const root=useRef<HTMLSpanElement>(null),[near,setNear]=useState(false),[resolved,setResolved]=useState(()=>cachedProPortrait(player.id)??""),[failed,setFailed]=useState<string[]>([]),[loaded,setLoaded]=useState("");
  const image=[player.image,resolved].find(value=>value&&!failed.includes(value))??"";
  useEffect(()=>{
    const node=root.current;if(!node||!active)return;
    const observer=new IntersectionObserver(entries=>setNear(entries.some(entry=>entry.isIntersecting)),{root:node.closest(".games-view"),rootMargin:"280px"});observer.observe(node);return()=>observer.disconnect();
  },[active]);
  useEffect(()=>{
    if(!active||!near||image||failed.length>=3)return;
    const request=new AbortController();void loadProPortrait(player,request.signal,failed).then(value=>{if(!request.signal.aborted)setResolved(value);},()=>{});return()=>request.abort();
  },[active,near,image,failed,player.id,player.name,player.url]);
  return <span className="games-pro-portrait" data-image-loaded={!!image&&loaded===image} ref={root} aria-hidden>
    <span className="games-pro-initials">{player.name.replace(/[^\p{L}\p{N}]/gu,"").slice(0,2).toUpperCase()}</span>
    {image&&<img src={image} alt="" loading="lazy" decoding="async" data-loaded={loaded===image} onLoad={()=>setLoaded(image)} onError={()=>setFailed(previous=>[...previous,image])}/>}
  </span>;
}
