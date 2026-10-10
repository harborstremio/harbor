import { useState } from "react";
import { Check, Copy, ExternalLink, Search } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { filterKeyShops, keyShopUrl, type KeyShopKind } from "@/lib/games/key-shops";

export function GameKeyShops({ appId, name }: { appId: number; name: string }) {
  const t = useT(), [query, setQuery] = useState(""), [kind, setKind] = useState<KeyShopKind | "all">("all"), [copied, setCopied] = useState(false), [copyFailed, setCopyFailed] = useState(false);
  const shops = filterKeyShops(query, kind);
  return <div className="games-shop-directory">
    <div className="games-shop-context"><div><span>{t("games.shops.shoppingFor")}</span><strong>{name}</strong></div><button className="games-button" onClick={() => { void navigator.clipboard.writeText(name).then(() => { setCopied(true); setCopyFailed(false); }, () => setCopyFailed(true)); }}>{copied ? <Check size={17}/> : <Copy size={17}/>} {t(copied ? "games.shops.copied" : "games.shops.copy")}</button></div>
    {copyFailed && <p role="status">{t("games.shops.copyError")}</p>}
    <div className="games-shop-controls"><label className="games-shop-search"><Search size={20}/><input aria-label={t("games.shops.search")} placeholder={t("games.shops.search")} value={query} maxLength={100} onChange={event => setQuery(event.target.value)}/></label><Dropdown ariaLabel={t("games.shops.type")} value={kind} options={(["all", "keys", "marketplace", "retailer", "comparison"] as const).map(value => ({ value, label: t(`games.shops.kind.${value}`) }))} onChange={value => setKind(value as KeyShopKind | "all")}/></div>
    <p className="games-shop-note">{t("games.shops.note")}</p>
    <div className="games-shop-grid">{shops.map(shop => <a className="games-shop-card" key={shop.id} data-shop={shop.id} href={keyShopUrl(shop, appId)} target="_blank" rel="noreferrer" onClick={event => { event.preventDefault(); openUrl(keyShopUrl(shop, appId)); }}>
      <span className="games-shop-mark">{shop.logo ? <img src={`/games/shops/${shop.logo}`} alt="" loading="lazy"/> : <span aria-hidden="true">{shop.id === "lzt" ? "LZT" : shop.id === "gamivo" ? "G" : shop.id === "loaded" ? "L" : shop.id === "gg" ? "GG" : shop.name}</span>}</span>
      <span className="games-shop-copy"><strong>{shop.name}</strong><small>{t(`games.shops.products.${shop.products}`)}</small><span>{new URL(shop.url).hostname.replace(/^www\./, "")}{shop.id === "loaded" && " · CDKeys"}</span></span><ExternalLink size={17}/>
    </a>)}</div>
    {!shops.length && <p className="games-price-message" role="status">{t("games.shops.empty")}</p>}
  </div>;
}
