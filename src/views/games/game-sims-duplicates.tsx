import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, FolderOpen, LoaderCircle } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useT, useUiLanguage } from "@/lib/i18n";
import { transferBytes } from "@/lib/games/transfers";
import { simsCancel, simsDuplicates, simsError, type SimsDuplicates, type SimsProgress, type SimsWorkspace } from "@/lib/games/sims";
import type { SimsSelection } from "./game-sims-review";

export function GameSimsDuplicates({ data, profile, active, disabled, choose }: { data: SimsWorkspace; profile: string; active: boolean; disabled: boolean; choose: (selection: SimsSelection) => void }) {
  const t = useT(), language = useUiLanguage(), label = (key: string) => t(`games.sims.${key}`);
  const [report, setReport] = useState<SimsDuplicates | null>(null), [busy, setBusy] = useState(false), [canceling, setCanceling] = useState(false), [file, setFile] = useState(""), [error, setError] = useState("");
  const [limit, setLimit] = useState(12);
  const [copyLimits, setCopyLimits] = useState<Record<string, number>>({});
  const alive = useRef(true), task = useRef<{ id: string; canceled: boolean } | null>(null);
  const scanButton = useRef<HTMLButtonElement>(null), cancelButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false), focusCancel = useRef(false);
  const cancel = useCallback(() => { const current = task.current; if (current) { current.canceled = true; void simsCancel(profile, current.id).catch(() => {}); } }, [profile]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; cancel(); }; }, [cancel]);
  useEffect(() => { if (!active || disabled) cancel(); }, [active, disabled, cancel]);
  useEffect(() => { if (busy && focusCancel.current) { focusCancel.current = false; cancelButton.current?.focus({ preventScroll: true }); } else if (!busy && returnFocus.current) { returnFocus.current = false; scanButton.current?.focus({ preventScroll: true }); } }, [busy]);
  const scan = async () => {
    if (task.current || disabled || !active) return;
    const own = { id: crypto.randomUUID(), canceled: false }; task.current = own;
    focusCancel.current = document.activeElement === scanButton.current;
    setBusy(true); setCanceling(false); setError(""); setFile(""); setReport(null); setLimit(12); setCopyLimits({});
    let stop: (() => void) | undefined;
    try {
      stop = await listen<SimsProgress>("games:sims-progress", ({ payload }) => {
        if (payload.profile !== profile || payload.operationId !== own.id) return;
        // Closing can beat native registration. Retry once its first event arrives.
        if (own.canceled || !alive.current) { if (payload.canCancel) void simsCancel(profile, own.id).catch(() => {}); }
        else setFile(payload.file ?? "");
      });
      if (own.canceled || !alive.current) return;
      const value = await simsDuplicates(profile, data.folder.path, own.id);
      if (alive.current && !own.canceled) setReport(value);
    } catch (reason) { if (alive.current && !own.canceled) setError(simsError(reason)); }
    finally { stop?.(); if (task.current === own) task.current = null; if (alive.current) { returnFocus.current = document.activeElement === cancelButton.current; setBusy(false); setFile(""); } }
  };
  const showFile = async (path: string) => {
    try { await revealItemInDir(`${data.folder.path}/Mods/${path}`.replaceAll("/", "\\")); }
    catch { if (alive.current) setError("games.sims.readError"); }
  };
  return <details className="games-sims-guidance games-sims-duplicates" onToggle={event => { if (!event.currentTarget.open) cancel(); }}>
    <summary>{label("duplicatesTitle")}<ChevronDown size={16}/></summary>
    <div className="games-sims-duplicates-intro"><p>{label("duplicatesNote")}</p><button ref={scanButton} className="games-button" disabled={disabled || busy} onClick={() => void scan()}>{label(report ? "duplicatesAgain" : "duplicatesScan")}</button></div>
    {busy && <div className="games-sims-duplicates-progress"><p role="status"><LoaderCircle size={18}/><span>{t("common.loading")}<small dir="auto">{file}</small></span></p><button ref={cancelButton} className="games-button" aria-disabled={canceling} onClick={() => { if (!canceling) { cancel(); setCanceling(true); } }}>{t("common.cancel")}</button></div>}
    {error && <p role="alert" className="games-sims-notice">{t(error)}</p>}
    {report && <>
      <p role="status">{report.matches.length ? t("games.sims.duplicatesFound", { count: report.matches.length }) : label(report.partial ? "duplicatesNonePartial" : "duplicatesNone")}</p>
      <small>{t("games.sims.duplicatesChecked", { count: report.checkedFiles, time: new Date(report.checkedAt * 1000).toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" }) })}</small>
      {report.partial && <p className="games-sims-warning">{label("duplicatesPartial")}</p>}
      <div className="games-sims-duplicates-results">{report.matches.slice(0, limit).map(match => <article key={match.copies[0].path}>
        <header><strong>{t("games.sims.duplicatesCopies", { count: match.copies.length })}</strong><small>{transferBytes(match.bytes)}</small></header>
        <ul>{match.copies.slice(0, copyLimits[match.copies[0].path] ?? 6).map(copy => <li key={copy.path}><div>{copy.groupTitle && <strong dir="auto">{copy.groupTitle}</strong>}<span dir="auto">{copy.path}</span></div><div className="games-sims-actions"><button className="games-button" onClick={() => void showFile(copy.path)}><FolderOpen size={16}/>{label("duplicatesShow")}</button>{copy.groupId && <button className="games-button" disabled={disabled} onClick={() => choose({ action: { kind: "disable", id: copy.groupId! }, title: copy.groupTitle!, sources: [] })}>{label("duplicatesDisable")}</button>}</div></li>)}</ul>
        {match.copies.length > (copyLimits[match.copies[0].path] ?? 6) && <button className="games-button" onClick={() => setCopyLimits(previous => ({ ...previous, [match.copies[0].path]: (previous[match.copies[0].path] ?? 6) + 6 }))}>{t("games.details.showMore")}</button>}
      </article>)}</div>
      {report.matches.length > limit && <button className="games-button" onClick={() => setLimit(n => n + 12)}>{t("games.details.showMore")}</button>}
    </>}
  </details>;
}
