import { useEffect, useId, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ArrowLeft, ArrowRight, FolderOpen, Recycle, RotateCcw, Search, X } from "lucide-react";
import { LoaderCircle } from "@/components/icons/music-icons";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useSectionBack } from "@/lib/section-back";
import { useT } from "@/lib/i18n";
import { transferBytes } from "@/lib/games/transfers";
import { archiveDestinationParts, type ArchiveJob, type ArchiveProgress } from "@/lib/games/archives";
import { cleanupError, cleanupItems, cleanupLabel, cleanupPending, type CleanupRecord, type CleanupReview } from "@/lib/games/archive-cleanup";
import "./game-source-links.css";
import "./game-archive-cleanup.css";

export function GameArchiveCleanup({ profile, jobs, onClose }: { profile: string; jobs: ArchiveJob[]; onClose: () => void }) {
  const t = useT(), title = useId(), root = useRef<HTMLDivElement>(null);
  const { closing, close } = useModalExit(onClose);
  const [records, setRecords] = useState<CleanupRecord[]>([]), [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<string | null>(null), [review, setReview] = useState<CleanupReview | null>(null);
  const [query, setQuery] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [progress, setProgress] = useState<ArchiveProgress | null>(null);
  const live = useRef(true), pending = useRef(false), operation = useRef(""), token = useRef("");
  const listener = useRef<Promise<() => void>>(Promise.resolve(() => {}));
  const items = cleanupItems(jobs, records, profile), item = items.find(entry => entry.id === selected);
  const record = item?.record, files = review?.files ?? record?.files ?? [];
  const parent = record?.parent ?? archiveDestinationParts(files[0]?.path ?? "").parent;
  const cancel = () => { if (operation.current) void invoke("games_cancel_archive", { profile, operationId: operation.current }).catch(() => {}); };
  const discard = () => { const value = token.current; token.current = ""; if (value) void invoke("games_discard_archive_cleanup", { profile, token: value }).catch(() => {}); };
  const dismiss = () => { live.current = false; cancel(); discard(); close(); };
  const back = () => {
    if (pending.current) return;
    const id = selected;
    discard(); setReview(null); setSelected(null); setError("");
    requestAnimationFrame(() => { if (id) root.current?.querySelector<HTMLElement>(`[data-cleanup-job="${CSS.escape(id)}"]`)?.focus({ preventScroll: true }); });
  };
  useSectionBack(() => { if (selected && !busy) back(); else dismiss(); }, true);
  const refresh = async () => {
    const next = await invoke<CleanupRecord[]>("games_archive_cleanup_records", { profile });
    if (live.current) { setRecords(next.filter(value => value.profile === profile)); setLoaded(true); }
  };
  useEffect(() => {
    live.current = true;
    const previous = document.activeElement as HTMLElement | null, dialog = root.current;
    dialog?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !dialog || [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].at(-1) !== dialog.closest('[role="dialog"]')) return;
      const controls = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),summary')].filter(el => el.getClientRects().length);
      const index = controls.indexOf(document.activeElement as HTMLElement);
      if (controls.length && (index < 0 || event.shiftKey && index === 0 || !event.shiftKey && index === controls.length - 1)) {
        event.preventDefault(); (event.shiftKey ? controls.at(-1) : controls[0])?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    listener.current = listen<ArchiveProgress>("games:archive-progress", ({ payload }) => {
      if (live.current && payload.profile === profile && payload.operationId === operation.current) setProgress(payload);
    }).catch(() => () => {});
    void refresh().catch(reason => { if (live.current) setError(cleanupError(reason)); });
    return () => { live.current = false; cancel(); discard(); void listener.current.then(stop => stop()); document.removeEventListener("keydown", trap); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, [profile]);
  useEffect(() => {
    if (!selected || busy) return;
    root.current?.querySelector<HTMLElement>(".games-cleanup-detail-title")?.focus({ preventScroll: true });
  }, [selected, busy]);
  const [busyLabel, setBusyLabel] = useState("common.loading");
  const task = async (id: string, action: () => Promise<void>, label = "common.loading") => {
    if (pending.current || !live.current) return;
    pending.current = true; operation.current = id; setBusy(true); setBusyLabel(label); setError(""); setProgress(null);
    try { await listener.current; if (live.current) await action(); }
    catch (reason) { if (live.current) setError(cleanupError(reason)); }
    finally { pending.current = false; operation.current = ""; if (live.current) { setBusy(false); setProgress(null); } }
  };
  const inspect = (job: ArchiveJob) => {
    discard(); setReview(null); setSelected(job.id);
    const operationId = crypto.randomUUID();
    void task(operationId, async () => {
      const result = await invoke<CleanupReview>("games_review_archive_cleanup", { profile, id: job.id, operationId });
      if (!live.current) { if (result.token) await invoke("games_discard_archive_cleanup", { profile, token: result.token }); return; }
      token.current = result.token ?? ""; setReview(result);
    }, "games.cleanup.working");
  };
  const apply = (action?: "resume" | "restore") => {
    if (pending.current || action && !record || !action && !review?.token) return;
    const operationId = action ? record!.id : crypto.randomUUID(), heldToken = token.current;
    void task(operationId, async () => {
      // An accepted operation owns the token. Always reload its journal, including
      // after a rejected IPC response, before offering another mutation.
      setLoaded(false); setReview(null); token.current = "";
      try {
        const result = await invoke<CleanupRecord>(action ? "games_archive_cleanup_action" : "games_recycle_archive_sources", action ? { profile, id: operationId, action } : { profile, token: heldToken, operationId });
        if (live.current) setRecords(previous => [...previous.filter(value => value.id !== result.id), result]);
      } finally {
        if (heldToken) void invoke("games_discard_archive_cleanup", { profile, token: heldToken }).catch(() => {});
        if (live.current) await refresh();
      }
    }, action === "restore" || record?.restoring ? "games.cleanup.restore" : "games.cleanup.recycle");
  };
  const reveal = () => void task("", async () => {
    const { openPath } = await import("@tauri-apps/plugin-opener");
    await openPath(parent);
  });
  const forget = () => {
    if (!record) return;
    void task("", async () => {
      await invoke("games_archive_cleanup_action", { profile, id: record.id, action: "dismiss" });
      await refresh();
      if (live.current) { setSelected(null); setReview(null); }
    });
  };
  const count = files.length, bytes = files.reduce((sum, file) => sum + file.bytes, 0);
  const percent = progress && progress.totalBytes > 0 ? Math.min(100, progress.bytes / progress.totalBytes * 100) : undefined;
  const canReview = loaded && item?.job && (!record || record.phase === "restored");
  const visible = items.filter(entry => entry.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <ModalShell labelledBy={title} width={620} closing={closing} onDismiss={dismiss} backdropClassName="games-source-link-backdrop">
    <div className="games-cleanup" ref={root}>
      <header><Recycle size={22} aria-hidden/><h2 id={title}>{t("games.cleanup.title")}</h2><button className="games-icon-button" aria-label={t("common.close")} onClick={dismiss}><X size={19}/></button></header>
      <div className="games-cleanup-body">
        {!selected ? <>
          <p>{t("games.cleanup.intro")}</p>
          {!!items.length && <label className="games-cleanup-search"><Search size={17} aria-hidden/><input value={query} onChange={event => setQuery(event.target.value)} placeholder={t("games.cleanup.search")} aria-label={t("games.cleanup.search")}/></label>}
          {loaded && !visible.length && <p className="games-cleanup-empty">{t(items.length ? "games.noResults" : "games.cleanup.empty")}</p>}
          <div className="games-cleanup-list">{visible.map(entry => <button key={entry.id} data-cleanup-job={entry.id} className="games-cleanup-choice" disabled={!loaded || busy} onClick={() => { setError(""); if (entry.job && (!entry.record || entry.record.phase === "restored")) inspect(entry.job); else { setSelected(entry.id); setReview(null); } }}>
            <span><strong dir="auto">{entry.name}</strong><small>{t(entry.record ? cleanupLabel(entry.record) : "games.cleanup.review")}</small></span><ArrowRight size={18} aria-hidden/>
          </button>)}</div>
        </> : <>
          <h3 className="games-cleanup-detail-title" tabIndex={-1} dir="auto">{item?.name}</h3>
          {record && !review && <p role="status">{t(cleanupLabel(record))}</p>}
          {review && <p>{t(review.filesVerified && !review.blockers.length ? "games.cleanup.confirm" : "games.cleanup.archive_cleanup_in_use")}</p>}
          {!!count && <><div className="games-cleanup-total"><span>{t("games.archive.partsCount", { count: count.toLocaleString() })}</span><strong dir="ltr">{transferBytes(bytes)}</strong></div>
            <div className="games-cleanup-files">{files.map(file => <div key={file.path}><span dir="auto" title={file.path}>{file.name}</span><small dir="ltr">{transferBytes(file.bytes)}</small></div>)}</div></>}
          {(review || record) && <p className="games-cleanup-path" dir="ltr">{parent}</p>}
          {review?.blockers.map(blocker => <p key={blocker} role="status">{t(`games.cleanup.blocker.${blocker}`)}</p>)}
          {review?.token && <p>{t("games.cleanup.binNote")}</p>}
          {record && !review && <p>{t(record.phase === "complete" ? "games.cleanup.completedNote" : record.phase === "restored" ? "games.cleanup.restoredNote" : record.phase === "unconfirmed" ? "games.cleanup.uncertainNote" : item?.job ? "games.cleanup.recoveryNote" : "games.cleanup.orphanNote")}</p>}
        </>}
        {(busy || !loaded && !error) && <div className="games-cleanup-progress" role="status"><LoaderCircle className="games-download-spinner" size={18}/><span>{t(busy ? busyLabel : "common.loading")}</span>{progress?.currentFile && <small dir="auto">{progress.currentFile}</small>}{percent !== undefined && <progress aria-label={t("games.cleanup.working")} value={percent} max={100}/>}</div>}
        {(error || selected && record?.error && !review && !busy) && <p role="alert" className="games-cleanup-error">{t(error || cleanupError(record!.error))}</p>}
      </div>
      <footer>
        {selected ? <button className="games-button" disabled={busy} onClick={back}><ArrowLeft size={16}/>{t("common.back")}</button> : <button className="games-button" onClick={dismiss}>{t("common.close")}</button>}
        <div>
          {!loaded && !!error && <button className="games-button" disabled={busy} onClick={() => void task("", refresh)}>{t("common.retry")}</button>}
          {selected && !busy && (review || record) && <button className="games-button" onClick={reveal}><FolderOpen size={16}/>{t("games.archive.openFolder")}</button>}
          {canReview && !review?.token && !busy && <button className="games-button" onClick={() => inspect(item!.job!)}>{t("games.cleanup.review")}</button>}
          {loaded && record && cleanupPending(record) && !review && <>
            <button className="games-button" disabled={busy} onClick={() => apply("restore")}><RotateCcw size={16}/>{t("games.cleanup.restore")}</button>
            {!record.restoring && item?.job && <button className="games-button games-button-primary" disabled={busy} onClick={() => apply("resume")}>{t("games.cleanup.resume")}</button>}
          </>}
          {loaded && review?.token && review.filesVerified && !review.blockers.length && <button className="games-button games-button-primary" disabled={busy} onClick={() => apply()}><Recycle size={17}/>{t("games.cleanup.recycle")}</button>}
          {loaded && record && ["complete", "restored"].includes(record.phase) && !review && <button className="games-button" disabled={busy} onClick={forget}>{t("games.archive.dismissRecord")}</button>}
          {busy && <button className="games-button" onClick={cancel}>{t("common.cancel")}</button>}
        </div>
      </footer>
    </div>
  </ModalShell>;
}
