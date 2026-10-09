import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Archive, ArrowLeft, ArrowUpRight, Check, FolderOpen, History, LoaderCircle, RotateCcw, Search, X } from "lucide-react";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useGameSaves } from "@/hooks/use-game-saves";
import { useT, useUiLanguage } from "@/lib/i18n";
import { useSectionBack } from "@/lib/section-back";
import { transferBytes } from "@/lib/games/transfers";
import type { GameSummary } from "@/lib/games/types";
import { saveDisplayPath, type SaveSnapshot } from "@/lib/games/saves";
import { GameSaveComparison } from "./game-save-comparison";
import "./game-saves.css";

export function GameSaveLauncher({ profile, game, active, simsPath, onChanged }: { profile: string; game: GameSummary; active: boolean; simsPath?: string; onChanged?: () => void }) {
  const t = useT(), [open, setOpen] = useState(false);
  useEffect(() => { if (!active) setOpen(false); }, [active]);
  return <><button className="games-button" onClick={() => setOpen(true)}><History size={18} />{t("games.backups.title")}</button>{open && active && <GameSaveModal key={`${profile}:${game.id}:${simsPath || ""}`} profile={profile} game={game} simsPath={simsPath} onChanged={onChanged} onClose={() => setOpen(false)} />}</>;
}
export function GameSaveModal({ profile, game, simsPath, onClose, onChanged }: { profile: string; game: GameSummary; simsPath?: string; onClose: () => void; onChanged?: () => void }) {
  const t = useT(), id = useId(), root = useRef<HTMLDivElement>(null), heading = useRef<HTMLHeadingElement>(null);
  const language = useUiLanguage();
  const dateFormat = useMemo(() => new Intl.DateTimeFormat(language, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }), [language]);
  const { closing, close } = useModalExit(onClose), saves = useGameSaves(profile, game, simsPath);
  const [label, setLabel] = useState(""), [query, setQuery] = useState("");
  const reviewed = useRef<string | null>(null), changeCallback = useRef(onChanged);
  changeCallback.current = onChanged;
  useEffect(() => { if (saves.receipt) changeCallback.current?.(); }, [saves.receipt]);
  const dismiss = () => { if (saves.busy === "restore" || saves.busy === "recover") return; saves.cancel(); close(); };
  useSectionBack(() => { if (saves.plan && !saves.busy) saves.discard(); else dismiss(); }, true);
  useEffect(() => {
    if (saves.plan && reviewed.current !== saves.plan.snapshot.id) {
      reviewed.current = saves.plan.snapshot.id;
      root.current?.querySelector(".games-saves-scroll")?.scrollTo({ top: 0 });
      heading.current?.focus({ preventScroll: true });
    } else if (!saves.plan && reviewed.current && !saves.busy) {
      const trigger = [...root.current?.querySelectorAll<HTMLButtonElement>("[data-save-review]") ?? []].find(button => button.dataset.saveReview === reviewed.current);
      (saves.receipt ? heading.current : trigger ?? heading.current)?.focus({ preventScroll: true });
      reviewed.current = null;
    }
  }, [saves.plan, saves.busy, saves.receipt]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = root.current?.closest<HTMLElement>('[role="dialog"]');
    dialog?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !dialog || [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].at(-1) !== dialog) return;
      const items = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), summary')].filter(item => item.getClientRects().length);
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === heading.current || !dialog.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", trap);
    return () => { document.removeEventListener("keydown", trap); previous?.focus({ preventScroll: true }); };
  }, []);
  const date = (time: number) => dateFormat.format(time);
  const name = (snapshot: SaveSnapshot) => snapshot.label || t(snapshot.kind === "beforeRestore" ? "games.backups.recoveryName" : "games.backups.snapshotName");
  const shown = saves.snapshots.filter(snapshot => `${name(snapshot)} ${date(snapshot.createdAt)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const progress = saves.progress, percent = progress && progress.totalBytes > 0 ? Math.min(100, Math.round(progress.bytes / progress.totalBytes * 100)) : undefined;
  return <ModalShell closing={closing} onDismiss={dismiss} width={690} labelledBy={id} backdropClassName="games-saves-backdrop">
    <div className={`games-saves${saves.plan ? " is-review" : ""}`} ref={root}>
      <header><span className="games-saves-mark"><History size={25} /></span><div><span className="games-section-kicker">{game.name}</span><h2 id={id} ref={heading} tabIndex={-1}>{t(saves.plan ? "games.backups.reviewTitle" : "games.backups.title")}</h2></div><button className="games-icon-button" aria-label={t("common.close")} onClick={dismiss} disabled={saves.busy === "restore" || saves.busy === "recover"}><X size={19} /></button></header>
      <div className="games-saves-scroll">
        {!saves.available ? <p className="games-saves-intro">{t("games.backups.desktop")}</p> : saves.plan ? <>
          <div className="games-saves-review-heading"><button className="games-button" disabled={!!saves.busy} onClick={saves.discard}><ArrowLeft size={15} />{t("common.back")}</button><span>{name(saves.plan.snapshot)} · {date(saves.plan.snapshot.createdAt)}</span></div>
          <p className="games-saves-intro">{t("games.backups.restoreNote")}</p><code className="games-saves-path">{saveDisplayPath(saves.plan.target)}</code>
          <div className="games-saves-counts">{([['added',saves.plan.added],['replaced',saves.plan.replaced],['removed',saves.plan.removed],['unchanged',saves.plan.unchanged]] as const).map(([key,count])=><div key={key}><strong>{count}</strong><span>{t(`games.backups.${key}`)}</span></div>)}</div>
          {saves.plan.changes.length ? <GameSaveComparison key={saves.plan.token} plan={saves.plan} /> : <p className="games-saves-quiet">{t("games.backups.identical")}</p>}
        </> : <>
          {saves.receipt && <section className={`games-saves-receipt ${saves.receipt.status==="restored"?"is-success":""}`} role="status"><div>{saves.receipt.status==="restored"?<Check size={21}/>:<RotateCcw size={21}/>}<h3>{t(`games.backups.result.${saves.receipt.status}`)}</h3><button className="games-icon-button" aria-label={t("common.close")} onClick={saves.clearReceipt}><X size={16}/></button></div><p>{t(`games.backups.resultNote.${saves.receipt.status}`)}</p>{saves.receipt.recoveryFolder&&<><code className="games-saves-path">{saveDisplayPath(saves.receipt.recoveryFolder)}</code><button className="games-button" onClick={()=>void saves.reveal(saves.receipt!.recoveryFolder!)}><FolderOpen size={15}/>{t("games.backups.openRecovery")}</button></>}{saves.receipt.recoverySnapshotId&&<button className="games-button" disabled={!!saves.busy} onClick={()=>void saves.review(saves.receipt!.recoverySnapshotId!)}><RotateCcw size={15}/>{t("games.backups.reviewUndo")}</button>}</section>}
          {saves.recoveryPending && <section className="games-saves-restart" role="status"><h3>{t("games.backups.restartTitle")}</h3><p>{t("games.backups.restartNote")}</p><div><button className="games-button games-button-primary" disabled={!!saves.busy} onClick={() => void saves.recover()}><RotateCcw size={16}/>{t("games.backups.recoverPending")}</button><button className="games-button" onClick={() => void saves.reveal(saves.folders.source.replace(/[\\/][^\\/]+$/, ""))}><FolderOpen size={16}/>{t("games.setup.openFolder")}</button></div></section>}
          <p className="games-saves-intro">{t(simsPath ? "games.sims.savesIntro" : "games.backups.intro")}</p>
          <div className="games-saves-folders">{(["source","vault"] as const).map((kind,index)=><button key={kind} disabled={!!saves.busy || (!!simsPath && kind === "source")} className={simsPath && kind === "source" ? "games-saves-fixed-folder" : undefined} onClick={()=>void saves.choose(kind,t(`games.backups.choose.${kind}`))}><span className="games-saves-step">0{index+1}</span><span><strong>{t(`games.backups.folder.${kind}`)}</strong><span dir="auto" title={saveDisplayPath(saves.folders[kind])}>{saveDisplayPath(saves.folders[kind])||t(`games.backups.choose.${kind}`)}</span></span><FolderOpen size={19}/></button>)}</div>
          <form className="games-saves-create" onSubmit={event=>{event.preventDefault();void saves.backup(label);}}><label><span>{t("games.backups.label")}</span><input value={label} maxLength={240} onChange={event=>setLabel(event.target.value)} placeholder={t(simsPath ? "games.sims.savesLabelHint" : "games.backups.labelHint")} disabled={!!saves.busy}/></label><button className="games-button games-button-primary" disabled={!!saves.busy||saves.recoveryPending||!saves.folders.source||!saves.folders.vault}><Archive size={17}/>{t("games.backups.create")}</button></form>
          <section className="games-saves-history"><div className="games-section-heading"><h3>{t("games.backups.history")}</h3><button className="games-icon-button" disabled={!!saves.busy||!saves.folders.vault} aria-label={t("games.backups.refresh")} onClick={()=>void saves.refresh()}><RotateCcw size={15}/></button></div>{saves.snapshots.length>5&&<label className="games-search"><Search size={16}/><input aria-label={t("games.backups.search")} placeholder={t("games.backups.search")} value={query} onChange={event=>setQuery(event.target.value)}/></label>}{saves.busy==="list"&&!saves.snapshots.length?<div className="games-saves-skeleton" aria-label={t("common.loading")}><span/><span/></div>:!shown.length&&!saves.error?<p className="games-saves-quiet">{t(query?"games.backups.noMatch":saves.folders.vault?"games.backups.empty":"games.backups.chooseFirst")}</p>:<div className="games-saves-history-list">{shown.map(snapshot=><div key={snapshot.id} className="games-saves-row"><span className="games-saves-row-icon">{snapshot.kind==="beforeRestore"?<RotateCcw size={18}/>:<Archive size={18}/>}</span><div><strong>{name(snapshot)}</strong><time dateTime={new Date(snapshot.createdAt).toISOString()}>{date(snapshot.createdAt)}</time><small>{t(snapshot.fileCount===1?"games.backups.oneFile":"games.backups.files",{count:snapshot.fileCount})} · {transferBytes(snapshot.bytes)}</small></div><button className="games-button" disabled={!!saves.busy||saves.recoveryPending||!saves.folders.source} data-save-review={snapshot.id} onClick={()=>void saves.review(snapshot.id)} aria-label={t("games.backups.reviewNamed",{name:name(snapshot),date:date(snapshot.createdAt)})}>{t("games.backups.review")}<ArrowUpRight size={14}/></button></div>)}</div>}</section>
        </>}
      </div>
      <footer>{saves.error&&<p className="games-saves-error" role="alert">{t(saves.error)}</p>}{saves.busy&&saves.busy!=="choose"&&saves.busy!=="list"?<div className="games-saves-progress" role="status"><div><LoaderCircle size={17} className="games-saves-working"/><span>{t(`games.backups.phase.${progress?.phase??(saves.busy==="review"?"verifying":"scanning")}`)}</span>{percent!==undefined&&<strong>{percent}%</strong>}<button className="games-button" onClick={saves.cancel}>{t("common.cancel")}</button></div><div className="games-saves-progress-track" role="progressbar" aria-label={t("games.backups.progress")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{width:percent===undefined?"28%":`${percent}%`}}/></div>{progress&&progress.totalFiles>0&&<small>{t("games.backups.progressFiles",{done:progress.files,total:progress.totalFiles})} · {transferBytes(progress.bytes)} / {transferBytes(progress.totalBytes)}</small>}</div>:<div className="games-saves-footer"><span>{t(saves.plan?"games.backups.recoveryNote":"games.backups.localNote")}{saves.plan && <span className="games-save-comparison-scope">{t("games.backups.compare.scope")}</span>}</span>{saves.plan?<button className="games-button games-button-primary" disabled={!!saves.busy||saves.plan.changes.length===0} onClick={()=>void saves.restore()}><RotateCcw size={17}/>{t("games.backups.restore")}</button>:<button className="games-button" onClick={dismiss}>{t("common.close")}</button>}</div>}</footer>
    </div>
  </ModalShell>;
}
