import { Search, X } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { useT } from "@/lib/i18n";
import { ATLAS_GENRES, DEFAULT_ATLAS_FILTERS, type AtlasFilters } from "@/lib/games/igdb-data";
import { GAME_PLATFORMS } from "@/lib/games/platforms";
import "./game-studio-catalog.css";

const platformOrder = [6, 167, 48, 169, 49, 508, 130, 14, 3];
const platforms = [...GAME_PLATFORMS].sort((a, b) => {
  const rank = (id: number) => platformOrder.includes(id) ? platformOrder.indexOf(id) : platformOrder.length;
  return rank(a.id) - rank(b.id) || a.name.localeCompare(b.name);
});

export function GameStudioCatalogFilters({ filters, setFilters }: { filters: AtlasFilters; setFilters: (filters: AtlasFilters) => void }) {
  const t = useT();
  const changed = filters.query || filters.sort !== "discussed" || filters.era !== "all" || filters.platform !== undefined || filters.genre !== undefined || filters.minimumRating !== undefined || filters.minimumVotes !== undefined;
  const selectNumber = (key: "platform" | "genre" | "minimumRating" | "minimumVotes", value: string) => setFilters({ ...filters, [key]: value === "all" ? undefined : Number(value) });
  const numberOptions = (key: "minimumRating" | "minimumVotes", values: number[]) => [
    { value: "all", label: t(`games.studioCatalog.${key}.all`) },
    ...values.map(value => ({ value: String(value), label: t(`games.studioCatalog.${key}.value`, { count: value }) })),
  ];
  return <div className="games-studio-catalog-filters">
    <div className="games-studio-catalog-search">
      <div className="games-search"><Search size={17}/><input value={filters.query} onChange={event => setFilters({ ...filters, query: event.target.value })} placeholder={t("games.atlas.search")} aria-label={t("games.atlas.search")}/>{filters.query && <button className="games-icon-button" aria-label={t("games.clear")} onClick={() => setFilters({ ...filters, query: "" })}><X size={16}/></button>}</div>
      <Dropdown ariaLabel={t("games.catalog.sort")} value={filters.sort} onChange={sort => setFilters({ ...filters, sort: sort as AtlasFilters["sort"] })} options={["discussed", "rated", "newest", "oldest"].map(value => ({ value, label: t(`games.atlas.sort.${value}`) }))}/>
    </div>
    <div className="games-studio-catalog-options">
      <Dropdown ariaLabel={t("games.platforms")} value={String(filters.platform ?? "all")} onChange={value => selectNumber("platform", value)} options={[{ value: "all", label: t("games.recommend.allPlatforms") }, ...platforms.map(platform => ({ value: String(platform.id), label: platform.short }))]}/>
      <Dropdown ariaLabel={t("games.studioCatalog.genres")} value={String(filters.genre ?? "all")} onChange={value => selectNumber("genre", value)} options={[{ value: "all", label: t("games.studioCatalog.genres") }, ...ATLAS_GENRES.map(genre => ({ value: String(genre.id), label: t(genre.key) }))]}/>
      <Dropdown ariaLabel={t("games.atlas.era")} value={filters.era} onChange={era => setFilters({ ...filters, era: era as AtlasFilters["era"] })} options={["all", "before1990", "1990", "2000", "2010", "2020"].map(value => ({ value, label: t(`games.atlas.era.${value}`) }))}/>
      <Dropdown ariaLabel={t("games.studioCatalog.minimumRating")} value={String(filters.minimumRating ?? "all")} onChange={value => selectNumber("minimumRating", value)} options={numberOptions("minimumRating", [50, 70, 80, 90])}/>
      <Dropdown ariaLabel={t("games.studioCatalog.minimumVotes")} value={String(filters.minimumVotes ?? "all")} onChange={value => selectNumber("minimumVotes", value)} options={numberOptions("minimumVotes", [5, 25, 100, 500])}/>
    </div>
    {changed && <div className="games-studio-catalog-filter-note"><span>{(filters.sort === "rated" || filters.minimumRating !== undefined) && t("games.studioCatalog.ratingFloor")}</span><button className="games-text-action" onClick={() => setFilters(DEFAULT_ATLAS_FILTERS)}><X size={14}/>{t("games.catalog.reset")}</button></div>}
  </div>;
}
