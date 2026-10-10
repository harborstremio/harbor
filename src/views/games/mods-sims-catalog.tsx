import { ModProviderLogo } from "./mod-identity";
import { useEffect, useMemo, useState } from "react";
import { Dropdown } from "@/components/dropdown";
import { GameSimsCurseForge } from "./game-sims-curseforge";
import type { SimsMtsProject } from "@/lib/games/sims";
import { useT } from "@/lib/i18n";
import { GameSimsMts } from "./game-sims-mts";
import { ModsIcon, ModsTabs } from "./mod-workspace-parts";
import "./game-sims-companion.css";

export function ModsSimsCatalog({ game, profile, active, query, project }: { game: 2 | 3; profile: string; active: boolean; query: string; project?: SimsMtsProject }) {
  const t = useT();
  const [controls, setControls] = useState<HTMLSpanElement | null>(null);
  const [source, setSource] = useState("mts");
  useEffect(() => { if (project) setSource("mts"); }, [project]);
  const request = useMemo(() => project ? { id: `${game}:${project.id}`, page: project.page, project, trigger: document.activeElement as HTMLElement } : null, [game, project?.id]);
  return <section className="games-sims games-inset">
    <ModsTabs label={t("games.modHub.title")}><button aria-current="page"><ModsIcon name="browse" size={24}/>{t("games.modHub.browse")}</button><span className="sims-browse-controls" ref={setControls}/>{game === 2 ? <span className="sims-source-picker"><Dropdown ariaLabel={t("games.modHub.source")} value={source} onChange={setSource} options={[{ value: "mts", label: "Mod The Sims", left: <ModProviderLogo source="Mod The Sims" iconOnly/> }, { value: "curseforge", label: "CurseForge", left: <ModProviderLogo source="CurseForge" iconOnly/> }]}/></span> : <span className="mods-source-label"><ModProviderLogo source="Mod The Sims"/></span>}</ModsTabs>
    <div hidden={source !== "mts"}><GameSimsMts game={game} workspace toolbarTarget={source === "mts" ? controls : null} profile={profile} active={active && source === "mts"} query={query} request={request} data={null} disabled choose={() => {}}/></div>
    {game === 2 && <div hidden={source !== "curseforge"}><GameSimsCurseForge game={2} active={active && source === "curseforge"} query={query} toolbarTarget={controls}/></div>}
  </section>;
}
