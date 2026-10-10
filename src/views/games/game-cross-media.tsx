import { useEffect, useRef, useState } from "react";
import { observeWithin } from "@/lib/visibility";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { loadGameMedia } from "@/lib/games/cross-media-fetch";
import { gameMediaIdentity, visibleGameMedia, type GameMediaIdentity, type GameMediaResult, type GameMediaTarget } from "@/lib/games/cross-media";
import { GameStoryCard } from "./game-story-card";
import "./game-cross-media.css";

export function GameCrossMedia({ game, active, open }: { game: GameMediaIdentity; active: boolean; open?: (target: GameMediaTarget) => void }) {
  const identity = gameMediaIdentity(game)?.key;
  // A new game must never briefly inherit another game's connections or filters.
  return identity ? <GameStories key={identity} game={game} active={active} open={open} /> : null;
}

function GameStories({ game, active, open }: { game: GameMediaIdentity; active: boolean; open?: (target: GameMediaTarget) => void }) {
  const t = useT(), root = useRef<HTMLElement>(null), grid = useRef<HTMLDivElement>(null);
  const { settings } = useSettings(), hideAdult = settings.hideContent.adult;
  const [seen, setSeen] = useState(false), [data, setData] = useState<GameMediaResult | null>(null), [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0), [kind, setKind] = useState("all"), [count, setCount] = useState(8);
  const identity = gameMediaIdentity(game)?.key;
  useEffect(() => { const node = root.current; if (!node) return; return observeWithin(node, "350px", entry => { if (entry.isIntersecting) setSeen(true); }); }, [identity]);
  useEffect(() => {
    if (!active || !seen || !identity) return;
    const request = new AbortController(); setFailed(false);
    void loadGameMedia(game, request.signal, hideAdult).then(value => { if (!request.signal.aborted) setData(value); }, () => { if (!request.signal.aborted) setFailed(true); });
    return () => request.abort();
  }, [active, seen, identity, attempt, hideAdult]);
  useEffect(() => {
    if (!grid.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animation = grid.current.animate([{ opacity: .45, transform: "translateY(4px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 180, easing: "ease-out" });
    return () => animation.cancel();
  }, [kind]);
  const visible = visibleGameMedia(data?.items ?? [], hideAdult);
  // Optional discovery should appear only when there are real, visible ties.
  // Keep the observer without an empty panel; failures aren't cached as no ties.
  if (!visible.length) return <section ref={root} className="games-cross-media-probe" aria-hidden="true" />;
  const kinds = ["movie", "series", "book"].filter(value => visible.some(item => item.kind === value));
  const selectedKind = kinds.includes(kind) ? kind : "all";
  const filtered = visible.filter(item => selectedKind === "all" || item.kind === selectedKind);
  return <section className="games-cross-media games-inset" ref={root} aria-labelledby="games-cross-media-title">
    <div className="games-cross-media-heading">
      <h2 id="games-cross-media-title">{t("games.media.eyebrow")}</h2>
      {kinds.length > 1 && <div className="games-media-filters" role="group" aria-label={t("games.media.filter")}>{["all", ...kinds].map(value => <button key={value} aria-pressed={selectedKind === value} onClick={() => { setKind(value); setCount(8); }}>{t(`games.media.${value}`)}</button>)}</div>}
    </div>
    {failed && <div className="games-media-error" role="status"><p>{t("games.media.error")}</p><button className="games-button" onClick={() => setAttempt(n => n+1)}>{t("common.retry")}</button></div>}
    <div className="games-media-grid" ref={grid}>{filtered.slice(0,count).map((item, index) => <GameStoryCard key={item.qid} item={item} index={index} active={active} open={open}/>)}</div>
    {filtered.length>count && <div className="games-media-footer"><button className="games-button" onClick={()=>setCount(n=>n+8)}>{t("games.media.more")}</button></div>}
  </section>;
}
