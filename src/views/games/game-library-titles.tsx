import { useEffect, useId, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useSectionBack } from "@/lib/section-back";
import { useT, useUiLanguage } from "@/lib/i18n";
import type { GameLibraryPreferences } from "@/hooks/use-game-library-preferences";
import { defaultLibraryTitleRules, libraryTitleChanges, reviewLibraryTitles, type LibraryTitleItem, type LibraryTitleRules } from "@/lib/games/library-titles";
import "./game-library-titles.css";

export function GameLibraryTitles({ preferences, items, selectedIds, onClose, onApplied }: {
  preferences: GameLibraryPreferences; items: LibraryTitleItem[]; selectedIds: string[];
  onClose: () => void; onApplied: (count: number) => void;
}) {
  const t = useT(), language = useUiLanguage(), titleId = useId(), root = useRef<HTMLFormElement>(null);
  const initial = useRef(preferences.data), pending = useRef(false), mounted = useRef(true);
  const [draft,setDraft] = useState<LibraryTitleRules>(()=>({...defaultLibraryTitleRules(),...initial.current.titleRules,locale:language}));
  const [scope,setScope] = useState(selectedIds.length ? "selected" : "all"), [restore,setRestore] = useState(false), [limit,setLimit] = useState(80);
  const {closing,close} = useModalExit(onClose);
  const dismiss = () => { if (!pending.current && !preferences.busy) close(); };
  useSectionBack(dismiss,true);
  useEffect(()=>{
    mounted.current = true;
    const previous = document.activeElement as HTMLElement | null;
    // Let the opening pointer event finish before taking modal focus.
    const focusFrame = requestAnimationFrame(()=>root.current?.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true}));
    const trap = (event:KeyboardEvent) => {
      if (event.key !== "Tab" || event.defaultPrevented || !root.current) return;
      const targets = [...root.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled)')].filter(element=>element.getClientRects().length);
      if (!root.current.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? targets.at(-1) : targets[0])?.focus(); }
      else if (event.shiftKey && document.activeElement===targets[0]) { event.preventDefault(); targets.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement===targets.at(-1)) { event.preventDefault(); targets[0]?.focus(); }
    };
    document.addEventListener("keydown",trap);
    return()=>{mounted.current=false;cancelAnimationFrame(focusFrame);document.removeEventListener("keydown",trap);previous?.isConnected&&previous.focus({preventScroll:true});};
  },[]);
  const selected = useMemo(()=>new Set(selectedIds),[selectedIds]);
  const targets = useMemo(()=>scope==="selected"?items.filter(item=>selected.has(item.id)):items,[items,scope,selected]);
  const rows = useMemo(()=>reviewLibraryTitles(targets,draft,restore),[targets,draft,restore]);
  const changed = rows.filter(row=>row.changed);
  const patch = (value:Partial<LibraryTitleRules>) => {setDraft(previous=>({...previous,...value}));setLimit(80);};
  const save = async () => {
    if (pending.current || preferences.busy || !preferences.ready) return;
    pending.current = true;
    const rules = restore ? initial.current.titleRules ?? defaultLibraryTitleRules() : {
      ...draft, existingIds:draft.automatic ? items.map(item=>item.id) : [],
    };
    // Restore also removes a same-spelling local override. A null title explicitly
    // opts that game out of automatic formatting without discarding other preferences.
    const updates = libraryTitleChanges(items,rows,initial.current.entries,rules,restore);
    try {
      if (await preferences.updateTitles(updates,rules,initial.current.titleRules) && mounted.current) {onApplied(changed.length);close();}
    } finally {pending.current=false;}
  };
  return <ModalShell closing={closing} onDismiss={dismiss} labelledBy={titleId} width={820} backdropClassName="games-library-personal-backdrop">
    <form className="games-library-titles" ref={root} onSubmit={event=>{event.preventDefault();void save();}}>
      <header><div><h2 id={titleId}>{t("games.titles.title")}</h2><p>{t("games.titles.note")}</p></div><button type="button" className="games-icon-button" disabled={preferences.busy} aria-label={t("common.close")} onClick={dismiss}><X size={21}/></button></header>
      <div className="games-title-scroll">
        <div className="games-title-scope" role="group" aria-label={t("games.titles.title")}>
          <button type="button" disabled={preferences.busy} aria-pressed={scope==="all"} onClick={()=>{setScope("all");setLimit(80);}}>{t("games.sidebar.allGames")} <span>{items.length.toLocaleString(language)}</span></button>
          {!!selectedIds.length&&<button type="button" disabled={preferences.busy} aria-pressed={scope==="selected"} onClick={()=>{setScope("selected");setLimit(80);}}>{t("games.selection.count",{count:selectedIds.length})}</button>}
        </div>
        <label className="games-title-toggle"><input type="checkbox" checked={restore} disabled={preferences.busy} onChange={event=>setRestore(event.target.checked)}/>{t("games.titles.restore")}</label>
        {!restore&&<fieldset disabled={preferences.busy} className="games-title-rules">
          <div className="games-title-terms"><label>{t("games.titles.ignored")}<textarea value={draft.ignored} maxLength={2000} rows={2} placeholder="NieR eFootball" onChange={event=>patch({ignored:event.target.value})}/></label><label>{t("games.titles.uppercase")}<textarea value={draft.uppercase} maxLength={2000} rows={2} placeholder="RPG VR" onChange={event=>patch({uppercase:event.target.value})}/></label></div>
          <label className="games-title-toggle"><input type="checkbox" checked={draft.dashToColon} onChange={event=>patch({dashToColon:event.target.checked})}/>{t("games.titles.dash")}</label>
          <label className="games-title-toggle"><input type="checkbox" checked={draft.automatic} onChange={event=>patch({automatic:event.target.checked})}/><span>{t("games.titles.automatic")}<small>{t("games.titles.newNote")}</small></span></label>
        </fieldset>}
        <div className="games-title-review"><div className="games-title-review-heading"><span>{t("games.titles.current")}</span><span>{t("games.titles.preview")}</span></div>
          {rows.slice(0,limit).map(row=><div key={row.id} className="games-title-review-row" data-title-id={row.id} data-changed={row.changed}><span dir="auto">{row.name}</span><strong dir="auto">{row.next}</strong></div>)}
          {rows.length>limit&&<button type="button" className="games-button" onClick={()=>setLimit(value=>value+80)}>{t("games.library.showMore")}</button>}
        </div>
        <p className="games-title-count" role="status">{t(changed.length?"games.titles.changes":"games.titles.unchanged",{count:changed.length})}</p>
        {preferences.error&&<p role="alert" className="games-title-error">{t(preferences.error)}</p>}
      </div>
      <footer><button type="button" className="games-button" disabled={preferences.busy} onClick={dismiss}>{t("common.cancel")}</button><button type="submit" className="games-button games-button-primary" disabled={preferences.busy||!preferences.ready}>{t(preferences.busy?"common.loading":"common.save")}</button></footer>
    </form>
  </ModalShell>;
}
