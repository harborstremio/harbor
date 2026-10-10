import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Check, Eye, EyeOff, FolderPlus, Pin, PinOff, SquareCheck, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useSectionBack } from "@/lib/section-back";
import { toggleLibrarySelection, type LibrarySelectionChange, type LibrarySelectionOutcome } from "@/lib/games/library-selection";
import type { PersonalCollectionGame } from "@/lib/games/personal-collections";
import "./game-library-selection.css";

type Item = { id: string; name: string; pinned: boolean; hidden: boolean; game?: PersonalCollectionGame | null };
type Change = LibrarySelectionChange;
export function useLibrarySelection({ items, scope, active, update, collect }: {
  items: Item[]; scope: string; active: boolean;
  update: (ids: string[], patch: Change) => Promise<LibrarySelectionOutcome>; collect?: (games: PersonalCollectionGame[]) => void;
}) {
  const t = useT(), [mode, setMode] = useState(false), [selected, setSelected] = useState<string[]>([]), [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{key:string;count?:number;total?:number}|null>(null);
  const message = notice ? t(notice.key, {count:notice.count??0,total:notice.total??0}) : "";
  const anchor = useRef<string | null>(null), trigger = useRef<HTMLButtonElement>(null), liveScope = useRef(scope), pending = useRef(false);
  liveScope.current = scope;
  const ids = items.map(item => item.id), key = JSON.stringify(ids), selectedSet = new Set(selected), chosen = items.filter(item => selectedSet.has(item.id));
  const close = () => { if (pending.current) return; setMode(false); setSelected([]); anchor.current = null; trigger.current?.focus({ preventScroll: true }); };
  useSectionBack(close, active && mode);
  useEffect(() => { setMode(false); setSelected([]); setNotice(null); anchor.current = null; }, [scope, active]);
  useEffect(() => { const allowed = new Set(ids); setSelected(previous => previous.filter(id => allowed.has(id))); }, [key]);
  const toggle = (id: string, extend = false) => {
    if (pending.current) return;
    setSelected(previous => toggleLibrarySelection(previous, ids, id, anchor.current, extend));
    if (!extend || !anchor.current) anchor.current = id;
    setNotice(null);
  };
  const apply = async (patch: Change) => {
    if (!chosen.length || pending.current) return;
    pending.current = true; setBusy(true); setNotice(null);
    const requestedScope = scope;
    try {
      const result = await update(chosen.map(item => item.id), patch);
      if (liveScope.current === requestedScope) {
        const completed = new Set(typeof result === "boolean" ? result ? chosen.map(item => item.id) : [] : result.completed);
        const count = chosen.filter(item => completed.has(item.id)).length;
        setSelected(previous => previous.filter(id => !completed.has(id))); anchor.current = null;
        setNotice({key: count === chosen.length
          ? `games.selection.${patch.hidden !== undefined ? patch.hidden ? "hidden" : "shown" : patch.pinned ? "pinned" : "unpinned"}`
          : count ? "games.selection.partial" : "games.selection.failed", count, total:chosen.length});
        // Hiding can remove the focused card. Keep the selection controls reachable.
        requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }));
      }
    } catch { if (liveScope.current === requestedScope) setNotice({key:"games.selection.failed"}); }
    finally { pending.current = false; setBusy(false); }
  };
  const props = (id: string, name: string, open: (event: MouseEvent<HTMLButtonElement>) => void) => ({
    "aria-pressed": mode ? selected.includes(id) : undefined,
    ...(mode ? { "aria-label": t("games.selection.game", { name }), "data-selectable": true } : {}),
    onClick: (event: MouseEvent<HTMLButtonElement>) => mode ? toggle(id, event.shiftKey) : open(event),
  });
  return { mode, selected, chosen, busy, message, trigger, props, close, apply,
    toggleAll: () => { if (!pending.current) { setSelected(chosen.length === items.length ? [] : ids); setNotice(null); } },
    start: () => { setMode(true); setNotice(null); }, total: items.length,
    collect: collect && chosen.length && chosen.every(item => item.game) ? () => collect(chosen.map(item => item.game!)) : undefined,
  };
}
export type LibrarySelection = ReturnType<typeof useLibrarySelection>;

export function LibrarySelectButton({ selection, disabled = false }: { selection: LibrarySelection; disabled?: boolean }) {
  const t = useT();
  return <button ref={selection.trigger} className="games-button games-library-select" aria-pressed={selection.mode} disabled={(!selection.mode && disabled) || selection.busy} onClick={selection.mode ? selection.close : selection.start}>
    {selection.mode ? <X size={16} /> : <SquareCheck size={16} />}{t(selection.mode ? "common.done" : "games.selection.start")}
  </button>;
}
export function LibrarySelectionMark({ selection, id }: { selection: LibrarySelection; id: string }) {
  return selection.mode ? <span className="games-selection-check" data-checked={selection.selected.includes(id)} aria-hidden="true">{selection.selected.includes(id) && <Check size={15} strokeWidth={2.5} />}</span> : null;
}
export function LibrarySelectionBar({ selection }: { selection: LibrarySelection }) {
  const t = useT(), { chosen, busy, message } = selection;
  const allPinned = chosen.length > 0 && chosen.every(item => item.pinned), allHidden = chosen.length > 0 && chosen.every(item => item.hidden);
  return <>{selection.mode && <div className="games-selection-bar" aria-label={t("games.selection.actions")} aria-busy={busy}>
    <div className="games-selection-summary"><strong role="status">{t("games.selection.count", { count: chosen.length })}</strong><button disabled={busy || !selection.total} onClick={selection.toggleAll}>{t(chosen.length === selection.total && selection.total ? "games.selection.clear" : "games.selection.all", { count: selection.total })}</button></div>
    <div className="games-selection-actions"><button className="games-button" disabled={busy || !chosen.length} onClick={() => void selection.apply({ pinned: !allPinned })}>{allPinned ? <PinOff size={16} /> : <Pin size={16} />}{t(allPinned ? "games.selection.unpin" : "games.selection.pin")}</button>
      <button className="games-button" disabled={busy || !chosen.length} onClick={() => void selection.apply({ hidden: !allHidden })}>{allHidden ? <Eye size={16} /> : <EyeOff size={16} />}{t(allHidden ? "games.selection.show" : "games.selection.hide")}</button>
      <button className="games-button" disabled={busy || !selection.collect} onClick={selection.collect} title={chosen.length && !selection.collect ? t("games.selection.matchNote") : undefined}><FolderPlus size={16} />{t("games.selection.collection")}</button>
    </div>{chosen.length > 0 && !selection.collect && <p>{t("games.selection.matchNote")}</p>}
  </div>}{message && <p className="games-selection-result" role="status">{message}</p>}</>;
}
