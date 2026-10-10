import { HoverTooltip } from "@/components/hover-tooltip";
import type { SteamSaleEvent } from "@/lib/games/steam-events";
import { STEAM_SALE_CARDS_FAQ } from "@/lib/games/steam-events-data";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { GameArt } from "./game-art";

/** Original Harbor stacked-card mark; quiet crossed state is distinct from unknown. */
function SaleCardMark({ state }: { state: "included" | "none" | "unknown" }) {
  return <svg viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <path d="M8 5.5 5.4 5A2 2 0 0 0 3 6.6L.8 19.2a2 2 0 0 0 1.6 2.3l3.1.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <rect x="8" y="3" width="16" height="22" rx="3" fill="currentColor" fillOpacity=".12" stroke="currentColor" strokeWidth="1.5"/>
    {state === "included" ? <><path d="m16 8 1.8 3.2 3.2 1.8-3.2 1.8L16 18l-1.8-3.2L11 13l3.2-1.8L16 8Z" fill="currentColor"/><path d="M12 21h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></> : state === "none" ? <path d="m12 18 8-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/> : <><path d="M13.5 11a2.5 2.5 0 1 1 4.5 1.5c-1 .9-2 1.3-2 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="16" cy="19" r=".9" fill="currentColor"/></>}
  </svg>;
}

export function GameSaleCards({ event }: { event: SteamSaleEvent }) {
  const t = useT(), state = event.cards ? event.cards.available ? "included" : "none" : "unknown";
  const label = t(`games.discovery.sale.cards.${state}`);
  const note = [t(`games.discovery.sale.cards.${state}Note`), state === "included" && event.cards?.badgeRewards ? t("games.discovery.sale.cards.badgeNote") : ""].filter(Boolean).join(" ");
  const url = event.cards?.sourceUrl ?? STEAM_SALE_CARDS_FAQ;
  return <HoverTooltip className="games-sale-card-reward" label={label} sublabel={note} mark={<GameArt className="games-sale-card-source" src="/games/brands/steam.svg"/>} arrow side="top" align="end">
    <a href={url} data-availability={state} aria-label={`${label}. ${note}`} onClick={e => { e.preventDefault(); openUrl(url); }}><SaleCardMark state={state}/><span>{label}</span></a>
  </HoverTooltip>;
}
