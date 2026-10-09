import { SimsPackIcon } from "./sims-pack-icon";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Ban, Check, ChevronDown, ChevronRight, CircleHelp, FolderOpen, LoaderCircle, Minus, RefreshCw, TriangleAlert } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { useT, useUiLanguage } from "@/lib/i18n";
import { simsCancel, simsDisplayPath, simsError, type SimsProgress } from "@/lib/games/sims";
import { readSimsInstallation, rememberSimsInstallation, simsCheckPacks, simsPackCode, simsPackName, simsPackStatus, type SimsPackReport, type SimsPackSelection } from "@/lib/games/sims-packs";
import { simsInstallationKey, type SimsInstallation } from "@/lib/games/sims-installations";
import { GameLauncherLogo } from "./game-launcher-logo";

type PackContext = { report: SimsPackReport | null; selection: SimsPackSelection | null; busy: boolean; picking: boolean; error: string; path: string; installations: SimsInstallation[]; select: (path: string, trigger: HTMLElement) => void; choose: () => void; refresh: () => void; cancel: () => void };
const Context = createContext<PackContext | null>(null);
export const useSimsPackSelection = () => { const value = useContext(Context); return { selection: value?.selection ?? null, busy: value?.busy ?? false }; };

export function SimsPackProvider({ profile, active, installations, children }: { profile: string; active: boolean; installations: SimsInstallation[]; children: ReactNode }) {
  const t = useT(), [rawReport, setReport] = useState<SimsPackReport | null>(null), [error, setError] = useState(""), [checkedCustom, setCheckedCustom] = useState("");
  const known = useRef(installations); known.current = installations;
  const customFor = (folder: string) => known.current.find(item => item.key === simsInstallationKey(folder))?.custom ?? [];
  const selection = rawReport ? { path: rawReport.path, custom: customFor(rawReport.path) } : null;
  const report: SimsPackReport | null = rawReport && JSON.stringify(selection?.custom) !== checkedCustom ? { ...rawReport, launch: { source: "custom", state: "unknown", disabled: [] } } : rawReport;
  const [busy, setBusy] = useState(false), [picking, setPicking] = useState(false), [path, setPath] = useState(() => readSimsInstallation(profile));
  const alive = useRef(true), enabled = useRef(active), task = useRef<{ id: string; canceled: boolean } | null>(null), picker = useRef(0);
  const restoreFocus = useRef<HTMLElement | null>(null);
  enabled.current = active;
  const cancel = useCallback(() => { const own = task.current; if (own) { own.canceled = true; void simsCancel(profile, own.id).catch(() => {}); } }, [profile]);
  const run = useCallback(async (folder: string, trigger: HTMLElement | null = null) => {
    if (!alive.current || !enabled.current || !folder) return;
    cancel(); const own = { id: crypto.randomUUID(), canceled: false }; task.current = own;
    restoreFocus.current = trigger;
    setBusy(true); setReport(null); setError("");
    let stop: (() => void) | undefined;
    try {
      stop = await listen<SimsProgress>("games:sims-progress", ({ payload }) => {
        if (payload.profile === profile && payload.operationId === own.id && payload.canCancel && (own.canceled || !alive.current || !enabled.current)) void simsCancel(profile, own.id).catch(() => {});
      });
      if (own.canceled || !alive.current || !enabled.current) return;
      const custom = customFor(folder), snapshot = JSON.stringify(custom);
      const value = await simsCheckPacks(profile, folder, own.id, custom);
      if (task.current === own && !own.canceled && alive.current && enabled.current) {
        setReport(value); setCheckedCustom(snapshot); setPath(value.path); rememberSimsInstallation(profile, value.path);
      }
    } catch (reason) { if (task.current === own && !own.canceled && alive.current && enabled.current) setError(simsError(reason)); }
    finally { stop?.(); if (task.current === own) { task.current = null; if (alive.current) setBusy(false); } }
  }, [profile, cancel]);
  useEffect(() => {
    if (!active) { restoreFocus.current = null; return; }
    if (busy || picking) return;
    const trigger = restoreFocus.current; restoreFocus.current = null;
    requestAnimationFrame(() => { if (alive.current && enabled.current && !task.current && trigger?.isConnected) trigger.focus({ preventScroll: true }); });
  }, [active, busy, picking, report, error]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; picker.current++; cancel(); }; }, [cancel]);
  const detectedPath = installations.length === 1 ? installations[0].path : "";
  useEffect(() => {
    if (active) { const saved = readSimsInstallation(profile) || detectedPath; if (saved) void run(saved); }
    else { picker.current++; cancel(); setReport(null); setError(""); }
    return cancel;
  }, [active, profile, run, cancel, detectedPath]);
  const choose = async () => {
    if (picking || busy || !active) return;
    const own = ++picker.current, trigger = document.activeElement as HTMLElement | null; setPicking(true);
    restoreFocus.current = trigger;
    try {
      const selected = await open({ directory: true, multiple: false, title: t("games.sims.packsChoose"), defaultPath: path || undefined });
      if (own === picker.current && alive.current && enabled.current && selected) await run(selected, trigger);
    } catch (reason) { if (own === picker.current && alive.current && enabled.current) setError(simsError(reason)); }
    finally { if (alive.current) setPicking(false); }
  };
  const select = async (folder: string, trigger: HTMLElement) => {
    if (busy || picking || !active || !installations.some(item => item.path === folder)) return;
    await run(folder, trigger);
  };
  return <Context.Provider value={{ report, selection, busy, picking, error, path, installations, select: (folder, trigger) => void select(folder, trigger), choose: () => void choose(), refresh: () => void run(path, document.activeElement as HTMLElement | null), cancel }}>{children}</Context.Provider>;
}

function PackActions({ compact = false }: { compact?: boolean }) {
  const t = useT(), value = useContext(Context), language = useUiLanguage();
  if (!value) return null;
  const installations = value.installations.length > 0 && <div className="games-sims-installations" role="group" aria-label={t("games.sims.packsLibrary")}>
      {!compact && <small>{t("games.sims.packsLibrary")}</small>}
      {value.installations.map(item => <button key={item.key} type="button" disabled={value.busy || value.picking} title={t("games.sims.packsUse")} onClick={event => value.select(item.path, event.currentTarget)}>
        {item.sources[0] === "custom" ? <FolderOpen size={22} aria-hidden="true"/> : <GameLauncherLogo launcher={item.sources[0]} size={22}/>}
        <span className="games-sims-installation-label"><strong>{item.sources.map(source => source === "custom" ? t("games.sims.packsManual") : source === "ea" ? "EA app" : "Steam").join(" · ")}</strong><small dir="ltr">{simsDisplayPath(item.path)}</small></span>
        {value.report && simsInstallationKey(value.report.path) === item.key ? <Check size={16} aria-hidden="true"/> : <ChevronRight size={16} aria-hidden="true"/>}
      </button>)}
    </div>;
  return <div className="games-sims-pack-actions">
    {installations && (compact ? <details className="games-sims-installation-options"><summary>{t("games.sims.packsLibrary")}<ChevronDown size={16}/></summary>{installations}</details> : installations)}
    <div className="games-sims-actions">
      <button className="games-button" disabled={value.busy || value.picking} onClick={value.choose}><FolderOpen size={16}/>{t(`games.sims.${value.path ? "packsChange" : "packsChoose"}`)}</button>
      {value.path && <button className="games-icon-button" disabled={value.busy || value.picking} title={t("games.sims.packsRefresh")} aria-label={t("games.sims.packsRefresh")} onClick={value.refresh}><RefreshCw size={16}/></button>}
      {value.busy && <><span className="games-sims-pending" role="status"><LoaderCircle size={17}/>{t("games.sims.packsChecking")}</span><button className="games-button" onClick={value.cancel}>{t("common.cancel")}</button></>}
    </div>
    {value.report && <><small>{t("games.sims.packsChecked", { date: new Date(value.report.checkedAt * 1000).toLocaleString(language, { dateStyle: "medium", timeStyle: "short" }) })}</small><small className="games-sims-path" dir="auto">{simsDisplayPath(value.report.path)}</small></>}
    {value.error && <p role="alert">{t(value.error)}</p>}
  </div>;
}
function PackStatus({ status, incompatible = false }: { status: "found" | "missing" | "unchecked" | "disabled"; incompatible?: boolean }) {
  const t = useT(), conflict = incompatible && status === "found", Icon = conflict ? TriangleAlert : status === "disabled" ? Ban : status === "found" ? Check : status === "missing" ? Minus : CircleHelp;
  return <span className={`games-sims-pack-status is-${conflict ? "conflict" : status}`}><Icon size={14}/>{t(`games.sims.packs${status === "disabled" ? "Disabled" : status === "found" ? "Found" : status === "missing" ? "Missing" : "Unchecked"}`)}</span>;
}
export function SimsPackLaunchInfo({ report }: { report: SimsPackReport }) {
  const t = useT(), value = report.launch;
  return <div className="games-sims-pack-launch" role="status">{value?.state === "checked" ? <><small>{t("games.sims.packsLaunchChecked", { source: value.source === "custom" ? "Harbor" : value.source === "ea" ? "EA app" : "Steam" })}</small><small>{value.disabled.length ? t("games.sims.packsLaunchDisabled", { packs: value.disabled.map(code => simsPackName(code) ?? code).join(", ") }) : t("games.sims.packsLaunchClear")}</small></> : <small>{t(value?.state === "conflicting" ? "games.sims.packsLaunchConflict" : "games.sims.packsLaunchUnknown")}</small>}</div>;
}
export function GameSimsPacks() {
  const t = useT(), value = useContext(Context);
  if (!value) return null;
  return <details className="games-sims-guidance games-sims-pack-check"><summary>{t("games.sims.packsTitle")}<ChevronDown size={16}/></summary>
    <p>{t("games.sims.packsIntro")}</p><PackActions/>
    {value.report && <>
      {value.report.partial && <p role="status">{t("games.sims.packsPartial")}</p>}
      {value.report.packs.length ? <ul className="games-sims-pack-list">{value.report.packs.map(pack => <li key={pack.code}><SimsPackIcon code={pack.code}/><span dir="auto">{simsPackName(pack.code) ?? pack.code}<small>{pack.code}</small></span><PackStatus status={simsPackStatus(pack.code, value.report)}/></li>)}</ul> : <p>{t("games.sims.packsEmpty")}</p>}
      <SimsPackLaunchInfo report={value.report}/>
      <p>{t("games.sims.packsScope")}</p></>}
  </details>;
}
export function SimsPackCheckActions() {
  const t = useT(), value = useContext(Context);
  if (!value) return null;
  return <><PackActions compact/>{value.report && <><SimsPackLaunchInfo report={value.report}/><small className="games-sims-pack-scope">{t("games.sims.packsScope")}</small></>}</>;
}
export function SimsPackRequirements({ values, incompatible = false, controls = true }: { values: string[]; incompatible?: boolean; controls?: boolean }) {
  const t = useT(), value = useContext(Context);
  if (!values.length) return null;
  return <div className="games-sims-pack-requirements"><strong>{t(`games.sims.${incompatible ? "infoIncompatiblePacks" : "infoRequiredPacks"}`)}</strong>
    <ul className="games-sims-pack-list">{[...new Set(values)].map(name => { const code = simsPackCode(name), title = code ? simsPackName(code) ?? name : name; return <li key={name}><SimsPackIcon code={code}/><span dir="auto">{title}{code && title !== code && <small>{code}</small>}</span><PackStatus status={simsPackStatus(name, value?.report ?? null)} incompatible={incompatible}/></li>; })}</ul>
    {controls && <SimsPackCheckActions/>}
  </div>;
}
