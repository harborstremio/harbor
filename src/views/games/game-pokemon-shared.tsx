import { RefreshCw } from "lucide-react";
import { useT } from "@/lib/i18n";
export function PokemonStatus({ feed, layout = "dex" }: { feed: { busy: boolean; failed: boolean; retry: () => void }; layout?: "dex" | "reader" | "species" | "maps" | "videos" | "locations" | "bank" | "editor" | "collection" }) {
  const t = useT();
  if (feed.failed) return <div className="pokemon-status" role="status"><p>{t("games.pokemon.unavailable")}</p><button onClick={feed.retry}><RefreshCw size={18}/>{t("common.retry")}</button></div>;
  if (!feed.busy) return null;
  if (layout === "bank") return <div className="pokemon-skeleton pokemon-skeleton-bank" aria-label={t("common.loading")} role="status"><div aria-hidden="true">{Array.from({length:30},(_,i)=><span key={i}/>)}</div><div aria-hidden="true"><i/><b/><b/><span/><b/><b/></div></div>;
  if (layout === "editor") return <div className="pokemon-skeleton pokemon-skeleton-editor" aria-label={t("common.loading")} role="status"><div aria-hidden="true"><span/><i/><b/><b/><b/></div></div>;
  if (layout === "reader") return <div className="pokemon-skeleton pokemon-skeleton-reader" aria-label={t("common.loading")} role="status"><div aria-hidden="true"><i/><b/><b/><b/><span/><b/><b/><b/></div></div>;
  if (layout === "species") return <div className="pokemon-skeleton pokemon-skeleton-species" aria-label={t("common.loading")} role="status"><div aria-hidden="true"><span/><div><i/><b/><b/><b/></div></div><div aria-hidden="true"><b/><b/><b/></div></div>;
  return <div className={`pokemon-skeleton pokemon-skeleton-${layout}`} aria-label={t("common.loading")} role="status">{Array.from({ length: layout === "dex" ? 24 : 6 }, (_, i) => <div key={i} aria-hidden="true"><span/><b/><i/></div>)}</div>;
}
