import type { SimsInstallation } from "@/lib/games/sims-installations";
import { MOD_GAMES, type ModsRoute } from "@/lib/games/mod-workspace";
import { ModsGameHeader } from "./mods-game-header";
import { ModsHome } from "./mods-home";
import { deferredGameView } from "./game-deferred";
import "./mods-workspace.css";
import "./mod-project-page.css";

const Minecraft = deferredGameView(async () => ({ default: (await import("./game-minecraft")).GameMinecraft }));
const Sims = deferredGameView(async () => ({ default: (await import("./game-sims-companion")).GameSimsCompanion }));
const SimsCatalog = deferredGameView(async () => ({ default: (await import("./mods-sims-catalog")).ModsSimsCatalog }));

export function ModsWorkspace({ route, active, profile, query, navigate, installations }: { route: ModsRoute; active: boolean; profile: string; query: string; navigate: (route: ModsRoute, origin?: HTMLElement) => void; installations: SimsInstallation[] }) {
  const game = MOD_GAMES.find(value => value.id === route.game);
  return <div className="mods-workspace" data-mod-game={route.game ?? "home"}>
    <div hidden={!!route.game}><ModsHome profile={profile} active={active && !route.game} query={query} navigate={navigate}/></div>
    {game && <ModsGameHeader game={game.id} active={active} change={(game, origin) => navigate({ game }, origin)}/>}
    <div hidden={route.game !== "minecraft"}>{route.game === "minecraft" && <Minecraft profile={profile} query={query} active={active} workspace requested={route.project}/>}</div>
    <div hidden={route.game !== "sims4"}>{route.game === "sims4" && <Sims profile={profile} globalQuery={query} active={active} installations={installations} workspace requested={route.project}/>}</div>
    {(route.game === "sims2" || route.game === "sims3") && <SimsCatalog key={route.game} game={route.game === "sims2" ? 2 : 3} profile={profile} active={active} query={query} project={route.project}/>}
  </div>;
}
