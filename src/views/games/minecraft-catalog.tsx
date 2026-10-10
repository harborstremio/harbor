import { GameScreenshotViewer } from "./game-screenshot-viewer";
import { BackToTop } from "@/components/back-to-top";
import { ModBackToTop } from "./mod-back-to-top";
import { MinecraftCatalogCard, MinecraftCatalogSkeleton } from "./minecraft-catalog-card";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Box, ChevronLeft, ChevronRight, Download, RefreshCw, Search, X } from "lucide-react";
import { isTauri } from "@tauri-apps/api/core";
import { Dropdown } from "@/components/dropdown";
import { useT } from "@/lib/i18n";
import { useSectionBack } from "@/lib/section-back";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { MINECRAFT_CONTENT, minecraftCatalogRequest, minecraftCategories, minecraftProject, minecraftProjects, minecraftProjectUrl, minecraftVersions, minecraftPreferredVersion, minecraftReviewableVersion, type MinecraftContent, type MinecraftProject, type MinecraftProjectDetail, type MinecraftVersion } from "@/lib/games/minecraft-catalog";
import { parseModGames } from "@/lib/games/mods";
import { ModStats } from "./mod-stats";
import { ModGameMark, ModProviderLogo, ModProjectIcon } from "./mod-identity";
import { ModViewToggle, useModCatalogView } from "./mod-view-toggle";
import { GameArt } from "./game-art";
import { MinecraftProjectLink as ProjectLink } from "./minecraft-project-link";
import { MinecraftProjectVersions, MinecraftVersionIdentity } from "./minecraft-project-versions";
import { MinecraftProjectProse } from "./minecraft-project-prose";
import { MinecraftReleaseNotesView } from "./minecraft-release-notes";
import type { MinecraftPackRequest } from "@/lib/games/minecraft-instances";
import { MinecraftContentIcon } from "./minecraft-content-icon";
import { MinecraftCurseForge } from "./minecraft-curseforge";
import "./minecraft-catalog.css";


const label = (value: string) => value === "neoforge" ? "NeoForge" : value.replaceAll("-", " ").replace(/\b\w/g, c => c.toUpperCase());
const catalogError = (reason: unknown) => String(reason).includes("mods_rate_limit") ? "games.minecraft.account.rateLimit" : "games.minecraft.catalog.network";

export function MinecraftCatalog({ active, query, manage, installPack, requested, consumed, pageDetails = false, contentType, browseRevision }: { browseRevision?: number; contentType?: MinecraftContent; pageDetails?: boolean; active: boolean; query: string; manage: (project: MinecraftProject) => void; installPack?: (pack: MinecraftPackRequest) => void; requested?: MinecraftProject | null; consumed?: () => void }) {
  const t = useT(), [type, setType] = useState<MinecraftContent>(contentType ?? "modpack"), [term, setTerm] = useState(query), [game, setGame] = useState(""), [loader, setLoader] = useState(""), [category, setCategory] = useState(""), [sort, setSort] = useState("downloads"), [page, setPage] = useState(0);
  const [categories, setCategories] = useState<ReturnType<typeof minecraftCategories>>([]), [games, setGames] = useState<string[]>([]), [result, setResult] = useState<ReturnType<typeof minecraftProjects> | null>(null);
  const [loading, setLoading] = useState(false), [error, setError] = useState(""), [metaError, setMetaError] = useState(false), [retry, setRetry] = useState(0), [selected, setSelected] = useState<MinecraftProject | null>(null);
  const [view, setView] = useModCatalogView("minecraft", "grid");
  const [curseForge, setCurseForge] = useState(false);
  const modrinthButton = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLElement>(null), trigger = useRef<HTMLElement | null>(null);
  const savedScroll = useRef<{ node: HTMLElement; top: number }[]>([]);
  const rememberScroll = (origin: HTMLElement | null) => { savedScroll.current = []; for (let node = origin?.parentElement; node; node = node.parentElement) if (node.scrollHeight > node.clientHeight) savedScroll.current.push({ node, top: node.scrollTop }); };
  const [fromSpotlight, setFromSpotlight] = useState(false);
  useEffect(() => {
    if (!active || !requested) return;
    trigger.current = document.activeElement as HTMLElement;
    rememberScroll(trigger.current);
    setCurseForge(false); setFromSpotlight(true); setSelected(requested); consumed?.();
  }, [active, requested]);
  useEffect(() => { setTerm(query); setPage(0); }, [query]);
  useEffect(() => { if (!active) setSelected(null); }, [active]);
  useEffect(() => {
    if (!active || curseForge) return; const controller = new AbortController(); setMetaError(false);
    void Promise.allSettled([
      minecraftCatalogRequest({ kind: "categories" }, controller.signal).then(minecraftCategories).then(setCategories),
      minecraftCatalogRequest({ kind: "games" }, controller.signal).then(parseModGames).then(setGames),
    ]).then(values => { if (!controller.signal.aborted) setMetaError(values.some(v => v.status === "rejected")); });
    return () => controller.abort();
  }, [active, retry, curseForge]);
  useEffect(() => {
    if (!active || curseForge) return; const controller = new AbortController(); setLoading(true); setError("");
    const timer = setTimeout(() => { void minecraftCatalogRequest({ kind: "search", type, query: term.trim(), loader, game, category, offset: page * 24, sort }, controller.signal, retry > 0).then(minecraftProjects).then(value => { setResult(value); setLoading(false); }).catch(reason => { if (!controller.signal.aborted) { setError(catalogError(reason)); setLoading(false); } }); }, term ? 250 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [active, type, term, loader, game, category, page, sort, retry, curseForge]);
  useEffect(()=>{if(contentType){setType(contentType);setLoader("");setCategory("");setPage(0);setResult(null);setSelected(null);}},[contentType]);
  useEffect(()=>{setSelected(null);},[browseRevision]);
  const change = (action: () => void) => { action(); setPage(0); setResult(null); };
  const move = (next: number) => { setPage(next); root.current?.scrollIntoView({ block: "start", behavior: "instant" }); };
  const close = () => { setSelected(null); requestAnimationFrame(() => { if (pageDetails) for (const { node, top } of savedScroll.current) if (node.isConnected) node.scrollTop = top; trigger.current?.focus({ preventScroll: true }); }); };

  const loaders = type === "shader" ? ["iris", "optifine", "canvas"] : type === "resourcepack" ? [] : ["fabric", "forge", "neoforge", "quilt"];
  return <section className="mc-catalog games-inset" ref={root}>
    <div hidden={pageDetails && !!selected}>
    <div className="mc-catalog-heading">
      <div className="mc-catalog-sources" role="group" aria-label={t("games.sources.manage")}>
        <button ref={modrinthButton} type="button" aria-pressed={!curseForge} onClick={() => setCurseForge(false)}><ModProviderLogo source="Modrinth"/></button>
        <button type="button" aria-pressed={curseForge} onClick={() => setCurseForge(true)}><ModProviderLogo source="CurseForge"/></button>
      </div>
      <label hidden={pageDetails} className="mc-catalog-search"><Search size={18} /><input aria-label={t("games.minecraft.catalog.search")} placeholder={t("games.minecraft.catalog.search")} value={term} maxLength={200} onChange={e => change(() => setTerm(e.target.value))} />{term && <button aria-label={t("games.clear")} onClick={() => change(() => setTerm(""))}><X size={16} /></button>}</label>
    </div>
    <div hidden={!!contentType} className="mc-content-types" role="group" aria-label={t("games.minecraft.catalog.content")}>
      {MINECRAFT_CONTENT.map(value => { return <button key={value} aria-pressed={type === value} onClick={() => change(() => { setType(value); setLoader(""); setCategory(""); })}><MinecraftContentIcon kind={value}/><span>{t(`games.minecraft.catalog.${value}`)}</span></button>; })}
    </div>
    </div>
    {curseForge && <MinecraftCurseForge embedded key={type} type={type} query={term} active={active} close={() => { setCurseForge(false); requestAnimationFrame(() => modrinthButton.current?.focus({ preventScroll: true })); }}/>}
    <div hidden={curseForge || (pageDetails && !!selected)}>
    <div className="mc-catalog-filters">
      <div><span>{t("games.minecraft.catalog.category")}</span><Dropdown ariaLabel={t("games.minecraft.catalog.category")} value={category} options={[{ value: "", label: t("games.minecraft.catalog.allCategories") }, ...categories.filter(v => v.type === type).map(v => ({ value: v.name, label: label(v.name) }))]} onChange={value => change(() => setCategory(value))}/></div>
      <div><span>{t("games.minecraft.catalog.gameVersion")}</span><Dropdown ariaLabel={t("games.minecraft.catalog.gameVersion")} value={game} options={[{ value: "", label: t("games.minecraft.catalog.allVersions") }, ...games.map(value => ({ value, label: value }))]} onChange={value => change(() => setGame(value))}/></div>
      {!!loaders.length && <div><span>{t("games.minecraft.catalog.loader")}</span><Dropdown ariaLabel={t("games.minecraft.catalog.loader")} value={loader} options={[{ value: "", label: t("games.minecraft.catalog.allLoaders") }, ...loaders.map(value => ({ value, label: label(value) }))]} onChange={value => change(() => setLoader(value))}/></div>}
      <div className="mc-catalog-sort"><span>{t("games.minecraft.catalog.sort")}</span><Dropdown ariaLabel={t("games.minecraft.catalog.sort")} value={sort} options={["downloads", "relevance", "updated", "newest"].map(value => ({ value, label: t(`games.minecraft.catalog.sort.${value}`) }))} onChange={value => change(() => setSort(value))}/></div>
    </div>
    {(error || metaError) && <div className="mc-catalog-error" role="alert"><span>{t(error || "games.minecraft.catalog.filterError")}</span><button className="games-button" onClick={() => setRetry(v => v + 1)}>{t("common.retry")}</button></div>}
    <div className="mc-catalog-summary"><div className="mc-catalog-result-summary"><span role="status">{loading ? t("common.loading") : result ? t("games.minecraft.catalog.results", { count: result.total.toLocaleString() }) : ""}</span>{(category || game || loader || sort !== "downloads") && <button className="mc-catalog-reset" onClick={() => change(() => { setCategory(""); setGame(""); setLoader(""); setSort("downloads"); })}><X size={15}/>{t("games.catalog.reset")}</button>}</div><div className="mod-catalog-actions"><ModViewToggle value={view} change={setView}/><button className="games-icon-button" aria-label={t("games.feed.refresh")} disabled={loading} onClick={() => setRetry(value => value + 1)}><RefreshCw size={19}/></button></div></div>
    <div className={`mc-project-grid is-${view}${loading && result ? " is-loading" : ""}`} aria-busy={loading} inert={loading && !!result}>
      {result?.hits.map(project => <MinecraftCatalogCard key={project.id} project={project} view={view} game={game} open={origin => { trigger.current = origin; rememberScroll(origin); setFromSpotlight(false); setSelected(project); }}/>) }
      {!result && loading && Array.from({ length: 8 }, (_, index) => <MinecraftCatalogSkeleton key={index}/>)}
    </div>
    {!loading && result && !result.hits.length && <p className="mc-catalog-empty">{t("games.minecraft.catalog.empty")}</p>}
    {result && result.total > 24 && <footer className="mc-catalog-pages"><span dir="ltr">{page + 1} / {Math.ceil(Math.min(10024, result.total) / 24)}</span><button className="games-icon-button" aria-label={t("common.previous")} disabled={!page || loading} onClick={() => move(page - 1)}><ChevronLeft size={20} /></button><button className="games-icon-button" aria-label={t("common.next")} disabled={loading || (page + 1) * 24 >= result.total || (page + 1) * 24 > 10000} onClick={() => move(page + 1)}><ChevronRight size={20} /></button></footer>}
    {active && !selected && <ModBackToTop/>}
    </div>
    {selected && <MinecraftProjectDialog page={pageDetails} key={selected.id} project={selected} game={fromSpotlight ? "" : game} loader={fromSpotlight ? "" : loader} close={close} manage={project => { close(); manage(project); }} installPack={installPack ? pack => { close(); installPack(pack); } : undefined} />}
  </section>;
}

type ProjectTab = "about" | "changelog" | "gallery" | "versions";
const projectTabs = [{ key: "about", label: "games.minecraft.catalog.about" }, { key: "changelog", label: "games.minecraft.notes.title" }, { key: "gallery", label: "games.minecraft.catalog.gallery" }, { key: "versions", label: "games.minecraft.catalog.versions" }] as const;

export function MinecraftProjectDialog({ project, game, loader, close: onClose, manage, installPack, page = false }: { page?: boolean; project: MinecraftProject; game: string; loader: string; close: () => void; manage: (project: MinecraftProject) => void; installPack?: (pack: MinecraftPackRequest) => void }) {
  const t = useT(), id = useId(), modal = useModalExit(onClose), close = page ? onClose : modal.close, root = useRef<HTMLDivElement>(null);
  const [detail, setDetail] = useState<MinecraftProjectDetail | null>(null), [versions, setVersions] = useState<MinecraftVersion[] | null>(null), [retry, setRetry] = useState(0), [error, setError] = useState("");
  const [tab, setTab] = useState<ProjectTab>("about"), [photo, setPhoto] = useState(0), [expanded, setExpanded] = useState(false);
  const scroll = useRef<HTMLDivElement>(null), positions = useRef<Record<ProjectTab, number>>({ about: 0, changelog: 0, gallery: 0, versions: 0 });
  const readingScroll = () => page ? root.current?.closest<HTMLElement>(".games-view") : scroll.current;
  const switchTab = (next: ProjectTab) => { if (next === tab) return; positions.current[tab] = readingScroll()?.scrollTop ?? 0; setTab(next); };
  useLayoutEffect(() => { const target = readingScroll(); if (target) target.scrollTop = positions.current[tab]; }, [tab]);
  const [versionGame, setVersionGame] = useState(game), [versionLoader, setVersionLoader] = useState(loader), [selected, setSelected] = useState("");
  const [versionsLoading, setVersionsLoading] = useState(true), [versionsError, setVersionsError] = useState(""), [versionsRetry, setVersionsRetry] = useState(0), [versionsCapped, setVersionsCapped] = useState(false);
  const selectedVersion = minecraftPreferredVersion(versions ?? [], selected);
  const chooseVersion = (id: string) => { if (id !== selectedVersion?.id) { positions.current.changelog = 0; if (tab === "changelog" && scroll.current) scroll.current.scrollTop = 0; } setSelected(id); };
  const changeVersions = (game: string, loader: string) => { positions.current.changelog = 0; setVersionsLoading(true); setVersions(null); setSelected(""); setVersionGame(game); setVersionLoader(loader); };
  const showVersions = () => { switchTab("versions"); positions.current.versions = 0; requestAnimationFrame(() => { if (!page && scroll.current) scroll.current.scrollTop = 0; const control = root.current?.querySelector<HTMLElement>(".mc-release-filters :is(select,button)"); if (page) control?.scrollIntoView({ block: "center" }); control?.focus({ preventScroll: true }); }); };
  useSectionBack(close, true);
  useEffect(() => {
    if (page) { root.current?.scrollIntoView({ block: "start" }); root.current?.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true }); return; }
    const previous = document.activeElement as HTMLElement; root.current?.querySelector<HTMLButtonElement>(".mc-project-close")?.focus({ preventScroll: true });
    const trap = (event: KeyboardEvent) => { if (event.key !== "Tab") return; const buttons = [...(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],select,input') ?? [])].filter(v => v.getClientRects().length && !v.closest("[inert]")); if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1)?.focus(); } else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0]?.focus(); } };
    document.addEventListener("keydown", trap); return () => { document.removeEventListener("keydown", trap); previous?.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => {
    const controller = new AbortController(); setError("");
    void minecraftCatalogRequest({ kind: "project", query: project.id }, controller.signal, retry > 0).then(minecraftProject).then(value => { if (value.id !== project.id || value.type !== project.type) throw Error("mods_metadata"); if (!controller.signal.aborted) setDetail(value); }).catch(reason => { if (!controller.signal.aborted) setError(catalogError(reason)); });
    return () => controller.abort();
  }, [project.id, retry]);
  useEffect(() => {
    const controller = new AbortController(); setVersionsLoading(true); setVersionsError("");
    void minecraftCatalogRequest({ kind: "versions", query: project.id, game: versionGame, loader: versionLoader }, controller.signal, versionsRetry > 0).then(value => {
      const items = minecraftVersions(value); if (controller.signal.aborted) return;
      setVersions(items); setVersionsCapped(Array.isArray(value) && value.length > 500); setSelected(current => minecraftPreferredVersion(items, current)?.id ?? "");
    }).catch(reason => { if (!controller.signal.aborted) setVersionsError(catalogError(reason)); }).finally(() => { if (!controller.signal.aborted) setVersionsLoading(false); });
    return () => controller.abort();
  }, [project.id, versionGame, versionLoader, versionsRetry]);
  const gallery = detail?.gallery.length ? detail.gallery : project.art ? [{ url: project.art, title: "" }] : [];
  const currentPhoto = gallery[photo % gallery.length];
  const artwork = currentPhoto && <figure className={`mc-project-gallery${tab === "gallery" ? " is-expanded" : ""}`}><button className="mc-gallery-enlarge" aria-label={t("games.gallery.enlargeImage", { number: photo % gallery.length + 1 })} onClick={() => setExpanded(true)}><GameArt src={currentPhoto.url} alt={currentPhoto.title || project.title} /></button><figcaption>{tab === "gallery" && <span>{currentPhoto.title || project.title}</span>}{gallery.length > 1 && <div><button className="games-icon-button" aria-label={t("common.previous")} onClick={() => setPhoto(v => (v + gallery.length - 1) % gallery.length)}><ChevronLeft size={20} /></button><span dir="ltr" aria-live="polite">{photo % gallery.length + 1} / {gallery.length}</span><button className="games-icon-button" aria-label={t("common.next")} onClick={() => setPhoto(v => (v + 1) % gallery.length)}><ChevronRight size={20} /></button></div>}</figcaption></figure>;
  const projectError = error && <div className="mc-catalog-error" role="alert"><span>{t(error)}</span><button className="games-button" onClick={() => setRetry(v => v + 1)}>{t("common.retry")}</button></div>;
  const facts = <aside><ModStats values={{ downloads: detail?.downloads ?? project.downloads, followers: detail?.followers }}/>{(detail?.updated || project.updated) && Number.isFinite(Date.parse(detail?.updated || project.updated)) && <section><h3>{t("games.sims.mtsUpdated")}</h3><p>{new Date(detail?.updated || project.updated).toLocaleDateString(document.documentElement.lang)}</p></section>}{detail?.license && <section><h3>{t("games.minecraft.catalog.license")}</h3><p>{detail.license}</p></section>}{!!detail?.loaders.length && <section><h3>{t("games.minecraft.catalog.loader")}</h3><p>{detail.loaders.map(label).join(" · ")}</p></section>}<section className="mc-project-links"><ProjectLink url={minecraftProjectUrl(project)}>{t("games.minecraft.catalog.projectPage")}</ProjectLink>{detail?.links.map(link => <ProjectLink key={link.title} url={link.url}>{t(`games.minecraft.catalog.${link.title}`)}</ProjectLink>)}</section></aside>;
  const actions = <>{project.type === "mod" && <footer><p>{t("games.minecraft.catalog.manageNote")}</p><button className="games-button" onClick={() => manage(project)}><Box size={17} />{t("games.minecraft.catalog.manage")}</button></footer>}
      {project.type === "modpack" && installPack && <footer className="mc-release-footer"><div className="mc-release-summary">{versionsLoading ? <span role="status">{t("common.loading")}</span> : selectedVersion && !versionsError ? <MinecraftVersionIdentity version={selectedVersion} showChannel /> : <span>{t(versionsError || "games.minecraft.catalog.noVersion")}</span>}<button onClick={showVersions}>{t("games.minecraft.release.choose")}</button></div><div className="mc-release-review">{!isTauri() && <small>{t("games.minecraft.instances.desktop")}</small>}{selectedVersion && !versionsLoading && !versionsError && !minecraftReviewableVersion(selectedVersion) && <small>{t("games.minecraft.release.noArchive")}</small>}<button className="games-button" disabled={!isTauri() || versionsLoading || !!versionsError || !minecraftReviewableVersion(selectedVersion)} onClick={() => { if (selectedVersion) installPack({ version: selectedVersion.id, name: project.title, icon: project.icon }); }}><Download size={17} />{t("games.minecraft.instances.review")}</button></div></footer>}</>;
  const content = <div className={`mc-project-dialog${page ? " mc-project-page" : ""}`} ref={root}>
      <header><GameArt src={project.icon} /><div><span className="mc-project-context"><ModProviderLogo source="Modrinth"/><ModGameMark game="minecraft"/><span>{t(`games.minecraft.catalog.${project.type}`)}</span></span><h2 id={id} tabIndex={-1}>{project.title}</h2>{project.author && <p>{project.author}</p>}</div><button hidden={page} className="games-icon-button mc-project-close" aria-label={t("common.close")} onClick={close}><X size={20} /></button></header>
      <div className="mc-project-tabs" role="tablist" aria-label={t("games.minecraft.catalog.project")} onKeyDown={event => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault(); const rtl = getComputedStyle(event.currentTarget).direction === "rtl", at = projectTabs.findIndex(value => value.key === tab);
        const next = event.key === "Home" ? 0 : event.key === "End" ? projectTabs.length - 1 : (at + ((event.key === "ArrowRight") !== rtl ? 1 : -1) + projectTabs.length) % projectTabs.length;
        switchTab(projectTabs[next].key); event.currentTarget.querySelectorAll<HTMLButtonElement>("button")[next]?.focus({ preventScroll: true });
      }}>{projectTabs.map(({ key, label }) => <button key={key} id={`${id}-${key}`} role="tab" aria-selected={tab === key} aria-controls={`${id}-panel`} tabIndex={tab === key ? 0 : -1} onClick={() => switchTab(key)}><ModProjectIcon name={key}/>{t(label)}</button>)}</div>
      <div className={page ? "mc-project-page-layout" : "mc-project-modal-layout"}>
      <div className="mc-project-scroll" ref={scroll} role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${tab}`} tabIndex={0}>
        {(tab === "about" || page && tab !== "gallery") && artwork}
        {tab === "gallery" ? <div className="mc-project-gallery-page">{projectError}{artwork || <div className="mc-gallery-empty" role={!detail && !error ? "status" : undefined}><ModProjectIcon name="gallery" size={64}/><h3>{t("games.minecraft.catalog.gallery")}</h3><p>{t(!detail && !error ? "common.loading" : "games.minecraft.catalog.galleryEmpty")}</p>{detail && <div><button className="games-button" onClick={() => switchTab("about")}><ModProjectIcon name="about"/>{t("games.minecraft.catalog.about")}</button><ProjectLink url={minecraftProjectUrl(project)}>{t("games.minecraft.catalog.projectPage")}</ProjectLink></div>}</div>}</div> : <div className={`mc-project-detail-body${tab === "changelog" ? " is-reading" : ""}`}><article>
          {tab === "about" && <><p className="mc-project-description">{project.description}</p>{projectError}{detail ? <MinecraftProjectProse>{detail.body || detail.description}</MinecraftProjectProse> : !error && <p role="status">{t("common.loading")}</p>}</>}
          {tab === "versions" && <MinecraftProjectVersions project={project} versions={versions} selected={selectedVersion?.id ?? ""} choose={chooseVersion} game={versionGame} loader={versionLoader} games={detail?.versions.length ? detail.versions : project.versions} loaders={detail?.loaders.length ? detail.loaders : project.loaders} filter={changeVersions} loading={versionsLoading} error={versionsError} retry={() => setVersionsRetry(v => v + 1)} capped={versionsCapped} />}
          {tab === "changelog" && <MinecraftReleaseNotesView project={project} versions={versions} selected={selectedVersion} choose={chooseVersion} loading={versionsLoading} error={versionsError} retry={() => setVersionsRetry(v => v + 1)} showVersions={showVersions} ready={() => { if (scroll.current) scroll.current.scrollTop = positions.current.changelog; }}/>} 
        </article>{!page && tab !== "changelog" && facts}</div>}
      </div>
      {page && <aside className="mc-project-page-sidebar"><section className="mod-project-install">{actions}</section>{facts}</aside>}
      </div>
      {page ? <ModBackToTop/> : <BackToTop scrollRef={scroll} threshold={300}/>}
      {expanded && <GameScreenshotViewer screenshots={gallery.map(value => value.url)} index={photo} select={setPhoto} onClose={() => setExpanded(false)}/>}
      {!page && actions}
    </div>;
  return page ? content : <ModalShell closing={modal.closing} onDismiss={close} width={1040} labelledBy={id} backdropClassName="mc-project-scrim">{content}</ModalShell>;
}


