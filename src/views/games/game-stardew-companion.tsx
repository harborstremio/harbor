import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, FolderOpen, LoaderCircle, RefreshCw, Search, TriangleAlert } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { Dropdown } from "@/components/dropdown";
import { useT, useUiLanguage } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { stardewAttention, stardewDisplayPath, type StardewMod, type StardewUpdate } from "@/lib/games/stardew";
import packageIcon from "@/assets/settings-icons/package.svg";
import { useStardewMods } from "./use-stardew-mods";
import "./game-stardew-companion.css";
import { GameStardewManager } from "./game-stardew-manager";
import { GameStardewCatalog } from "./game-stardew-catalog";

export function GameStardewCompanion({ profile, active, artwork }: { profile: string; active: boolean; artwork?: string }) {
  const t = useT(); const language = useUiLanguage(); const label = (key: string) => t(`games.stardew.${key}`);
  const state = useStardewMods(profile, active);
  const [query, setQuery] = useState(""); const [filter, setFilter] = useState("all");
  const [managerRevision, setManagerRevision] = useState(0);
  const [picking, setPicking] = useState(false); const [artFailed, setArtFailed] = useState(false); const [artLoaded, setArtLoaded] = useState(false);
  const current = useRef(active); current.current = active;
  const alive = useRef(true); const cancelButton = useRef<HTMLButtonElement>(null); const scanButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { if (!state.busy && restoreFocus.current) { scanButton.current?.focus({ preventScroll: true }); restoreFocus.current = false; } }, [state.busy]);
  const choose = async () => {
    if (picking || state.busy) return; setPicking(true);
    try { const path = await open({ directory: true, multiple: false, title: label("choose") }); if (typeof path === "string" && alive.current && current.current) await state.run(path); }
    catch { if (alive.current) state.setError("games.stardew.readError"); }
    finally { if (alive.current) setPicking(false); }
  };
  const updates = new Map((state.report?.updates ?? []).map(item => [item.id.toLowerCase(), item]));
  const mods = state.inventory?.mods ?? [];
  const hasUpdate = (mod: StardewMod) => !mod.duplicate && updates.get(mod.manifest.id.toLowerCase())?.state === "available";
  const attention = mods.filter(stardewAttention).length; const updateCount = mods.filter(hasUpdate).length;
  const shown = mods.filter(mod => (filter !== "attention" || stardewAttention(mod)) && (filter !== "updates" || hasUpdate(mod)) && `${mod.manifest.name} ${mod.manifest.author} ${mod.manifest.id}`.toLowerCase().includes(query.trim().toLowerCase()));
  const busy = state.busy || picking;
  return <section className="games-stardew" aria-label={label("title")}>
    <header className="games-stardew-heading">
      {artwork && !artFailed && <div className="games-stardew-art"><img src={artwork} alt="" loading="lazy" onLoad={() => setArtLoaded(true)} onError={() => setArtFailed(true)}/>{!artLoaded && <span aria-hidden="true"><LoaderCircle size={18}/></span>}</div>}
      <div><h2>{label("title")}</h2><p>{label("intro")}</p><button className="games-detail-text-button" onClick={() => void openUrl("https://smapi.io/")}>SMAPI<ArrowUpRight size={14}/></button></div>
    </header>
    <div className="games-stardew-toolbar">
      <button ref={scanButton} className="games-button" disabled={busy || !active} onClick={() => state.path ? void state.run() : void choose()}>{state.path ? <RefreshCw size={16}/> : <FolderOpen size={16}/>}{label(state.path ? "rescan" : "choose")}</button>
      {state.path && <button className="games-detail-text-button" disabled={busy || !active} onClick={() => void choose()}>{label("change")}</button>}
      {state.inventory && <button className="games-button games-button-primary" disabled={busy || !active || !mods.length} onClick={() => void state.run(state.path, true)}>{label("check")}</button>}
    </div>
    {!state.path && state.candidates.map(path => <button className="games-button games-stardew-candidate" key={path} disabled={busy || !active} onClick={() => void state.run(path)}><FolderOpen size={16}/><span dir="ltr">{stardewDisplayPath(path)}</span></button>)}
    {state.path && <p className="games-stardew-path" dir="ltr">{stardewDisplayPath(state.path)}</p>}
    {state.busy && <div className="games-stardew-progress"><p role="status"><LoaderCircle size={18}/>{label(state.progress?.phase ?? "scanning")}{state.progress && state.progress.current > 0 && <span>{state.progress.current}{state.progress.total ? ` / ${state.progress.total}` : ""}</span>}</p><button ref={cancelButton} className="games-button" aria-disabled={state.canceling} onClick={() => { if (!state.canceling) { restoreFocus.current = true; state.cancel(); } }}>{t("common.cancel")}</button></div>}
    {state.error && <p role="alert" className="games-stardew-notice"><TriangleAlert size={17}/>{t(state.error)}</p>}
    <GameStardewCatalog key={profile} profile={profile} path={state.inventory?.path} active={active} blocked={busy} changed={() => { setManagerRevision(v => v + 1); void state.run(); }}/>
    {state.inventory && <GameStardewManager key={`${profile}:${state.inventory.path}:${managerRevision}`} profile={profile} path={state.inventory.path} active={active} blocked={state.busy} changed={() => void state.run()}/>}
    {state.inventory && <>
      <div className="games-stardew-overview"><span>{t("games.stardew.modCount", { count: mods.length })}</span><span>Stardew Valley · {state.inventory.gameVersion ?? label("unknown")}</span><span>SMAPI · {state.inventory.smapiVersion ?? label("unknown")}</span></div>
      <p className="games-stardew-note">{label("scope")}</p>
      {!state.inventory.smapiVersion && <p className="games-stardew-note">{label("noSmapiVersion")}</p>}
      {mods.length > 0 && <>
        <div className="games-stardew-filters"><label className="games-stardew-search"><Search size={16}/><input value={query} aria-label={label("search")} placeholder={label("search")} onChange={event => setQuery(event.target.value)}/></label><Dropdown value={filter} onChange={setFilter} ariaLabel={label("filter")} options={[{ value: "all", label: label("all") }, { value: "attention", label: `${label("attention")} · ${attention}` }, { value: "updates", label: `${label("updates")} · ${updateCount}` }]}/></div>
        <div className="games-stardew-mods" aria-busy={state.busy}>{shown.map(mod => <ModRow key={mod.folder} mod={mod} updates={updates} checked={Boolean(state.report)}/>)}</div>
        {!shown.length && <p className="games-stardew-empty">{label("noMatches")}</p>}
        <p className="games-stardew-note">{label("share")}</p>
      </>}
      {!mods.length && !state.inventory.partial && <p className="games-stardew-empty">{label("empty")}</p>}
      {state.inventory.partial && <details className="games-stardew-issues"><summary><TriangleAlert size={17}/>{label("partial")}<ChevronDown size={16}/></summary><ul>{state.inventory.issues.map((issue, i) => <li key={`${issue.path}:${i}`}><code dir="ltr">{issue.path}</code></li>)}</ul></details>}
      {state.report && <p className="games-stardew-note">SMAPI · {new Date(state.report.observedAt * 1000).toLocaleString(language)}</p>}
    </>}
  </section>;
}

function ModRow({ mod, updates, checked }: { mod: StardewMod; updates: Map<string, StardewUpdate>; checked: boolean }) {
  const t = useT(); const label = (key: string) => t(`games.stardew.${key}`);
  const update = mod.duplicate ? undefined : updates.get(mod.manifest.id.toLowerCase());
  const attention = stardewAttention(mod);
  const status = update?.state === "available" ? "updates" : attention ? "attention" : update?.state ?? (checked ? "unknown" : "notChecked");
  return <details className="games-stardew-mod"><summary><span className="games-stardew-package" aria-hidden="true" style={{ maskImage: `url("${packageIcon}")` }}/><span className="games-stardew-mod-name"><strong dir="auto">{mod.manifest.name}</strong><small dir="auto">{mod.manifest.author} · {mod.manifest.version}</small></span><span className={`games-stardew-status${attention || update?.state === "available" ? " is-notice" : ""}`}>{label(status)}</span><ChevronDown size={16}/></summary>
    <div className="games-stardew-mod-detail">
      {mod.manifest.description && <p dir="auto">{mod.manifest.description}</p>}
      <code dir="ltr">{mod.folder}</code>
      {mod.duplicate && <p>{label("duplicateNote")}</p>}{mod.missingDll && <p>{label("dllNote")}</p>}
      {update?.state === "available" && <p>{mod.manifest.version} → {update.version}</p>}
      {update?.url && <button className="games-detail-text-button" onClick={() => void openUrl(update.url!)}>{label(update.state === "available" ? "viewUpdate" : "project")}<ArrowUpRight size={14}/></button>}
      {mod.requirements.length > 0 && <div className="games-stardew-requirements"><h3>{label("requirements")}</h3>{mod.requirements.map((requirement, index) => { const source = updates.get(requirement.id.toLowerCase()); return <div key={`${requirement.id}:${index}`}><span><span dir="auto">{source?.name ?? requirement.id}</span>{requirement.minimum && <small> ≥ {requirement.minimum}</small>}{!requirement.required && <small> · {label("optional")}</small>}</span><span>{label(`requirement.${requirement.status}`)}{source?.url && <button className="games-detail-text-button" aria-label={`${label("project")}: ${source.name ?? requirement.id}`} onClick={() => void openUrl(source.url!)}><ArrowUpRight size={14}/></button>}</span></div>; })}</div>}
      {update?.errors.length ? <p>{label("providerError")}</p> : null}
      {update?.communityNote && <details className="games-stardew-history"><summary>{label("history")}<ChevronDown size={14}/></summary><p>{label("historyNote")}</p><p dir="auto">{update.communityNote}</p></details>}
    </div>
  </details>;
}
