import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy } from "lucide-react";
import { copyText } from "@/components/player/copy-link-button";
import { useT } from "@/lib/i18n";

/** Buttons sit outside provider markup so neither copied code nor exports include UI labels. */
export function GuideMarkup({html}:{html:string}) {
  const root=useRef<HTMLDivElement>(null),[blocks,setBlocks]=useState<{host:HTMLElement;text:string}[]>([]);
  const markup=useMemo(()=>({__html:html}),[html]);
  useLayoutEffect(()=>{
    const element=root.current;if(!element)return;
    const next=[...element.querySelectorAll("pre")].map(pre=>{
      const wrapper=document.createElement("div"),host=document.createElement("span");
      wrapper.className="games-guide-code";host.className="games-guide-code-action";
      pre.before(wrapper);wrapper.append(pre,host);
      return {host,text:pre.innerText.replace(/\u00a0/g," ")};
    });
    setBlocks(next);
    return()=>{for(const {host} of next){const wrapper=host.parentElement,pre=wrapper?.querySelector("pre");if(pre&&wrapper){wrapper.replaceWith(pre);}}};
  },[html]);
  return <><div ref={root} dangerouslySetInnerHTML={markup}/>{blocks.map(({host,text},i)=>createPortal(<CopyGuideCode text={text}/>,host,String(i)))}</>;
}
function CopyGuideCode({text}:{text:string}) {
  const t=useT(),[state,setState]=useState<"idle"|"copied"|"error">("idle"),timer=useRef<ReturnType<typeof setTimeout>>(undefined),mounted=useRef(true);
  useLayoutEffect(()=>{mounted.current=true;return()=>{mounted.current=false;clearTimeout(timer.current);};},[]);
  const copy=async()=>{const copied=await copyText(text);if(!mounted.current)return;setState(copied?"copied":"error");clearTimeout(timer.current);timer.current=setTimeout(()=>setState("idle"),2200);};
  return <button type="button" className="games-guide-copy" onClick={()=>void copy()} aria-label={t(state==="error"?"games.guides.copyError":"games.guides.copyCode")}><span aria-hidden="true">{state==="copied"?<Check size={14}/>:<Copy size={14}/>}</span><span role="status">{t(state==="copied"?"games.guides.copied":state==="error"?"common.retry":"games.guides.copyCode")}</span></button>;
}
