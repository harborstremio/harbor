import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Download, RefreshCw, Search, X } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { useT } from "@/lib/i18n";
import { useSectionBack } from "@/lib/section-back";
import type { MinecraftContent } from "@/lib/games/minecraft-catalog";
import { curseForgeUrl, type CurseForgeQuery } from "@/lib/games/minecraft-discovery";
import { loadCurseForge } from "@/lib/games/minecraft-discovery-request";
import { useMinecraftDiscovery } from "./use-minecraft-discovery";
import { ModProviderLogo } from "./mod-identity";
import { GameArt } from "./game-art";
import { MinecraftProjectLink } from "./minecraft-project-link";
import { DiscoveryFooter } from "./minecraft-discovery-shared";
import { MinecraftProviderPicks } from "./minecraft-provider-picks";
import "./minecraft-discovery.css";

export function MinecraftCurseForge({ type, query, active, close, embedded = false }: { type: MinecraftContent; query: string; active: boolean; close: () => void; embedded?: boolean }) {
  const t = useT(), [term, setTerm] = useState(query), [search, setSearch] = useState(query);
  const [category, setCategory] = useState(""), [version, setVersion] = useState(""), [loader, setLoader] = useState(""), [sort, setSort] = useState<CurseForgeQuery["sort"]>("downloads");
  const back = useRef<HTMLButtonElement>(null);
  useSectionBack(close, active);
  useEffect(() => { if (!embedded) back.current?.focus({ preventScroll: true }); }, [embedded]);
  useEffect(() => setTerm(query), [query]);
  useEffect(() => { const timer = setTimeout(() => setSearch(term), 250); return () => clearTimeout(timer); }, [term]);
  const filters = { type, query: search, category, version, loader, sort, page: 1 };
  const url = curseForgeUrl(filters);
  const load = useCallback(async (pageUrl: string, signal: AbortSignal, refresh: boolean) => {
    const { data } = await loadCurseForge(pageUrl, signal, refresh);
    const next = new URL(pageUrl); next.searchParams.set("page", String(Number(next.searchParams.get("page") || 1) + 1));
    return { items: data.projects, next: data.next ? next.href : "", meta: data };
  }, []);
  const feed = useMinecraftDiscovery(url, active, load);
  const option = (key: "categories" | "versions" | "loaders", value: string) => {
    const options = feed.meta?.[key] || [];
    return value && !options.some(item => item.value === value) ? [{ value, label: value }, ...options] : options;
  };
  return <section className="mc-discovery mc-curseforge" aria-label="CurseForge">
    {!embedded && <header className="mc-discovery-heading"><div><button ref={back} className="mc-discovery-back" onClick={close}><ArrowLeft size={16}/>{t("common.back")}</button><h2><ModProviderLogo source="CurseForge"/><span>{t(`games.minecraft.catalog.${type}`)}</span></h2></div><label className="mc-catalog-search"><Search size={17}/><input value={term} maxLength={200} onChange={event => setTerm(event.target.value)} placeholder={t("games.minecraft.discovery.searchCurseForge")} aria-label={t("games.minecraft.discovery.searchCurseForge")}/></label></header>}
    <div className="mc-catalog-filters">
      <div><span>{t("games.minecraft.catalog.category")}</span><Dropdown ariaLabel={t("games.minecraft.catalog.category")} value={category} onChange={setCategory} options={[{ value: "", label: t("games.minecraft.catalog.allCategories") }, ...option("categories", category)]}/></div>
      <div><span>{t("games.minecraft.catalog.gameVersion")}</span><Dropdown ariaLabel={t("games.minecraft.catalog.gameVersion")} value={version} onChange={setVersion} options={[{ value: "", label: t("games.minecraft.catalog.allVersions") }, ...option("versions", version)]}/></div>
      {type !== "resourcepack" && <div><span>{t("games.minecraft.catalog.loader")}</span><Dropdown ariaLabel={t("games.minecraft.catalog.loader")} value={loader} onChange={setLoader} options={[{ value: "", label: t("games.minecraft.catalog.allLoaders") }, ...option("loaders", loader)]}/></div>}
      <div className="mc-catalog-sort"><span>{t("games.minecraft.catalog.sort")}</span><Dropdown ariaLabel={t("games.minecraft.catalog.sort")} value={sort} onChange={value => setSort(value as CurseForgeQuery["sort"])} options={[{ value: "downloads", label: t("games.minecraft.catalog.sort.downloads") }, { value: "relevance", label: t("games.minecraft.catalog.sort.relevance") }]}/></div>
    </div>
    <div className="mc-catalog-summary">
      <div>{(category || version || loader || sort !== "downloads") && <button className="mc-catalog-reset" onClick={() => { setCategory(""); setVersion(""); setLoader(""); setSort("downloads"); }}><X size={15}/>{t("games.catalog.reset")}</button>}</div>
      <button className="games-icon-button" disabled={feed.busy} onClick={feed.refresh} aria-label={t("games.feed.refresh")}><RefreshCw size={17}/></button>
    </div>
    {!category && !version && !loader && <MinecraftProviderPicks type={type} query={search}/>}
    <div className="mc-source-list" aria-busy={feed.busy}>{feed.items.map(project => <article className="mc-source-project" key={project.id}>
      <GameArt src={project.icon}/><div className="mc-source-project-copy"><h3><MinecraftProjectLink url={project.url}>{project.name}</MinecraftProjectLink></h3><span>{project.author}</span><p>{project.description}</p><small>{[project.version, project.loader, ...project.categories].filter(Boolean).join(" · ")}</small></div><div className="mc-source-project-meta">{project.downloads && <span title={t("games.minecraft.discovery.downloads")}><Download size={15}/>{project.downloads}</span>}{project.updated && <small>{project.updated}</small>}</div>
    </article>)}</div>
    <DiscoveryFooter feed={feed} unavailable={t(feed.error.includes("blocked") ? "games.minecraft.discovery.curseForgeBlocked" : "games.minecraft.discovery.unavailable")} />
    {!!feed.error && <div className="mc-source-fallback"><MinecraftProjectLink url={url}>{t("games.minecraft.discovery.openSource")}</MinecraftProjectLink></div>}
  </section>;
}
