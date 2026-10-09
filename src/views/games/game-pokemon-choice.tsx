import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { AnchoredMenu } from "@/components/anchored-menu";
import { advanceFocus } from "@/lib/keyboard-navigation";
import { getDirection, isBackKey } from "@/lib/keyboard-navigation/geometry";
import { pushBackHandler } from "@/lib/back-intercept";
import { useT } from "@/lib/i18n";

/** A bounded, searchable choice list for the editor's large move/item catalogs. */
export function PokemonChoice({ label, value, options, disabled, onChange }: {
  label: string; value: number; options: string[]; disabled: boolean; onChange: (value: number) => void;
}) {
  const t=useT(), id=useId(), trigger=useRef<HTMLButtonElement>(null), menu=useRef<HTMLDivElement>(null), search=useRef<HTMLInputElement>(null);
  const [open,setOpen]=useState(false),[query,setQuery]=useState(""),[limit,setLimit]=useState(50);
  const needle=query.trim().toLocaleLowerCase();
  const matches=options.map((name,id)=>({name:name || "—",id})).filter(item=>!needle || item.name.toLocaleLowerCase().includes(needle) || String(item.id)===needle);
  const close=(restore=false)=>{setOpen(false);if(restore && trigger.current)advanceFocus(trigger.current);};
  useEffect(()=>{
    if(!open)return;
    const frame=requestAnimationFrame(()=>search.current?.focus({preventScroll:true}));
    const remove=pushBackHandler(()=>{close(true);return true;});
    const key=(event:globalThis.KeyboardEvent)=>{if(!isBackKey(event))return;event.preventDefault();event.stopImmediatePropagation();close(true);};
    window.addEventListener("keydown",key,true);
    return()=>{cancelAnimationFrame(frame);remove();window.removeEventListener("keydown",key,true);};
  },[open]);
  useEffect(()=>{if(disabled)setOpen(false);},[disabled]);
  const choose=(id:number)=>{onChange(id);close(true);};
  const onKeyDown=(event:KeyboardEvent<HTMLDivElement>)=>{
    if(event.key==="Tab"){
      // Leave the portalled menu in the form's normal tab order.
      event.preventDefault();
      const fields=[...document.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex="0"]')].filter(item=>!menu.current?.contains(item) && !!item.getClientRects().length && !item.closest('[inert]'));
      const at=fields.indexOf(trigger.current!);const next=fields[at+(event.shiftKey?-1:1)];close(false);if(next)advanceFocus(next);else trigger.current?.focus();return;
    }
    const items=[...menu.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []];
    const from=items.indexOf(event.target as HTMLButtonElement),direction=getDirection(event.nativeEvent);
    if(event.target===search.current && event.key==="Enter") {event.preventDefault();if(matches.length===1)choose(matches[0].id);else items[0]?.focus();return;}
    if(direction!=="up" && direction!=="down")return;
    event.preventDefault();event.stopPropagation();
    if(from===0 && direction==="up"){search.current?.focus();return;}
    const next=items[from<0?(direction==="down"?0:items.length-1):from+(direction==="down"?1:-1)];
    if(next)advanceFocus(next,direction);
  };
  return <div className="pokemon-choice"><span id={`${id}-label`}>{label}</span><button ref={trigger} type="button" disabled={disabled} aria-label={`${label}: ${options[value] || "—"}`} aria-haspopup="dialog" aria-expanded={open} onClick={()=>{setQuery("");setLimit(50);setOpen(!open);}}><span>{options[value] || "—"}</span><ChevronDown size={18}/></button>
    <AnchoredMenu anchorRef={trigger} open={open} onClose={()=>close(false)} backdrop={false} width={Math.min(340,window.innerWidth-24)}><div className="pokemon-choice-menu" role="dialog" aria-labelledby={`${id}-label`} ref={menu} onKeyDown={onKeyDown}>
      <label><Search size={18}/><input ref={search} value={query} placeholder={t("common.search")} aria-label={`${t("common.search")}: ${label}`} aria-controls={`${id}-list`} onChange={event=>{setQuery(event.target.value);setLimit(50);}}/></label>
      <div role="listbox" id={`${id}-list`} aria-label={label}>{matches.slice(0,limit).map(item=><button key={item.id} type="button" role="option" aria-selected={value===item.id} onClick={()=>choose(item.id)}><span>{item.name}</span>{value===item.id && <Check size={18}/>}</button>)}</div>
      {!matches.length && <p role="status">{t("games.pokemon.noChoices")}</p>}{matches.length>limit && <button className="pokemon-choice-more" type="button" onClick={()=>setLimit(n=>n+50)}>{t("games.pokemon.loadMore")}</button>}
    </div></AnchoredMenu>
  </div>;
}
