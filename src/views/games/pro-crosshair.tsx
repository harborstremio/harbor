import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Crosshair, Image as ImageIcon, Moon, Sun } from "lucide-react";
import { useT } from "@/lib/i18n";
import { proCrosshair } from "@/lib/games/pro-crosshair";
import type { ProConfig, ProConfigGame } from "@/lib/games/pro-configs";

export function ProCrosshair({config,game}:{config:ProConfig;game:ProConfigGame}) {
  const t=useT(),[light,setLight]=useState(false),[shot,setShot]=useState(-1),preview=proCrosshair(config,game);
  const maps=config.maps??[],map=shot>=0?maps[shot]??"":"";
  useEffect(()=>{setShot(-1);},[config]);
  const step=(delta:number)=>setShot(index=>(index+delta+maps.length)%maps.length);
  return <figure className="games-pro-crosshair">
    <div className="games-pro-crosshair-title"><figcaption>{t("games.guides.crosshairPreview")}</figcaption>
      {preview&&<span className="games-pro-preview-actions">
        {!!maps.length&&<button className="games-pro-preview-toggle" aria-label={t("games.guides.previewMap")} aria-pressed={shot>=0} onClick={()=>setShot(index=>index>=0?-1:0)}><ImageIcon size={17}/></button>}
        {!map&&<button className="games-pro-preview-toggle" aria-label={t("games.guides.previewBackground")} aria-pressed={light} onClick={()=>setLight(value=>!value)}>{light?<Moon size={17}/>:<Sun size={17}/>}</button>}
      </span>}
    </div>
    {preview?<>
      <div className={`games-pro-crosshair-stage${light&&!map?" is-light":""}${map?" is-map":""}`} style={map?{backgroundImage:`url("${map}")`}:undefined}>
        {!!map&&maps.length>1&&<>
          <button className="games-pro-shot-step" data-side="start" aria-label={t("games.guides.previous")} onClick={()=>step(-1)}><ChevronLeft size={18}/></button>
          <button className="games-pro-shot-step" data-side="end" aria-label={t("games.guides.next")} onClick={()=>step(1)}><ChevronRight size={18}/></button>
        </>}
        <svg viewBox="-80 -60 160 120" role="img" aria-label={t("games.guides.crosshairPreview")}>
          {preview.outline>0&&<g fill="none" stroke="#000" strokeWidth={preview.outline*2} opacity={preview.outlineOpacity}>{preview.rects.map((rect,i)=><rect key={i} {...rect}/>)}</g>}
          <g fill={preview.color}>{preview.rects.map((rect,i)=><rect key={i} {...rect}/>)}</g>
        </svg>
      </div>
      <p>{t("games.guides.previewNote")}</p>
    </>:<div className="games-pro-crosshair-missing"><Crosshair size={26}/><p>{t("games.guides.noCrosshair")}</p></div>}
  </figure>;
}
