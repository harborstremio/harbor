import { useEffect, useId, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { ArrowDownToLine, ArrowUpRight, ChevronDown, LoaderCircle, RefreshCw } from "lucide-react";
import { useT, useUiLanguage } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { stardewCancel, stardewCatalog, stardewError, type StardewCatalog, type StardewProgress } from "@/lib/games/stardew";
import { GameStardewReview } from "./game-stardew-review";
import packageIcon from "@/assets/settings-icons/package.svg";

export function GameStardewCatalog({ profile, path, active, blocked, changed }: { profile: string; path?: string; active: boolean; blocked: boolean; changed: () => void }) {
 const t = useT(), language = useUiLanguage(), id = useId(); const text = (key: string) => t(`games.stardew.${key}`);
 const [expanded, setExpanded] = useState(false), [catalog, setCatalog] = useState<StardewCatalog | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
 const [selection, setSelection] = useState<{ project: string; trigger: HTMLElement | null } | null>(null);
 const alive = useRef(true), current = useRef(active), trigger = useRef<HTMLButtonElement>(null), task = useRef<{ id: string; canceled: boolean } | null>(null); current.current = active;
 const cancel = () => { const own = task.current; if (own) { own.canceled = true; void stardewCancel(profile, own.id).catch(() => {}); } };
 const load = async (refresh = false) => {
  if (task.current || !current.current) return;
  const own = { id: crypto.randomUUID(), canceled: false }; task.current = own; setBusy(true); setError(""); let stop: (() => void) | undefined;
  try {
   stop = await listen<StardewProgress>("games:stardew-progress", ({ payload }) => { if (payload.profile === profile && payload.operationId === own.id && (own.canceled || !alive.current || !current.current)) void stardewCancel(profile, own.id).catch(() => {}); });
   if (own.canceled || !alive.current || !current.current) return;
   const value = await stardewCatalog(profile, own.id, refresh);
   if (!own.canceled && alive.current && current.current) setCatalog(value);
  } catch (e) { if (!own.canceled && alive.current && current.current) setError(stardewError(e)); }
  finally { stop?.(); if (task.current === own) task.current = null; if (alive.current) setBusy(false); }
 };
 useEffect(() => { alive.current = true; return () => { alive.current = false; cancel(); }; }, [profile]);
 useEffect(() => { if (!active) { cancel(); setSelection(null); setExpanded(false); } }, [active]);
 useEffect(() => {
  let mounted = true;
  if (expanded && active && !catalog && !error && !busy) queueMicrotask(() => { if (mounted) void load(); });
  return () => { mounted = false; };
 }, [expanded, active, catalog, error, busy]);
 const toggle = () => { if (expanded) cancel(); setExpanded(!expanded); };
 const date = (value: string) => { const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString(language); };
 return <div className="games-stardew-discovery">
  <button ref={trigger} className="games-button" aria-expanded={expanded} aria-controls={id} disabled={!active} onClick={toggle}><span className="games-stardew-package" aria-hidden="true" style={{ maskImage: `url("${packageIcon}")` }}/>{text("browse")}<ChevronDown size={15}/></button>
  {expanded && <div id={id} className="games-stardew-catalog">
   <div className="games-stardew-catalog-heading"><div><h3>{text("starterTitle")}</h3><p>{text("starterNote")}</p></div><button className="games-detail-text-button" disabled={busy} aria-label={text("refresh")} onClick={() => void load(true)}><RefreshCw size={17}/></button></div>
   {busy && <p className="games-stardew-working" role="status"><LoaderCircle size={18}/>{text("catalog")}</p>}
   {error && <p role="alert">{t(error)}</p>}
   {catalog?.stale && <p className="games-stardew-note" role="status">{text("catalogStale")}</p>}
   {!!catalog?.unavailable && <p className="games-stardew-note" role="status">{text("catalogPartial")}</p>}
   {catalog && <>
    {!path && <p className="games-stardew-note">{text("creatorChoose")}</p>}
    <div className="games-stardew-projects">{catalog.projects.map(project => <article className="games-stardew-project" key={project.id}>
     <h4 dir="auto">{project.name}</h4><small dir="auto">{project.author}</small><p dir="auto">{project.description}</p>
     <small>{project.version} · {date(project.updated)}</small>
     <div className="games-stardew-toolbar">
      {project.creator && <button className="games-button" disabled={!path || blocked || busy} onClick={() => setSelection({ project: project.id, trigger: document.activeElement as HTMLElement | null })}><ArrowDownToLine size={16}/>{text("creatorGet")}</button>}
      <button className="games-detail-text-button" onClick={() => void openUrl(project.url)}>Nexus Mods<ArrowUpRight size={14}/></button>
     </div>
    </article>)}</div>
    <p className="games-stardew-note">{text("creatorRoute")}</p>
    <div className="games-stardew-catalog-source"><button className="games-detail-text-button" onClick={() => void openUrl(`https://github.com/Pathoschild/StardewModDataset/tree/${catalog.commit}`)}>StardewModDataset<ArrowUpRight size={14}/></button><span>{text("snapshot")} · {date(catalog.snapshot)}</span><button className="games-detail-text-button" onClick={() => void openUrl("https://www.nexusmods.com/games/stardewvalley/mods")}>{text("moreMods")}<ArrowUpRight size={14}/></button></div>
   </>}
  </div>}
  {selection && path && active && <GameStardewReview profile={profile} path={path} action={{ kind: "creator", project: selection.project }} trigger={selection.trigger} fallback={trigger.current} onClose={() => setSelection(null)} changed={changed}/>}
 </div>;
}
