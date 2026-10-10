import type { ProConfig, ProConfigGame } from "./pro-configs";
export type CrosshairRect={x:number;y:number;width:number;height:number;opacity:number};
export type CrosshairPreview={color:string;outline:number;outlineOpacity:number;rects:CrosshairRect[]};
/** A static geometry preview from published values, never a generic crosshair. */
export function proCrosshair(config:ProConfig,game:ProConfigGame):CrosshairPreview|null {
  const group=config.groups.find(g=>g.id==="crosshair");if(!group)return null;
  const values=Object.fromEntries(group.values.map(row=>[row.key.toLowerCase(),row.value]));
  const n=(key:string,fallback=0)=>{const raw=values[key];return raw!==undefined&&/^-?\d+(?:\.\d+)?$/.test(raw)?Math.max(-100,Math.min(255,Number(raw))):fallback;};
  const on=(key:string)=>/^(?:yes|on|true|1)$/i.test(values[key]??"");
  const alpha=(key:string,fallback=1)=>Math.max(0,Math.min(1,n(key,fallback)));
  const rects:CrosshairRect[]=[];
  const lines=(length:number,thickness:number,gap:number,opacity:number,top=true,verticalLength=length)=>{if(length<=0||thickness<=0)return;const g=Math.max(0,gap);rects.push({x:-g-length,y:-thickness/2,width:length,height:thickness,opacity},{x:g,y:-thickness/2,width:length,height:thickness,opacity},{x:-thickness/2,y:g,width:thickness,height:verticalLength,opacity});if(top)rects.push({x:-thickness/2,y:-g-verticalLength,width:thickness,height:verticalLength,opacity});};
  if(game==="cs2"){
    // September 2026 source pages publish pixels, not the old size units.
    const pixels=values.cl_crosshair_length!==undefined||values.cl_crosshair_thickness!==undefined;
    const sizeKey=pixels?"cl_crosshair_length":"cl_crosshairsize",thicknessKey=pixels?"cl_crosshair_thickness":"cl_crosshairthickness";
    const style=(values.cl_crosshairstyle??"").toLowerCase();
    const dotOnly=pixels&&(style==="dot only"||style==="6");
    if((!dotOnly&&values[sizeKey]===undefined)||values[thicknessKey]===undefined)return null;
    if(pixels&&!/^(?:static cross|dynamic cross(?: \((?:classic|legacy|shot feedback|legacy\/shot feedback)\))?|0|2|4|5|dot only|6)$/.test(style))return null;
    const colors:Record<string,string>={red:"#ff0000",green:"#00ff00",yellow:"#ffff00",blue:"#0000ff",cyan:"#00ffff","0":"#ff0000","1":"#00ff00","2":"#ffff00","3":"#0000ff","4":"#00ffff"};
    const color=(!pixels&&colors[(values.cl_crosshaircolor??"").toLowerCase()])||`rgb(${n("cl_crosshaircolor_r")},${n("cl_crosshaircolor_g",255)},${n("cl_crosshaircolor_b")})`,opacity=pixels?Math.max(0,n("cl_crosshaircolor_a",255))/255:on("cl_crosshairusealpha")?Math.max(0,n("cl_crosshairalpha",255))/255:1;
    const thickness=Math.max(1,n(thicknessKey)*(pixels?1:2));
    if(!dotOnly)lines(n(sizeKey)*(pixels?1:2),thickness,pixels?Math.max(thickness/2,n("cl_crosshair_gap")):4+n("cl_crosshairgap"),opacity,!on("cl_crosshair_t"));
    if(dotOnly||on("cl_crosshairdot"))rects.push({x:-thickness/2,y:-thickness/2,width:thickness,height:thickness,opacity});
    const outline=values.cl_crosshair_drawoutline??"",halfOutline=pixels&&/^(?:half|2)$/i.test(outline);
    const outlineSize=halfOutline ? 0.5 : (on("cl_crosshair_drawoutline")||/^full$/i.test(outline)) ? (pixels?1:n("cl_crosshair_outlinethickness",1)) : 0;
    return {color,outline:outlineSize,outlineOpacity:1,rects};
  }
  if(game==="valorant"){
    const color=values.crosshair_color;if(!color||!/^#[\da-f]{6}$/i.test(color))return null;
    for(const part of ["inner","outer"])if(on(`show_${part}_lines`)){
      const lengths=(values[`${part}_line_length`]??"").split(/[;,]/).map(Number);
      if(!lengths.length||lengths.some(v=>!Number.isFinite(v)||v<0||v>100))return null;
      lines(lengths[0],n(`${part}_line_thickness`),n(`${part}_line_offset`),alpha(`${part}_line_opacity`),true,lengths[1]??lengths[0]);
    }
    if(on("center_dot")){const size=n("center_dot_thickness",2);rects.push({x:-size/2,y:-size/2,width:size,height:size,opacity:alpha("center_dot_opacity")});}
    return {color,outline:on("outlines")?n("outline_thickness",1):0,outlineOpacity:alpha("outline_opacity"),rects};
  }
  return null;
}
