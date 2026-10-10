import { useEffect, useId, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Check, FolderOpen, PackageOpen } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { useT } from "@/lib/i18n";
import { transferBytes } from "@/lib/games/transfers";
import { preparationValues, type PreparationForm, type PreparationOption } from "@/lib/games/download-preparation";
import { setupPath } from "@/lib/games/setup";
import type { SetupLocations } from "@/lib/games/setup-locations";
import "./game-preparation.css";

export function GamePreparationOptions({ value, change, options, parent, disabled, alwaysEnabled = false, onBrowsing }: {
  value: PreparationForm; change: (value: PreparationForm) => void; options: PreparationOption[]; parent: string; disabled: boolean; alwaysEnabled?: boolean; onBrowsing?: (busy: boolean) => void;
}) {
  const t = useT(), id = useId(), live = useRef(true);
  const current = preparationValues(value, options, parent, name => t("games.preparation.folder", { name })), option = options.find(item => item.archive === current.archive);
  const [locations, setLocations] = useState<SetupLocations>(), [browsing, setBrowsing] = useState(false), [error, setError] = useState(false);
  const [supported, setSupported] = useState<boolean>();
  useEffect(() => {
    if (alwaysEnabled || !options.length) return;
    let active = true;
    void invoke<number>("games_preparation_version").then(version => { if (active) setSupported(version >= 1); }, () => { if (active) setSupported(false); });
    return () => { active = false; };
  }, [alwaysEnabled, options.length > 0]);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  useEffect(() => {
    if (!value.enabled || !options.length) return;
    let active = true, pending = false; setLocations(undefined);
    const inspect = async () => {
      if (pending) return; pending = true;
      try { const result = await invoke<SetupLocations>("games_download_locations", { parent: current.parent || null }); if (active) { setLocations(result); setError(false); } }
      catch { if (active) setError(true); }
      finally { pending = false; }
    };
    void inspect(); const interval = window.setInterval(() => void inspect(), 15000);
    return () => { active = false; clearInterval(interval); };
  }, [value.enabled, current.parent, options.length]);
  const browse = async () => {
    if (browsing || disabled) return;
    setBrowsing(true); onBrowsing?.(true);
    try { const { open } = await import("@tauri-apps/plugin-dialog"); const path = await open({ directory: true, multiple: false, defaultPath: current.parent || undefined }); if (live.current && typeof path === "string") change({ ...value, parent: path }); }
    catch { if (live.current) setError(true); }
    finally { if (live.current) { setBrowsing(false); onBrowsing?.(false); } }
  };
  const seen = new Set<string>(), folders = [parent, current.parent, locations?.selected?.path, ...(locations?.drives.map(drive => drive.path) ?? [])].filter((path): path is string => !!path).filter(path => { const key = setupPath(path); if (seen.has(key)) return false; seen.add(key); return true; });
  const available = locations?.selected?.availableBytes;
  if (!options.length) return null;
  return <section className="games-preparation-options">
    {!alwaysEnabled && <button type="button" className="games-preparation-toggle" role="checkbox" aria-checked={value.enabled} aria-controls={id} disabled={disabled || browsing || supported !== true} onClick={() => change({ ...value, enabled: !value.enabled })}><PackageOpen size={20}/><span><strong>{t("games.preparation.enable")}</strong><small>{t(supported === false ? "games.archive.unavailable" : "games.preparation.note")}</small></span><i aria-hidden>{value.enabled && <Check size={15}/>}</i></button>}
    {value.enabled && <div className="games-preparation-fields" id={id}>
      {options.length > 1 && <label><span>{t("games.archive.source")}</span><select aria-label={t("games.archive.source")} value={current.archive} disabled={disabled || browsing} onChange={event => change({ ...value, archive: event.target.value, name: undefined })}><option value="">{t("games.archive.chooseSource")}</option>{options.map(item => <option key={item.archive} value={item.archive}>{item.archive}</option>)}</select></label>}
      {current.archive && <p className="games-preparation-archive"><PackageOpen size={15}/><bdi>{current.archive}</bdi>{option && option.members.length > 0 && <span>{t("games.download.center.fileCount", { count: option.members.length + 1 })}</span>}</p>}
      {option && !option.complete && <p className="games-preparation-error" role="alert">{t("games.preparation.missingParts")}</p>}
      <label><span>{t("games.preparation.destination")}</span><div className="games-preparation-folder"><fieldset disabled={disabled || browsing}><Dropdown value={current.parent} ariaLabel={t("games.preparation.destination")} placeholder={t("games.archive.chooseParent")} options={folders.map(path => {
        const drive = locations?.drives.find(item => setupPath(item.path) === setupPath(path));
        const label = path.replace(/^\\\\\?\\/, "");
        return { value: path, label: drive?.availableBytes == null ? label : label + " · " + t("games.torrent.free", { size: transferBytes(drive.availableBytes) }) };
      })} onChange={path => change({ ...value, parent: path })}/></fieldset><button type="button" className="games-button" disabled={disabled || browsing} onClick={() => void browse()}><FolderOpen size={17}/>{t("games.torrent.browse")}</button></div></label>
      <label><span>{t("games.archive.folderName")}</span><input aria-label={t("games.archive.folderName")} value={current.name} maxLength={180} disabled={disabled || browsing} onChange={event => change({ ...value, name: event.target.value })}/></label>
      <p>{available != null ? `${t("games.torrent.free", { size: transferBytes(available) })} · ` : ""}{t("games.preparation.spaceNote")}</p>
      {error && <p role="status">{t("games.torrent.drivesUnavailable")}</p>}
    </div>}
  </section>;
}
