import { ChevronDown } from "lucide-react";
import { useT, useUiLanguage } from "@/lib/i18n";
import type { WowEnhancements, WowEquipment } from "@/lib/games/wow-equipment";
import { GameArt } from "./game-art";
import "./game-wow-equipment.css";

function Enhancements({ title, data }: { title: string; data: WowEnhancements }) {
  const t = useT();
  return <div className="games-wow-enhancements"><h5>{title}</h5>
    {data.items.length > 0 && <ul>{data.items.map((item, index) => <li key={`${item.id}:${index}`}><GameArt src={item.image}/><span dir="auto">{item.name}</span></li>)}</ul>}
    {(!data.complete || !data.items.length) && <p>{t(data.complete ? "games.wow.equipment.none" : "games.wow.equipment.detailsUnavailable")}</p>}
  </div>;
}
export function GameWowEquipment({ equipment }: { equipment: WowEquipment | null }) {
  const t = useT(), language = useUiLanguage();
  if (!equipment) return <p className="games-wow-status" role="status">{t("games.wow.equipment.unavailable")}</p>;
  return <div className="games-wow-equipment">
    <p className="games-wow-equipment-note">{t("games.wow.equipment.note")}</p>
    {equipment.partial && <p className="games-wow-status" role="status">{t("games.wow.equipment.partial")}</p>}
    <div className="games-wow-equipment-grid">{equipment.items.map(item => <details key={item.slot} className="games-wow-equipment-item">
      <summary><GameArt src={item.image}/><span className="games-wow-equipment-name"><small>{t(`games.wow.equipment.${item.slot}`)}</small><strong dir="auto">{item.name}</strong></span><span className="games-wow-equipment-level" aria-label={t("games.wow.equipment.level", { level: item.level?.toLocaleString(language) ?? "—" })}>{item.level?.toLocaleString(language) ?? "—"}</span><ChevronDown size={15}/></summary>
      <div className="games-wow-equipment-details"><Enhancements title={t("games.wow.equipment.gems")} data={item.gems}/><Enhancements title={t("games.wow.equipment.enchants")} data={item.enchants}/></div>
    </details>)}</div>
  </div>;
}
