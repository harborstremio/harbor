import { useEffect, useId, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { downloadDir } from "@tauri-apps/api/path";
import { ArrowDown, Check, FolderOpen, HardDrive, X } from "lucide-react";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useSectionBack } from "@/lib/section-back";
import { useT } from "@/lib/i18n";
import { DOWNLOAD_HEADROOM, downloadDestination, downloadLocationKey, recentDownloadFolders } from "@/lib/games/download-locations";
import { setupParent, type SetupLocations, type SetupLocation } from "@/lib/games/setup-locations";
import { transferBytes, transferError, type GameTransfer } from "@/lib/games/transfers";
import { preparationError, preparationDraft, preparationFilename, preparationOptions, type PreparationForm } from "@/lib/games/download-preparation";
import { GamePreparationOptions } from "./game-preparation-options";
import type { DownloadDestinationPrompt } from "@/hooks/use-game-download-destination";
import "./game-download-destination.css";

type Choice = SetupLocation & { kind: "recent" | "downloads" | "drive" | "custom" };

export function GameDownloadDestination({ prompt, records }: { prompt: DownloadDestinationPrompt; records: GameTransfer[] }) {
  const t = useT(), title = useId(), root = useRef<HTMLDivElement>(null);
  const accepted = useRef(false), submitting = useRef(false);
  const { closing, close } = useModalExit(() => prompt.finish(accepted.current));
  const [choices, setChoices] = useState<Choice[]>([]), [path, setPath] = useState("");
  const [loading, setLoading] = useState(true), [unavailable, setUnavailable] = useState(false), [browsing, setBrowsing] = useState(false);
  const [preparation, setPreparation] = useState<PreparationForm>({ enabled: false }), [preparationBrowsing, setPreparationBrowsing] = useState(false);
  const [starting, setStarting] = useState(false), [error, setError] = useState("");
  const blocked = browsing || preparationBrowsing || starting || closing;
  useEffect(() => { if (error) root.current?.querySelector('[role="alert"]')?.scrollIntoView({ block: "nearest" }); }, [error]);
  const live = useRef(true), chosen = useRef(false);
  // Capture recent folders once: transfer progress events must not restart disk enumeration.
  const recent = useMemo(() => recentDownloadFolders(records, prompt.profile), [prompt]);
  useSectionBack(() => { if (!blocked) close(); }, true);
  useEffect(() => {
    live.current = true;
    const previous = document.activeElement as HTMLElement | null;
    root.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || (event.target as Element)?.closest?.('[data-dropdown-menu]') || [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].at(-1) !== root.current?.closest('[role="dialog"]')) return;
      const buttons = [...(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),summary,[tabindex="0"]') ?? [])].filter(item => item.getClientRects().length);
      const index = buttons.indexOf(document.activeElement as HTMLElement);
      if (buttons.length && (index < 0 || event.shiftKey && index === 0 || !event.shiftKey && index === buttons.length - 1)) {
        event.preventDefault(); (event.shiftKey ? buttons.at(-1) : buttons[0])?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      live.current = false; document.removeEventListener("keydown", trap);
      if (previous?.isConnected) {
        const target = previous.matches(":disabled") ? previous.closest('[role="dialog"]')?.querySelector<HTMLElement>('button:not(:disabled)') : previous;
        target?.focus({ preventScroll: true });
      }
    };
  }, []);
  useEffect(() => {
    let current = true;
    const inspect = (parent: string | null) => invoke<SetupLocations>("games_download_locations", { parent });
    void (async () => {
      const home = await downloadDir().catch(() => "");
      const responses = await Promise.allSettled([inspect(home || null), ...recent.map(inspect)]);
      if (!current) return;
      const main = responses[0].status === "fulfilled" ? responses[0].value : null;
      const folders: Choice[] = [];
      for (const response of responses.slice(1)) if (response.status === "fulfilled" && response.value.selected) folders.push({ ...response.value.selected, kind: "recent" });
      if (main?.selected) folders.push({ ...main.selected, kind: "downloads" });
      folders.push(...(main?.drives ?? []).map(drive => ({ ...drive, kind: "drive" as const })));
      const seen = new Set<string>(), unique = folders.filter(folder => { const key = downloadLocationKey(folder.path); if (seen.has(key)) return false; seen.add(key); return true; });
      setChoices(old => [...old.filter(item => item.kind === "custom" && !seen.has(downloadLocationKey(item.path))), ...unique]);
      if (!chosen.current && unique.length) setPath(downloadDestination(unique[0].path, prompt.filename));
      setUnavailable(responses.some(response => response.status === "rejected")); setLoading(false);
    })();
    return () => { current = false; };
  }, [prompt, recent]);
  const parent = prompt.filename ? setupParent(path) : path;
  const options = useMemo(() => preparationOptions((prompt.filename ? [preparationFilename(path || prompt.filename)] : prompt.filenames ?? []).map(path => ({ path, selected: true }))), [prompt, path]);
  const unpack = preparationDraft(preparation, options, parent, "direct", name => t("games.preparation.folder", { name }));
  const invalidPreparation = preparation.enabled && (!options.length || !unpack);
  useEffect(()=>{if(!options.length)setPreparation({enabled:false});},[options.length]);
  const choice = choices.find(item => downloadLocationKey(item.path) === downloadLocationKey(parent));
  const [space, setSpace] = useState<{ path: string; bytes: number | null } | null>(null);
  useEffect(() => {
    if (!parent) return;
    let current = true;
    const refresh = async () => {
      try { const value = await invoke<SetupLocations>("games_download_locations", { parent }); if (current) setSpace({ path: parent, bytes: value.selected?.availableBytes ?? null }); }
      catch { if (current) setSpace({ path: parent, bytes: null }); }
    };
    void refresh(); const timer = window.setInterval(() => void refresh(), 15000);
    return () => { current = false; window.clearInterval(timer); };
  }, [parent]);
  const available = space?.path === parent ? space.bytes : choice?.availableBytes;
  const insufficient = available != null && available < (prompt.expectedBytes ?? 0) + DOWNLOAD_HEADROOM;
  const browse = async () => {
    if (blocked) return;
    setBrowsing(true);
    try {
      const dialog = await import("@tauri-apps/plugin-dialog");
      const next = prompt.filename ? await dialog.save({ defaultPath: path || prompt.filename }) : await dialog.open({ directory: true, multiple: false, defaultPath: path || undefined });
      if (!live.current || !next || Array.isArray(next)) return;
      chosen.current = true; setPath(next);
      const directory = prompt.filename ? setupParent(next) : next;
      setChoices(old => old.some(item => downloadLocationKey(item.path) === downloadLocationKey(directory)) ? old : [{ path: directory, label: directory, availableBytes: null, kind: "custom" }, ...old.filter(item => item.kind !== "custom")]);
    } catch { if (live.current) setUnavailable(true); }
    finally { if (live.current) setBrowsing(false); }
  };
  const submit = async () => {
    if (submitting.current || blocked || !path || insufficient || invalidPreparation) return;
    submitting.current = true; setStarting(true); setError("");
    try { const result = await prompt.accept({ path, preparation: unpack }); if (live.current && result) { accepted.current = true; close(); } }
    catch (reason) { if (live.current) setError(String(reason).includes("archive_") ? preparationError(reason) : transferError(reason)); }
    finally { submitting.current = false; if (live.current) setStarting(false); }
  };
  return <ModalShell closing={closing} onDismiss={() => { if (!blocked) close(); }} labelledBy={title} width={540} backdropClassName="games-source-link-backdrop games-destination-backdrop">
    <div className="games-destination-dialog" ref={root}>
      <header><div><h2 id={title}>{t("games.sources.links.destination")}</h2><p>{prompt.filename || prompt.name}</p></div><button className="games-icon-button" aria-label={t("common.close")} disabled={blocked} onClick={close}><X size={19}/></button></header>
      <div className="games-destination-body"><div className="games-destination-choices" role="group" aria-label={t("games.download.destination")} aria-busy={loading}>
        {loading && <p role="status">{t("games.torrent.loadingDrives")}</p>}
        {choices.map(item => { const selected = downloadLocationKey(parent) === downloadLocationKey(item.path); return <button key={item.path} aria-pressed={selected} disabled={blocked} onClick={() => { chosen.current = true; setPath(downloadDestination(item.path, prompt.filename)); }}>
          {item.kind === "drive" ? <HardDrive size={22} aria-hidden/> : <FolderOpen size={22} aria-hidden/>}<span><strong>{item.kind === "recent" ? t("games.setup.recentLocation") : item.kind === "downloads" ? t("games.download.nav") : item.label}</strong><small dir="ltr">{item.path.replace(/^\\\\\?\\/, "")}</small></span>
          <span className="games-destination-space">{(selected ? available : item.availableBytes) != null && t("games.torrent.free", { size: transferBytes((selected ? available : item.availableBytes)!) })}</span><i aria-hidden>{selected && <Check size={15}/>}</i>
        </button>; })}
      </div><button className="games-button games-destination-browse" disabled={blocked} onClick={() => void browse()}><FolderOpen size={17}/>{t("games.torrent.browse")}</button>
      {unavailable && <p role="status">{t("games.torrent.drivesUnavailable")}</p>}
      <div className="games-destination-summary"><span>{prompt.expectedBytes == null ? t("games.sources.links.unknownSize") : t("games.torrent.required", { size: transferBytes(prompt.expectedBytes + DOWNLOAD_HEADROOM) })}</span>{path && <small dir="ltr">{path.replace(/^\\\\\?\\/, "")}</small>}</div>
      {insufficient && <p className="games-destination-warning" role="status">{t("games.torrent.notEnoughSpace")}</p>}
      <GamePreparationOptions value={preparation} change={setPreparation} options={options} parent={parent} disabled={blocked} onBrowsing={setPreparationBrowsing}/>
      {error && <p className="games-destination-warning" role="alert">{t(error)}</p>}</div>
      <footer><button className="games-button" disabled={blocked} onClick={close}>{t("common.cancel")}</button><button className="games-button games-button-primary" disabled={!path || insufficient || blocked || invalidPreparation} onClick={() => void submit()} aria-busy={starting}><ArrowDown size={17}/>{t(starting ? "games.torrent.starting" : prompt.filename ? "games.sources.download" : "games.torrent.start")}</button></footer>
    </div>
  </ModalShell>;
}
