import { Play } from "@/components/icons/play-filled";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import { NavChevron } from "@/components/nav-arrow";
import { useT } from "@/lib/i18n";
import type { GameDetail } from "@/lib/games/types";
import { GameArt } from "./game-art";
import { GameTrailer } from "./game-trailer";
import { Maximize } from "lucide-react";
import { GameScreenshotViewer } from "./game-screenshot-viewer";
import { GameScreenshotArt } from "./game-screenshot-art";

export function GameMediaGallery({screenshots,screenshotThumbnails={},trailers,active,suspended=false}:{screenshots:string[];screenshotThumbnails?:Record<string,string>;trailers:GameDetail["trailers"];active:boolean;suspended?:boolean}) {
  const t=useT(),strip=useRef<HTMLDivElement>(null),focusSelection=useRef(false);
  const [selected,setSelected]=useState(0),[focused,setFocused]=useState(0),[intentional,setIntentional]=useState(false),[page,setPage]=useState(0),[columns,setColumns]=useState(5);
  const [expanded,setExpanded]=useState(false);
  useEffect(()=>{if(!active||suspended)setExpanded(false);},[active,suspended]);
  const selectedRef=useRef(selected),columnsRef=useRef(columns);selectedRef.current=selected;columnsRef.current=columns;
  const media=[...trailers.filter(item=>item.url).map(item=>({...item,type:"trailer" as const})),...screenshots.map((url,index)=>({url,poster:screenshotThumbnails[url]||url,name:t("games.screenshot",{number:index+1}),type:"image" as const}))];
  const total=media.length,current=Math.min(selected,total-1),item=media[current],lastPage=Math.max(0,Math.ceil(total/columns)-1),visiblePage=Math.min(page,lastPage);
  useEffect(()=>{const node=strip.current;if(!node)return;const observer=new ResizeObserver(([entry])=>{const next=Math.max(2,Math.min(6,Math.floor((entry.contentRect.width+8)/108)));if(next===columnsRef.current)return;const button=node.querySelector<HTMLButtonElement>("button:focus"),anchor=button?Number(button.dataset.mediaIndex):selectedRef.current;setColumns(next);setPage(Math.floor(anchor/next));if(button){setFocused(anchor);focusSelection.current=true;}});observer.observe(node);return()=>observer.disconnect();},[total>1]);
  useEffect(()=>{if(focusSelection.current){strip.current?.querySelector<HTMLButtonElement>(`[data-media-index="${focused}"]`)?.focus();focusSelection.current=false;}},[focused,visiblePage,columns]);
  const select=(index:number)=>{setSelected(index);setIntentional(true);setPage(Math.floor(index/columns));};
  if(!item)return null;
  return <section className="games-gallery" aria-label={t("games.gallery")}>
    <div className="games-gallery-stage">
      {item.type==="trailer"?<GameTrailer key={item.url} url={item.url} poster={item.poster} active={active} suspended={suspended} intentional={intentional}/>:<GameScreenshotArt key={item.url} className="games-gallery-still" src={item.url} alt={item.name} active={active&&!suspended}/>}
      {item.type==="image"&&<button type="button" className="games-gallery-open-image" onClick={()=>setExpanded(true)} aria-label={t("games.gallery.enlargeImage",{number:current-(total-screenshots.length)+1})}><span><Maximize size={20}/></span></button>}
      {item.type==="image"&&total>1&&<div className="games-gallery-arrows"><button className="games-icon-button" aria-label={t("games.player.previous")} onClick={()=>select((current-1+total)%total)}><NavChevron dir="left" size={21}/></button><button className="games-icon-button" aria-label={t("games.player.next")} onClick={()=>select((current+1)%total)}><NavChevron dir="right" size={21}/></button></div>}
    </div>
    {total>1&&<div className="games-gallery-strip"><button type="button" className="games-gallery-page" aria-label={t("common.previous")} disabled={visiblePage===0} onClick={()=>setPage(visiblePage-1)}><NavChevron dir="left" size={19}/></button>
      <div ref={strip} className="games-gallery-window" style={{"--media-columns":columns} as CSSProperties} onKeyDown={event=>{const index=Number((event.target as HTMLElement).closest<HTMLButtonElement>("button[data-media-index]")?.dataset.mediaIndex);if(!Number.isFinite(index))return;const next=event.key==="ArrowRight"?Math.min(total-1,index+1):event.key==="ArrowLeft"?Math.max(0,index-1):event.key==="Home"?0:event.key==="End"?total-1:null;if(next!==null){event.preventDefault();event.stopPropagation();focusSelection.current=true;setFocused(next);setPage(Math.floor(next/columns));}}}>
        {media.slice(visiblePage*columns,(visiblePage+1)*columns).map((entry,index)=><button key={`${entry.type}:${entry.url}`} data-media-index={visiblePage*columns+index} type="button" aria-label={entry.type==="trailer"?t("games.player.trailerNamed",{name:entry.name}):entry.name} aria-pressed={current===visiblePage*columns+index} onClick={()=>select(visiblePage*columns+index)}>{entry.type==="image"?<GameScreenshotArt src={entry.poster} active={active&&!suspended}/>:<GameArt src={entry.poster} alt=""/>}{entry.type==="trailer"&&<span className="games-gallery-thumb-play"><Play size={20}/></span>}</button>)}
      </div><button type="button" className="games-gallery-page" aria-label={t("common.next")} disabled={visiblePage===lastPage} onClick={()=>setPage(visiblePage+1)}><NavChevron dir="right" size={19}/></button>
    </div>}
    {expanded&&active&&!suspended&&item.type==="image"&&<GameScreenshotViewer screenshots={screenshots} index={current-(total-screenshots.length)} select={index=>select(total-screenshots.length+index)} onClose={()=>setExpanded(false)}/>}
  </section>;
}
