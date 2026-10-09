import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, Check, ChevronDown, Download, LoaderCircle } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { Dropdown } from "@/components/dropdown";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { simsCancel, simsError, simsMtsDetail, type SimsMtsDetail, type SimsMtsProject, type SimsProgress, type SimsWorkspace } from "@/lib/games/sims";
import { SimsMtsArt } from "./game-sims-mts-art";
import { ModsSimsProject } from "./mods-sims-project";
import { GameSimsMtsBrowse } from "./game-sims-mts-browse";
import { useSectionBack } from "@/lib/section-back";
import { SimsPackRequirements } from "./game-sims-packs";
import { GameSimsCreatorContent } from "./game-sims-creator-content";
import type { SimsSelection } from "./game-sims-review";

type ParentProject = { detail: SimsMtsDetail; page: string; version: string; target: string; item: number; scroll: { node: HTMLElement; top: number }[] };
export type SimsCreatorRequest = { id: string; page: string; trigger: HTMLElement; project?: SimsMtsProject };

export function GameSimsMts({ game = 4, profile, active, data, disabled, choose, request, workspace = false, setup, query = "", toolbarTarget }: { game?: 2 | 3 | 4; query?: string; workspace?: boolean; toolbarTarget?: HTMLElement | null; setup?: () => void; profile: string; active: boolean; data: SimsWorkspace | null; disabled: boolean; choose: (selection: SimsSelection) => void; request?: SimsCreatorRequest | null }) {
  const t = useT(), label = (key: string) => t(`games.sims.${key}`);
  const [opened, setOpened] = useState(workspace), [detailView, setDetailView] = useState(false), [waiting, setWaiting] = useState(false);
  const selectedCard = useRef<HTMLElement | null>(null), focusCard = useRef(false), section = useRef<HTMLDetailsElement>(null);
  const savedScroll = useRef<{ node: HTMLElement; top: number }[]>([]);
  const [preview, setPreview] = useState<SimsMtsProject | null>(null);
  const [page, setPage] = useState(""), [detail, setDetail] = useState<SimsMtsDetail | null>(null), [error, setError] = useState("");
  const [busy, setBusy] = useState(false), [canceling, setCanceling] = useState(false), [version, setVersion] = useState(""), [target, setTarget] = useState("new");
  const [trail, setTrail] = useState<ParentProject[]>([]), [focusItem, setFocusItem] = useState<number>();
  const restoreParent = useRef<ParentProject | null>(null);
  const lastRequest = useRef(""); const [showContent, setShowContent] = useState(false);
  const alive = useRef(true), task = useRef<{ id: string; canceled: boolean } | null>(null);
  const loadButton = useRef<HTMLButtonElement>(null), cancelButton = useRef<HTMLButtonElement>(null);
  const focusCancel = useRef(false), returnFocus = useRef(false);
  const cancel = useCallback(() => { const own = task.current; if (own) { own.canceled = true; void simsCancel(profile, own.id).catch(() => {}); } }, [profile]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; cancel(); }; }, [cancel]);
  useEffect(() => { if (!active) cancel(); }, [active, cancel]);
  useEffect(() => { if (busy && focusCancel.current) { focusCancel.current = false; cancelButton.current?.focus({ preventScroll: true }); } else if (!busy && returnFocus.current) { returnFocus.current = false; loadButton.current?.focus({ preventScroll: true }); } }, [busy]);
  const back = () => {
    cancel(); setError("");
    const parent = trail.at(-1);
    if (parent) { setTrail(values => values.slice(0, -1)); setDetail(parent.detail); setPage(parent.page); setVersion(parent.version); setTarget(parent.target); setFocusItem(parent.item); restoreParent.current = parent; }
    else { setDetailView(false); setDetail(null); setFocusItem(undefined); focusCard.current = true; }
  };
  useSectionBack(back, active && opened && detailView);
  useLayoutEffect(() => { if (detailView && selectedCard.current) section.current?.scrollIntoView({ block: "start" }); else if (!detailView && !busy && focusCard.current) { focusCard.current = false; for (const { node, top } of savedScroll.current) node.scrollTop = top; selectedCard.current?.focus({ preventScroll: true }); } }, [detailView, busy]);
  useLayoutEffect(() => { if (!busy && restoreParent.current) { for (const { node, top } of restoreParent.current.scroll) if (node.isConnected) node.scrollTop = top; restoreParent.current = null; } }, [detail, busy]);
  const load = async (url = page, group = "new", trigger: HTMLElement | null = null, dependency = false, creatorList = false, project?: SimsMtsProject) => {
    if (task.current || !active) return;
    const own = { id: crypto.randomUUID(), canceled: false }; task.current = own;
    focusCancel.current = document.activeElement === loadButton.current;
    if (!dependency) {
      setTrail([]); selectedCard.current = trigger; savedScroll.current = [];
      for (let node = trigger?.parentElement; node; node = node.parentElement) if (node.scrollHeight > node.clientHeight) savedScroll.current.push({ node, top: node.scrollTop });
    }
    setPreview(project ?? null);
    setFocusItem(undefined);
    setShowContent(creatorList);
    setDetailView(true); setWaiting(false); setPage(url); setBusy(true); setCanceling(false); setError(""); setDetail(null); setVersion(""); setTarget(group);
    let stop: (() => void) | undefined;
    try {
      stop = await listen<SimsProgress>("games:sims-progress", ({ payload }) => {
        if (payload.profile !== profile || payload.operationId !== own.id) return;
        if (payload.canCancel && (own.canceled || !alive.current)) void simsCancel(profile, own.id).catch(() => {});
        else if (alive.current) setWaiting(payload.phase === "waiting");
      });
      if (own.canceled || !alive.current) return;
      const value = await simsMtsDetail(profile, url, own.id);
      if (alive.current && !own.canceled) { setDetail(value); setVersion(value.files.find(file => file.supported)?.version ?? value.files[0]?.version ?? ""); }
    } catch (reason) { if (alive.current && !own.canceled) setError(simsError(reason)); }
    finally { stop?.(); if (task.current === own) task.current = null; if (alive.current) { returnFocus.current = document.activeElement === cancelButton.current; setBusy(false); } }
  };
  useEffect(() => {
    if (!request || !active || busy || lastRequest.current === request.id) return;
    lastRequest.current = request.id;
    if (section.current) section.current.open = true;
    void load(request.page, "new", request.trigger, false, true, request.project);
  }, [request, active, busy]);
  const selectDependency = (url: string, trigger: HTMLElement) => {
    if (!detail || busy || trail.length >= 16) return;
    const scroll: ParentProject["scroll"] = []; for (let node = trigger.parentElement; node; node = node.parentElement) if (node.scrollHeight > node.clientHeight) scroll.push({ node, top: node.scrollTop });
    setTrail(values => [...values, { detail, page, version, target, item: Number(trigger.dataset.simsCreatorItem), scroll }]);
    void load(url, "new", trigger, true);
  };
  const managed = data?.state.groups.filter(group => group.source?.provider === "mts") ?? [];
  const targets = managed.filter(group => group.source?.project === detail?.project);
  const selected = detail?.files.find(file => file.version === version);
  const creation = data?.tray?.items.find(item => item.source?.provider === "mts" && item.source.project === detail?.project && item.source.version === version);
  const installed = targets.some(group => group.source?.version === version) || !!creation?.installed;
  const validTarget = target === "new" || targets.some(group => group.id === target);
  const managedGame = (detail?.game ?? game) === 4;
  const download = () => {
    if (!managedGame || !detail || !selected?.supported || disabled || installed || !data || !validTarget) return;
    if (creation && !creation.installed) { choose({ action: { kind: "trayRestore", id: creation.id }, title: creation.title, sources: [] }); return; }
    choose({ action: target === "new" ? { kind: "install", title: detail.title } : { kind: "update", id: target }, title: `${detail.title} · ${selected.name}`, sources: [], creator: { provider: "mts", project: detail.project, version: selected.version, gamePatch: "", target: target === "new" ? undefined : target } });
  };
  return <details ref={section} open={workspace ? true : undefined} className={`games-sims-guidance games-sims-mts${workspace ? " is-workspace" : ""}`} onToggle={event => { setOpened(event.currentTarget.open); if (!event.currentTarget.open) cancel(); }}>
    <summary>Mod The Sims<ChevronDown size={16}/></summary>
    <p>{label("mtsDiscoveryIntro")}</p>
    <div hidden={detailView}><GameSimsMtsBrowse game={game} query={query} autoLoad={workspace} toolbarTarget={toolbarTarget} profile={profile} active={active && opened && !detailView && !busy} select={(project, trigger) => void load(project.page, "new", trigger, false, false, project)}/></div>
    {detailView && !workspace && <button className="games-detail-text-button games-sims-mts-back" onClick={back}><ArrowLeft size={16}/>{trail.length ? t("games.sims.creatorCcBack", { name: trail.at(-1)!.detail.title }) : label("mtsBack")}</button>}
    <details hidden={workspace && detailView} className="games-sims-mts-paste"><summary>{label("mtsPaste")}</summary>
    <form className="games-sims-mts-form" onSubmit={event => { event.preventDefault(); void load(); }}>
      <label><span>{label("mtsPage")}</span><input type="url" value={page} disabled={busy} maxLength={1024} placeholder="https://modthesims.info/d/…" autoCapitalize="off" spellCheck={false} dir="ltr" onChange={event => { setPage(event.target.value); setDetail(null); setError(""); }}/></label>
      <button ref={loadButton} type="submit" className="games-button" disabled={busy || !active || !page.trim()}>{label("mtsLoad")}</button>
      <button type="button" className="games-detail-text-button" onClick={() => void openUrl(`https://modthesims.info/downloads/ts${game}/`)}>{label("mtsBrowse")}<ArrowUpRight size={14}/></button>
    </form>
    </details>
    {!workspace && managed.length > 0 && <details className="games-sims-mts-managed"><summary>{label("creatorExisting")}<ChevronDown size={14}/></summary><div>{managed.map(group => <button key={group.id} className="games-detail-text-button" disabled={busy} onClick={() => void load(`https://modthesims.info/d/${group.source!.project}/`, group.id)} dir="auto">{group.title}</button>)}</div></details>}
    {workspace && detailView ? <ModsSimsProject game={game} detail={detail} preview={preview} page={page} busy={busy} waiting={waiting} error={error} canceling={canceling} cancelButton={cancelButton} cancel={() => { if (!canceling) { cancel(); setCanceling(true); } }} retry={() => void load(page, target, selectedCard.current, trail.length > 0, showContent, preview ?? undefined)} version={version} setVersion={setVersion} targets={targets} target={validTarget ? target : "new"} setTarget={setTarget} installed={installed} restoration={!!creation} connected={!!data} disabled={!active || disabled || !validTarget || !!data?.folder.partial} setup={setup} download={download} selectDependency={trail.length < 16 ? selectDependency : undefined} focusItem={focusItem} showContent={showContent}/> : <>
    {busy && <div className="games-sims-duplicates-progress"><p role="status"><LoaderCircle size={18}/>{waiting ? label("mtsWaiting") : t("common.loading")}</p><button ref={cancelButton} className="games-button" aria-disabled={canceling} onClick={() => { if (!canceling) { cancel(); setCanceling(true); } }}>{t("common.cancel")}</button></div>}
    {error && <p role="alert">{t(error)}</p>}
    {detail && <div className="games-sims-mts-detail"><SimsMtsArt key={detail.image} src={detail.image}/><div className="games-sims-mts-content"><small dir="auto">{detail.creator}</small><h3 dir="auto">{detail.title}</h3><p dir="auto">{detail.description}</p>{managedGame ? <SimsPackRequirements values={detail.packs}/> : detail.packs.length > 0 && <p>{detail.packs.join(" · ")}</p>}<button className="games-detail-text-button" onClick={() => void openUrl(detail.page)}>{label("lotGuide")}<ArrowUpRight size={14}/></button>
      {managedGame ? <div className="games-sims-mts-choices"><div><small>{label("mtsFile")}</small><Dropdown ariaLabel={label("mtsFile")} value={version} options={detail.files.map(file => ({ value: file.version, label: file.name }))} onChange={setVersion}/></div>{targets.length > 0 && <div><small>{label("creatorExisting")}</small><Dropdown ariaLabel={label("creatorExisting")} value={validTarget ? target : "new"} options={[{ value: "new", label: label("lotNew") }, ...targets.map(group => ({ value: group.id, label: group.title }))]} onChange={setTarget}/></div>}</div> : <div className="mods-source-files"><small>{t("games.modHub.files")}</small><ul>{detail.files.map(file => <li key={file.version} dir="auto">{file.name}</li>)}</ul></div>}
      {managedGame ? <>{!selected?.supported && <p>{label("mtsZip")}</p>}<p>{label("lotCompatibility")}</p><button className="games-button games-button-primary" disabled={!active || busy || (data ? disabled || !selected?.supported || installed || !validTarget || data.folder.partial : !setup)} onClick={data ? download : setup}>{installed ? <Check size={16}/> : <Download size={16}/>}{label(!data && setup ? "choose" : installed ? "creatorInstalled" : creation ? "trayRestore" : "creatorReview")}</button>{!data && <p>{label("creatorChoose")}</p>}</> : <><button className="games-button games-button-primary" onClick={() => void openUrl(`${detail.page}#files`)}><ArrowUpRight size={16}/>{t("games.modHub.creatorDownload")}</button><p>{t("games.modHub.legacyNote")}</p></>}
    </div>{workspace && detail.body && <section className="mods-project-description" dir="auto"><h4>{t("games.minecraft.catalog.about")}</h4>{detail.body.split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</section>}<GameSimsCreatorContent key={detail.project} content={detail.content} select={trail.length < 16 ? selectDependency : undefined} disabled={busy} focusItem={focusItem} expanded={showContent}/></div>}
    </>}
  </details>;
}
