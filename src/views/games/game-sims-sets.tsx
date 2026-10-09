import { useEffect, useId, useRef, useState } from "react";
import { Check, LoaderCircle, Plus, X } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useSectionBack } from "@/lib/section-back";
import { useT } from "@/lib/i18n";
import { simsError, simsSets, simsSetSave, simsSetRemove, type SimsModSet, type SimsWorkspace } from "@/lib/games/sims";
import type { SimsSelection } from "./game-sims-review";

export function GameSimsSets({ profile, data, active, disabled, refreshKey, choose, editing }: {
  profile: string; data: SimsWorkspace; active: boolean; disabled: boolean; refreshKey: number;
  choose: (selection: SimsSelection) => void; editing: (open: boolean) => void;
}) {
  const t = useT(), path = data.folder.path;
  const [sets, setSets] = useState<SimsModSet[]>([]), [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true), [error, setError] = useState(""), [attempt, setAttempt] = useState(0);
  const [editor, setEditor] = useState<{ previous: SimsModSet | null; trigger: HTMLElement | null } | null>(null);
  useEffect(() => {
    if (!active) { setEditor(null); return; }
    let live = true; setLoading(true); setError("");
    void simsSets(profile, path).then(value => { if (live) { setSets(value); setSelected(id => value.some(s => s.id === id) ? id : value[0]?.id ?? ""); } }, reason => { if (live) setError(simsError(reason)); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [profile, path, active, refreshKey, attempt]);
  useEffect(() => { editing(!!editor); return () => editing(false); }, [editor, editing]);
  const selectedSet = sets.find(set => set.id === selected);
  const missing = selectedSet?.members.some(member => !data.state.groups.some(g => g.id === member.id));
  const current = !!selectedSet && !missing && selectedSet.members.every(member => data.state.groups.find(g => g.id === member.id)?.enabled === member.enabled);
  const open = (previous: SimsModSet | null) => setEditor({ previous, trigger: document.activeElement as HTMLElement | null });
  const unavailable = disabled || loading || !!error;
  return <section className="games-sims-sets" aria-label={t("games.sims.sets")}>
    <header><div><h3>{t("games.sims.sets")}</h3><p>{t("games.sims.setsNote")}</p></div><button className="games-button" disabled={unavailable || !data.state.groups.length} onClick={() => open(null)}><Plus size={17}/>{t("games.sims.newSet")}</button></header>
    {loading && <p className="games-sims-pending" role="status"><LoaderCircle size={17}/>{t("common.loading")}</p>}
    {error && <p role="alert">{t(error)} <button className="games-button" onClick={() => setAttempt(n => n + 1)}>{t("common.retry")}</button></p>}
    {!loading && !error && selectedSet && <><div className="games-sims-set-controls">
      {active && <Dropdown value={selected} ariaLabel={t("games.sims.sets")} options={sets.map(set => ({ value: set.id, label: set.title }))} onChange={setSelected}/>}
      <button className="games-button" disabled={unavailable || current || missing} onClick={() => choose({ action: { kind: "applySet", id: selectedSet.id, backupFolder: "" }, title: selectedSet.title, sources: [] })}>{t("games.sims.switchSet")}</button>
      <button className="games-detail-text-button" disabled={unavailable} onClick={() => open(selectedSet)}>{t("games.sims.editSet")}</button>
      {current && <small className="games-sims-set-current"><Check size={15}/>{t("games.sims.setCurrent")}</small>}
    </div>{missing && <p className="games-sims-warning">{t("games.sims.setMissing")}</p>}</>}
    {!loading && !error && !sets.length && <small>{t(data.state.groups.length ? "games.sims.emptySets" : "games.sims.setsNeedMods")}</small>}
    {active && editor && <SetEditor key={`${path}:${editor.previous?.id ?? "new"}`} profile={profile} data={data} previous={editor.previous} trigger={editor.trigger} onClose={() => setEditor(null)} onSaved={(value, id) => { setSets(value); setSelected(id); setEditor(null); }}/>} 
  </section>;
}

function SetEditor({ profile, data, previous, trigger, onClose, onSaved }: {
  profile: string; data: SimsWorkspace; previous: SimsModSet | null; trigger: HTMLElement | null;
  onClose: () => void; onSaved: (sets: SimsModSet[], id: string) => void;
}) {
  const t = useT(), id = useId(), root = useRef<HTMLDivElement>(null), alive = useRef(true), saving = useRef(false);
  const [name, setName] = useState(previous?.title ?? ""), [busy, setBusy] = useState(false), [error, setError] = useState(""), [deleting, setDeleting] = useState(false);
  const [members, setMembers] = useState(() => data.state.groups.map(group => ({ id: group.id, enabled: previous?.members.find(m => m.id === group.id)?.enabled ?? group.enabled })));
  const { closing, close: animateClose } = useModalExit(onClose);
  const close = () => { if (!saving.current) animateClose(); };
  useSectionBack(() => { if (deleting) setDeleting(false); else close(); }, true);
  useEffect(() => {
    alive.current = true; root.current?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const nodes = [...root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)') ?? []].filter(n => n.getClientRects().length);
      if (!nodes.length) { event.preventDefault(); root.current?.focus(); }
      else if (event.shiftKey && (document.activeElement === nodes[0] || !root.current?.contains(document.activeElement))) { event.preventDefault(); nodes.at(-1)?.focus(); }
      else if (!event.shiftKey && (document.activeElement === nodes.at(-1) || !root.current?.contains(document.activeElement))) { event.preventDefault(); nodes[0]?.focus(); }
    };
    document.addEventListener("keydown", trap);
    return () => { alive.current = false; document.removeEventListener("keydown", trap); requestAnimationFrame(() => { if (trigger?.isConnected) trigger.focus({ preventScroll: true }); }); };
  }, [trigger]);
  const save = async (remove = false) => {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError(""); root.current?.focus();
    try {
      const result = remove && previous ? await simsSetRemove(profile, data.folder.path, previous) : await simsSetSave(profile, data.folder.path, { revision: data.state.revision, previous, title: name.trim(), members });
      if (alive.current) onSaved(result, remove ? result[0]?.id ?? "" : result.at(-1)?.id ?? "");
    } catch (reason) { if (alive.current) setError(simsError(reason)); }
    finally { saving.current = false; if (alive.current) setBusy(false); }
  };
  const removed = previous?.members.some(member => !data.state.groups.some(g => g.id === member.id));
  return <ModalShell closing={closing} onDismiss={close} labelledBy={id} width={640} backdropClassName="games-sims-scrim"><div className="games-sims-dialog" ref={root} tabIndex={-1}>
    <header><div><small>The Sims 4</small><h2 id={id}>{t(previous ? "games.sims.editSet" : "games.sims.newSet")}</h2></div><button className="games-icon-button" disabled={busy} aria-label={t("common.close")} onClick={close}><X size={20}/></button></header>
    <div className="games-sims-dialog-body">
      <label className="games-sims-name" data-tv-focus-container>{t("games.sims.setName")}<input value={name} maxLength={100} disabled={busy} onChange={e => setName(e.target.value)}/></label>
      <p>{t("games.sims.setEditNote")}</p>
      {removed && <p>{t("games.sims.setRemovedNote")}</p>}
      <div className="games-sims-set-members">{data.state.groups.map(group => <button key={group.id} role="checkbox" aria-checked={members.find(m => m.id === group.id)?.enabled ?? false} className="games-sims-set-member" disabled={busy} onClick={() => setMembers(value => value.map(m => m.id === group.id ? { ...m, enabled: !m.enabled } : m))}><span className="games-sims-check" aria-hidden="true">{members.find(m => m.id === group.id)?.enabled && <Check size={14}/>}</span><span dir="auto">{group.title}</span><small>{t("games.sims.setFiles", { count: group.files.length })}</small></button>)}</div>
      {deleting && <p role="alert">{t("games.sims.deleteSetNote")}</p>}
      {busy && <p className="games-sims-pending" role="status"><LoaderCircle size={18}/>{t("common.loading")}</p>}
      {error && <p role="alert">{t(error)}</p>}
    </div>
    <footer>{previous && <button className="games-detail-text-button games-sims-set-delete" disabled={busy} onClick={() => deleting ? void save(true) : setDeleting(true)}>{t("games.sims.deleteSet")}</button>}<button className="games-button" disabled={busy} onClick={() => deleting ? setDeleting(false) : close()}>{t("common.cancel")}</button>{!deleting && <button className="games-button games-button-primary" disabled={busy || !name.trim() || !members.length} onClick={() => void save()}>{t("games.sims.saveSet")}</button>}</footer>
  </div></ModalShell>;
}
