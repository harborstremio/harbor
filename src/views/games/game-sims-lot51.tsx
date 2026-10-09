import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, Download, LoaderCircle, RefreshCw, Search } from "lucide-react";
import { ModProjectPage } from "./mod-project-page";
import { SimsMtsGallery } from "./game-sims-mts-gallery";
import { useSectionBack } from "@/lib/section-back";
import { Dropdown } from "@/components/dropdown";
import { useT, useUiLanguage } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { simsError, simsLot51Catalog, simsLot51Detail, type SimsLot51Catalog, type SimsLot51Detail, type SimsWorkspace } from "@/lib/games/sims";
import packageIcon from "@/assets/settings-icons/package.svg";
import { SimsPackRequirements } from "./game-sims-packs";
import type { SimsSelection } from "./game-sims-review";

function LotArt({ src }: { src: string }) {
  const [failedSrc, setFailedSrc] = useState(""), [loadedSrc, setLoadedSrc] = useState("");
  const failed = failedSrc === src, loaded = loadedSrc === src;
  return <span className="games-sims-lot51-image">{(!src || failed || !loaded) && <span className="games-sims-lot51-art-fallback" style={{ maskImage: `url("${packageIcon}")` }} aria-hidden="true"/>}{src && !failed && <img src={src} className={loaded ? "is-loaded" : ""} loading="lazy" decoding="async" alt="" onLoad={() => setLoadedSrc(src)} onError={() => setFailedSrc(src)}/>}</span>;
}
function atLeast(value: string, required: string) {
  const a = value.split('.').map(Number), b = required.split('.').map(Number);
  for (let i = 0; i < 4; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  return true;
}
export function GameSimsLot51({ active, data, disabled, choose, importDownload, workspace = false, setup }: { setup?: () => void; workspace?: boolean; active: boolean; data: SimsWorkspace | null; disabled: boolean; choose: (selection: SimsSelection) => void; importDownload: (title: string, target?: string) => void }) {
  const t = useT(), language = useUiLanguage(), label = (key: string) => t(`games.sims.${key}`);
  const [catalog, setCatalog] = useState<SimsLot51Catalog | null>(null), [loading, setLoading] = useState(false), [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0), [search, setSearch] = useState(""), [limit, setLimit] = useState(workspace ? 24 : 6);
  const [slug, setSlug] = useState(""), [detail, setDetail] = useState<SimsLot51Detail | null>(null), [detailError, setDetailError] = useState(""), [detailAttempt, setDetailAttempt] = useState(0), [targetKey, setTargetKey] = useState("");
  useEffect(() => {
    if (!active) return;
    let live = true; setLoading(true); setError("");
    void simsLot51Catalog(attempt > 0).then(value => { if (live) setCatalog(value); }, e => { if (live) setError(simsError(e)); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [active, attempt]);
  useEffect(() => {
    if (!active || !slug || catalog?.cached) return;
    let live = true; setDetail(null); setDetailError("");
    void simsLot51Detail(slug).then(value => { if (live) setDetail(value); }, e => { if (live) setDetailError(simsError(e)); });
    return () => { live = false; };
  }, [active, slug, detailAttempt, catalog?.cached]);
  const catalogProject = useRef(""), restoreCatalog = useRef(false), catalogScroll = useRef<{ node: HTMLElement; top: number }[]>([]), trail = useRef<string[]>([]);
  useLayoutEffect(() => {
    if (slug || !restoreCatalog.current) return;
    restoreCatalog.current = false;
    for (const { node, top } of catalogScroll.current) if (node.isConnected) node.scrollTop = top;
    document.querySelector<HTMLButtonElement>(`[data-lot-project="${CSS.escape(catalogProject.current)}"]`)?.focus({ preventScroll: true });
  }, [slug]);
  const select = (value: string, origin?: HTMLElement) => {
    if (origin) { catalogProject.current = value; catalogScroll.current = []; trail.current = []; for (let node = origin.parentElement; node; node = node.parentElement) if (node.scrollHeight > node.clientHeight) catalogScroll.current.push({ node, top: node.scrollTop }); }
    else if (slug) trail.current.push(slug);
    setDetail(null); setDetailError(""); setSlug(value); setTargetKey("");
  };
  useSectionBack(() => {
    const parent = trail.current.pop(); setSlug(parent ?? ""); setDetail(null); setDetailError("");
    restoreCatalog.current = !parent;
  }, active && workspace && !!slug);
  const matching = data?.state.groups.filter(g => g.source?.provider === "lot51" && g.source.project === slug) ?? [];
  const targets = data?.state.groups.filter(g => !g.source || matching.includes(g)) ?? [];
  const target = targets.find(g => g.id === targetKey) ?? matching[0];
  const cores = data?.state.groups.filter(g => g.enabled && g.source?.provider === "lot51" && g.source.project === "core-library") ?? [];
  const missingCore = !!detail?.requiredCore && (cores.length !== 1 || !atLeast(cores[0].source!.version, detail.requiredCore));
  const current = !!detail && target?.source?.version === detail.project.version;
  const projects = catalog?.projects.filter(p => `${p.title} ${p.subtitle}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())) ?? [];
  const fallbackProject = catalog?.projects.find(p => p.slug === slug);
  const targetPicker = targets.length > 0 && <div className="games-sims-creator-target"><small>{label("creatorExisting")}</small><Dropdown ariaLabel={label("creatorExisting")} value={target?.id ?? "new"} options={[...(!matching.length ? [{ value: "new", label: label("lotNew") }] : []), ...targets.map(g => ({ value: g.id, label: g.title }))]} onChange={setTargetKey}/></div>;
  const download = () => detail && choose({ action: target ? { kind: "update", id: target.id } : { kind: "install", title: detail.project.title }, title: detail.project.title, sources: [], creator: { provider: "lot51", project: slug, version: detail.project.version, gamePatch: "", target: target?.id } });
  if (workspace && active && slug && fallbackProject) {
    const project = detail?.project ?? fallbackProject, manual = !!catalog?.cached || !!detailError;
    return <ModProjectPage key={slug} game="sims4" source="Lot 51" sourceUrl={project.page} title={project.title} creator="Lot 51" description={project.subtitle} media={<SimsMtsGallery images={[project.image || project.icon]}/>}
      actions={<><section className="mod-project-install"><h3>{label("creatorVersion")}</h3><strong>{project.version}</strong>{targetPicker}
        {!detail && !manual && <p className="mod-project-pending" role="status"><LoaderCircle size={18}/>{t("common.loading")}</p>}
        {detailError && <p role="alert">{t(detailError)}</p>}
        {detail?.requiredCore && <p>{t("games.sims.lotCore", { version: detail.requiredCore })}{missingCore && <button className="games-detail-text-button" onClick={() => select("core-library")}>{label("lotGetCore")}</button>}</p>}
        <button className="games-button games-button-primary" disabled={!data ? !setup : disabled || (!manual && (!detail || current || missingCore)) || !!data.folder.partial} onClick={!data ? setup : manual ? () => importDownload(project.title, target?.id) : download}>{current ? <Check size={17}/> : <Download size={17}/>}{label(!data ? "choose" : current ? "creatorInstalled" : manual ? "install" : "creatorReview")}</button>
        <p>{label(!data ? "creatorChoose" : manual ? "lotManual" : "creatorReviewNote")}</p>
      </section>{detail && <button className="games-detail-text-button" onClick={() => void openUrl(detail.changelog)}>{label("creatorChanges")}<ArrowUpRight size={14}/></button>}{detail && <SimsPackRequirements values={detail.packs}/>}</>}
    ><section className="mod-project-overview"><h3>{t("games.minecraft.catalog.about")}</h3><p>{detail?.description || project.subtitle}</p>{manual && <button className="games-detail-text-button" onClick={() => void openUrl(project.page)}>{t("games.modHub.viewOnSource")}<ArrowUpRight size={14}/></button>}</section></ModProjectPage>;
  }
  return <section className="games-sims-lot51" aria-label="Lot 51">
    <div className="games-sims-lot51-heading"><div><small>Lot 51</small><h3>{label("lotTitle")}</h3></div><div className="games-sims-actions"><label className="games-sims-lot51-search"><Search size={16}/><input aria-label={label("lotSearch")} placeholder={label("lotSearch")} value={search} onChange={e => { setSearch(e.target.value); setLimit(6); }}/></label><button className="games-icon-button" disabled={loading} aria-label={label("creatorRefresh")} onClick={() => { setAttempt(n => n + 1); setDetailAttempt(n => n + 1); }}><RefreshCw size={16}/></button></div></div>
    {loading && !catalog && <p className="games-sims-pending" role="status"><LoaderCircle size={18}/>{t("common.loading")}</p>}
    {error && <p role="status">{t(error)} <button className="games-detail-text-button" disabled={loading} onClick={() => setAttempt(n => n + 1)}>{t("common.retry")}</button></p>}
    {catalog?.cached && <p className="games-sims-lot51-cached" role="status">{t("games.sims.lotCached", { date: new Date(catalog.observedAt * 1000).toLocaleDateString(language) })}</p>}
    <div className="games-sims-lot51-grid">{projects.slice(0, limit).map(project => <button key={project.slug} className="games-sims-lot51-card" aria-pressed={slug === project.slug} data-lot-project={project.slug} onClick={event => select(project.slug, event.currentTarget)}><div className="games-sims-lot51-art"><LotArt src={project.image}/></div><div className="games-sims-lot51-card-title"><LotArt src={project.icon}/><span>{project.title}<small>{project.version}</small></span></div><p>{project.subtitle}</p></button>)}</div>
    {projects.length > limit && <button className="games-detail-text-button" onClick={() => setLimit(n => n + 6)}>{t("games.details.showMore")}</button>}
    {slug && <div className="games-sims-lot51-detail" aria-busy={!catalog?.cached && !detail && !detailError}>
      {(catalog?.cached || detailError) && fallbackProject ? <><div><div className="games-sims-lot51-detail-title"><LotArt src={fallbackProject.icon}/><h3>{fallbackProject.title}</h3></div><p>{fallbackProject.subtitle}</p><button className="games-detail-text-button" onClick={() => void openUrl(fallbackProject.page)}>{label("lotGuide")}<ArrowUpRight size={14}/></button></div><div className="games-sims-creator-controls">{targetPicker}<p>{label("lotManual")}</p><button className="games-button games-button-primary" disabled={disabled || data?.folder.partial} onClick={() => importDownload(fallbackProject.title, target?.id)}><Download size={16}/>{label(target ? "update" : "install")}</button>{!data && <small>{label("creatorChoose")}</small>}</div></> : !detail ? <p className="games-sims-pending" role="status"><LoaderCircle size={18}/>{t("common.loading")}</p> : <>
        <div><div className="games-sims-lot51-detail-title"><LotArt src={detail.project.icon}/><h3>{detail.project.title}<small>{detail.project.version}</small></h3></div><p>{detail.description || detail.project.subtitle}</p><SimsPackRequirements values={detail.packs}/><button className="games-detail-text-button" onClick={() => void openUrl(detail.project.page)}>{label("lotGuide")}<ArrowUpRight size={14}/></button></div>
        <div className="games-sims-creator-controls">{targets.length > 0 && <div className="games-sims-creator-target"><small>{label("creatorExisting")}</small><Dropdown ariaLabel={label("creatorExisting")} value={target?.id ?? "new"} options={[...(!matching.length ? [{ value: "new", label: label("lotNew") }] : []), ...targets.map(g => ({ value: g.id, label: g.title }))]} onChange={setTargetKey}/></div>}
          {detail.requiredCore && <p>{t("games.sims.lotCore", { version: detail.requiredCore })}{missingCore && <button className="games-detail-text-button" onClick={() => { setSearch(""); select("core-library"); }}>{label("lotGetCore")}</button>}</p>}
          <div className="games-sims-actions"><button className="games-button games-button-primary" disabled={disabled || !!error || loading || current || missingCore || data?.folder.partial} onClick={download}>{current ? <Check size={16}/> : <Download size={16}/>}{label(current ? "creatorInstalled" : "creatorReview")}</button><button className="games-detail-text-button" onClick={() => void openUrl(detail.changelog)}>{label("creatorChanges")}<ArrowUpRight size={14}/></button></div>
          <small>{label(!data ? "creatorChoose" : data.folder.partial ? "adoptScan" : target && !target.source ? "creatorLinkNote" : "lotCompatibility")}</small>
        </div>
      </>}
    </div>}
  </section>;
}
