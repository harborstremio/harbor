import { useEffect, useId, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { readSaveFolders, type SaveProgress } from "@/lib/games/saves";
import { Check, ChevronDown, LoaderCircle, X } from "lucide-react";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useSectionBack } from "@/lib/section-back";
import { useT } from "@/lib/i18n";
import { GameSimsMetadata } from "./game-sims-metadata";
import { transferBytes } from "@/lib/games/transfers";
import { simsApply, simsCancel, simsCreatorReview, simsCreatorName, simsDiscard, simsDisplayPath, simsError, simsRecover, simsReview, type SimsAction, type SimsGroup, type SimsProgress, type SimsReview, type SimsWorkspace } from "@/lib/games/sims";

export type SimsSelection = { action: SimsAction | { kind: "recover" }; title: string; sources: string[]; creator?: { provider?: "lot51" | "mts"; project?: string; version: string; gamePatch: string; target?: string }; choices?: SimsGroup[] };
export function GameSimsReview({ profile, path, selection, trigger, fallback, onClose, changed }: { profile: string; path: string; selection: SimsSelection; trigger: HTMLElement | null; fallback?: HTMLElement | null; onClose: () => void; changed: (value: SimsWorkspace) => void }) {
  const t = useT(), id = useId(), root = useRef<HTMLDivElement>(null), alive = useRef(true), applying = useRef(false), token = useRef("");
  const [review, setReview] = useState<SimsReview | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(""), [done, setDone] = useState(false);
  const [title, setTitle] = useState(selection.title);
  const [preview, setPreview] = useState<string | null>(null);
  const [backup, setBackup] = useState(true), [backupDone, setBackupDone] = useState(false), [progress, setProgress] = useState<SaveProgress | null>(null);
  const [modProgress, setModProgress] = useState<SimsProgress | null>(null), [cancelRequested, setCancelRequested] = useState(false);
  const operation = useRef("");
  const [isTray, setIsTray] = useState(selection.action.kind.startsWith("tray"));
  const naming = !selection.creator && (selection.action.kind === "trayImport" || selection.action.kind === "install" || selection.action.kind === "adopt");
  const startTest = selection.action.kind === "startTest";
  const isTrial = startTest || selection.action.kind === "answerTest" || selection.action.kind === "restoreTest";
  const isSet = selection.action.kind === "applySet" || isTrial;
  const checkpoint = selection.action.kind === "applySet" || startTest;
  const [chosen, setChosen] = useState(selection.action.kind === "startTest" ? selection.action.groups : []);
  const { closing, close: animateClose } = useModalExit(onClose);
  const close = () => { if (applying.current) return; alive.current = false; if (operation.current) void simsCancel(profile, operation.current).catch(() => {}); animateClose(); };
  const cancel = async () => {
    if (!modProgress?.canCancel || cancelRequested || !operation.current) return;
    setCancelRequested(true);
    try { if (!await simsCancel(profile, operation.current) && alive.current) setCancelRequested(false); }
    catch (reason) { if (alive.current) { setError(simsError(reason)); setCancelRequested(false); } }
  };
  useSectionBack(close, true);
  useEffect(() => {
    alive.current = true; const previous = trigger ?? document.activeElement as HTMLElement | null;
    root.current?.querySelector<HTMLElement>("input,button")?.focus({ preventScroll: true });
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const nodes = [...(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),a[href],summary') ?? [])].filter(node => node.getClientRects().length);
      if (!nodes.length) { event.preventDefault(); root.current?.focus(); }
      else if (event.shiftKey && (document.activeElement === nodes[0] || document.activeElement === root.current)) { event.preventDefault(); nodes.at(-1)?.focus(); }
      else if (!event.shiftKey && (document.activeElement === nodes.at(-1) || document.activeElement === root.current)) { event.preventDefault(); nodes[0]?.focus(); }
    };
    document.addEventListener("keydown", trap);
    return () => { alive.current = false; if (operation.current && !applying.current) void simsCancel(profile, operation.current).catch(() => {}); if (token.current) void simsDiscard(profile, token.current); document.removeEventListener("keydown", trap); requestAnimationFrame(() => { if (previous?.isConnected && previous.getClientRects().length) previous.focus({ preventScroll: true }); else if (fallback?.isConnected) fallback.focus({ preventScroll: true }); }); };
  }, [profile, trigger, fallback]);
  useEffect(() => {
    if (!review) return;
    const timer = setTimeout(() => { void simsDiscard(profile, review.token); token.current = ""; setReview(null); setPreview(null); setError("games.mods.error.expired"); }, Math.max(0, review.expiresAt * 1000 - Date.now()));
    return () => clearTimeout(timer);
  }, [review, profile]);
  const run = async () => {
    if (busy || !alive.current) return;
    setBusy(true); setError(""); setProgress(null); setModProgress(null); setCancelRequested(false); const commit = !!review || selection.action.kind === "recover"; applying.current = commit;
    try {
      if (commit) {
        const held = token.current; token.current = ""; setReview(null); root.current?.focus();
        operation.current = crypto.randomUUID();
        const stops: (() => void)[] = [];
        try {
          if (selection.action.kind !== "recover") stops.push(await listen<SimsProgress>("games:sims-progress", ({ payload }) => { if (alive.current && payload.profile === profile && payload.operationId === operation.current) { setModProgress(payload); if (payload.phase !== "checking") setProgress(null); } }));
          if (checkpoint) stops.push(await listen<SaveProgress>("games:save-progress", ({ payload }) => { if (alive.current && payload.profile === profile && payload.operationId === operation.current) setProgress(payload); }));
          const value = selection.action.kind === "recover" ? await simsRecover(path) : await simsApply(profile, held, operation.current);
          if (alive.current) { changed(value); setBackupDone(!!value.saveBackup); setDone(true); }
        } finally { stops.forEach(stop => stop()); operation.current = ""; void simsDiscard(profile, held); }
      } else if (selection.action.kind !== "recover") {
        const action = selection.action.kind === "trayImport" || selection.action.kind === "install" || selection.action.kind === "adopt" ? { ...selection.action, title: title.trim() } : selection.action.kind === "applySet" || selection.action.kind === "startTest" ? { ...selection.action, ...(selection.action.kind === "startTest" ? { groups: chosen } : {}), backupFolder: backup ? readSaveFolders(profile, `steam:1222670:sims:${path}`).vault || "" : null } : selection.action;
        const reviewOperation = crypto.randomUUID(); operation.current = reviewOperation;
        let stop: (() => void) | undefined;
        try {
          stop = await listen<SimsProgress>("games:sims-progress", ({ payload }) => {
            if (payload.profile !== profile || payload.operationId !== reviewOperation) return;
            // Close can arrive before the native job registers. Retry on its first event.
            if (!alive.current) { if (payload.canCancel) void simsCancel(profile, reviewOperation).catch(() => {}); }
            else setModProgress(payload);
          });
          if (!alive.current) return;
          const value = selection.creator ? await simsCreatorReview(profile, path, { version: selection.creator.version, target: selection.creator.target, provider: selection.creator.provider, project: selection.creator.project }, reviewOperation) : await simsReview(profile, path, action, selection.sources, reviewOperation);
          if (alive.current) { token.current = value.token; setReview(value); setPreview(value.preview); setIsTray(value.action.kind.startsWith("tray")); } else void simsDiscard(profile, value.token);
        } finally { stop?.(); if (operation.current === reviewOperation) operation.current = ""; }
      }
    } catch (reason) { if (alive.current) setError(isTray && simsError(reason) === "games.sims.formatError" ? "games.sims.trayFormat" : simsError(reason)); }
    finally { applying.current = false; if (alive.current) setBusy(false); }
  };
  return <ModalShell closing={closing} onDismiss={close} labelledBy={id} width={660} backdropClassName="games-sims-scrim"><div className="games-sims-dialog" ref={root} tabIndex={-1}>
    <header><div><small>The Sims 4</small><h2 id={id}>{t(`games.sims.${selection.creator ? "creatorReview" : selection.action.kind}`)}</h2></div><button className="games-icon-button" disabled={busy && applying.current} aria-label={t("common.close")} onClick={close}><X size={20}/></button></header>
    <div className="games-sims-dialog-body">
      {done ? <><p className="games-sims-success" role="status"><Check size={24}/>{t(isTray ? "games.sims.trayDone" : "games.sims.success")}</p>{backupDone && <p>{t("games.sims.setBackupDone")}</p>}</> : <>
        {naming && !review && !applying.current ? <label className="games-sims-name" data-tv-focus-container>{t(isTray ? "games.sims.trayName" : "games.sims.name")}<input value={title} onChange={event => setTitle(event.target.value)} maxLength={100} disabled={busy}/></label> : !isTrial && <div className="games-sims-review-creation">{preview && <img src={preview} alt="" onError={() => setPreview(null)}/>}<h3 dir="auto">{review?.title ?? (naming ? title.trim() : selection.title)}</h3></div>}
        {selection.creator && <p className="games-sims-creator-provenance">{review?.source ? simsCreatorName(review.source) : selection.creator.provider === "mts" ? "Mod The Sims" : selection.creator.provider === "lot51" ? "Lot 51" : "Deaderpool"}{selection.creator.provider !== "mts" && <> · {review?.source?.version ?? selection.creator.version}</>}{(review?.source?.gamePatch ?? selection.creator.gamePatch) && <><br/>{t("games.sims.creatorTested", { version: review?.source?.gamePatch ?? selection.creator.gamePatch })}</>}</p>}
        <p>{t(isTray ? selection.action.kind === "trayRemove" ? "games.sims.trayRemoveNote" : "games.sims.trayReviewNote" : isTrial ? selection.action.kind === "restoreTest" ? "games.sims.testRestoreNote" : "games.sims.testReviewNote" : selection.action.kind === "adopt" ? "games.sims.adoptNote" : isSet ? "games.sims.setReviewNote" : selection.action.kind === "recover" ? "games.sims.recovery" : selection.action.kind === "remove" || selection.action.kind === "disable" ? "games.sims.removeNote" : "games.sims.reviewNote")}</p>
        {review?.destinationFolder ? <dl className="games-sims-adopt-paths">{review.sourceFolder && <div><dt>{t("games.sims.adoptFrom")}</dt><dd dir="auto">{simsDisplayPath(review.sourceFolder)}</dd></div>}<div><dt>{t("games.sims.adoptTo")}</dt><dd dir="auto">{simsDisplayPath(review.destinationFolder)}</dd></div></dl> : <p className="games-sims-path" dir="auto">{simsDisplayPath(path)}</p>}
        {startTest && !review && <><p>{t("games.sims.testChooseNote")}</p><div className="games-sims-set-members">{selection.choices?.map(group => <button key={group.id} role="checkbox" aria-checked={chosen.includes(group.id)} disabled={busy} className="games-sims-set-member" onClick={() => setChosen(ids => ids.includes(group.id) ? ids.filter(id => id !== group.id) : [...ids, group.id])}><span className="games-sims-check" aria-hidden="true">{chosen.includes(group.id) && <Check size={14}/>}</span><span dir="auto">{group.title}</span><small>{t("games.sims.setFiles", { count: group.files.length })}</small></button>)}</div></>}
        {checkpoint && !review && !busy && <button className="games-sims-set-member games-sims-set-backup" role="checkbox" aria-checked={backup} onClick={() => setBackup(value => !value)}><span className="games-sims-check" aria-hidden="true">{backup && <Check size={14}/>}</span><span>{t(startTest ? "games.sims.testBackup" : "games.sims.setBackup")}</span></button>}
        {selection.action.kind === "answerTest" && <p><strong>{t(selection.action.present ? "games.sims.testPresent" : "games.sims.testGone")}</strong></p>}
        {review && isSet && <><ul className="games-sims-set-changes">{review.changes.map(change => <li key={change.id}><span dir="auto">{change.title}</span><small>{t(change.enabled ? "games.mods.enabled" : "games.mods.disabled")} · {t("games.sims.setFiles", { count: change.fileCount })}</small></li>)}</ul>{review.backupFolder && <p>{t(startTest ? "games.sims.testBackup" : "games.sims.setBackup")}<small className="games-sims-path">{simsDisplayPath(review.backupFolder)}</small></p>}</>}
        {review && !isSet && <><p>{`${t("games.sims.setFiles", { count: review.files.length })} · ${transferBytes(review.bytes)}`}</p><ul>{review.files.map(file => <li key={file.name}><span dir="auto">{file.name}</span><small>{transferBytes(file.bytes)}</small></li>)}</ul>{!!review.skipped.length && <details><summary>{t("games.sims.skipped", { count: review.skipped.length })}</summary><ul>{review.skipped.map((name, index) => <li key={`${index}:${name}`} dir="auto">{name}</li>)}</ul></details>}</>}
        {review?.information && (review.information.partial || !!review.information.files.length) && <details className="games-sims-guidance games-sims-review-information" open={review.information.partial || review.information.files.some(file => file.manifests.some(value => value.requirements.length || value.requiredPacks.length || value.incompatiblePacks.length))}><summary>{t("games.sims.info")}<ChevronDown size={16}/></summary><GameSimsMetadata report={review.information}/></details>}
        {busy && <p className="games-sims-pending" role="status"><LoaderCircle size={20}/>{t(cancelRequested ? "games.download.state.canceling" : !applying.current ? modProgress?.phase === "waiting" ? "games.sims.mtsWaiting" : modProgress?.phase === "downloading" ? "games.sims.creatorDownloading" : "games.sims.checking" : modProgress ? `games.sims.apply${modProgress.phase === "copying" ? "Copying" : modProgress.phase === "checking" ? "Checking" : "Publishing"}` : applying.current ? "games.sims.applying" : "games.sims.checking")}</p>}
        {busy && modProgress && (modProgress.phase === "copying" || modProgress.phase === "downloading" || modProgress.phase === "reviewing" && !!modProgress.file) && <div className="games-sims-file-progress">{modProgress.file && <small dir="auto">{modProgress.file}</small>}{modProgress.totalBytes > 0 && <><progress value={modProgress.bytes} max={modProgress.totalBytes} aria-label={t(modProgress.phase === "downloading" ? "games.sims.creatorDownloading" : "games.sims.applyCopying")}/><small>{transferBytes(modProgress.bytes)} / {transferBytes(modProgress.totalBytes)}</small></>}</div>}
        {busy && progress && <p className="games-sims-backup-progress" role="status">{t(`games.backups.phase.${progress.phase}`)} {progress.totalBytes > 0 && `${transferBytes(progress.bytes)} / ${transferBytes(progress.totalBytes)}`}</p>}
        {error && <p role="alert">{t(error)}</p>}
      </>}
    </div>
    <footer>{done ? <button className="games-button games-button-primary" onClick={close}>{t("common.done")}</button> : <><button className="games-button" disabled={busy && applying.current && (!modProgress?.canCancel || cancelRequested)} onClick={() => { if (busy && applying.current) void cancel(); else close(); }}>{t(cancelRequested && busy ? "games.download.state.canceling" : "common.cancel")}</button>{!(busy && applying.current) && <button className="games-button games-button-primary" disabled={busy || (naming && !title.trim()) || (startTest && !chosen.length)} onClick={() => void run()}>{t(review ? "games.mods.applyChanges" : selection.action.kind === "recover" ? "games.sims.recover" : "games.mods.reviewChanges")}</button>}</>}</footer>
  </div></ModalShell>;
}
