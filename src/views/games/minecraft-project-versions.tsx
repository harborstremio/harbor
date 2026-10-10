import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, FileArchive } from "lucide-react";
import { useT } from "@/lib/i18n";
import { minecraftCatalogRequest, minecraftProject, minecraftProjectUrl, type MinecraftProject, type MinecraftProjectDetail, type MinecraftVersion } from "@/lib/games/minecraft-catalog";
import { transferBytes } from "@/lib/games/transfers";
import { GameArt } from "./game-art";
import { MinecraftProjectLink } from "./minecraft-project-link";
import "./minecraft-project-versions.css";

const k = (key: string) => `games.minecraft.release.${key}`;
export const minecraftLoaderLabel = (value: string) => value === "neoforge" ? "NeoForge" : value.replaceAll("-", " ").replace(/\b\w/g, c => c.toUpperCase());
export function MinecraftVersionIdentity({ version, showChannel = false }: { version: MinecraftVersion; showChannel?: boolean }) {
  const t = useT();
  return <><strong dir="auto">{version.number}</strong><span>{showChannel && ["beta", "alpha"].includes(version.type) && <>{t(k(version.type))} · </>}{version.loaders.map(minecraftLoaderLabel).join(" · ")}{version.games.length > 0 && <>{version.loaders.length > 0 && " · "}<bdi dir="ltr">Minecraft {version.games.join(", ")}</bdi></>}</span></>;
}

function Dependencies({ version, project }: { version: MinecraftVersion; project: MinecraftProject }) {
  const t = useT(), [limit, setLimit] = useState(6), [resolved, setResolved] = useState<Record<string, MinecraftProjectDetail>>({}), [failed, setFailed] = useState<string[]>([]), [busy, setBusy] = useState(false), [retry, setRetry] = useState(0);
  const known = useRef(resolved); known.current = resolved;
  const visible = version.dependencyRefs.slice(0, limit);
  useEffect(() => {
    const controller = new AbortController(), ids = [...new Set(version.dependencyRefs.slice(0, limit).map(v => v.project).filter(Boolean))].filter(id => !known.current[id]);
    setBusy(!!ids.length); setFailed([]);
    void Promise.allSettled(ids.map(async id => {
      try { const detail = minecraftProject(await minecraftCatalogRequest({ kind: "project", query: id }, controller.signal)); if (detail.id !== id) throw Error("mods_metadata"); if (!controller.signal.aborted) setResolved(current => ({ ...current, [id]: detail })); }
      catch (error) { if (!controller.signal.aborted) setFailed(current => [...current, id]); throw error; }
    })).then(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [version, limit, retry]);
  return <div className="mc-release-dependencies" aria-busy={busy}>
    {visible.map((dependency, index) => {
      const detail = resolved[dependency.project];
      return <div key={`${dependency.project}:${dependency.version}:${index}`} className="mc-release-dependency">
        <GameArt src={detail?.icon || ""} /><div>{detail ? <MinecraftProjectLink url={minecraftProjectUrl(detail, dependency.version)}>{detail.title}</MinecraftProjectLink> : <strong dir="auto">{dependency.filename || (dependency.project && !failed.includes(dependency.project) ? t("common.loading") : t(k("unknownDependency")))}</strong>}{dependency.filename && detail && <small dir="auto">{dependency.filename}</small>}{dependency.version && detail && <small>{t(k("pinned"))}</small>}</div><span>{t(k(dependency.type))}</span>
      </div>;
    })}
    {!!failed.length && <div className="mc-catalog-error" role="alert"><span>{t(k("dependencyError"))}</span><button className="games-button" disabled={busy} onClick={() => setRetry(v => v + 1)}>{t("common.retry")}</button></div>}
    {limit < version.dependencyRefs.length && <button className="games-button" disabled={busy} onClick={() => setLimit(v => v + 6)}>{t(k("moreDependencies"))}</button>}
    {version.dependencyCount > version.dependencyRefs.length && <p>{t(k("dependencyLimit"), { count: version.dependencyRefs.length })} <MinecraftProjectLink url={minecraftProjectUrl(project, version.id)}>{t("games.minecraft.catalog.viewVersion")}</MinecraftProjectLink></p>}
  </div>;
}

function VersionInfo({ version, project }: { version: MinecraftVersion; project: MinecraftProject }) {
  const t = useT(), [expanded, setExpanded] = useState(false);
  return <div className="mc-release-info">
    <div className="mc-release-file"><FileArchive size={18} /><div><span>{t(k("file"))}</span><strong dir="auto">{version.filename || t(k("noFile"))}</strong></div>{version.bytes > 0 && <span dir="ltr">{transferBytes(version.bytes)}</span>}</div>
    <MinecraftProjectLink url={minecraftProjectUrl(project, version.id)}>{t("games.minecraft.catalog.viewVersion")}</MinecraftProjectLink>
    {version.dependencyCount > 0 && <><button className="mc-release-dependency-toggle" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>{t(k("requirements"))}<span>{version.dependencyCount}</span><ChevronDown size={16} /></button>{expanded && <Dependencies version={version} project={project} />}</>}
  </div>;
}

export function MinecraftProjectVersions({ project, versions, selected, choose, game, loader, games, loaders, filter, loading, error, retry, capped }: {
  project: MinecraftProject; versions: MinecraftVersion[] | null; selected: string; choose: (id: string) => void;
  game: string; loader: string; games: string[]; loaders: string[]; filter: (game: string, loader: string) => void; loading: boolean; error: string; retry: () => void; capped: boolean;
}) {
  const t = useT(), [limit, setLimit] = useState(20);
  useEffect(() => { setLimit(Math.max(20, (versions?.findIndex(v => v.id === selected) ?? -1) + 1)); }, [versions]);
  const uniqueGames = [...new Set([game, ...games].filter(Boolean))], uniqueLoaders = [...new Set([loader, ...loaders].filter(Boolean))];
  return <div className="mc-release-browser">
    <div className="mc-release-filters">
      <label><span>{t("games.minecraft.catalog.gameVersion")}</span><select value={game} onChange={e => filter(e.target.value, loader)}><option value="">{t("games.minecraft.catalog.allVersions")}</option>{uniqueGames.map(value => <option key={value}>{value}</option>)}</select></label>
      {uniqueLoaders.length > 0 && <label><span>{t("games.minecraft.catalog.loader")}</span><select value={loader} onChange={e => filter(game, e.target.value)}><option value="">{t("games.minecraft.catalog.allLoaders")}</option>{uniqueLoaders.map(value => <option value={value} key={value}>{minecraftLoaderLabel(value)}</option>)}</select></label>}
    </div>
    {error && <div className="mc-catalog-error" role="alert"><span>{t(error)}</span><button className="games-button" onClick={retry}>{t("common.retry")}</button></div>}
    {loading && <p className="mc-release-status" role="status">{t("common.loading")}</p>}
    {!loading && !error && versions && !versions.length && <p className="mc-release-status">{t("games.minecraft.catalog.noVersion")}</p>}
    <div className="mc-project-versions mc-release-list" aria-busy={loading} inert={loading || !!error}>
      {versions?.slice(0, limit).map(version => <article key={version.id} className={version.id === selected ? "is-selected" : ""}>
        <button className="mc-release-choice" aria-pressed={version.id === selected} onClick={() => choose(version.id)}>
          <span className="mc-release-radio">{version.id === selected && <Check size={13} />}</span><span className="mc-release-identity"><MinecraftVersionIdentity version={version} />{version.date && !Number.isNaN(Date.parse(version.date)) && <small>{new Date(version.date).toLocaleDateString()}</small>}</span>{["release", "beta", "alpha"].includes(version.type) && <span className="mc-release-channel">{t(k(version.type))}</span>}
        </button>
        {version.id === selected && <VersionInfo key={version.id} project={project} version={version} />}
      </article>)}
      {!!versions && versions.length > limit && <button className="games-button" onClick={() => setLimit(v => v + 20)}>{t("games.minecraft.catalog.moreVersions")}</button>}
    </div>
    {capped && <p className="mc-release-status">{t(k("versionLimit"), { count: 500 })}</p>}
  </div>;
}
