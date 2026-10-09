import { GameSetupRom } from "./game-setup-rom";
import { useOptionalGameAccess } from "./game-access";
import { Play } from "@/components/icons/play-filled";
import { GameFileIcon } from "./game-file-icon";
import { GameShortcuts } from "./game-shortcuts";
import { GamePlayButton } from "./game-play-button";
import { GameExecutionPermission } from "./game-execution-permission";
import { useEffect, useId, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ArrowRight, Check, File, FolderOpen, Network, PackageOpen, RefreshCw, X } from "lucide-react";
import { LoaderCircle } from "@/components/icons/music-icons";
import { HarborMark } from "@/components/icons/harbor-mark";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useSectionBack } from "@/lib/section-back";
import { useT } from "@/lib/i18n";
import { osClass } from "@/lib/platform";
import { customLaunchError, emptyLaunchConfig, type LaunchConfig } from "@/lib/games/custom-library";
import { setupDetectedExecutable, setupError, setupInstalledExecutable, setupGameCandidates, setupInstallFolder, setupJobForSource, setupLibraryGame, setupPath, type SetupEntry, type SetupJob, type SetupPlan, type SetupSource } from "@/lib/games/setup";
import { registeredSetupGame, rememberSetupContext } from "@/lib/games/setup-context";
import { setupRunStage, setupVerificationFailed } from "@/lib/games/setup-progress";
import { transferBytes } from "@/lib/games/transfers";
import { recentSetupParent, setupParent } from "@/lib/games/setup-locations";
import { gameLogoSource } from "@/lib/games/logo-art";
import type { CustomGameLibrary } from "@/hooks/use-custom-game-library";
import type { GameArchives } from "@/hooks/use-game-archives";
import { sourceArchive } from "@/lib/games/archives";
import { groupSetupArchives } from "@/lib/games/archive-parts";
import { GameArchiveDialog } from "./game-archive";
import { GameHeroLogo } from "./game-hero-logo";
import { GameSetupDestination, SetupSkeleton, SetupReadySkeleton } from "./game-setup-destination";
import { DownloadSetupProgress, useInstallerClock } from "./game-download-setup";
import { DownloadSourceIdentity } from "./game-download-source";
import { GameSetupIcon, LinkGameMark } from "./game-setup-icon";
import "./game-setup.css";

export function GameSetupStatus({ job }: { job?: SetupJob }) {
  const t = useT(), now = useInstallerClock(job);
  if (!job) return null;
  const label = job.error === "setup_verification" || setupVerificationFailed(job) ? "verificationFailed" : job.error === "setup_verification_unknown" ? "verificationUnknown" : job.error === "setup_review" ? "finished" : job.status === "running" ? setupRunStage(job, now) : job.status;
  return <span className={`games-setup-status is-${job.status}`} role="status">{job.status === "running" && <LoaderCircle size={14} aria-hidden/>}{t(label === "finished" ? "games.setup.review" : `games.setup.state.${label}`)}</span>;
}

export function GameSetupDialog({ source, profile, library, jobs, acceptJob, registering = [], registrationErrors = {}, openLibrary, onClose, onTorrent, archives }: { source: SetupSource; profile: string; library: CustomGameLibrary; jobs: SetupJob[]; acceptJob: (job: SetupJob, source?: SetupSource) => void; registering?: string[]; registrationErrors?: Record<string, string>; openLibrary: () => void; onClose: () => void; onTorrent?: (path: string) => void; archives?: GameArchives }) {
  const access = useOptionalGameAccess();
  const t = useT(), titleId = useId(), root = useRef<HTMLDivElement>(null);
  const initialJob = setupJobForSource(jobs, source.source);
  const [location, setLocation] = useState(initialJob?.status !== "running" && initialJob?.destination || source.source), [name, setName] = useState(source.game?.name ?? source.name);
  const [plan, setPlan] = useState<SetupPlan | null>(null), [error, setError] = useState("");
  const [busy, setBusy] = useState<"scan" | "choose" | "start" | "save" | null>("scan"), [executable, setExecutable] = useState("");
  const [archive, setArchive] = useState<string | null>(null), [manuallySaved, setSaved] = useState(false), [destination, setDestination] = useState("");
  const [artFailed, setArtFailed] = useState(false);
  const sourceSteamId = Number(source.game?.id.match(/^steam:([1-9]\d*)$/)?.[1]);
  const steamId = Number.isSafeInteger(sourceSteamId) ? sourceSteamId : undefined;
  const [launching, setLaunching] = useState(false), [launchRequested, setLaunchRequested] = useState(false), launchPending = useRef(false);
  const generation = useRef(0), dismissed = useRef(false), pending = useRef(false), live = useRef(true);
  const nextTorrent = useRef<string | null>(null);
  const { closing, close } = useModalExit(() => { onClose(); if (nextTorrent.current) onTorrent?.(nextTorrent.current); });
  const job = setupJobForSource(jobs, source.source) ?? setupJobForSource(jobs, location), running = job?.status === "running";
  const recovering = !!job && !running;
  useEffect(() => { if (job?.status !== "running" && job?.destination) setLocation(current => setupPath(current) === setupPath(job.destination!) ? current : job.destination!); }, [job?.id, job?.status, job?.destination]);
  const installed = job?.destination && job.status === "finished" && job.exitCode === 0 && !job.error && !setupVerificationFailed(job) ? setupInstalledExecutable(job, name) : undefined;
  const registered = job ? registeredSetupGame(job, name, library.data.games) : undefined;
  const linked = registered || library.data.games.find(game => setupPath(game.config.executable) === setupPath(installed ?? (executable || "")));
  const gameRunning = !!linked && library.running.some(process => process.id === linked.id);
  const launchBusy = launching || !!linked && library.busy.includes(linked.id);
  const saved = !running && (!job?.error || job.error === "setup_review") && !(job && setupVerificationFailed(job)) && (manuallySaved || !!registered || !job && !!linked), adding = !!job && registering.includes(job.id);
  const installers = plan?.entries.filter(entry => entry.kind === "installer") ?? [];
  const managed = osClass() === "windows" && installers.length === 1 && installers[0].engine === "inno" ? installers[0] : undefined;
  const detected = installed ?? (plan ? setupDetectedExecutable(plan, name) : undefined);
  const candidatePaths = setupGameCandidates(plan?.entries.filter(entry => entry.kind === "game").map(entry => entry.path) ?? []);
  const entries = groupSetupArchives(recovering ? plan?.entries.filter(entry => candidatePaths.includes(entry.path)) ?? [] : plan?.entries ?? []);
  const romOnly = !!entries.length && entries.every(entry => entry.kind === "rom");
  const openRoms = () => { dismissed.current = true; close(); access?.navigate({ library: "retro" }); };
  const torrentOnly = !!plan && !plan.truncated && entries.length > 0 && entries.every(entry => entry.kind === "torrent");
  useEffect(() => { if (!executable && detected) setExecutable(detected); }, [detected, executable]);
  const verifying = job?.progress?.stage === "checking";
  const steps = verifying ? ["check", "install", "verify", "ready"] : ["check", "install", "ready"];
  const stage = saved || recovering && job.status === "finished" && job.exitCode === 0 && !job.error && !setupVerificationFailed(job) ? steps.length - 1 : verifying ? 2 : running || job || executable || managed ? 1 : 0;
  const step = saved ? "ready" : busy === "scan" ? "scan" : adding || busy === "save" ? "register" : running ? verifying ? "verify" : "install" : "choose";
  useEffect(() => {
    root.current?.querySelector<HTMLElement>(".games-setup-body")?.scrollTo({ top: 0 });
    if (saved || document.activeElement === document.body) root.current?.querySelector<HTMLElement>(".games-setup-panel")?.focus({ preventScroll: true });
  }, [step, saved]);
  const dismiss = () => { if (pending.current && busy === "save") return; dismissed.current = true; generation.current++; close(); };
  useSectionBack(() => { if (!archive) dismiss(); }, true);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    root.current?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
    live.current = true;
    const trap = (event: KeyboardEvent) => {
      const dialog = root.current;
      if (event.key !== "Tab" || !dialog || [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].at(-1) !== dialog.closest('[role="dialog"]')) return;
      const items = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),summary')].filter(item => item.getClientRects().length);
      if (event.shiftKey && (document.activeElement === items[0] || !dialog.contains(document.activeElement))) { event.preventDefault(); items.at(-1)?.focus(); }
      else if (!event.shiftKey && (document.activeElement === items.at(-1) || !dialog.contains(document.activeElement))) { event.preventDefault(); items[0]?.focus(); }
    };
    document.addEventListener("keydown", trap);
    return () => { live.current = false; generation.current++; document.removeEventListener("keydown", trap); previous?.focus({ preventScroll: true }); };
  }, []);
  const current = (revision: number) => live.current && !dismissed.current && revision === generation.current;
  const scan = async () => {
    const revision = ++generation.current; pending.current = true; setBusy("scan"); setError(""); setPlan(null);
    try {
      if (job && !running && (job.destination || setupPath(location) !== setupPath(source.source))) {
        try {
          const refreshed = await invoke<SetupJob>("games_recover_setup", { profile, id: job.id, destination: job.destination && setupPath(location) === setupPath(job.destination) ? null : location });
          if (current(revision)) acceptJob(refreshed, { ...source, source: job.source });
        } catch (reason) {
          // A dev frontend can update before its native binary. Keep explicit recovery usable.
          if (current(revision)) {
            acceptJob(job, { ...source, source: job.source });
            if (setupError(reason) !== "games.setup.unavailable") setError(setupError(reason) === "games.setup.setup_destination" ? "games.setup.recoverDestination" : setupError(reason));
          }
        }
      }
      if (!current(revision)) return;
      const result = await invoke<SetupPlan>("games_inspect_setup", { profile, source: location }); if (current(revision)) setPlan(result);
    }
    catch (reason) { if (current(revision)) setError(setupError(reason)); }
    finally { if (current(revision)) { pending.current = false; setBusy(null); } }
  };
  useEffect(() => { void scan(); }, [location, profile]);
  const reveal = async (path = location) => {
    try { const { revealItemInDir } = await import("@tauri-apps/plugin-opener"); if (!dismissed.current) await revealItemInDir(path); }
    catch (reason) { if (live.current && !dismissed.current) setError(setupError(reason)); }
  };
  const choose = async () => {
    if (pending.current) return;
    const revision = generation.current; pending.current = true; setBusy("choose"); setError("");
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      if (!current(revision)) return;
      const value = await open({ directory: false, multiple: false, title: t("games.setup.choose"), defaultPath: executable || job?.destination || location, filters: osClass() === "windows" ? [{ name: t("games.setup.selected"), extensions: ["exe"] }] : undefined });
      if (current(revision) && typeof value === "string") setExecutable(value);
    } catch (reason) { if (current(revision)) setError(customLaunchError(reason)); }
    finally { pending.current = false; if (current(revision)) setBusy(null); }
  };
  const chooseInstalledFolder = async () => {
    if (pending.current || running) return;
    const revision = generation.current; pending.current = true; setBusy("choose"); setError("");
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      if (!current(revision)) return;
      const value = await open({ directory: true, multiple: false, title: t("games.setup.locateFolder"), defaultPath: job?.destination || location });
      if (current(revision) && typeof value === "string") { setExecutable(""); if (value === location) { pending.current = false; await scan(); } else setLocation(value); }
    } catch (reason) { if (current(revision)) setError(setupError(reason)); }
    finally { pending.current = false; if (current(revision)) setBusy(null); }
  };
  const chooseDestination = async () => {
    if (pending.current || running) return "";
    const revision = generation.current; pending.current = true; setBusy("choose"); setError("");
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      if (!current(revision)) return "";
      const parent = await open({ directory: true, multiple: false, title: t("games.setup.chooseDestination"), defaultPath: setupParent(destination) || recentSetupParent(jobs, profile) || undefined });
      if (current(revision) && typeof parent === "string") {
        const path = setupInstallFolder(parent, name);
        if (!path) throw Error("setup_destination");
        setDestination(path); return path;
      }
    } catch (reason) { if (current(revision)) setError(setupError(reason)); }
    finally { pending.current = false; if (current(revision)) setBusy(null); }
    return "";
  };
  const run = async (entry: SetupEntry, target?: string) => {
    if (!plan || pending.current || running) return;
    const revision = generation.current; pending.current = true; setBusy("start"); setError("");
    try {
      const next = await invoke<SetupJob>("games_start_setup", { profile, token: plan.token, candidateId: entry.id, destination: target ?? null });
      acceptJob(next, { ...source, source: location });
    } catch (reason) { if (current(revision)) setError(setupError(reason)); }
    finally { pending.current = false; if (current(revision)) setBusy(null); }
  };
  const install = async () => { if (managed && destination && !dismissed.current) await run(managed, destination); };
  const add = async () => {
    if (!name.trim() || !executable || pending.current) return;
    const revision = generation.current; pending.current = true; setBusy("save"); setError(""); library.dismissError();
    try {
      const config = await invoke<LaunchConfig>("games_validate_custom_launch", { config: { ...emptyLaunchConfig(), executable } });
      if (!current(revision)) return;
      const game = setupLibraryGame(source, config.executable, name, library.data.games);
      if (await library.save(game) && current(revision)) {
        if (job) { rememberSetupContext(profile, job.id, { ...source, source: job.source }, config.executable); acceptJob(job); }
        else {
          const extraction = sourceArchive(source.originSource ?? source.source, profile, archives?.jobs ?? []);
          if (extraction?.status === "complete" && setupPath(extraction.destination) === setupPath(location)) {
            rememberSetupContext(profile, `archive:${extraction.id}`, { ...source, source: location }, config.executable);
          }
        }
        setSaved(true); requestAnimationFrame(() => root.current?.querySelector<HTMLElement>(".games-setup-success")?.focus());
      }
    } catch (reason) { if (current(revision)) setError(customLaunchError(reason)); }
    finally { pending.current = false; if (current(revision)) setBusy(null); }
  };
  const select = (entry: SetupEntry) => {
    if (entry.kind === "installer") void run(entry);
    else if (entry.kind === "archive") setArchive(entry.path);
    else if (entry.kind === "externalArchive") void reveal(entry.path);
    else if (entry.kind === "torrent") { if (onTorrent) { nextTorrent.current = entry.path; dismissed.current = true; generation.current++; close(); } }
    else setExecutable(entry.path);
  };
  const enterLibrary = () => { dismissed.current = true; close(); openLibrary(); };
  const play = async () => {
    if (!linked || launchPending.current || launchBusy || gameRunning || !library.available) return;
    launchPending.current = true; setLaunching(true); setLaunchRequested(true); library.dismissError();
    try { await library.launch(linked); }
    finally { launchPending.current = false; if (live.current && !dismissed.current) setLaunching(false); }
  };
  return <><ModalShell closing={closing} onDismiss={() => { if (!archive) dismiss(); }} width={720} labelledBy={titleId} backdropClassName="games-setup-backdrop"><div ref={root} className="games-setup-dialog">
    <header className={source.game?.artwork && !artFailed ? "has-art" : ""}>
      {source.game?.artwork && !artFailed && <img className="games-setup-art" src={source.game.artwork} alt="" onError={() => setArtFailed(true)}/>}
      <div className="games-setup-heading"><p>{t(recovering ? "games.setup.review" : "games.setup.title")}</p><div className="games-setup-identity">
        {(source.game?.logo || steamId) && <GameHeroLogo key={source.game?.id} sources={[source.game?.logo, steamId ? gameLogoSource(steamId) : undefined]} name={source.game?.name ?? source.name} steamId={steamId} platformIds={[]} ready active className="games-setup-logo"/>}<h2 id={titleId}>{source.game?.name ?? source.name}</h2></div>
        <DownloadSourceIdentity name={source.game?.sourceName} release={source.game?.name && source.game.name !== source.name ? source.name : undefined}/>
      </div><button className="games-icon-button" aria-label={t("common.close")} onClick={dismiss} disabled={busy === "save"}><X size={22}/></button>
    </header>
    {!romOnly && <ol className="games-setup-stages" aria-label={t("games.setup.title")}>{steps.map((step, index) => <li key={step} className={index < stage || saved ? "is-done" : index === stage ? "is-current" : ""} aria-current={index === stage ? "step" : undefined}><i>{index < stage || saved ? <Check size={14}/> : index === stage && (busy === "scan" || running || adding) ? <LoaderCircle size={14}/> : index + 1}</i><span>{t(`games.setup.phase.${step}`)}</span></li>)}</ol>}
    <div className="games-setup-body"><div key={step} className="games-setup-panel" data-step={step} tabIndex={-1}>{saved ? <div className="games-setup-success" tabIndex={-1}><Check size={36}/><h3>{t("games.setup.added")}</h3><p>{t("games.setup.addedNote")}</p><span>{name}</span>{linked && <span className="games-setup-saved-path" dir="ltr">{linked.config.executable.replace(/^\\\\\?\\/, "")}</span>}{linked && <GameShortcuts key={linked.id} game={linked}/>}</div> : busy === "scan" ? <SetupSkeleton label={t(recovering ? "games.setup.scanInstalled" : "games.setup.scanning")}/> : busy === "save" || adding ? <SetupReadySkeleton/> : <>
      {job ? <div className="games-setup-job" key={job.id}>
        {running || adding ? <DownloadSetupProgress setup={{ job, phase: adding ? "registering" : verifying ? "checking" : "installing" }}/> : <><GameSetupStatus job={job}/>{job.error === "setup_verification_unknown" && <p className="games-setup-error" role="alert">{t("games.setup.setup_verification_unknown")}</p>}{(job.error === "setup_verification" || setupVerificationFailed(job)) && <p className="games-setup-error" role="alert">{t("games.setup.setup_verification")}</p>}</>}
        {job.exitCode !== null && job.exitCode !== 0 && <small>{t("games.setup.exitCode", { code: job.exitCode })}</small>}
        {!running && !adding && <div className="games-setup-recovery">
          <p>{t(job.error === "setup_review" ? "games.setup.setup_review" : "games.setup.recoveryNote")}</p>
          {(job.destination || setupPath(location) !== setupPath(source.source)) && <div className="games-setup-selected-location"><FolderOpen size={19}/><span><small>{t("games.setup.installedFolder")}</small><b dir="ltr">{location.replace(/^\\\\\?\\/, "")}</b></span></div>}
          <div className="games-setup-file-tools"><button className="games-button" disabled={!!busy} onClick={() => void scan()}><RefreshCw size={17}/>{t("games.setup.viewInstalled")}</button><button className="games-button" disabled={!!busy} onClick={() => void chooseInstalledFolder()}><FolderOpen size={17}/>{t("games.setup.locateFolder")}</button>{job.destination && <button className="games-button" onClick={() => void reveal(location)}>{t("games.setup.openFolder")}<ArrowRight size={17}/></button>}</div>
        </div>}
      </div> : <p className="games-setup-intro">{t(romOnly ? "games.emulation.library" : torrentOnly ? "games.setup.torrentNote" : managed ? "games.setup.managedNote" : detected ? "games.setup.detected" : "games.setup.intro")}</p>}
      {managed && !job && <GameSetupDestination name={name} source={location} recent={recentSetupParent(jobs, profile)} destination={destination} disabled={!!busy} select={path => { setDestination(path); setError(""); }} browse={() => void chooseDestination()}/>}
      <details className="games-setup-disclosure" open={(recovering || !managed) && !running && !adding}>
        <summary>{t(recovering ? "games.setup.installedFiles" : "games.setup.files")}</summary>
        <div className="games-setup-files">{plan && <>{!entries.length && <p>{t("games.setup.none")}</p>}{entries.map(entry => entry.kind === "rom" ? <GameSetupRom key={entry.id} entry={entry} profile={profile} disabled={!!busy || running || adding} openLibrary={openRoms}/> : <div className={`games-setup-file${entry.kind === "game" ? " is-game" : ""}${entry.kind === "game" && setupPath(executable) === setupPath(entry.path) ? " is-selected" : ""}`} key={entry.id}>{entry.kind === "game" ? <GameSetupIcon profile={profile} token={plan.token} candidateId={entry.id}/> : entry.kind === "torrent" ? <HarborMark className="games-setup-torrent-mark"/> : <GameFileIcon name={entry.relativePath}/>}<div><strong title={entry.path}>{entry.archiveParts > 1 ? entry.relativePath.replace(/[^\\/]+$/, entry.archiveName ?? "") : entry.relativePath}</strong><span>{entry.archiveParts > 1 && <>{t("games.archive.partsCount", { count: entry.archiveParts })} · </>}{/\.app$/i.test(entry.path) ? "macOS" : transferBytes(entry.bytes)}</span></div><button className={`games-button${entry.kind === "game" ? " games-setup-select" : ""}`} aria-pressed={entry.kind === "game" ? setupPath(executable) === setupPath(entry.path) : undefined} disabled={!!busy || running || adding || entry.kind === "torrent" && !onTorrent} onClick={() => select(entry)}>{entry.kind === "torrent" ? <Network size={16}/> : entry.kind === "installer" ? <Play size={16}/> : entry.kind === "game" ? <LinkGameMark selected={setupPath(executable) === setupPath(entry.path)}/> : <PackageOpen size={16}/>}<span>{t(entry.kind === "torrent" ? "games.torrent.review" : entry.kind === "installer" ? /\.(dmg|pkg|deb|rpm)$/i.test(entry.path) ? "games.setup.openNative" : "games.setup.run" : entry.kind === "archive" ? "games.setup.extract" : entry.kind === "game" ? setupPath(executable) === setupPath(entry.path) ? "games.setup.gameSelected" : "games.setup.selectGame" : "games.setup.externalArchive")}</span></button></div>)}{plan.truncated && <p>{t("games.setup.limited")}</p>}</>}</div>
      {entries.filter(entry => /\.iso$/i.test(entry.path)).map(entry => <GameSetupRom key={`rom:${entry.id}`} entry={entry} profile={profile} disabled={!!busy || running || adding} openLibrary={openRoms}/>)}
      {!recovering && <div className="games-setup-file-tools"><button className="games-button" onClick={() => void reveal()}><FolderOpen size={18}/>{t("games.setup.openFolder")}</button><button className="games-button" disabled={!!busy} onClick={() => void scan()}><RefreshCw size={17}/>{t("games.setup.refresh")}</button></div>}
      </details>
      {(error || job?.error && job.error !== "setup_review" || job && registrationErrors[job.id] || library.error) && <p className="games-setup-error" role="alert">{t(error || (job?.error && job.error !== "setup_review" ? setupError(job.error) : "") || job && registrationErrors[job.id] || library.error)}</p>}
      {(error || library.error) === "games.custom.launch_permission" && <GameExecutionPermission path={executable} disabled={!!busy || adding || running} onFixed={() => { setError(""); library.dismissError(); }}/>}
      {!romOnly && <details className="games-setup-disclosure games-setup-manual" open={!managed && !running && !adding && !torrentOnly || !!executable}><summary>{t("games.setup.manual")}</summary>
        <section className="games-setup-link"><label>{t("games.setup.name")}<input data-setup-name value={name} maxLength={160} disabled={!!busy || running || adding} onChange={event => setName(event.target.value)}/></label><label>{t("games.setup.selected")}<button className="games-setup-path" disabled={!!busy || running || adding} onClick={() => void choose()}><File size={19}/><span>{executable ? executable.replace(/^\\\\\?\\/, "") : t("games.setup.choose")}</span><FolderOpen size={18}/></button></label>{detected && <p className="games-setup-detected"><Check size={16}/>{t("games.setup.detected")}</p>}</section>
      </details>}
    </>}{saved && launchRequested && library.error && <p className="games-setup-error" role="alert">{t(library.error)}</p>}</div></div>
    <footer>{saved ? <><button className="games-button" onClick={enterLibrary}>{t("games.setup.library")}<ArrowRight size={18}/></button>{linked && <GamePlayButton iconSize={20} className="games-setup-play" phase={gameRunning ? "running" : launchBusy ? "launching" : "ready"} unavailable={!library.available} onClick={() => void play()} label={t(gameRunning ? "games.setup.running" : launchBusy ? "games.setup.launching" : "games.library.play")}/>}</> : busy === "scan" ? <span className="games-setup-status" role="status"><LoaderCircle size={18} className="games-setup-spinner"/>{t("games.setup.phase.check")}</span> : running || torrentOnly || romOnly ? <button className="games-button" onClick={dismiss}>{t("common.close")}</button> : managed && !job && !executable ? <button className="games-button games-button-primary" disabled={!!busy || !name.trim() || !destination} onClick={() => void install()}>{busy ? <LoaderCircle size={18} className="games-setup-spinner"/> : <PackageOpen size={19}/>} {t("games.setup.install")}</button> : <button className="games-button games-button-primary" disabled={!!busy || adding || !name.trim() || !executable} onClick={() => void add()}>{busy === "save" || adding ? <LoaderCircle size={18} className="games-setup-spinner"/> : <LinkGameMark size={20}/>} {t(adding ? "games.setup.registering" : "games.setup.add")}</button>}</footer>
  </div></ModalShell>{archive && <GameArchiveDialog profile={profile} source={archive} originSource={source.originSource ?? source.source} game={source.game} archives={archives} onClose={() => { setArchive(null); if (sourceArchive(source.originSource ?? source.source, profile, archives?.jobs ?? [])?.status === "running") dismiss(); }} openLibrary={openLibrary} onPrepared={receipt => { setArchive(null); setLocation(receipt.destination); setExecutable(""); }}/>}</>;
}
