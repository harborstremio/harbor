import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Check, Download, FolderOpen, LoaderCircle, RefreshCw } from "lucide-react";
import { ModProjectPage } from "./mod-project-page";
import { useSectionBack } from "@/lib/section-back";
import { Dropdown } from "@/components/dropdown";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { simsCreatorCatalog, type SimsCreatorCatalog, type SimsWorkspace } from "@/lib/games/sims";
import { simsCreatorExisting } from "@/lib/games/sims-creator-existing";
import type { SimsSelection } from "./game-sims-review";

const source = "https://deaderpool-mccc.com/downloads.html";
function older(game: string, patch: string) { const a = game.split('.').map(Number), b = patch.split('.').map(Number); for (let i = 0; i < 4; i++) { if (a[i] !== b[i]) return a[i] < b[i]; } return false; }
export function GameSimsCatalog({ active, data, disabled, choose, manageExisting, workspace = false, setup, close }: { workspace?: boolean; setup?: () => void; close?: () => void; active: boolean; data: SimsWorkspace | null; disabled: boolean; choose: (selection: SimsSelection) => void; manageExisting: () => void }) {
  const t = useT(), label = (key: string) => t(`games.sims.${key}`);
  const [catalog, setCatalog] = useState<SimsCreatorCatalog | null>(null), [version, setVersion] = useState(""), [error, setError] = useState(false), [loading, setLoading] = useState(false), [attempt, setAttempt] = useState(0);
  useEffect(() => { if (!active) return; let live = true; setLoading(true); setError(false); void simsCreatorCatalog(attempt > 0).then(value => { if (live) { setCatalog(value); setVersion(current => value.releases.some(r => r.version === current) ? current : value.releases[0]?.version ?? ""); } }, () => { if (live) setError(true); }).finally(() => { if (live) setLoading(false); }); return () => { live = false; }; }, [active, attempt]);
  const [targetKey, setTargetKey] = useState("");
  const existing = useMemo(() => simsCreatorExisting(data), [data]);
  const target = existing.targets.find(item => item.key === targetKey) ?? existing.targets.find(item => item.version) ?? existing.targets[0];
  const selected = catalog?.releases.find(r => r.version === version);
  const tooOld = !!(selected && data && older(data.folder.gameVersion, selected.gamePatch));
  const current = !!target?.version && target.version === version;
  const loose = !!target?.sources, unresolved = existing.found && !target;
  const reviewExisting = () => target?.sources && choose({ action: { kind: "adopt", title: "MC Command Center" }, title: "MC Command Center", sources: target.sources });
  const download = () => selected && choose({ action: target?.groupId ? { kind: "update", id: target.groupId } : { kind: "install", title: "MC Command Center" }, title: "MC Command Center", sources: [], creator: { version, gamePatch: selected.gamePatch, target: target?.groupId } });
  useSectionBack(() => close?.(), active && workspace);
  const controls = <div className="games-sims-creator-controls">
      {loading && !catalog ? <p className="games-sims-pending" role="status"><LoaderCircle size={18}/>{t("common.loading")}</p> : <>
        {target && <div className="games-sims-creator-target"><small>{label("creatorExisting")}</small><Dropdown ariaLabel={label("creatorExisting")} value={target.key} options={existing.targets.map(item => ({ value: item.key, label: item.label }))} onChange={setTargetKey}/></div>}
        {loose || unresolved ? <div className="games-sims-actions"><button className="games-button games-button-primary" disabled={disabled || data?.folder.partial} onClick={loose ? reviewExisting : manageExisting}><FolderOpen size={16}/>{label("creatorManage")}</button></div> : selected && <><div className="games-sims-actions"><Dropdown ariaLabel={label("creatorVersion")} value={version} options={catalog!.releases.map(r => ({ value: r.version, label: r.version }))} onChange={setVersion}/><button className="games-icon-button" disabled={loading} aria-label={label("creatorRefresh")} title={label("creatorRefresh")} onClick={() => setAttempt(n => n + 1)}><RefreshCw size={16}/></button></div><p>{t("games.sims.creatorTested", { version: selected.gamePatch })}</p><div className="games-sims-actions"><button className="games-button games-button-primary" disabled={disabled || error || loading || tooOld || current || data?.folder.partial} onClick={download}>{current ? <Check size={16}/> : <Download size={16}/>}{label(current ? "creatorInstalled" : "creatorReview")}</button><button className="games-detail-text-button" onClick={() => void openUrl(selected.changelog)}>{label("creatorChanges")}<ArrowUpRight size={14}/></button></div></>}
        {error && <div role="status"><p>{label("creatorNetwork")}</p><button className="games-button" disabled={loading} onClick={() => setAttempt(n => n + 1)}>{t("common.retry")}</button></div>}
      </>}
      {!data ? <p>{label("creatorChoose")}</p> : data.folder.partial ? <p>{label("adoptScan")}</p> : loose ? <small>{label("creatorAdoptNote")}</small> : unresolved ? <p>{label("creatorExistingError")}</p> : tooOld ? <p className="games-sims-warning">{label("creatorPatch")}</p> : selected && !current && <small>{label(target && !target.version ? "creatorLinkNote" : "creatorReviewNote")}</small>}
    </div>;
  if (workspace && active) return <ModProjectPage game="sims4" source="Deaderpool" sourceUrl={source} title="MC Command Center" creator="Deaderpool" description={label("creatorIntro")} media={null} actions={<section className="mod-project-install"><h3>{label("creatorVersion")}</h3>{!data && setup && <button className="games-button games-button-primary" onClick={setup}><FolderOpen size={17}/>{label("choose")}</button>}{controls}</section>}><section className="mod-project-overview"><h3>{t("games.minecraft.catalog.versions")}</h3>{catalog && <ul className="mod-project-file-list">{catalog.releases.map(release => <li key={release.version}><strong>{release.version}</strong><p>{t("games.sims.creatorTested", { version: release.gamePatch })}</p><button className="games-detail-text-button" onClick={() => void openUrl(release.changelog)}>{label("creatorChanges")}<ArrowUpRight size={14}/></button></li>)}</ul>}</section></ModProjectPage>;
  return <section className="games-sims-catalog" aria-label={label("creatorTitle")}>
    <div className="games-sims-creator-copy"><small>{label("creatorTitle")}</small><h3>MC Command Center</h3><p>{label("creatorIntro")}</p><button className="games-detail-text-button" onClick={() => void openUrl(source)}>Deaderpool<ArrowUpRight size={14}/></button></div>
    {controls}
  </section>;
}
