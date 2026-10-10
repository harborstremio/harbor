import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useT, useUiLanguage } from "@/lib/i18n";
import { loadGameDetail, loadGameHighlights, readGameDetailSnapshot } from "@/lib/games/catalog";
import { loadAtlasGame, readAtlasGameSnapshot } from "@/lib/games/atlas";
import type { AtlasGame } from "@/lib/games/igdb-data";
import type { GameDetail, GameSummary } from "@/lib/games/types";
import type { GameHighlight } from "@/lib/games/catalog";
import { combineGameRatings } from "@/lib/games/rating-data";
import { GameDiscoveryRatings, RatingMark, scoreTone } from "./game-discovery-ratings";
import { HoverTooltip } from "@/components/hover-tooltip";
import { useSectionBack } from "@/lib/section-back";
import { GameArt } from "./game-art";
import { GameCard } from "./game-ui";

function GamePreview({ game, reviews, anchor, id, enter, leave, close }: { game: GameSummary; reviews?: GameHighlight; anchor: HTMLElement; id: string; enter: () => void; leave: () => void; close: () => void }) {
  const t = useT(), root = useRef<HTMLDivElement>(null), [detail, setDetail] = useState<GameDetail|null>(null), [loaded, setLoaded] = useState(false);
  const [atlas, setAtlas] = useState<AtlasGame|null>(null);
  const [position, setPosition] = useState<{ top: number; left: number }|null>(null);
  useSectionBack(close, true);
  useEffect(() => {
    let current = true;
    if (!game.steamId) {
      const request = new AbortController();
      void Promise.allSettled([readAtlasGameSnapshot(game), loadAtlasGame(game, request.signal)]).then(([cached, fresh]) => {
        if (!current) return;
        setAtlas(fresh.status === "fulfilled" && fresh.value ? fresh.value : cached.status === "fulfilled" ? cached.value : null);
        setLoaded(true);
      });
      return () => { current = false; request.abort(); };
    }
    void Promise.allSettled([readGameDetailSnapshot(game.steamId), loadGameDetail(game.steamId)]).then(([cached, fresh]) => {
      if (!current) return;
      setDetail(fresh.status === "fulfilled" && fresh.value ? fresh.value : cached.status === "fulfilled" ? cached.value : null);
      setLoaded(true);
    });
    return () => { current = false; };
  }, [game.id]);
  useLayoutEffect(() => {
    const place = () => {
      if (!root.current) return;
      const a = anchor.getBoundingClientRect(), b = root.current.getBoundingClientRect(), gap = 12;
      const right = a.right + gap + b.width <= innerWidth - 12, left = a.left - gap - b.width >= 12;
      setPosition({ left: right ? a.right + gap : left ? a.left - gap - b.width : Math.max(12, Math.min(a.left, innerWidth - b.width - 12)), top: Math.max(12, Math.min(right || left ? a.top : a.top >= b.height + 12 ? a.top - b.height - gap : a.bottom + gap, innerHeight - b.height - 12)) });
    };
    place(); const observer = new ResizeObserver(place); if (root.current) observer.observe(root.current); return () => observer.disconnect();
  }, [anchor]);
  const metadata = detail ?? atlas;
  const shots = metadata?.screenshots.filter(url => url !== game.capsule).slice(0, 2) ?? [];
  const genres = detail?.genres ?? atlas?.genres.map(genre => genre.name) ?? [];
  return createPortal(<div ref={root} id={id} role="tooltip" className="games-search-preview" style={position ?? { visibility: "hidden" }} onPointerEnter={enter} onPointerLeave={leave}>
    <div className="games-search-preview-content"><div className="games-search-preview-hero" aria-busy={!loaded}>{loaded && <GameArt src={detail?.libraryHero || metadata?.hero || game.capsule} fallback={game.capsule} eager/>}</div>
      <div className="games-search-preview-copy"><h3>{game.name}</h3><p className="games-search-preview-byline">{detail ? [detail.release, detail.developers.join(" · ")].filter(Boolean).join(" · ") : game.platforms.join(" · ")}</p>
        <GameDiscoveryRatings game={game} active compact initialRatings={combineGameRatings(game, detail, atlas, reviews)}/>
        {metadata ? <><p className="games-search-preview-description">{metadata.description}</p><div className="games-search-preview-genres">{genres.slice(0, 4).map(genre => <span key={genre}>{genre}</span>)}</div></> : <div className="games-search-preview-placeholder" aria-busy={!loaded}>{loaded ? t("games.detailError") : <><i/><i/><i/></>}</div>}
        {!!shots.length && <div className="games-search-preview-shots">{shots.map(src => <GameArt key={src} src={src} eager/>)}</div>}
        <div className="games-search-preview-footer"><span>{t("games.searchUi.previewHint")}</span></div>
      </div>
    </div>
  </div>, document.body);
}

export function GamePreviewTrigger({ game, review, active, className, children }: { game: GameSummary; review?: GameHighlight; active: boolean; className?: string; children: (descriptionId: string | undefined) => ReactNode }) {
  const id = useId(), root = useRef<HTMLDivElement>(null), timer = useRef<number|null>(null), [preview, setPreview] = useState(false), [tracking, setTracking] = useState(false);
  const cancel = () => { if (timer.current !== null) clearTimeout(timer.current); timer.current = null; };
  const close = () => { cancel(); setPreview(false); setTracking(false); };
  const enter = () => { if (!active) return; cancel(); setTracking(true); timer.current = window.setTimeout(() => setPreview(true), 320); };
  const leave = () => { cancel(); timer.current = window.setTimeout(close, 130); };
  const keep = () => { cancel(); };
  useEffect(() => { if (!active) close(); return cancel; }, [active]);
  useEffect(() => {
    if (!tracking) return;
    const dismiss = () => close();
    window.addEventListener("scroll", dismiss, true); window.addEventListener("resize", dismiss);
    return () => { cancel(); window.removeEventListener("scroll", dismiss, true); window.removeEventListener("resize", dismiss); };
  }, [tracking]);
  return <div ref={root} className={className} onPointerEnter={event => { if (event.pointerType === "mouse") enter(); }} onPointerLeave={leave} onFocus={event => { if (event.target.matches(":focus-visible")) enter(); }} onBlur={leave} onClick={close}>
    {children(preview && active ? id : undefined)}
    {preview && root.current && active && <GamePreview key={game.id} game={game} reviews={review} anchor={root.current.querySelector<HTMLElement>(".games-card-art, [data-pick]") ?? root.current} id={id} enter={keep} leave={leave} close={close}/>}
  </div>;
}

function SearchCard({ game, review, active, open, reason }: { game: GameSummary; review?: GameHighlight; active: boolean; open: (game: GameSummary) => void; reason?: string }) {
  const t = useT(), language = useUiLanguage();
  const score = review?.reviews;
  return <div className="games-search-result" data-search-game={game.steamId}>
    <GamePreviewTrigger game={game} review={review} active={active}>{descriptionId => <GameCard game={game} open={open} posterInset descriptionId={descriptionId}/>}</GamePreviewTrigger>
    <div className="games-search-result-meta">{score && <HoverTooltip label={t("games.discovery.rating.steam")} sublabel={`${t("games.discovery.ratingNote.steam")} · ${t("games.discovery.ratingCount", { count: score.count.toLocaleString(language) })}`} side="top"><span className="games-search-review" data-score-tone={scoreTone(score.positive)}><RatingMark source="steam"/><strong>{score.positive}%</strong><small>({new Intl.NumberFormat(language, { notation: "compact", maximumFractionDigits: 1 }).format(score.count)})</small></span></HoverTooltip>}</div>
    {reason && <p className="games-ai-reason">{reason}</p>}
  </div>;
}

export function GameSearchResults({ games, active, open, reasons, view = "grid", loadingMore = false }: { games: GameSummary[]; active: boolean; open: (game: GameSummary) => void; reasons?: Record<string,string>; view?: "grid" | "rows"; loadingMore?: boolean }) {
  const root = useRef<HTMLDivElement>(null), [reviews, setReviews] = useState<Record<number, GameHighlight>>({});
  const ids = games.map(game => game.id).join(",");
  useEffect(() => {
    if (!active || !root.current) return;
    let current = true, timer = 0;
    const visible = new Set<number>(), requested = new Set<number>();
    const flush = () => {
      const batch = [...visible].filter(id => !reviews[id] && !requested.has(id)).slice(0, 24);
      if (!batch.length) return;
      batch.forEach(id => requested.add(id));
      void loadGameHighlights(batch).then(items => { if (current) setReviews(previous => ({ ...previous, ...Object.fromEntries(items.map(item => [item.steamId, item])) })); }, () => {});
    };
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) { const id = Number((entry.target as HTMLElement).dataset.searchGame); if (id > 0) { if (entry.isIntersecting) visible.add(id); else visible.delete(id); } }
      clearTimeout(timer); timer = window.setTimeout(flush, 180);
    }, { root: root.current.closest(".games-view"), rootMargin: "80px", threshold: .05 });
    root.current.querySelectorAll("[data-search-game]").forEach(element => observer.observe(element));
    return () => { current = false; clearTimeout(timer); observer.disconnect(); };
  }, [active, ids]);
  return <div className={`games-grid games-search-results is-${view}`} ref={root} aria-busy={loadingMore}>{games.map(game => <SearchCard key={game.id} game={game} review={game.steamId ? reviews[game.steamId] : undefined} active={active} open={open} reason={reasons?.[game.id]}/>)}{loadingMore && Array.from({length:8},(_,index)=><div className="games-search-skeleton" key={`loading-${index}`} aria-hidden="true"><div/><span><i/><i/><i/></span></div>)}</div>;
}
