import {useLayoutEffect,useRef,useState} from "react";
import {ArrowDown,ArrowUp} from "lucide-react";
import {HoverTooltip} from "@/components/hover-tooltip";
import {useT} from "@/lib/i18n";
import {downloadQueueKey} from "@/lib/games/download-queue";
import type {DownloadItem} from "@/lib/games/download-presentation";

export function DownloadQueueActions({item,queue,busy,action}:{item:DownloadItem;queue:DownloadItem[];busy:boolean;action:(direction:"earlier"|"later")=>Promise<unknown>}){
  const t=useT(),controls=useRef<HTMLDivElement>(null),position=queue.findIndex(candidate=>downloadQueueKey(candidate)===downloadQueueKey(item));
  const [restoreFocus,setRestoreFocus]=useState<"earlier"|"later"|null>(null);
  useLayoutEffect(()=>{
    if(!restoreFocus||busy||!controls.current)return;
    const requested=controls.current.querySelector<HTMLButtonElement>(`button[data-queue-move="${restoreFocus}"]`);
    const target=requested&&!requested.disabled?requested:controls.current.querySelector<HTMLButtonElement>("button:not(:disabled)");
    (target??controls.current.closest("article")?.querySelector<HTMLButtonElement>("button:not(:disabled)"))?.focus({preventScroll:true});
    setRestoreFocus(null);
  },[restoreFocus,busy,position]);
  if(position<0)return null;
  const move=async(direction:"earlier"|"later")=>{
    await action(direction);
    // Wait for the settled render: a frame callback can run before the hook's
    // busy state commits, when both directions are still disabled.
    setRestoreFocus(direction);
  };
  return <div ref={controls} className="games-download-order-actions">
    <span className="sr-only" aria-live="polite">{t("games.download.queueOrder",{position:position+1})}</span>
    {queue.length>1&&(["earlier","later"] as const).map(direction=><HoverTooltip key={direction} label={t(`games.download.${direction}`,{name:item.record.name})}><button data-queue-move={direction} className="games-icon-button" disabled={busy||(direction==="earlier"?position===0:position===queue.length-1)} onClick={()=>void move(direction)} aria-label={t(`games.download.${direction}`,{name:item.record.name})}>{direction==="earlier"?<ArrowUp size={16}/>:<ArrowDown size={16}/>}</button></HoverTooltip>)}
  </div>;
}
