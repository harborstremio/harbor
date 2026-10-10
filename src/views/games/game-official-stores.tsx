import { ArrowUpRight } from "lucide-react";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import type { OfficialStoreOffer } from "@/lib/games/official-stores";
import { GameArt } from "./game-art";
import "./game-official-download.css";
export function GameOfficialStores({ offers }: { offers: OfficialStoreOffer[] }) {
  const t = useT();
  return <>{offers.map(offer => <a key={offer.name} className="games-official-download" href={offer.url} target="_blank" rel="noreferrer" onClick={event => { event.preventDefault(); void openUrl(offer.url); }}>
    <GameArt src={offer.logo}/><span><strong>{offer.name}</strong><small>{t("games.stores.official")}</small></span>
    {offer.price && <span className="games-card-price">{offer.price.discount > 0 && <span className="games-discount">−{offer.price.discount}%</span>}<span>{offer.price.amount === 0 ? t("games.free") : new Intl.NumberFormat(undefined, { style: "currency", currency: offer.price.currency }).format(offer.price.amount / 100)}</span><small>{t("games.stores.usPrice")}</small></span>}
    <span className="games-official-action">{t(offer.price ? "games.stores.view" : "games.stores.check", { store: offer.name })}<ArrowUpRight size={18}/></span>
  </a>)}</>;
}
