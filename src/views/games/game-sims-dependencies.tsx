import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, LoaderCircle } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { simsCancel, simsDependencies, simsDisplayPath, simsError, type SimsDependencies, type SimsProgress, type SimsWorkspace } from "@/lib/games/sims";
import { SimsPackLaunchInfo, useSimsPackSelection } from "./game-sims-packs";

export function GameSimsDependencies({ data, profile, active, disabled }: { data: SimsWorkspace; profile: string; active: boolean; disabled: boolean }) {
  const t = useT(), label = (key: string) => t(`games.sims.${key}`);
  const packs = useSimsPackSelection(), packKey = JSON.stringify(packs.selection);
  const [report, setReport] = useState<SimsDependencies | null>(null), [busy, setBusy] = useState(false), [canceling, setCanceling] = useState(false), [file, setFile] = useState(""), [error, setError] = useState("");
  const [limit, setLimit] = useState(12);
  const alive = useRef(true), task = useRef<{ id: string; canceled: boolean } | null>(null);
  const scanButton = useRef<HTMLButtonElement>(null), cancelButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false), focusCancel = useRef(false);
  const cancel = useCallback(() => { const current = task.current; if (current) { current.canceled = true; void simsCancel(profile, current.id).catch(() => {}); } }, [profile]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; cancel(); }; }, [cancel]);
  useEffect(() => { if (!active || disabled) cancel(); }, [active, disabled, cancel]);
  useEffect(() => { cancel(); setReport(null); setError(""); }, [packKey, active, cancel]);
  useEffect(() => { if (busy && focusCancel.current) { focusCancel.current = false; cancelButton.current?.focus({ preventScroll: true }); } else if (!busy && returnFocus.current) { returnFocus.current = false; scanButton.current?.focus({ preventScroll: true }); } }, [busy]);
  const scan = async () => {
    if (task.current || disabled || packs.busy || !active) return;
    const own = { id: crypto.randomUUID(), canceled: false }; task.current = own;
    focusCancel.current = document.activeElement === scanButton.current;
    setBusy(true); setCanceling(false); setError(""); setFile(""); setReport(null); setLimit(12);
    let stop: (() => void) | undefined;
    try {
      stop = await listen<SimsProgress>("games:sims-progress", ({ payload }) => {
        if (payload.profile !== profile || payload.operationId !== own.id) return;
        if (own.canceled || !alive.current) { if (payload.canCancel) void simsCancel(profile, own.id).catch(() => {}); }
        else setFile(payload.file ?? "");
      });
      if (own.canceled || !alive.current) return;
      const value = await simsDependencies(profile, data.folder.path, own.id, packs.selection);
      if (alive.current && !own.canceled) setReport(value);
    } catch (reason) { if (alive.current && !own.canceled) setError(simsError(reason)); }
    finally { stop?.(); if (task.current === own) task.current = null; if (alive.current) { returnFocus.current = document.activeElement === cancelButton.current; setBusy(false); setFile(""); } }
  };
  const statusKey = { found: "depsFound", missing: "depsMissing", unchecked: "depsUnchecked", notRequired: "depsNotRequired", alternative: "depsAlternative" };
  return <details className="games-sims-guidance games-sims-dependencies" onToggle={event => { if (!event.currentTarget.open) cancel(); }}>
    <summary>{label("depsTitle")}<ChevronDown size={16}/></summary>
    <div className="games-sims-duplicates-intro"><p>{label("depsNote")}</p><button ref={scanButton} className="games-button" disabled={disabled || busy || packs.busy} onClick={() => void scan()}>{label(report ? "duplicatesAgain" : "depsScan")}</button></div>
    {!packs.selection && <p>{label("depsPackMissing")}</p>}
    {busy && <div className="games-sims-duplicates-progress"><p role="status"><LoaderCircle size={18}/><span>{t("common.loading")}<small dir="auto">{file}</small></span></p><button ref={cancelButton} className="games-button" aria-disabled={canceling} onClick={() => { if (!canceling) { cancel(); setCanceling(true); } }}>{t("common.cancel")}</button></div>}
    {error && <p role="alert" className="games-sims-notice">{t(error)}</p>}
    {report && <>
      {report.packs && <><p className="games-sims-path" dir="auto">{t("games.sims.depsPackUsing", { path: simsDisplayPath(report.packs.path) })}</p><SimsPackLaunchInfo report={report.packs}/></>}
      {report.packError && <p role="alert">{label("depsPackError")}</p>}
      <p role="status">{t("games.sims.depsCoverage", { count: report.checkedFiles, manifests: report.manifestFiles })}</p>
      {report.partial && <p className="games-sims-warning">{label("depsPartial")}</p>}
      {!report.requirements.length && <p>{label("depsNone")}</p>}
      <div className="games-sims-dependency-results">{report.requirements.slice(0, limit).map((entry, index) => <article key={`${entry.file}:${index}`}>
        <header><div><small dir="auto">{entry.modName}</small><h3 dir="auto">{entry.name}</h3></div><span className={entry.status === "missing" ? "games-sims-warning" : ""}>{label(statusKey[entry.status])}</span></header>
        {entry.version && <p>{t("games.sims.infoVersion", { version: entry.version })}</p>}
        {!!entry.matchedFiles.length && <details><summary>{label("depsMatches")}<ChevronDown size={14}/></summary><ul>{entry.matchedFiles.map(path => <li key={path} dir="auto">{path}</li>)}</ul></details>}
        <small className="games-sims-info-source" dir="auto">{entry.file}</small>
        {entry.url && <button className="games-detail-text-button" onClick={() => void openUrl(entry.url!)}>{label("infoWebsite")}<ArrowUpRight size={14}/></button>}
      </article>)}</div>
      {report.requirements.length > limit && <button className="games-button" onClick={() => setLimit(n => n + 12)}>{t("games.details.showMore")}</button>}
    </>}
  </details>;
}
