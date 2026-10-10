import type { ProSetting } from "./pro-configs";

const DICTIONARY="ABCDEFGHJKLMNOPQRSTUVWXYZabcdefhijkmnopqrstuvwxyz23456789";
export const CROSSHAIR_STYLE_NAMES:Record<string,string>={"classic static":"4",classic:"2","classic dynamic":"3",legacy:"5","dynamic cross":"0","dynamic circle":"1","dynamic cross (classic)":"2","static circle":"3","static cross":"4","dynamic cross (legacy/shot feedback)":"5","dynamic cross (legacy)":"5","static cross (shot feedback)":"5","dot only":"6","dynamic quad":"7","static square":"8",default:"0","default static":"1"};
export const CROSSHAIR_COLOR_NAMES:Record<string,string>={red:"0",green:"1",yellow:"2",blue:"3",cyan:"4",custom:"5"};
export const CROSSHAIR_OUTLINE_NAMES:Record<string,string>={full:"1",half:"2"};

type Values=Record<string,string>;
const clamp=(value:number,min:number,max:number)=>Math.min(Math.max(value,min),max);
const number=(values:Values,key:string)=>{const raw=values[key];return raw!==undefined&&/^-?\d+(?:\.\d+)?$/.test(raw)?Number(raw):undefined;};
const flag=(values:Values,key:string)=>{const raw=(values[key]??"").toLowerCase();return /^(?:yes|on|true|1)$/.test(raw)?1:/^(?:no|off|false|0)$/.test(raw)?0:undefined;};
const named=(values:Values,key:string,names:Record<string,string>)=>{
  const raw=(values[key]??"").toLowerCase();if(!raw)return undefined;
  const mapped=names[raw]??(/^\d+$/.test(raw)?raw:undefined);return mapped===undefined?undefined:Number(mapped);
};
const steps=(value:number|undefined,per:number,max:number)=>value===undefined?undefined:clamp(Math.round(value*per),0,max);
const outlineMode=(values:Values)=>{
  const raw=(values.cl_crosshair_drawoutline??"").toLowerCase();if(!raw)return undefined;
  const mapped=CROSSHAIR_OUTLINE_NAMES[raw];if(mapped!==undefined)return Number(mapped);
  return /^(?:no|off|false|0)$/.test(raw)?0:/^(?:yes|on|true|1)$/.test(raw)?1:undefined;
};

function shareCode(bytes:number[]):string {
  if(bytes.some(byte=>!Number.isInteger(byte)||byte<0||byte>255))return "";
  bytes[0]=bytes.reduce((total,byte)=>total+byte,0)&255;
  let total=BigInt(`0x${bytes.map(byte=>byte.toString(16).padStart(2,"0")).join("")}`),text="";
  for(let i=0;i<25;i++){text+=DICTIONARY[Number(total%57n)];total/=57n;}
  return `CSGO-${text.slice(0,5)}-${text.slice(5,10)}-${text.slice(10,15)}-${text.slice(15,20)}-${text.slice(20,25)}`;
}

function pixelCode(values:Values):string {
  const style=named(values,"cl_crosshairstyle",CROSSHAIR_STYLE_NAMES),recoil=flag(values,"cl_crosshair_recoil");
  const dot=flag(values,"cl_crosshairdot"),tStyle=flag(values,"cl_crosshair_t"),outline=outlineMode(values);
  const red=number(values,"cl_crosshaircolor_r"),green=number(values,"cl_crosshaircolor_g"),blue=number(values,"cl_crosshaircolor_b"),alpha=number(values,"cl_crosshaircolor_a");
  const gap=number(values,"cl_crosshair_gap"),length=number(values,"cl_crosshair_length"),thickness=number(values,"cl_crosshair_thickness");
  const spread=number(values,"cl_crosshair_dynamic_spread_limit"),split=number(values,"cl_crosshair_dynamic_splitdist"),height=number(values,"cl_crosshair_screen_height");
  const inner=steps(number(values,"cl_crosshair_dynamic_splitalpha_innermod"),20,31);
  const outerRaw=number(values,"cl_crosshair_dynamic_splitalpha_outermod");
  const outer=outerRaw===undefined?undefined:clamp(Math.round(clamp(outerRaw,.3,1)*20)-6,0,15);
  const ratio=steps(number(values,"cl_crosshair_dynamic_maxdist_splitratio"),100,127);
  const required=[style,recoil,dot,tStyle,outline,red,green,blue,alpha,gap,length,thickness,spread,split,height,inner,outer,ratio];
  if(required.some(value=>value===undefined))return "";
  const bits=clamp(split!,0,127)|(inner!<<7)|(outer!<<12)|(ratio!<<16)|(clamp(Math.round(thickness!),0,31)<<23);
  const screen=clamp(Math.round(height!),0,65535);
  const bytes=[0,4,clamp(style!,0,8)|(recoil!<<4)|(dot!<<6)|(tStyle!<<7),
    clamp(Math.round(red!),0,255),clamp(Math.round(green!),0,255),clamp(Math.round(blue!),0,255),clamp(Math.round(alpha!),0,255),
    clamp(Math.round(gap!),0,255),clamp(Math.round(length!),0,255),clamp(Math.round(spread!),0,255),
    bits&255,(bits>>8)&255,(bits>>16)&255,((bits>>>24)&255)|(clamp(outline!,0,2)<<4),screen&255,screen>>8,0,0];
  return shareCode(bytes);
}

function legacyCode(values:Values):string {
  const style=named(values,"cl_crosshairstyle",CROSSHAIR_STYLE_NAMES),color=named(values,"cl_crosshaircolor",CROSSHAIR_COLOR_NAMES);
  const recoil=flag(values,"cl_crosshair_recoil"),dot=flag(values,"cl_crosshairdot"),tStyle=flag(values,"cl_crosshair_t");
  const weaponGap=flag(values,"cl_crosshairgap_useweaponvalue"),useAlpha=flag(values,"cl_crosshairusealpha"),drawOutline=flag(values,"cl_crosshair_drawoutline");
  const red=number(values,"cl_crosshaircolor_r"),green=number(values,"cl_crosshaircolor_g"),blue=number(values,"cl_crosshaircolor_b"),alpha=number(values,"cl_crosshairalpha");
  const gap=number(values,"cl_crosshairgap"),fixedGap=number(values,"cl_fixedcrosshairgap"),size=number(values,"cl_crosshairsize"),thickness=number(values,"cl_crosshairthickness");
  const outlineWidth=number(values,"cl_crosshair_outlinethickness"),split=number(values,"cl_crosshair_dynamic_splitdist");
  const inner=steps(number(values,"cl_crosshair_dynamic_splitalpha_innermod"),10,15);
  const outer=steps(number(values,"cl_crosshair_dynamic_splitalpha_outermod"),10,15);
  const ratio=steps(number(values,"cl_crosshair_dynamic_maxdist_splitratio"),10,15);
  const required=[style,color,recoil,dot,tStyle,weaponGap,useAlpha,drawOutline,red,green,blue,alpha,gap,fixedGap,size,thickness,outlineWidth,split,inner,outer,ratio];
  if(required.some(value=>value===undefined))return "";
  if(style!>7||Math.round(thickness!*10)>255||Math.round(size!*10)>255||Math.round(outlineWidth!*2)>255)return "";
  const bytes=[0,1,(Math.round(gap!*10))&255,Math.round(outlineWidth!*2),
    clamp(Math.round(red!),0,255),clamp(Math.round(green!),0,255),clamp(Math.round(blue!),0,255),clamp(Math.round(alpha!),0,255),
    (clamp(split!,0,7)&7)|(recoil!<<7),(Math.round(fixedGap!*10))&255,
    (clamp(color!,0,7)&7)|(drawOutline!<<3)|(inner!<<4),outer!|(ratio!<<4),
    Math.round(thickness!*10),(style!<<1)|(dot!<<4)|(weaponGap!<<5)|(useAlpha!<<6)|(tStyle!<<7),Math.round(size!*10),0,0,0];
  return shareCode(bytes);
}

/** A lossless re-encoding of the published cvars, never a filled-in default set. */
export function cs2CrosshairCode(settings:ProSetting[]):string {
  const values:Values=Object.fromEntries(settings.map(row=>[row.key.toLowerCase(),row.value.trim()]));
  return values.cl_crosshair_length!==undefined||values.cl_crosshair_thickness!==undefined?pixelCode(values):legacyCode(values);
}
