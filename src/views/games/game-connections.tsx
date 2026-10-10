import { GameHackRelations } from "./game-hack-hub";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import type { AtlasGame, AtlasRoute, GameConnection } from "@/lib/games/igdb-data";
import type { GameSummary } from "@/lib/games/types";
import { GameArt } from "./game-art";
import { PosterShelf } from "./game-ui";
import { GameStoryTimeline } from "./game-story-timeline";
import type { GameMediaTarget } from "@/lib/games/cross-media";

export function GameConnections({ game, browse, open, active, openMedia }: { game: AtlasGame; browse: (route: AtlasRoute) => void; open: (game: GameSummary) => void; active: boolean; openMedia?: (target: GameMediaTarget) => void }) {
  const t = useT();
  const franchises = game.franchises.filter(franchise => !game.series.some(series => series.name.trim().toLowerCase() === franchise.name.trim().toLowerCase()));
  const group = (title: string, items: GameConnection[], kind: AtlasRoute["kind"]) => items.length > 0 && <div className="games-connection-group"><h3>{t(title)}</h3><div>{items.map(item => <button key={item.id} onClick={() => browse({ kind, ...item })}>{kind === "platform" && item.image && <GameArt src={item.image} />}<span>{item.name}</span></button>)}</div></div>;
  return <>
    <GameHackRelations game={game} active={active} browse={browse} open={open}/>
    <section className="games-connections games-section games-inset">
      <div className="games-section-heading"><div><h2>{t("games.atlas.keepExploring")}</h2></div><a href={game.url} target="_blank" rel="noreferrer" onClick={event => { event.preventDefault(); openUrl(game.url); }} aria-label="IGDB"><img className="games-rating-brand games-rating-brand-igdb" src="/games/brands/igdb.svg" alt="IGDB"/></a></div>
      <div className="games-connection-grid">
        {group("games.atlas.series", game.series, "series")}{group("games.atlas.franchise", franchises, "franchise")}
        {group("games.atlas.themes", game.themes, "theme")}{group("games.atlas.genre", game.genres, "genre")}
        {group("games.developer", game.developers, "company")}
      </div>
      <div className="games-connections-context">
        {game.parent && <div className="games-original-link"><button onClick={() => open(game.parent!)}><GameArt src={game.parent.capsule}/><span><small>{t(game.gameType === 5 ? "games.atlas.basedOn" : game.gameType === 8 || game.gameType === 9 ? "games.details.originalGame" : "games.details.parentGame")}</small><strong>{game.parent.name}</strong></span></button></div>}
        <GameStoryTimeline key={game.id} game={game} active={active} openGame={open} openMedia={openMedia}/>
      </div>
    </section>
    {!!game.related.length && <PosterShelf games={game.related} open={open} title={t("games.atlas.related")} note={t("games.atlas.relatedNote")} upcoming={false} compact />}
  </>;
}
