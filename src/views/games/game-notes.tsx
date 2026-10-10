import { useEffect, useId, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ArrowDown, ArrowUp, Download, LoaderCircle, Plus, Trash2, Upload, X } from "lucide-react";
import { isTauri } from "@tauri-apps/api/core";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useSectionBack } from "@/lib/section-back";
import { useT } from "@/lib/i18n";
import { saveTextFileWithPath } from "@/lib/download-text";
import { guideNoteImport } from "@/lib/games/guide-note-import";
import { NOTE_BODY_LIMIT, NOTE_LIMIT, NOTE_STORE_LIMIT, notebookDrafts as retained, mergeGameNotes, moveGameNote, notebookKey, noteUrl, parseNotebook, saveNotebook, type GameNote } from "@/lib/games/game-notes";
import type { NotebookGuide } from "./game-notes-launcher";
import "./game-notes.css";

// Retain unsaved drafts across in-app game/profile navigation, never across identities.
export function GameNotes({ profile, gameId, name, guide, onClose }: { profile: string; gameId: string; name: string; guide?: NotebookGuide; onClose: () => void }) {
  const t = useT(), title = useId(), key = notebookKey(profile, gameId), root = useRef<HTMLDivElement>(null), file = useRef<HTMLInputElement>(null), live = useRef(true), lock = useRef(false);
  const [initial] = useState(() => { try { const saved = localStorage.getItem(key), data = parseNotebook(saved), draft = retained.get(key); return { raw: draft ? draft.raw : saved, notes: draft?.notes ?? data.notes, error: "" }; } catch { return { raw: null, notes: retained.get(key)?.notes ?? [], error: "games.notes.readError" }; } });
  const [raw, setRaw] = useState(initial.raw), [notes, setNotes] = useState<GameNote[]>(initial.notes), [selected, select] = useState(initial.notes[0]?.id ?? ""), [preview, setPreview] = useState(false);
  const [error, setError] = useState(initial.error), [unreadable, setUnreadable] = useState(!!initial.error), [busy, setBusy] = useState(false), [notice, setNotice] = useState(false);
  const [confirm, setConfirm] = useState<"discard" | "delete" | "reload" | null>(null), [importing, setImporting] = useState(!!guide), [usingGuide, setUsingGuide] = useState(!!guide), [incoming, setIncoming] = useState<GameNote[]>([]), [split, setSplit] = useState(false), [replace, setReplace] = useState(false);
  const savedNotes = useMemo(() => { try { return parseNotebook(raw).notes; } catch { return []; } }, [raw]);
  const dirty = notes.length !== savedNotes.length || notes.some((note, index) => { const saved = savedNotes[index]; return !saved || note.id !== saved.id || note.title !== saved.title || note.body !== saved.body || note.source?.url !== saved.source?.url || note.source?.author !== saved.source?.author; }), current = notes.find(note => note.id === selected), index = notes.findIndex(note => note.id === selected);
  const { closing, close } = useModalExit(onClose);
  const confirmReturn = useRef<{ element: HTMLElement | null; selector: string }>({ element: null, selector: "" });
  const ask = (kind: "discard" | "delete" | "reload") => {
    const element = document.activeElement as HTMLElement | null;
    const label = element?.getAttribute("aria-label");
    confirmReturn.current = { element, selector: element instanceof HTMLTextAreaElement ? "textarea" : element?.matches("[data-note-title]") ? "[data-note-title]" : label ? `[aria-label="${CSS.escape(label)}"]` : "" };
    setConfirm(kind);
  };
  const dismiss = () => { if (lock.current) return; if (confirm) setConfirm(null); else if (importing) setImporting(false); else if (dirty) ask("discard"); else close(); };
  useSectionBack(dismiss, true, true);
  useEffect(() => { if (dirty) retained.set(key, { raw, notes }); else retained.delete(key); }, [key, raw, notes, dirty]);
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key !== key && event.key !== null) return;
      if (dirty || lock.current) { setError("games.notes.conflict"); return; }
      try {
        const next = localStorage.getItem(key), data = parseNotebook(next);
        setRaw(next); setNotes(data.notes); select(data.notes.some(note => note.id === selected) ? selected : data.notes[0]?.id ?? ""); setError(""); setUnreadable(false); setNotice(false);
      } catch { setUnreadable(true); setError("games.notes.readError"); }
    };
    window.addEventListener("storage", changed); return () => window.removeEventListener("storage", changed);
  }, [key, dirty, selected]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    live.current = true; const previous = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true }));
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !root.current || event.defaultPrevented) return;
      const elements = [...root.current.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),a[href]')].filter(el => el.getClientRects().length && !el.closest("[inert]")), first = elements[0], last = elements.at(-1);
      if (event.shiftKey && (document.activeElement === first || !root.current.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !root.current.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", trap);
    return () => { live.current = false; document.removeEventListener("keydown", trap); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => {
    if (!confirm) return;
    const previous = confirmReturn.current;
    root.current?.querySelector<HTMLButtonElement>('[data-note-confirm] button')?.focus();
    return () => { requestAnimationFrame(() => { const target = previous.element?.isConnected ? previous.element : previous.selector ? root.current?.querySelector<HTMLElement>(previous.selector) : null; (target ?? root.current?.querySelector<HTMLElement>("button"))?.focus({ preventScroll: true }); }); };
  }, [confirm]);
  useEffect(() => {
    const editor = root.current?.querySelector<HTMLElement>(".games-notes-editor");
    if (!editor || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const motion = editor.animate([{ opacity: .4, transform: "translateY(4px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 170, easing: "ease-out" });
    return () => motion.cancel();
  }, [selected, preview]);
  const change = (next: GameNote[]) => { setNotes(next); setNotice(false); setError(""); };
  const add = () => { const note = { id: crypto.randomUUID(), title: t("games.notes.new"), body: "" }; change([...notes, note]); select(note.id); setPreview(false); requestAnimationFrame(() => root.current?.querySelector<HTMLInputElement>('[data-note-title]')?.focus()); };
  const save = async () => {
    if (lock.current || unreadable) return;
    if (notes.some(note => !note.title.trim())) { setError("games.notes.invalidTitle"); return; }
    lock.current = true; setBusy(true); setError("");
    try { const result = await saveNotebook(profile, gameId, raw, notes); retained.delete(key); if (live.current) { setRaw(result.raw); setNotes(result.data.notes); setNotice(true); } }
    catch (failure) { if (live.current) setError(failure instanceof Error && failure.message.startsWith("games.notes.") ? failure.message : "games.notes.saveError"); }
    finally { lock.current = false; if (live.current) setBusy(false); }
  };
  const reload = () => { try { const next = localStorage.getItem(key), data = parseNotebook(next); retained.delete(key); setRaw(next); setNotes(data.notes); select(data.notes[0]?.id ?? ""); setUnreadable(false); setError(""); setConfirm(null); } catch { setError("games.notes.readError"); } };
  const exportNotes = async () => { if (lock.current) return; lock.current = true; setBusy(true); try { const data = unreadable ? localStorage.getItem(key) ?? "" : JSON.stringify({ version: 1, revision: 0, notes }, null, 2); await saveTextFileWithPath("Harbor game notes.json", data, ["json"], "Harbor", { nativeFailure: "throw" }); } catch { if (live.current) setError("games.notes.saveError"); } finally { lock.current = false; if (live.current) setBusy(false); } };
  const importFile = async (chosen: File | undefined) => { if (!chosen || lock.current) return; lock.current = true; setBusy(true); try { if (chosen.size > NOTE_STORE_LIMIT) throw Error(); const data = parseNotebook(await chosen.text()); if (live.current) { setIncoming(data.notes); setUsingGuide(false); setImporting(true); setReplace(false); } } catch { if (live.current) setError("games.notes.readError"); } finally { lock.current = false; if (live.current) setBusy(false); if (file.current) file.current.value = ""; } };
  const review = useMemo(() => { if (!importing) return { notes: [], error: false }; try { return { notes: guide && usingGuide ? guideNoteImport(guide.item, guide.article, split) : incoming, error: false }; } catch { return { notes: [], error: true }; } }, [importing, guide, usingGuide, split, incoming]);
  const applyImport = () => { try { const next = mergeGameNotes(notes, review.notes, replace); change(next); select(next[0]?.id ?? ""); setImporting(false); } catch { setError("games.notes.limit"); } };
  const link = (href: string | undefined, text: React.ReactNode) => { const url = href && noteUrl(href); return url ? <a href={url} target="_blank" rel="noopener noreferrer" onClick={event => { if (!isTauri()) return; event.preventDefault(); void import("@tauri-apps/plugin-opener").then(({ openUrl }) => openUrl(url)).catch(() => { if (live.current) setError("games.links.openError"); }); }}>{text}</a> : <span>{text}</span>; };
  return <ModalShell closing={closing} onDismiss={dismiss} labelledBy={title} width={960} backdropClassName="games-notes-backdrop"><div className="games-notes" ref={root}>
    <header><div><h2 id={title}>{t("games.notes.title")}</h2><p dir="auto">{name}</p></div><button className="games-icon-button" aria-label={t("common.close")} disabled={busy} onClick={dismiss}><X size={21}/></button></header>
    {confirm && <div className="games-notes-confirm-layer"><section className="games-notes-confirm" data-note-confirm role="alertdialog" aria-label={t(`games.notes.${confirm}`)}><h3>{t(`games.notes.${confirm}`)}</h3><div className="games-notes-confirm-actions"><button className="games-button" onClick={() => setConfirm(null)}>{t("common.cancel")}</button><button className="games-button games-button-primary" onClick={() => { if (confirm === "discard") { retained.delete(key); close(); } else if (confirm === "reload") reload(); else { const next = notes.filter(note => note.id !== selected); change(next); select(next[Math.min(index, next.length - 1)]?.id ?? ""); setConfirm(null); } }}>{t(confirm === "discard" ? "games.notes.discardAction" : confirm === "delete" ? "common.delete" : "common.confirm")}</button></div></section></div>}<div className="games-notes-content" inert={!!confirm}>{importing ? <section className="games-notes-import"><h3>{t("games.notes.importReview")}</h3>{guide && usingGuide && <><p>{guide.article.title} · {guide.item.author}</p><label><input type="checkbox" checked={split} onChange={event => setSplit(event.target.checked)}/>{t("games.notes.sections")}</label></>}<p>{t("games.notes.importCount", { count: review.notes.length })}</p>{review.error && <p role="alert">{t("games.notes.limit")}</p>}<ul>{review.notes.map(note => <li key={note.id}>{note.title}</li>)}</ul><label><input type="checkbox" checked={replace} onChange={event => setReplace(event.target.checked)}/>{t("games.notes.replace")}</label><div><button className="games-button" onClick={() => setImporting(false)}>{t("common.cancel")}</button><button className="games-button games-button-primary" disabled={unreadable || review.error || !review.notes.length} onClick={applyImport}>{t("games.notes.addDraft")}</button></div></section> : <div className="games-notes-workspace">
      <aside aria-label={t("games.notes.title")}><button className="games-button" disabled={busy || unreadable || notes.length >= NOTE_LIMIT} onClick={add}><Plus size={16}/>{t("games.notes.new")}</button><nav>{notes.map(note => <button key={note.id} aria-current={note.id === selected ? "page" : undefined} onClick={() => select(note.id)} dir="auto">{note.title || t("games.notes.new")}</button>)}</nav></aside>
      <section className="games-notes-editor">{current ? <><div className="games-notes-toolbar"><div><button className="games-button" aria-pressed={!preview} onClick={() => setPreview(false)}>{t("common.edit")}</button><button className="games-button" aria-pressed={preview} onClick={() => setPreview(true)}>{t("games.notes.preview")}</button></div><div><button className="games-icon-button" aria-label={t("games.notes.up")} disabled={busy || unreadable || index <= 0} onClick={() => change(moveGameNote(notes, selected, -1))}><ArrowUp size={17}/></button><button className="games-icon-button" aria-label={t("games.notes.down")} disabled={busy || unreadable || index === notes.length - 1} onClick={() => change(moveGameNote(notes, selected, 1))}><ArrowDown size={17}/></button><button className="games-icon-button" aria-label={t("common.delete")} disabled={busy || unreadable} onClick={() => ask("delete")}><Trash2 size={17}/></button></div></div>
        {preview ? <article className="games-notes-markdown"><h3 dir="auto">{current.title}</h3>{current.body ? <ReactMarkdown skipHtml urlTransform={url => noteUrl(url) ?? ""} components={{ a: ({ href, children }) => link(href, children), img: ({ src, alt }) => link(typeof src === "string" ? src : undefined, alt || t("games.notes.image")) }}>{current.body}</ReactMarkdown> : <p>{t("games.notes.emptyBody")}</p>}</article> : <><label>{t("games.notes.noteTitle")}<input aria-label={t("games.notes.noteTitle")} data-note-title dir="auto" value={current.title} maxLength={120} disabled={busy || unreadable} onChange={event => change(notes.map(note => note.id === selected ? { ...note, title: event.target.value } : note))}/></label><label className="games-notes-body">{t("games.notes.body")}<textarea aria-label={t("games.notes.body")} dir="auto" value={current.body} maxLength={NOTE_BODY_LIMIT} disabled={busy || unreadable} onChange={event => change(notes.map(note => note.id === selected ? { ...note, body: event.target.value } : note))}/></label></>}
        {current.source && <p className="games-notes-source">{link(current.source.url, current.source.author || t("games.guides.original"))}</p>}
      </> : <div className="games-notes-empty"><h3>{t("games.notes.empty")}</h3><p>{t("games.notes.emptyBody")}</p></div>}</section>
    </div>}
    {error && <p className="games-notes-error" role="alert">{t(error)} <button className="games-button" disabled={busy} onClick={() => dirty ? ask("reload") : reload()}>{t("common.retry")}</button></p>}{notice && <p className="games-notes-status" role="status">{t("games.notes.saved")}</p>}
    </div><footer inert={!!confirm} data-confirming={!!confirm}><div><input ref={file} type="file" accept=".json,application/json" hidden onChange={event => void importFile(event.target.files?.[0])}/><button className="games-button" disabled={busy || unreadable || importing || !!confirm} onClick={() => file.current?.click()}><Upload size={15}/>{t("games.notes.import")}</button><button className="games-button" disabled={busy} onClick={() => void exportNotes()}><Download size={15}/>{t("games.notes.export")}</button></div><span>{t(dirty ? "games.notes.unsaved" : "games.notes.local")}</span><button className="games-button games-button-primary" disabled={busy || unreadable || !dirty || importing || !!confirm} onClick={() => void save()}>{busy && <LoaderCircle size={16} className="games-notes-spinner"/>}{t(busy ? "common.loading" : "common.save")}</button></footer>
  </div></ModalShell>;
}
