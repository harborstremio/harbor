import { ArrowRight } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { AtlasRoute } from "@/lib/games/igdb-data";
import { WARHAMMER_LOGO, WARHAMMER_WORLD_ART } from "@/lib/games/warhammer-art";
import { GameArt } from "./game-art";
import "./game-warhammer-universe.css";

export function GameWarhammerEntry({ image, browse }: { image?: string; browse: (route: AtlasRoute) => void }) {
  const t = useT();
  return <section className="games-inset wh-entry-wrap"><button className="wh-universe-entry" onClick={() => browse({ kind: "franchise", id: 6, name: "Warhammer 40,000", image })}><GameArt className="wh-entry-art" src={WARHAMMER_WORLD_ART}/><span className="wh-entry-copy"><GameArt className="wh-entry-logo" src={WARHAMMER_LOGO}/><strong>{t("games.warhammerUniverse.entry")}</strong><small>{t("games.warhammerUniverse.entryNote")}</small></span><span className="wh-entry-arrow"><ArrowRight size={27}/></span></button></section>;
}
