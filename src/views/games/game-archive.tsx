import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, Check, Folder, FolderOpen, PackageOpen, Search, X } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useSectionBack } from "@/lib/section-back";
import { useT } from "@/lib/i18n";
import { archiveDestinationParts, archiveError, archiveFolder, archiveSetupSource, type ArchiveJob, type ArchivePlan, type ArchiveProgress, type ArchiveReceipt } from "@/lib/games/archives";
import { transferBytes, type DownloadGame } from "@/lib/games/transfers";
import { setupPath } from "@/lib/games/setup";
import { useGameArchives, type GameArchives } from "@/hooks/use-game-archives";
import { ArchiveJobProgress } from "./game-download-archive";
import { useArchiveSpace } from "@/hooks/use-archive-space";
import { GameArchiveSpace } from "./game-archive-space";
import { GameArchiveParts } from "./game-archive-parts";
import { GameArchiveDestinations } from "./game-archive-destination";
import { ArchiveMotion, ArchiveReviewSkeleton } from "./game-archive-motion";
import { GameFileIcon } from "./game-file-icon";
import { recentArchiveParent } from "@/lib/games/archive-locations";
import "./game-archive.css";

export function GameArchiveDialog({ profile, source: initialSource = "", onClose, openLibrary, onPrepared, archives: providedArchives, initialJob, originSource, game }: { profile: string; source?: string; onClose: () => void; openLibrary: () => void; onPrepared?: (receipt: ArchiveReceipt) => void; archives?: GameArchives; initialJob?: ArchiveJob; originSource?: string; game?: DownloadGame }) {
  const prepared = useRef<ArchiveReceipt | null>(null);
  const t = useT(), id = useId(), root = useRef<HTMLDivElement>(null), { closing, close } = useModalExit(() => { if (prepared.current && onPrepared) onPrepared(prepared.current); else onClose(); });
  const destination = initialJob && archiveDestinationParts(initialJob.destination);
  const [source, setSource] = useState(initialSource), [parent, setParent] = useState(destination?.parent ?? ""), [name, setName] = useState(destination?.name ?? archiveFolder(initialSource));
  const [plan, setPlan] = useState<ArchivePlan | null>(null), [progress, setProgress] = useState<ArchiveProgress | null>(null);
  const localArchives = useGameArchives(profile, !providedArchives), archives = providedArchives ?? localArchives;
  const [accepted, setAccepted] = useState<ArchiveJob | null>(initialJob ?? null);
  const job = archives.jobs.find(job => job.id === accepted?.id) ?? accepted;
  const receipt = job && archiveSetupSource(job) ? job.receipt : null;
  const delivered = useRef("");
  useEffect(() => {
    if (!receipt || !job || !onPrepared || closing || delivered.current === job.id) return;
    delivered.current = job.id; prepared.current = receipt; close();
  }, [job?.id, receipt, onPrepared, closing]);
  const [busy, setBusy] = useState<"choose" | "inspect" | "extract" | null>(null), [error, setError] = useState(""), [query, setQuery] = useState("");
  const [passwordRequired, setPasswordRequired] = useState(false), passwordInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (passwordRequired && !busy && !plan) passwordInput.current?.focus({ preventScroll: true });
  }, [passwordRequired, busy, plan]);
  const live = useRef(true), pending = useRef(false), token = useRef(""), operation = useRef(""), exiting = useRef(closing);
  exiting.current = closing;
  const space = useArchiveSpace(profile, plan?.token ?? "", parent, !closing && busy !== "extract");
  const spaceAtFailure = useRef<typeof space.value>(undefined);
  const shortfall = space.value?.shortfallBytes != null && space.value.shortfallBytes > 0;
  useEffect(() => {
    if (error === "games.archive.archive_space" && space.value !== spaceAtFailure.current && space.value?.shortfallBytes === 0) setError("");
  }, [error, space.value]);
  const cancel = () => { if (operation.current) void invoke("games_cancel_archive", { profile, operationId: operation.current }).catch(() => {}); };
  const discard = () => { const held = token.current; token.current = ""; if (held) void invoke("games_discard_archive", { profile, token: held }).catch(() => {}); };
  const dismiss = () => { if (busy !== "extract") close(); };
  useSectionBack(dismiss, true);
  useEffect(() => {
    live.current = true;
    const previous = document.activeElement as HTMLElement | null, dialog = root.current;
    dialog?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !dialog || [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].at(-1) !== dialog.closest('[role="dialog"]')) return;
      const items = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),summary')].filter(el => el.getClientRects().length);
      if (event.shiftKey && (document.activeElement === items[0] || !dialog.contains(document.activeElement))) { event.preventDefault(); items.at(-1)?.focus(); }
      else if (!event.shiftKey && (document.activeElement === items.at(-1) || !dialog.contains(document.activeElement))) { event.preventDefault(); items[0]?.focus(); }
    };
    document.addEventListener("keydown", trap);
    const stop = listen<ArchiveProgress>("games:archive-progress", ({ payload }) => { if (live.current && payload.profile === profile && payload.operationId === operation.current) setProgress(payload); }).catch(() => () => {});
    return () => { live.current = false; cancel(); discard(); void stop.then(unlisten => unlisten()); document.removeEventListener("keydown", trap); previous?.focus({ preventScroll: true }); };
  }, [profile]);
  useEffect(() => { if (closing) { cancel(); discard(); } }, [closing]);
  useEffect(() => { if (error) root.current?.querySelector('.games-archive-error')?.scrollIntoView({ block: "nearest" }); }, [error]);
  const task = async (kind: NonNullable<typeof busy>, action: (operationId: string) => Promise<void>) => {
    if (pending.current) return; pending.current = true; operation.current = crypto.randomUUID(); setBusy(kind); setError(""); setProgress(null);
    try { await action(operation.current); } catch (reason) { if (live.current) { const message = archiveError(reason); setError(message); if (["games.archive.archive_encrypted", "games.archive.archive_password", "games.archive.archive_password_or_checksum"].includes(message)) setPasswordRequired(true); } }
    finally { pending.current = false; operation.current = ""; if (live.current) { setBusy(null); setProgress(null); } }
  };
  const choose = (kind: "source" | "parent") => task("choose", async () => {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const value = await open({ directory: kind === "parent", multiple: false, title: t(kind === "parent" ? "games.archive.chooseParent" : "games.archive.chooseSource"), filters: kind === "source" ? [{ name: "ZIP / ZIP.001 / 7z / 7z.001 / RAR / TAR / TAR.GZ / ISO", extensions: ["zip", "7z", "001", "rar", "tar", "gz", "tgz", "iso"] }] : undefined });
    if (typeof value !== "string" || !live.current || exiting.current) return;
    if (kind === "source") { discard(); setPlan(null); setAccepted(null); setQuery(""); setPasswordRequired(false); if (passwordInput.current) passwordInput.current.value = ""; setSource(value); setName(archiveFolder(value)); } else setParent(value);
  });
  const inspect = () => task("inspect", async operationId => {
    discard(); setPlan(null);
    const value = await invoke<ArchivePlan>("games_inspect_archive", { profile, source, operationId, password: passwordRequired ? passwordInput.current?.value ?? "" : null });
    if (passwordInput.current) passwordInput.current.value = "";
    if (live.current) setPasswordRequired(false);
    if (live.current && !exiting.current) { token.current = value.token; setPlan(value); } else void invoke("games_discard_archive", { profile, token: value.token }).catch(() => {});
  });
  const extract = () => task("extract", async () => {
    const held = token.current;
    try {
      const sameSource = setupPath(source) === setupPath(initialSource);
      const value = await invoke<ArchiveJob>("games_start_archive", { profile, token: held, parent, name: name.trim(), originSource: sameSource ? originSource ?? source : source, game: sameSource ? game ?? null : null });
      token.current = ""; archives.accept(value);
      if (live.current) { setAccepted(value); setPlan(null); }
    }
    catch (reason) { if (live.current) { if (String(reason) === "archive_space") spaceAtFailure.current = space.value; if (["archive_exists", "archive_destination", "archive_space", "archive_busy"].includes(String(reason))) token.current = held; else setPlan(null); } throw reason; }
  });
  const reveal = async (path = receipt?.destination ?? job?.destination) => { if (!path) return; try { const { revealItemInDir } = await import("@tauri-apps/plugin-opener"); await revealItemInDir(path); } catch (reason) { setError(archiveError(reason)); } };
  const entries = plan?.entries.filter(item => item.path.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) ?? [];
  const percent = progress?.totalBytes ? Math.min(100, Math.round(progress.bytes / progress.totalBytes * 100)) : 0;
  const visibleError = passwordRequired && error === "games.archive.archive_encrypted" ? "" : error || archives.error;
  return <ModalShell closing={closing} onDismiss={dismiss} width={710} labelledBy={id} backdropClassName="games-archive-backdrop"><div className="games-archive-dialog" ref={root}>
    <header><span className="games-archive-mark"><PackageOpen size={25} /></span><div><p className="games-eyebrow">{t("games.archive.eyebrow")}</p><h2 id={id}>{t(receipt ? "games.archive.ready" : "games.archive.title")}</h2></div><button className="games-icon-button" disabled={busy === "extract"} aria-label={t("common.close")} onClick={dismiss}><X size={20} /></button></header>
    <div className="games-archive-scroll">{job && !receipt ? <><ArchiveMotion phase={job.progress?.phase ?? "checking"} name={job.source} active={job.status === "running"}/><ArchiveJobProgress job={job}/>{job.status === "running" ? <p className="games-archive-intro">{t("games.archive.keepWorking")}</p> : <div className="games-archive-recovery"><button className="games-button" onClick={() => void reveal()}><FolderOpen size={17}/>{t("games.archive.openFolder")}</button>{job.stage && <button className="games-button" onClick={() => void reveal(job.stage!)}>{t("games.archive.showPartial")}</button>}</div>}</> : receipt ? <div className="games-archive-receipt"><span><Check size={29} /></span><h3>{t("games.archive.complete", { count: receipt.files.toLocaleString() })}</h3><p>{t("games.archive.completeNote")}</p><code>{receipt.destination.replace(/^\\\\\?\\/, "")}</code><dl><dt>{t("games.archive.expanded")}</dt><dd>{transferBytes(receipt.bytes)}</dd><dt>{receipt.parts && receipt.parts.length > 1 ? t("games.archive.setHash") : "SHA-256"}</dt><dd>{receipt.sha256}</dd></dl><GameArchiveParts parts={receipt.parts}/></div> : <>
      <p className="games-archive-intro">{t("games.archive.intro")}</p>
      <button className="games-archive-path games-archive-source" disabled={busy !== null} onClick={() => void choose("source")}><GameFileIcon name={source} /><span><small>{t("games.archive.source")}</small><strong>{source.split(/[\\/]/).pop() || t("games.archive.chooseSource")}</strong>{source && <em>{source}</em>}</span><FolderOpen size={17} /></button>
      {passwordRequired && !plan && <form className="games-archive-password" onSubmit={event => { event.preventDefault(); if (!busy) void inspect(); }}><label htmlFor={`${id}-password`}>{t("games.archive.password")}</label><input id={`${id}-password`} ref={passwordInput} type="password" autoComplete="off" spellCheck={false} maxLength={1024} disabled={busy !== null} aria-invalid={["games.archive.archive_password", "games.archive.archive_password_or_checksum"].includes(error)} aria-describedby={`${id}-password-note${visibleError ? ` ${id}-error` : ""}`} /><p id={`${id}-password-note`}>{t("games.archive.passwordNote")}</p></form>}
      {plan && <><div className="games-archive-metrics"><div><strong>{plan.fileCount.toLocaleString()}</strong><span>{t("games.archive.files")}</span></div><div><strong>{transferBytes(plan.archiveBytes)}</strong><span>{t("games.archive.compressed")}</span></div><ArrowRight size={17} /><div><strong>{transferBytes(plan.expandedBytes)}</strong><span>{t("games.archive.expanded")}</span></div></div>
        <GameArchiveParts key={plan.token} parts={plan.parts}/><details className="games-archive-contents"><summary>{t("games.archive.contents")}<span>{plan.entries.length < plan.fileCount + plan.directoryCount ? t("games.archive.previewCount", { count: plan.entries.length }) : t("games.archive.entryCount", { count: plan.entries.length })}</span></summary><label><Search size={15} /><input aria-label={t("games.archive.searchPreview")} placeholder={t("games.archive.searchPreview")} value={query} onChange={event => setQuery(event.target.value)} /></label><ul>{entries.map(item => <li key={item.path}>{item.directory ? <Folder size={22} /> : <GameFileIcon name={item.path} />}<span>{item.path}</span>{!item.directory && <small>{transferBytes(item.bytes)}</small>}</li>)}</ul>{!entries.length && <p>{t("games.noResults")}</p>}</details>
        <div className="games-archive-destination"><h3>{t("games.archive.destination")}</h3><GameArchiveDestinations profile={profile} token={plan.token} source={source} recent={recentArchiveParent(archives.jobs, profile)} parent={parent} disabled={busy !== null || closing} select={path => { setParent(path); setError(""); }}/><button className="games-archive-path" disabled={busy !== null} onClick={() => void choose("parent")}><FolderOpen size={19} /><span><strong>{parent || t("games.archive.chooseParent")}</strong></span><ArrowRight size={16} /></button><label>{t("games.archive.folderName")}<input value={name} maxLength={180} disabled={busy !== null} onChange={event => setName(event.target.value)} /></label><p>{t("games.archive.destinationNote")}</p>{parent && <GameArchiveSpace space={space} busy={busy !== null}/>}</div>
      </>}
    </>}
      {busy === "inspect" && <><ArchiveMotion phase="checking" name={source}/><div className="games-archive-progress" role="status"><div><span>{t("games.archive.phase.checking")}</span>{progress && progress.totalBytes > 0 && <span>{percent}%</span>}</div><div role="progressbar" aria-label={t("games.archive.phase.checking")} aria-valuenow={progress && progress.totalBytes > 0 ? percent : undefined} aria-valuemin={0} aria-valuemax={100} className={!progress?.totalBytes ? "is-indeterminate" : ""}><i style={progress?.totalBytes ? { width: `${percent}%` } : undefined}/></div>{progress && progress.totalBytes > 0 && <small>{transferBytes(progress.bytes)} / {transferBytes(progress.totalBytes)}</small>}</div><ArchiveReviewSkeleton/></>}
      {visibleError && <p id={`${id}-error`} className="games-archive-error" role="alert">{t(visibleError)}</p>}
    </div>
    <footer><span>{job?.status === "running" ? null : t(receipt ? "games.archive.originalKept" : "games.archive.zipOnly")}</span><div>{job && !receipt ? job.status === "running" ? <><button className="games-button" onClick={() => void archives.action(job, "cancel")}>{t("games.archive.cancelExtract")}</button><button className="games-button games-button-primary" onClick={close}>{t("games.archive.viewDownloads")}<ArrowRight size={16}/></button></> : <button className="games-button games-button-primary" onClick={() => { setAccepted(null); setError(""); archives.dismissError(); void inspect(); }}>{t("games.archive.retry")}<ArrowRight size={16}/></button> : receipt ? <><button className="games-button" onClick={() => void reveal()}><FolderOpen size={16} />{t("games.archive.openFolder")}</button><button className="games-button games-button-primary" onClick={() => { if (onPrepared) prepared.current = receipt; else openLibrary(); close(); }}>{t(onPrepared ? "games.setup.continue" : "games.archive.localLibrary")}<ArrowRight size={16} /></button></> : busy && busy !== "choose" ? <button className="games-button" disabled={busy === "extract"} onClick={cancel}>{t("common.cancel")}</button> : <button className="games-button games-button-primary" disabled={busy !== null || !source || (plan !== null && (!parent || !name.trim() || space.checking || shortfall))} onClick={() => void (plan ? extract() : inspect())}>{busy ? t("common.loading") : t(plan ? "games.archive.extract" : "games.archive.inspect")}<ArrowRight size={16} /></button>}</div></footer>
  </div></ModalShell>;
}
