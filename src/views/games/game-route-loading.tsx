import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { activeLayout } from "@/lib/theme";
import { useThemePreview } from "@/lib/theme-preview";
import { GameHeroSkeleton, GameSkeleton } from "./game-loading";
import { GameNavigation } from "./game-navigation";
import { GameLibrarySidebarSkeleton } from "./game-library-sidebar-loading";
import "./games.css";
import "./games-editorial.css";
import "./games-discovery-refinement.css";
import "./games-loading.css";
import "./game-library-sidebar.css";
// Shell geometry must load before the lazy Games route, including its navigation swap.
import "./game-harbor-menu.css";

/** The route chunk and its hero data share the same first-paint geometry. */
export function GameRouteLoading() {
  const t = useT();
  const { settings } = useSettings(), preview = useThemePreview();
  const layout = preview?.layout ?? activeLayout(settings.theme);
  const shared = ["sidebar", "nord", "dracula", "forest", "rail"].includes(layout);
  const collapsed = shared ? layout !== "rail" && innerWidth < 1024 || settings.sidebarCollapsed : innerWidth < 850;
  return <div className="games-workspace games-route-loading">
    <GameLibrarySidebarSkeleton collapsed={collapsed}/>
    <main className="games-view" aria-label={t("nav.games")}>
    <div className="games-browser games-browser-home">
      <header className="games-mast games-inset">
        <div className="games-mast-title"><h1>{t("nav.games")}</h1></div>
        <GameNavigation tab="explore" disabled active={false} navigate={() => {}} openHacks={() => {}}/>
        <div className="games-search" aria-hidden="true"><GameSkeleton className="games-skeleton-facts"/></div>
      </header>
      <GameHeroSkeleton failed={false} retry={() => {}}/>
    </div>
  </main></div>;
}
