import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, Copy, Cpu, Crosshair, Keyboard, Monitor, Mouse, Terminal } from "lucide-react";
import { useT } from "@/lib/i18n";
import { isLaunchOptions } from "@/lib/games/pro-config-extras";
import type { ProGroup, ProSetting } from "@/lib/games/pro-configs";

export function ConfigCopy({value,label,compact=false}:{value:string;label:string;compact?:boolean}) {
  const t=useT(),[state,setState]=useState<"idle"|"done"|"failed">("idle");
  useEffect(()=>{setState("idle");},[value]);
  useEffect(()=>{if(state!=="done")return;const timer=setTimeout(()=>setState("idle"),2500);return()=>clearTimeout(timer);},[state]);
  const done=state==="done",text=done?t("games.guides.copied"):label;
  return <span className={compact?"games-pro-copy":undefined}>
    <button className={compact?"games-pro-copy-button":"games-button"} onClick={async()=>{try{await navigator.clipboard.writeText(value);setState("done");}catch{setState("failed");}}}>
      {done?<Check size={16}/>:<Copy size={16}/>} {text}
    </button>
    <span className="sr-only" role="status">{done?t("games.guides.copied"):""}</span>
    {state==="failed"&&<small role="status">{t("games.guides.copyError")}</small>}
  </span>;
}

const groupIcon=(group:ProGroup)=>{
  const key=`${group.id} ${group.title}`.toLowerCase();
  return /mouse/.test(key)?Mouse:/crosshair/.test(key)?Crosshair:/launch/.test(key)?Terminal
    :/key|console|bind/.test(key)?Keyboard:/graphics|processor/.test(key)?Cpu:Monitor;
};
const rowText=(row:ProSetting)=>`${row.label}: ${row.value}`;
export const groupText=(group:ProGroup)=>[group.title,group.product?.name,
  ...(group.blocks?.length?group.blocks.flatMap(block=>[block.title,...block.values.map(rowText)]):group.values.map(rowText)),
  group.text].filter(Boolean).join("\n");

function ConfigValue({label,value}:{label:string;value:string}) {
  const t=useT(),[done,setDone]=useState(false);
  useEffect(()=>{if(!done)return;const timer=setTimeout(()=>setDone(false),1600);return()=>clearTimeout(timer);},[done]);
  return <div>
    <dt>{label}</dt>
    <dd dir="auto">
      <button type="button" className="games-pro-value" aria-label={t("games.guides.copyValue",{label})} onClick={async()=>{try{await navigator.clipboard.writeText(value);setDone(true);}catch{/* Clipboard denial leaves the value selectable instead. */}}}>
        <span>{value}</span>
        {done?<Check size={13}/>:<Copy size={13}/>}
      </button>
    </dd>
  </div>;
}

export function SettingGrid({values}:{values:ProSetting[]}) {
  return <dl className="games-pro-grid">{values.map((row,index)=><ConfigValue key={`${row.key}:${index}`} label={row.label} value={row.value}/>)}</dl>;
}

function ConfigGroup({group,code}:{group:ProGroup;code:string}) {
  const t=useT(),Icon=groupIcon(group);
  const options=group.text!==undefined&&isLaunchOptions(group.text);
  const copyable=options?group.text??"":group.text===undefined?groupText(group):"";
  const shown=group.id==="crosshair"&&code?(values:ProSetting[])=>values.filter(row=>row.key!=="code"):(values:ProSetting[])=>values;
  const blocks=group.blocks?.map(block=>({...block,values:shown(block.values)})).filter(block=>block.values.length);
  return <section className="games-pro-group">
    <header><h3><Icon size={20}/>{group.title}</h3>{copyable&&<ConfigCopy compact value={copyable} label={t("games.guides.copy")}/>}</header>
    {group.product&&<p className="games-pro-group-product">{group.product.image&&<img src={group.product.image} alt="" loading="lazy" decoding="async"/>}<span>{group.product.name}</span></p>}
    {group.text!==undefined?<pre className="games-pro-pre">{group.text}</pre>
      :blocks?.length?blocks.map((block,index)=><div className="games-pro-block" key={`${block.title}:${index}`}>{block.title&&<h4>{block.title}</h4>}<SettingGrid values={block.values}/></div>)
      :<SettingGrid values={shown(group.values)}/>}
    {group.id==="crosshair"&&code&&<CodeCopy value={code}/>}
  </section>;
}

function CodeCopy({value}:{value:string}) {
  const t=useT(),[done,setDone]=useState(false);
  useEffect(()=>{if(!done)return;const timer=setTimeout(()=>setDone(false),2500);return()=>clearTimeout(timer);},[done]);
  return <button className="games-pro-code" aria-label={t("games.guides.copyCrosshair")} onClick={async()=>{try{await navigator.clipboard.writeText(value);setDone(true);}catch{setDone(false);}}}>
    <code>{value}</code>{done?<Check size={16}/>:<Copy size={16}/>}
    <span className="sr-only" role="status">{done?t("games.guides.copied"):""}</span>
  </button>;
}

export function ConfigGroups({groups,code}:{groups:ProGroup[];code:string}) {
  const root=useRef<HTMLDivElement>(null),[narrow,setNarrow]=useState(false);
  useLayoutEffect(()=>{
    const node=root.current?.closest<HTMLElement>(".games-view")??root.current;if(!node)return;
    const update=()=>setNarrow(node.clientWidth<=760);update();
    const observer=new ResizeObserver(update);observer.observe(node);return()=>observer.disconnect();
  },[]);
  const columns=narrow?[groups]:[groups.filter((_,index)=>index%2===0),groups.filter((_,index)=>index%2===1)];
  return <div className="games-pro-setting-groups" ref={root}>{columns.map((column,index)=>
    <div className="games-pro-setting-column" key={index}>{column.map(group=><ConfigGroup key={group.id} group={group} code={code}/>)}</div>)}
  </div>;
}
