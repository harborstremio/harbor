import { useEffect, useRef } from "react";
import { GameSkeleton } from "./game-loading";

/** Observe the app's actual scroll pane; viewport margins cannot cross its clip. */
export function RomContinuation({ active, busy, failed, cursor, more }: {
  active: boolean; busy: boolean; failed: boolean; cursor?: number | null; more: () => Promise<boolean>;
}) {
  const root = useRef<HTMLDivElement>(null), load = useRef(more); load.current = more;
  useEffect(() => {
    if (!active || busy || failed || cursor == null || !root.current) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); void load.current(); }
    }, { root: root.current.closest(".games-view"), rootMargin: "1000px" });
    observer.observe(root.current); return () => observer.disconnect();
  }, [active, busy, failed, cursor]);
  return <div ref={root} className="games-rom-continuation" aria-hidden="true"/>;
}

export function RomPendingCards({ count = 6, worlds = false }: { count?: number; worlds?: boolean }) {
  return <>{Array.from({ length: count }, (_, index) => worlds
    ? <GameSkeleton key={index} className="games-rom-world-pending"/>
    : <div key={index} aria-hidden="true"><GameSkeleton className="games-skeleton-poster"/><GameSkeleton className="games-skeleton-title"/><GameSkeleton className="games-skeleton-meta"/></div>)}</>;
}
