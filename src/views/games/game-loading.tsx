import { useT } from "@/lib/i18n";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

export function GameSkeleton({ className = "" }: { className?: string }) {
  return <span className={`games-skeleton ${className}`} aria-hidden="true"/>;
}

export function GameHeroSkeleton({ failed, retry }: { failed: boolean; retry: () => void }) {
  const t = useT();
  const hero = useRef<HTMLElement>(null);
  // Marks the browser instead of :has(.games-showcase-loading). That :has() sat on an
  // ancestor of the whole games UI, so every row that mounted while scrolling re-ran it.
  useEffect(() => {
    const home = hero.current?.closest<HTMLElement>(".games-browser-home");
    if (!home) return;
    home.toggleAttribute("data-games-hero-loading", true);
    return () => home.removeAttribute("data-games-hero-loading");
  }, []);
  return <section ref={hero} className="games-showcase games-home-hero games-showcase-loading" aria-busy={!failed}>
    <span className="sr-only" role="status">{t(failed ? "games.loadError" : "common.loading")}</span>
    <div className="games-showcase-content games-inset">
      <div className="games-showcase-identity"><GameSkeleton className="games-skeleton-logo"/></div>
      <div className="games-showcase-deck is-description games-skeleton-lines"><GameSkeleton/><GameSkeleton/><GameSkeleton/></div>
      <div className="games-showcase-facts"><GameSkeleton className="games-skeleton-facts"/></div>
      <div className="games-actions"><GameSkeleton className="games-skeleton-action"/><GameSkeleton className="games-skeleton-action"/></div>
    </div>
    <div className="games-showcase-ratings games-inset"><div className="games-discovery-ratings">{[0,1,2,3].map(i=><GameSkeleton key={i} className="games-skeleton-rating"/>)}</div></div>
    <div className="games-showcase-footer games-inset"><GameSkeleton className="games-skeleton-motion"/><div className="games-feature-picker">{[0,1,2].map(i=><div className="games-skeleton-picker" key={i}><GameSkeleton/><span><GameSkeleton/><GameSkeleton/></span></div>)}</div><GameSkeleton className="games-skeleton-pages"/></div>
    {failed && <div className="games-showcase-retry" role="alert"><p>{t("games.loadError")}</p><button className="games-button" onClick={retry}>{t("common.retry")}</button></div>}
  </section>;
}

export function GamePosterSkeletons({ count = 6 }: { count?: number }) {
  const root=useRef<HTMLDivElement>(null),[slots,setSlots]=useState(count);
  useLayoutEffect(()=>{const node=root.current;if(!node)return;const measure=()=>{if(node.clientWidth>0)setSlots(Math.max(1,Math.min(count,Math.floor((node.clientWidth+20)/180))));};measure();const observer=new ResizeObserver(measure);observer.observe(node);return()=>observer.disconnect();},[count]);
  return <div ref={root} className="games-poster-grid games-loading-posters" style={{gridTemplateColumns:`repeat(${slots},minmax(0,1fr))`}} aria-busy="true">{Array.from({ length: slots }, (_, i)=><div key={i}><GameSkeleton className="games-skeleton-poster"/><GameSkeleton className="games-skeleton-title"/><GameSkeleton className="games-skeleton-meta"/></div>)}</div>;
}

export function GameActiveSkeleton() {
  return <div className="games-active-layout games-loading-active" aria-busy="true" aria-hidden="true"><GameSkeleton className="games-skeleton-active-feature"/><div className="games-active-list">{Array.from({length:6},(_,i)=><div className="games-active-row" key={i}><GameSkeleton className="games-skeleton-rank"/><GameSkeleton className="games-skeleton-capsule"/><div className="games-active-game-name"><GameSkeleton className="games-skeleton-title"/><GameSkeleton className="games-skeleton-meta"/></div><GameSkeleton className="games-skeleton-count"/></div>)}</div></div>;
}
