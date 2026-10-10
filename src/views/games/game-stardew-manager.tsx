import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, FolderOpen, LoaderCircle, Plus, RotateCcw } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useT, useUiLanguage } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { stardewError, stardewWorkspace, type StardewAction, type StardewWorkspace } from "@/lib/games/stardew";
import { GameStardewReview } from "./game-stardew-review";
import packageIcon from "@/assets/settings-icons/package.svg";
type Selection = { action: StardewAction | { kind: "recover" }; trigger: HTMLElement | null };
export function GameStardewManager({ profile, path, active, blocked, changed }: { profile: string; path: string; active: boolean; blocked: boolean; changed: () => void }) {
 const t = useT(), language = useUiLanguage(); const text = (key: string) => t(`games.stardew.${key}`);
 const [workspace, setWorkspace] = useState<StardewWorkspace | null>(null), [error, setError] = useState(""), [loading, setLoading] = useState(true), [picking, setPicking] = useState(false), [selection, setSelection] = useState<Selection | null>(null);
 const alive = useRef(true), current = useRef(active), fallback = useRef<HTMLButtonElement>(null); current.current = active;
 const load = async () => { setLoading(true); setError(""); try { const result = await stardewWorkspace(path); if (alive.current) setWorkspace(result); } catch (e) { if (alive.current) setError(stardewError(e)); } finally { if (alive.current) setLoading(false); } };
 useEffect(() => { let mounted = true; alive.current = true; queueMicrotask(() => { if (mounted) void load(); }); return () => { mounted = false; alive.current = false; }; }, [path]); // keyed by the chosen game folder
 const select = (action: Selection["action"]) => setSelection({ action, trigger: document.activeElement as HTMLElement | null });
 const choose = async () => {
  if (picking || !active) return; setPicking(true); setError("");
  const trigger = document.activeElement as HTMLElement | null;
  try { const archive = await open({ multiple: false, title: text("import"), filters: [{ name: "ZIP", extensions: ["zip"] }] }); if (typeof archive === "string" && alive.current && current.current) setSelection({ action: { kind: "import", archive }, trigger }); }
  catch (e) { if (alive.current) setError(stardewError(e)); } finally { if (alive.current) setPicking(false); }
 };
 const reveal = async () => { try { await revealItemInDir(`${path}/.harbor-stardew/state.json`); } catch (e) { if (alive.current) setError(stardewError(e)); } };
 useEffect(() => { if (!active) setSelection(null); }, [active]);
 const disabled = blocked || loading || picking || !active || !workspace?.supported || workspace.pending;
 return <div className="games-stardew-manager">
  <div className="games-stardew-manager-heading"><div><h3>{text("manage")}</h3><p>{text("manageNote")}</p></div><button ref={fallback} className="games-button" disabled={disabled} onClick={() => void choose()}><Plus size={16}/>{text("import")}</button></div>
  {loading && <p className="games-stardew-working" role="status"><LoaderCircle size={18}/>{text("scanning")}</p>}
  {error && <div className="games-stardew-notice" role="alert"><span>{t(error)}</span><button className="games-detail-text-button" onClick={() => void load()}>{t("common.retry")}</button></div>}
  {workspace && !workspace.supported && <p className="games-stardew-note">{text("platformError")}</p>}
  {workspace?.pending && <div className="games-stardew-notice"><p>{text("recoveryNote")}</p><button className="games-button" disabled={!active || !workspace.supported} onClick={() => select({ kind: "recover" })}><RotateCcw size={16}/>{text("recover")}</button></div>}
  {workspace?.groups.map(group => <details key={group.id} className="games-stardew-mod games-stardew-managed"><summary><span className="games-stardew-package" aria-hidden="true" style={{ maskImage: `url("${packageIcon}")` }}/><span className="games-stardew-mod-name"><strong dir="auto">{group.title}</strong><small>{group.version}</small></span><span className="games-stardew-status">{t(group.enabled ? "games.mods.enabled" : "games.mods.disabled")}</span><ChevronDown size={16}/></summary><div className="games-stardew-mod-detail"><code dir="ltr">{group.folder}</code>{group.origin && <div className="games-stardew-origin"><button className="games-detail-text-button" onClick={() => void openUrl(group.origin!.url)}>GitHub · Annosz/UIInfoSuite2<ArrowUpRight size={14}/></button></div>}<div className="games-stardew-toolbar"><button className="games-button" disabled={disabled} onClick={() => select({ kind: "toggle", id: group.id })}>{text(group.enabled ? "disable" : "enable")}</button><button className="games-detail-text-button" disabled={disabled} onClick={() => select({ kind: "remove", id: group.id })}>{text("remove")}</button></div></div></details>)}
  {!!workspace?.backups.length && <details className="games-stardew-backups"><summary>{text("previous")}<ChevronDown size={15}/></summary>{workspace.backups.map(backup => <div className="games-stardew-backup" key={backup.token}><span><strong dir="auto">{backup.item.title}</strong><small>{backup.item.version} · {new Date(backup.createdAt * 1000).toLocaleString(language)}</small></span><button className="games-button" disabled={disabled} onClick={() => select({ kind: "restore", id: backup.token })}>{text("restore")}</button></div>)}</details>}
  {!!workspace?.kept.length && <details className="games-stardew-backups"><summary>{text("kept")}<ChevronDown size={15}/></summary><p className="games-stardew-note">{text("keptNote")}</p>{workspace.kept.map(name => <code className="games-stardew-path" dir="ltr" key={name}>{name}</code>)}<button className="games-detail-text-button" onClick={() => void reveal()}><FolderOpen size={16}/>{text("openFiles")}</button></details>}
  {selection && active && <GameStardewReview profile={profile} path={path} action={selection.action} trigger={selection.trigger} fallback={fallback.current} onClose={() => { const trigger = selection.trigger; setSelection(null); void load().finally(() => requestAnimationFrame(() => { if (alive.current && current.current) (trigger?.isConnected ? trigger : fallback.current)?.focus({ preventScroll: true }); })); }} changed={value => { setWorkspace(value); changed(); }}/>} 
 </div>;
}
