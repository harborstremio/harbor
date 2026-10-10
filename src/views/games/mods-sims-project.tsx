import { ModDescription } from "./mod-description";
import type { RefObject } from "react";
import { ArrowUpRight, Check, Download, LoaderCircle, RotateCw } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { modCategory } from "@/lib/games/mod-workspace";
import type { SimsMtsDetail, SimsMtsProject } from "@/lib/games/sims";
import { ModProjectPage } from "./mod-project-page";
import { SimsMtsGallery } from "./game-sims-mts-gallery";
import { SimsPackRequirements } from "./game-sims-packs";
import { GameSimsCreatorContent } from "./game-sims-creator-content";

export function ModsSimsProject({ game, detail, preview, page, busy, waiting, error, canceling, cancel, cancelButton, retry,
  version, setVersion, targets, target, setTarget, installed, restoration, connected, disabled, setup, download, selectDependency, focusItem, showContent }: {
  game: 2 | 3 | 4; detail: SimsMtsDetail | null; preview: SimsMtsProject | null; page: string;
  busy: boolean; waiting: boolean; error: string; canceling: boolean; cancel: () => void; cancelButton: RefObject<HTMLButtonElement | null>; retry: () => void;
  version: string; setVersion: (value: string) => void; targets: { id: string; title: string }[]; target: string; setTarget: (value: string) => void;
  installed: boolean; restoration: boolean; connected: boolean; disabled: boolean; setup?: () => void; download: () => void;
  selectDependency?: (url: string, trigger: HTMLElement) => void; focusItem?: number; showContent: boolean;
}) {
  const t = useT(), label = (key: string) => t(`games.sims.${key}`);
  const identity = detail ?? preview, selectedGame = detail?.game ?? preview?.game ?? game;
  const selected = detail?.files.find(file => file.version === version), managed = selectedGame === 4;
  const images = detail?.gallery?.length ? detail.gallery : identity?.image ? [identity.image] : [];
  const fileAction = managed ? <>
    {detail && <div className="games-sims-mts-choices"><div><small>{label("mtsFile")}</small><Dropdown ariaLabel={label("mtsFile")} value={version} options={detail.files.map(file => ({ value: file.version, label: file.name }))} onChange={setVersion}/></div>
      {targets.length > 0 && <div><small>{label("creatorExisting")}</small><Dropdown ariaLabel={label("creatorExisting")} value={target} options={[{ value: "new", label: label("lotNew") }, ...targets.map(group => ({ value: group.id, label: group.title }))]} onChange={setTarget}/></div>}
    </div>}
    <button className="games-button games-button-primary" disabled={busy || !detail || (connected ? disabled || !selected?.supported || installed : !setup)} onClick={connected ? download : setup}>{installed ? <Check size={17}/> : <Download size={17}/>}{label(!connected && setup ? "choose" : installed ? "creatorInstalled" : restoration ? "trayRestore" : "creatorReview")}</button>
    {detail && <p>{label(!selected?.supported ? "mtsZip" : !connected ? "creatorChoose" : "creatorReviewNote")}</p>}
  </> : <><button className="games-button games-button-primary" disabled={!page} onClick={() => void openUrl(`${detail?.page ?? page}#files`)}><ArrowUpRight size={17}/>{t("games.modHub.creatorDownload")}</button><p>{t("games.modHub.legacyNote")}</p></>;
  return <ModProjectPage game={`sims${selectedGame}`} source="Mod The Sims" sourceUrl={detail?.page ?? page} title={identity?.title || t("common.loading")} creator={identity?.creator} description={identity?.description} category={modCategory(preview?.category ?? "")} metrics={{ ...preview?.metrics, ...detail?.metrics }}
    media={<SimsMtsGallery key={detail?.project ?? preview?.id ?? page} images={images}/>}
    actions={<><section className="mod-project-install" aria-busy={busy}><h3>{t("games.modHub.files")}{detail && <small className="mod-file-count">{detail.files.length}</small>}</h3>
      {busy && <><div className="mod-project-pending" role="status"><LoaderCircle size={18}/>{waiting ? label("mtsWaiting") : t("games.modHub.filesPending")}</div><div className="mod-project-loading" aria-hidden="true"><i/><i/></div><button ref={cancelButton} className="games-button" aria-disabled={canceling} onClick={cancel}>{t(canceling ? "games.download.state.canceling" : "common.cancel")}</button></>}
      {!busy && !detail && <><p role={error ? "alert" : "status"}>{t(error || "games.download.center.canceled")}</p><button className="games-button" onClick={retry}><RotateCw size={16}/>{t("common.retry")}</button></>}
      {(!busy || !managed) && fileAction}
      {detail && !managed && <ul className="mod-project-file-list">{detail.files.map(file => <li key={file.version} dir="auto">{file.name}</li>)}</ul>}
    </section>
    {detail && managed ? <SimsPackRequirements values={detail.packs}/> : detail && detail.packs.length > 0 && <section className="mod-project-facts"><h3>{label("infoRequiredPacks")}</h3><p>{detail.packs.join(" · ")}</p></section>}
    </>}
  ><section className="mod-project-overview" dir="auto"><h3>{t("games.minecraft.catalog.about")}</h3>
    {detail ? <><ModDescription text={detail.body || detail.description}/>
      <GameSimsCreatorContent key={detail.project} content={detail.content} select={selectDependency} disabled={busy} focusItem={focusItem} expanded={showContent}/></> : <div className="mod-project-loading" aria-hidden="true"><i/><i/><i/></div>}
  </section></ModProjectPage>;
}
