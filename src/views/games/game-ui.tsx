import { GameAvailabilityBadge } from "./game-availability";
import { Row } from "@/components/row";
import { GameDestinationIcon } from "@/components/icons/game-destination-icon";
import { Play } from "@/components/icons/play-filled";
import { useT, useUiLanguage } from "@/lib/i18n";
import type { GameSummary } from "@/lib/games/types";
import { recommendationPlatformNames } from "@/lib/games/recommendations";
import { GameArt } from "./game-art";
import { GamePosterSave } from "./game-poster-save";
import { GameCatalogRating } from "./game-discovery-ratings";
import "./game-rails.css";
import { GamePosterSkeletons } from "./game-loading";

export type GameMarkKind = "pick" | "worlds" | "runs" | "create" | "chart" | "release" | "offer" | "soon" | "filter";

/** Original Harbor collection stamps; no storefront icon assets. */
export function GameMark({ kind, size = 20 }: { kind: GameMarkKind; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === "filter" && <><path d="M4 7h16m6 0h2M4 16h3m6 0h15M4 25h13m6 0h5" /><circle cx="23" cy="7" r="3" /><circle cx="10" cy="16" r="3" /><circle cx="20" cy="25" r="3" /></>}
    {kind === "pick" && <><path d="m16 3 3.7 8.5L29 16l-9.3 4.5L16 29l-3.7-8.5L3 16l9.3-4.5Z" /><path d="m16 10 2 6-2 6-2-6Z" /></>}
    {kind === "worlds" && <><path d="M4 25h24M7 25V13l5-5 5 5v12M17 25V9l5-6 5 6v16M10 15h4M21 11h3M20 17h4M11 25v-5h3v5" /><path d="m3 5 1-2 1 2M3 5H1" /></>}
    {kind === "runs" && <><path d="m17 3-9 14h7l-1 12L25 13h-8Z" /><path d="M4 8h6M2 13h5M23 23h6M21 28h5" /></>}
    {kind === "create" && <><path d="m16 3 12 7-12 7L4 10l12-7ZM4 10v13l12 7 12-7V10M16 17v13M10 7l12 7" /><path d="M21 4v6M18 7h6" /></>}
    {kind === "chart" && <><path d="M5 27V16h5v11M14 27V9h5v18M23 27V3h5v24M3 27h27" /></>}
    {kind === "release" && <><path d="M16 3v5M16 24v5M3 16h5M24 16h5M7 7l3 3M22 22l3 3M25 7l-3 3M10 22l-3 3" /><path d="m16 10 6 6-6 6-6-6Z" /></>}
    {kind === "offer" && <><path d="M4 7h15l10 10-12 12L4 16V7Z" /><circle cx="10" cy="13" r="1.5" /><path d="m16 13 7 7M16 20l7-7" /></>}
    {kind === "soon" && <><path d="M7 3v5M25 3v5M3 12h26M6 6h20a3 3 0 0 1 3 3v17a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3Z" /><path d="M10 20h12m-4-4 4 4-4 4" /></>}
  </svg>;
}

export function GamePrice({ game }: { game: GameSummary }) {
  const t = useT();
  if (!game.price || game.cachedAt !== undefined) return null;
  return <span className="games-card-price">
    {game.price.discount > 0 && <span className="games-discount">−{game.price.discount}%</span>}
    <span>{game.price.amount === 0 ? t("games.free") : new Intl.NumberFormat(undefined, { style: "currency", currency: game.price.currency }).format(game.price.amount / 100)}</span>
  </span>;
}

export function GameCard({ game, open, portrait = false, posterInset = false, showRelease = false, descriptionId, compactPlatforms = false, catalogRating }: { game: GameSummary; open: (game: GameSummary) => void; portrait?: boolean; posterInset?: boolean; showRelease?: boolean; descriptionId?: string; compactPlatforms?: boolean; catalogRating?: { score?: number; count: number } }) {
  const language=useUiLanguage(), t=useT();
  const platforms=compactPlatforms?recommendationPlatformNames(game):game.platforms;
  const platformCaption=compactPlatforms?`${platforms.slice(0,2).join(" · ")}${platforms.length>2?` +${(platforms.length-2).toLocaleString(language)}`:""}`:platforms.join(" · ");
  const release=showRelease&&game.releaseTimestamp?new Date(game.releaseTimestamp*1000).toLocaleDateString(language,{month:"short",day:"numeric",year:"numeric"}):null;
  return <div className={`games-card games-save-card${portrait ? " games-poster" : ""}`}><button className="games-card-open" onClick={() => open(game)} data-game={game.id} aria-describedby={descriptionId}>
    <div className={`games-card-art${portrait && !game.portrait ? " games-no-portrait" : ""}`}>
      <GameArt src={portrait ? game.portrait ?? game.capsule : game.capsule} fallback={game.capsule} />
      {posterInset && !portrait && game.portrait && <span className="games-search-poster-inset" aria-hidden="true"><GameArt src={game.portrait}/></span>}
      {(game.gameType === 5 || game.gameType === 15) && <span className="games-card-kind"><GameDestinationIcon name="mods" size={14}/>{t(game.gameType === 5 ? "games.atlas.mod" : "games.atlas.kind.hacks")}</span>}
      <GameAvailabilityBadge game={game}/><span className="games-card-enter"><Play size={20} /></span>
    </div>
    <div className="games-card-caption"><h3>{game.name}</h3><span title={platforms.join(" · ")}>{release??platformCaption}</span></div>
  </button>{catalogRating ? <div className="games-card-overlays"><GamePosterSave game={game}/><GameCatalogRating {...catalogRating} open={()=>open(game)}/></div> : <GamePosterSave game={game}/>}</div>;
}

/** Use the same rail navigation and saved position as Harbor's media shelves. */
export function PosterShelf({ games, open, title, note, upcoming = true, loading = false, compact = false }: { games: GameSummary[]; open: (game: GameSummary) => void; title: string; note: string; upcoming?: boolean; loading?: boolean; compact?: boolean }) {
  const t = useT();
  if (!games.length && !loading) return null;
  return <section className={`games-section games-inset games-poster-section${compact?" games-related-shelf":""}`}>
    <div className="games-section-heading"><div><div className="games-section-kicker"><GameMark kind={upcoming ? "soon" : "worlds"} />{t(upcoming ? "games.onTheHorizon" : "games.atlas.connected")}</div><h2>{title}</h2><p>{note}</p></div>
    </div>
    {loading&&!games.length&&<GamePosterSkeletons/>}
    <Row className="games-content-rail" min={144} shape="portrait" scrollKey={`games:shelf:${title}:${games[0]?.id??"empty"}`}>
      {games.map(game => <GameCard key={game.id} game={game} open={open} portrait showRelease={upcoming} compactPlatforms={compact} />)}
    </Row>
  </section>;
}
