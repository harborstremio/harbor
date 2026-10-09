import { useHeroShuffle } from "./use-hero-shuffle";
import { NavArrow } from "@/components/nav-arrow";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Heart } from "lucide-react";
import { HoverTooltip } from "@/components/hover-tooltip";
import { UiIcon } from "@/components/ui-icon";
import { Play } from "@/components/icons/play-filled";
import { useT } from "@/lib/i18n";
import { romGameArtwork } from "@/lib/games/rom-editorial";
import { romConsoleNames, romPreview } from "@/lib/games/rom-presentation";
import { detailEditionTarget } from "@/lib/games/detail-edition";
import type { AtlasGame } from "@/lib/games/igdb-data";
import type { GameSummary } from "@/lib/games/types";
import { GameHeroLogo } from "./game-hero-logo";
import { GameArt } from "./game-art";
import { GameSkeleton } from "./game-loading";
import { useGameAccess } from "./game-access";
import { useHackVideo } from "./game-hack-video";

const scene = (game: AtlasGame) => game.hero || game.screenshots[0] || game.capsule;
const HERO_INDICATOR_LIMIT = 5;
const decoded = new Map<string, Promise<boolean>>();
function prepare(src: string) {
  if (!decoded.has(src)) {
    const image = new Image(); image.src = src;
    decoded.set(src, image.decode().then(() => true, () => false));
    if (decoded.size > 60) decoded.delete(decoded.keys().next().value!);
  }
  return decoded.get(src)!;
}

export function RomHero({ games: candidates, active, busy, failed, retry, browse, open, platform, score }: {
  games: AtlasGame[]; active: boolean; busy: boolean; failed: boolean; retry: () => void; browse: () => void;
  open: (game: GameSummary) => void; platform?: number; score: (game: AtlasGame) => ReactNode;
}) {
  const games = useHeroShuffle(candidates, active);
  const t = useT(), { saved, save } = useGameAccess(), watch = useHackVideo(), root = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(0), [shown, setShown] = useState<AtlasGame>(), [previous, setPrevious] = useState<AtlasGame>();
  const [hover, setHover] = useState(false), [focused, setFocused] = useState(false), [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(false), [foreground, setForeground] = useState(!document.hidden);
  const selection = games[Math.min(index, games.length - 1)], ids = games.map(game => game.igdbId).join(",");
  useEffect(() => setIndex(0), [platform, active]);
  useEffect(() => setIndex(value => Math.min(value, Math.max(0, games.length - 1))), [ids]);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)"), update = () => setReduced(media.matches), visibility = () => setForeground(!document.hidden);
    update(); media.addEventListener("change", update); document.addEventListener("visibilitychange", visibility);
    const observer = new IntersectionObserver(entries => setVisible(entries.some(entry => entry.isIntersecting)));
    if (root.current) observer.observe(root.current);
    return () => { media.removeEventListener("change", update); document.removeEventListener("visibilitychange", visibility); observer.disconnect(); };
  }, []);
  useEffect(() => {
    if (!active || !selection) return;
    let current = true;
    void prepare(scene(selection)).then(() => {
      if (current) { setPrevious(shown?.id !== selection.id ? shown : undefined); setShown(selection); }
    });
    const next = games[(index + 1) % games.length]; if (next) void prepare(scene(next));
    return () => { current = false; };
  }, [active, selection?.id, index, ids]);
  useEffect(() => {
    if (!previous) return;
    const timer = setTimeout(() => setPrevious(undefined), 800); return () => clearTimeout(timer);
  }, [previous]);
  useEffect(() => {
    if (!active || !visible || !foreground || hover || focused || reduced || games.length < 2 || shown?.id !== selection?.id) return;
    const timer = setTimeout(() => setIndex(value => (value + 1) % games.length), 8500);
    return () => clearTimeout(timer);
  }, [active, visible, foreground, hover, focused, reduced, index, ids, shown?.id, selection?.id]);
  const game = shown && games.some(item => item.id === shown.id) ? shown : undefined;
  const artwork = romGameArtwork(game?.igdbId);
  const indicatorStart = Math.min(
    Math.max(0, games.findIndex(item => item.id === game?.id) - Math.floor(HERO_INDICATOR_LIMIT / 2)),
    Math.max(0, games.length - HERO_INDICATOR_LIMIT),
  );
  return <section ref={root} className="games-rom-hero games-cycle-hero" onPointerOver={event => setHover(!!(event.target as Element).closest("button,a"))} onPointerLeave={() => setHover(false)} hidden={!active} aria-label={t("games.roms.featured")} aria-busy={!game && busy}
    onFocusCapture={event => setFocused(event.target.matches(':focus-visible'))} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    {previous && <GameArt key={`old-${previous.id}`} src={scene(previous)} className="games-rom-hero-art is-active" eager/>}
    {game && <GameArt key={game.id} src={scene(game)} className="games-rom-hero-art is-active games-rom-scene-enter" eager/>}
    <div className="games-rom-hero-shade"/>
    <div className="games-inset games-rom-hero-copy">{game ? <div key={game.id} className="games-rom-copy-enter">
      <span className="games-rom-hero-kicker">{t("games.roms.featured")}<i/>{romConsoleNames(game, platform).join(" · ")}</span>
      <div className="games-rom-identity"><GameHeroLogo sources={[artwork?.logo]} name={game.name} platformIds={game.platformLinks.map(item => item.id)} alternativeNames={game.alternativeTitles?.map(item => item.name)} gameType={game.gameType} ready active={active} className={`games-rom-title-logo${artwork?.monochrome ? " is-monochrome" : ""}`}/><h2>{game.name}</h2></div>
      <p>{game.description}</p><div className="games-rom-hero-facts"><span>{game.release && new Date(game.release * 1000).getUTCFullYear()}</span><span>{game.genres.slice(0, 2).map(genre => genre.name).join(" · ")}</span>{score(game)}</div>
      <div className="games-actions"><button className="games-button" data-game={game.id} onClick={() => open(game)}><Play size={21}/>{t("games.discovery.viewGame")}</button>{romPreview(game) && <HoverTooltip label={t("games.roms.watchVideo")} side="top" align="center"><button className="games-rom-watch-action" aria-label={t("games.roms.watchVideo")} onClick={() => watch(romPreview(game)!)}><UiIcon name="trailer" style={{ width: 28, height: 28 }}/></button></HoverTooltip>}<button className="games-showcase-save games-rom-hero-save" aria-label={t(saved.some(item => item.id === game.id) ? "games.saved" : "games.save")} aria-pressed={saved.some(item => item.id === game.id)} onClick={() => save(detailEditionTarget(game))}><Heart size={28} fill={saved.some(item => item.id === game.id) ? "currentColor" : "none"}/></button></div>
    </div> : busy || selection ? <div className="games-rom-hero-skeleton"><GameSkeleton className="games-skeleton-title"/><GameSkeleton className="games-skeleton-logo"/><GameSkeleton className="games-skeleton-action"/></div> : <div className="games-rom-hero-empty"><h2>{t("games.roms.featured")}</h2><p role={failed ? "alert" : "status"}>{t(failed ? "games.loadError" : "games.roms.noCollection")}</p><button className="games-button" onClick={failed ? retry : browse}>{t(failed ? "common.retry" : "games.roms.allGames")}</button></div>}</div>
    {games.length > 1 && <><NavArrow dir="left" size={32} label={t("Previous")} className="games-cycle-arrow is-previous" onClick={() => setIndex(value => (value - 1 + games.length) % games.length)}/><NavArrow dir="right" size={32} label={t("Next")} className="games-cycle-arrow is-next" onClick={() => setIndex(value => (value + 1) % games.length)}/></>}
    {games.length > 1 && <div className="games-hero-dots" aria-label={t("games.featuredSelection")}>{games.slice(indicatorStart, indicatorStart + HERO_INDICATOR_LIMIT).map((item,i) => <button key={item.id} aria-label={item.name} aria-current={item.id === game?.id ? "true" : undefined} onClick={() => setIndex(indicatorStart + i)}/>)}</div>}
    <div className="games-inset games-rom-hero-source"><span><GameArt src="/games/brands/igdb.svg" eager/>{t("games.roms.sort.discussed")}</span></div>
  </section>;
}
