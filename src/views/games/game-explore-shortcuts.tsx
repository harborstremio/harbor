import type { RefObject } from "react";
import { useT } from "@/lib/i18n";

const destinations = [
  ["games.discovery.worldsTitle", ".games-franchise-worlds", "worlds"],
  ["games.studios.title", ".games-studios", "studios"],
  ["games.romShowcase.title", ".games-rom-showcase", "rom-hacks"],
  ["games.launchers.explore", ".games-launchers", "launchers"],
  ["games.feed.title", ".games-news-feed", "news"],
  ["games.charts.title", ".games-discovery-desk", "charts"],
] as const;

export function GameExploreShortcuts({scrollRef, hiddenRows = []}:{scrollRef:RefObject<HTMLElement|null>; hiddenRows?: string[]}) {
  const t=useT();
  return <nav className="games-explore-shortcuts games-inset" aria-label={t("games.liveCatalog")}>
    {destinations.filter(([, , id]) => !hiddenRows.includes(id)).map(([label,selector])=><button key={selector} onClick={()=>{
      const section=scrollRef.current?.querySelector<HTMLElement>(selector),heading=section?.querySelector("h2");
      if(!section)return;
      if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}
      section.scrollIntoView({block:"start",behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth"});
    }}>{t(label)}</button>)}
  </nav>;
}
