import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { RefreshCw } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { loadSimsCurseForge, simsCurseForgeCard, simsCurseForgeUrl, type SimsCurseForgeGame } from "@/lib/games/sims-curseforge";
import { useMinecraftDiscovery } from "./use-minecraft-discovery";
import { DiscoveryFooter } from "./minecraft-discovery-shared";
import { MinecraftProjectLink } from "./minecraft-project-link";
import { ModViewToggle, useModCatalogView } from "./mod-view-toggle";
import { SimsDiscoveryLoading, SimsDiscoveryProject } from "./game-sims-discovery";
import "./minecraft-discovery.css";

export function GameSimsCurseForge({ game, active, query, toolbarTarget }: { game: SimsCurseForgeGame; active: boolean; query: string; toolbarTarget?: HTMLElement | null }) {
  const t = useT(), [search, setSearch] = useState(query);
  const [category, setCategory] = useState(""), [kind, setKind] = useState(""), [sort, setSort] = useState("total downloads");
  const [view, setView] = useModCatalogView(`sims${game}`, "list");
  useEffect(() => { const timer = setTimeout(() => setSearch(query), 250); return () => clearTimeout(timer); }, [query]);
  const url = simsCurseForgeUrl(game, search, category, kind, sort);
  const load = useCallback(async (pageUrl: string, signal: AbortSignal, refresh: boolean) => {
    const { data } = await loadSimsCurseForge(pageUrl, signal, refresh);
    const next = new URL(pageUrl); next.searchParams.set("page", String(Number(next.searchParams.get("page") || 1) + 1));
    return { items: data.projects, next: data.next ? next.href : "", meta: data };
  }, []);
  const feed = useMinecraftDiscovery(url, active, load, false);
  const [options, setOptions] = useState<{ classes: { value: string; label: string }[]; categories: { value: string; label: string }[] }>({ classes: [], categories: [] });
  useEffect(() => { if (feed.meta) setOptions({ classes: feed.meta.classes ?? [], categories: feed.meta.categories }); }, [feed.meta]);
  const sorts = [{ value: "total downloads", label: t("games.sims.mtsPopular") }, { value: "latest update", label: t("games.sims.mtsUpdated") }, { value: "creation date", label: t("games.sims.mtsNewest") }, { value: "relevancy", label: t("games.minecraft.catalog.sort.relevance") }];
  const controls = <div className="sims-catalog-controls">
    <Dropdown ariaLabel={t("games.sims.mtsSort")} value={sort} options={sorts} onChange={setSort}/>
    <Dropdown ariaLabel={t("games.minecraft.catalog.content")} value={kind} options={[{ value: "", label: t("games.sims.mtsCatAll") }, ...options.classes]} onChange={value => { setKind(value); setCategory(""); }}/>
    {!!options.categories.length && <Dropdown ariaLabel={t("games.sims.mtsCategory")} value={category} options={[{ value: "", label: t("games.minecraft.catalog.allCategories") }, ...options.categories]} onChange={setCategory}/>}
  </div>;
  return <section className={`games-sims-mts-browser sims-curseforge is-discovery is-${view}`} aria-label="CurseForge">
    {active && (toolbarTarget ? createPortal(controls, toolbarTarget) : controls)}
    <div className="games-sims-mts-results-head"><div><h3>{search ? t("games.sims.mtsSearch") : sorts.find(option => option.value === sort)?.label}</h3><MinecraftProjectLink url={url}>CurseForge</MinecraftProjectLink></div><div className="mod-catalog-actions"><ModViewToggle value={view} change={setView}/><button className="games-icon-button" disabled={feed.busy || !active} aria-label={t("games.feed.refresh")} onClick={feed.refresh}><RefreshCw size={19}/></button></div></div>
    <div className="games-sims-mts-grid" aria-busy={feed.busy}>{feed.items.map(project => <SimsDiscoveryProject key={project.id} source="CurseForge" project={simsCurseForgeCard(project, game)} disabled={!active} open={() => openUrl(project.url)}/>)}</div>
    {feed.busy && !feed.items.length && <SimsDiscoveryLoading/>}
    {(!feed.busy || feed.items.length > 0) && <DiscoveryFooter feed={feed} unavailable={t(feed.error.includes("blocked") ? "games.minecraft.discovery.curseForgeBlocked" : "games.minecraft.discovery.unavailable")}/>}
    {!!feed.error && <MinecraftProjectLink url={url}>{t("games.minecraft.discovery.openSource")}</MinecraftProjectLink>}
  </section>;
}

