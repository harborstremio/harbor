import { useT } from "@/lib/i18n";
import { GameSkeleton } from "./game-loading";
import "./game-library-sidebar-loading.css";

/** Uses the loaded sidebar's row boxes so resolving data never changes the column. */
export function GameLibrarySidebarRowsSkeleton() {
  const t = useT();
  return <>
    <span className="sr-only" role="status">{t("common.loading")}</span>
    <div className="games-library-side-skeleton" aria-hidden="true">
      <div className="games-library-side-group"><GameSkeleton className="games-library-skeleton-heading"/></div>
      {Array.from({ length: 20 }, (_, index) => <div className="games-library-side-row" key={index}><div className="games-library-side-game">
        <GameSkeleton className="games-art-empty games-library-skeleton-art"/>
        <span className="games-library-skeleton-name"><GameSkeleton/></span>
      </div></div>)}
    </div>
  </>;
}

/** First paint while the Games route itself is still loading. */
export function GameLibrarySidebarSkeleton({ collapsed }: { collapsed: boolean }) {
  const t = useT();
  return <aside className={`games-library-sidebar games-library-sidebar-loading${collapsed ? " is-collapsed" : ""}`} aria-label={t("games.dock.title")} aria-busy="true">
    <header aria-hidden="true">
      <div><div className="games-library-home"><GameSkeleton className="games-library-skeleton-mark"/></div></div>
      <div className="games-library-collapse"><GameSkeleton className="games-library-skeleton-mark"/></div>
    </header>
    <div className="games-library-destinations" aria-hidden="true">{[0, 1].map(index => <button key={index} disabled tabIndex={-1}><GameSkeleton className="games-library-skeleton-mark"/><span><GameSkeleton className="games-library-skeleton-label"/></span></button>)}</div>
    <div className="games-library-side-controls" aria-hidden="true">
      {!collapsed && <div className="games-library-section"><button disabled tabIndex={-1}><GameSkeleton className="games-library-skeleton-mark"/><GameSkeleton className="games-library-skeleton-label"/></button></div>}
      <div className="games-library-side-search"><GameSkeleton className="games-library-skeleton-search"/>{!collapsed && <GameSkeleton className="games-library-skeleton-label"/>}</div>
      {!collapsed && <div className="games-library-side-filters"><button disabled tabIndex={-1}><GameSkeleton className="games-library-skeleton-search"/></button><button disabled tabIndex={-1}><GameSkeleton className="games-library-skeleton-search"/></button><span><GameSkeleton className="games-library-skeleton-count"/></span><button disabled tabIndex={-1}><GameSkeleton className="games-library-skeleton-search"/></button></div>}
    </div>
    <div className="games-library-side-list" data-loading><GameLibrarySidebarRowsSkeleton/></div>
  </aside>;
}
