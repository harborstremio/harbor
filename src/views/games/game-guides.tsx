import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { BackToTop } from "@/components/back-to-top";
import { useSectionBack } from "@/lib/section-back";
import type { GameSummary } from "@/lib/games/types";
import type { GameGuide } from "@/lib/games/guides-data";
import { GameGuides } from "./game-guides-catalog";
import { GuideReader } from "./guide-reader";
import "./game-guides.css";

export type GuideGame = GameSummary & { hero?: string; logo?: string };
type Position = { top: number; element: HTMLElement | null };
/** A retained page layer keeps game details and the guide catalog's exact Back position. */
export function GameGuidesScope({ active, shellBackAvailable, onOpenChange, children }: { active: boolean; shellBackAvailable: boolean; onOpenChange?: (open:boolean)=>void; children: (open: (game: GuideGame) => void, detailActive: boolean) => ReactNode }) {
  const [game, setGame] = useState<GuideGame | null>(null), [item, setItem] = useState<GameGuide | null>(null);
  const scrollRef = useRef<HTMLElement>(null);
  const root = useRef<HTMLDivElement>(null), positions = useRef<Position[]>([]), restore = useRef<Position | null>(null);
  const remember = (element=document.activeElement as HTMLElement) => positions.current.push({ top:root.current?.closest(".games-view")?.scrollTop ?? 0, element });
  const open = (value: GuideGame) => { remember(); setGame(value); };
  const read = (value: GameGuide, element?:HTMLElement) => { remember(element); setItem(value); };
  const back = () => { restore.current = positions.current.pop() ?? null; if (item) setItem(null); else setGame(null); };
  useSectionBack(back, active && !!game);
  useLayoutEffect(() => { scrollRef.current = root.current?.closest<HTMLElement>(".games-view") ?? null; }, [active, game]);
  useLayoutEffect(() => { onOpenChange?.(!!game); return () => onOpenChange?.(false); }, [!!game,onOpenChange]);
  // Marks the view instead of :has(.games-guides-scope .games-guides). A :has() on the
  // scroll container is re-checked on every insert beneath it, and rows mount constantly.
  useLayoutEffect(() => {
    const view = root.current?.closest<HTMLElement>(".games-view");
    if (!view) return;
    view.toggleAttribute("data-games-guides-open", !!game);
    return () => view.removeAttribute("data-games-guides-open");
  }, [game]);
  useLayoutEffect(() => {
    const container = root.current?.closest(".games-view"), position = restore.current; restore.current = null;
    if (position) { container?.scrollTo({ top:position.top, behavior:"instant" }); const frame = requestAnimationFrame(() => { container?.scrollTo({ top:position.top, behavior:"instant" }); position.element?.focus({ preventScroll:true }); }); return () => cancelAnimationFrame(frame); }
    if (game) { container?.scrollTo({ top:0, behavior:"instant" }); root.current?.querySelector<HTMLElement>(item ? ".games-guide-reader h1" : ".games-guides h1")?.focus({ preventScroll:true }); }
  }, [game, item]);
  return <div ref={root} className="games-guides-scope">
    <div hidden={!!game}>{children(open, active && !game)}</div>
    {game && <><div hidden={!!item}><GameGuides game={game} active={active && !item} read={read} back={!shellBackAvailable ? back : undefined}/></div>
      {item && <GuideReader key={`${item.source}:${item.id}`} game={game} item={item} active={active} follow={setItem} back={!shellBackAvailable ? back : undefined}/>}</>}
    {active && <BackToTop scrollRef={scrollRef} onReturnToTop={() => root.current?.querySelector<HTMLElement>(item ? ".games-guide-reader h1" : game ? ".games-guides h1" : ".games-detail h1")?.focus({ preventScroll: true })} />}
  </div>;
}
