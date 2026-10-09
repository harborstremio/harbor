import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUp, Pause } from "lucide-react";
import { createPortal } from "react-dom";
import { Play } from "@/components/icons/play-filled";
import { Row } from "@/components/row";
import { useT } from "@/lib/i18n";
import type { AtlasGame, AtlasRoute } from "@/lib/games/igdb-data";
import type { GameSummary } from "@/lib/games/types";
import { GAME_PLATFORMS } from "@/lib/games/platforms";
import { ROM_PLATFORMS } from "@/lib/games/rom-discovery";
import { GameHeroLogo } from "./game-hero-logo";
import { GamePosterSave } from "./game-poster-save";
import { GameCatalogRating, RatingMark } from "./game-discovery-ratings";
import { GameConsoleMark } from "./game-console-mark";
import { GameSkeleton } from "./game-loading";
import { useHeroMotion } from "./use-hero-motion";
import "./game-atlas-discovery.css";

const EMPTY_SOURCES: string[] = [];
const scene = (game: AtlasGame) => game.screenshots[0] || (game.hero !== game.portrait ? game.hero : "");

/** Uses the existing page response. Only the current and next feature load large artwork. */
export function GameAtlasHero({ games, active, loading, open }: { games: AtlasGame[]; active: boolean; loading: boolean; open: (game: GameSummary) => void }) {
  const t = useT(), [selected, setSelected] = useState(""), [motion, setMotion] = useState(true), [hovered, setHovered] = useState(false);
  const candidates = games.filter(game => !!scene(game)).slice(0, 5);
  const target = candidates.find(item => item.id === selected) ?? candidates[0];
  const { root, playing, reduced, visible } = useHeroMotion(active, !!target, motion);
  const [art, setArt] = useState({ id: "", src: "", previous: "" });
  const artRef = useRef(art); artRef.current = art;
  // Keep the controls and copy with the displayed artwork until the next scene is decoded.
  const game = candidates.find(item => item.id === art.id) ?? target;
  const index = candidates.findIndex(item => item.id === target?.id), identity = candidates.map(item => item.id).join(",");
  useEffect(() => {
    if (!active || !target || artRef.current.id === target.id) return;
    let live = true; const image = new Image(), src = scene(target);
    image.src = src;
    void image.decode().then(() => { if (live) setArt(previous => ({ id: target.id, src, previous: previous.src })); }, () => { if (live) setArt({ id: target.id, src: "", previous: "" }); });
    return () => { live = false; image.src = ""; };
  }, [target?.id, target && scene(target), active]);
  useEffect(() => {
    if (!playing || !game || candidates.length < 2) return;
    const image = new Image(); image.src = scene(candidates[(index + 1) % candidates.length]);
    return () => { image.src = ""; };
  }, [playing, game?.id, identity]);
  useEffect(() => {
    if (!playing || hovered || !target || art.id !== target.id || candidates.length < 2) return;
    const timer = setTimeout(() => {
      if (!root.current?.matches(":hover") && !root.current?.contains(document.activeElement)) setSelected(candidates[(index + 1) % candidates.length].id);
    }, 9_000);
    return () => clearTimeout(timer);
  }, [playing, hovered, target?.id, identity, art.id]);
  const choose = (next: number) => { setMotion(false); setSelected(candidates[(next + candidates.length) % candidates.length].id); };
  return <section ref={root} className={`games-atlas-hero${!game && !loading ? " is-empty" : ""}`} aria-label={t("games.atlas.title")} onPointerEnter={event => { if (event.pointerType !== "touch") setHovered(true); }} onPointerLeave={() => setHovered(false)} onFocusCapture={event => { if (event.target.matches(":focus-visible")) setMotion(false); }}>
    <div className="games-atlas-hero-art" aria-hidden="true">{art.previous && <img src={art.previous} alt=""/>}{art.src && <img key={art.src} className="is-current" src={art.src} alt=""/>}</div>
    <div className="games-atlas-hero-shade"/>
    <div className="games-atlas-hero-copy">
      <h1 tabIndex={-1}>{t("games.atlas.title")}</h1>
      {game ? <div key={game.id} className="games-atlas-feature" data-featured-game={game.id}>
        <div className="games-atlas-feature-identity"><GameHeroLogo key={game.id} className="games-atlas-feature-logo" sources={EMPTY_SOURCES} name={game.name} steamId={game.steamId} platformIds={game.platformLinks.map(platform => platform.id)} gameType={game.gameType} ready active={active && visible}/><h2>{game.name}</h2></div>
        <div className="games-atlas-feature-facts">{game.release && <span>{new Date(game.release * 1000).getUTCFullYear()}</span>}<span>{game.platforms.slice(0, 2).join(" · ")}</span></div>
        <p>{game.description || t("games.atlas.description")}</p>
        <div className="games-atlas-feature-actions"><button className="games-button games-button-primary" data-game={game.id} onClick={() => open(game)}><Play size={22}/>{t("games.discovery.viewGame")}</button><GamePosterSave game={game}/>{game.rating !== undefined && game.ratingCount > 0 && <div className="games-atlas-feature-score"><RatingMark source="igdb-users"/><GameCatalogRating score={game.rating} count={game.ratingCount} open={() => open(game)}/></div>}</div>
      </div> : loading ? <div className="games-atlas-feature" aria-busy="true"><GameSkeleton className="games-skeleton-logo"/><GameSkeleton className="games-skeleton-title"/><GameSkeleton className="games-skeleton-meta"/></div> : <p>{t("games.atlas.description")}</p>}
    </div>
    {candidates.length > 1 && <footer className="games-atlas-hero-controls">
      <div className="games-atlas-hero-selectors">{candidates.map((item, i) => <button key={item.id} aria-label={item.name} aria-pressed={item.id === game?.id} onClick={() => choose(i)}><span>{String(i + 1).padStart(2, "0")}</span><i/></button>)}</div>
      <div className="games-atlas-hero-transport"><button aria-label={t("Previous")} onClick={() => choose(index - 1)}><ArrowLeft size={20}/></button>{!reduced && <button aria-label={t(motion ? "games.hero.pauseMotion" : "games.hero.playMotion")} aria-pressed={motion} onClick={() => setMotion(value => !value)}>{motion ? <Pause size={18}/> : <Play size={18}/>}</button>}<button aria-label={t("Next")} onClick={() => choose(index + 1)}><ArrowRight size={20}/></button></div>
    </footer>}
  </section>;
}

export function GameAtlasPlatforms({ browse }: { browse: (route: AtlasRoute) => void }) {
  const t = useT();
  return <section className="games-atlas-platforms"><div className="games-section-heading"><h2>{t("games.platforms")}</h2></div>
    <Row className="games-content-rail games-atlas-platform-rail" min={132} shape="tile" scrollKey="games:atlas:platforms">
      {GAME_PLATFORMS.map(platform => <button key={platform.id} className="games-atlas-platform" data-platform={platform.id} aria-label={platform.name} onClick={() => browse({ kind: "platform", ...platform })}><GameConsoleMark platform={ROM_PLATFORMS.find(item => item.id === platform.id) ?? platform}/><span>{platform.short}<ArrowRight size={16}/></span></button>)}
    </Row>
  </section>;
}

/** Binds to the Games scroller even before catalog results make it overflow. */
export function GameAtlasScrollTop({ active }: { active: boolean }) {
  const t = useT(), marker = useRef<HTMLSpanElement>(null), [shown, setShown] = useState(false);
  useEffect(() => {
    const scroller = marker.current?.closest<HTMLElement>(".games-view");
    if (!active || !scroller) { setShown(false); return; }
    const scroll = () => setShown(scroller.scrollTop > 600);
    scroll(); scroller.addEventListener("scroll", scroll, { passive: true });
    return () => scroller.removeEventListener("scroll", scroll);
  }, [active]);
  return <><span ref={marker} hidden/>{active && shown && createPortal(<button className="games-atlas-top" aria-label={t("chrome.backToTop")} title={t("chrome.backToTop")} onClick={() => {
    const scroller = marker.current?.closest<HTMLElement>(".games-view");
    scroller?.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    marker.current?.closest("article")?.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
  }}><ArrowUp size={21}/></button>, document.body)}</>;
}
