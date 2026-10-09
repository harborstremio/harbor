import { Component, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { lazyView } from "@/lib/lazy-view";
import { useT } from "@/lib/i18n";
import { GameSkeleton } from "./game-loading";
import "./game-deferred.css";

export function GameDestinationLoading() {
  const t = useT();
  return <div className="games-destination-loading games-inset" role="status" aria-busy="true">
    <span className="sr-only">{t("common.loading")}</span>
    <GameSkeleton className="games-destination-title"/>
    <GameSkeleton className="games-destination-body"/>
  </div>;
}

function LoadFailure({ retry }: { retry: (element: HTMLElement) => void }) {
  const t = useT();
  return <div className="games-state" role="alert"><p>{t("Could not load {name}. Try again.", { name: t("nav.games") })}</p><button className="games-button" onClick={event => retry(event.currentTarget.parentElement!)}>{t("common.retry")}</button></div>;
}

class LoadBoundary extends Component<{ children: ReactNode; retry: (element: HTMLElement) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <LoadFailure retry={this.props.retry}/> : this.props.children; }
}

function Resolved({ children, ready }: { children: ReactNode; ready: () => void }) {
  useLayoutEffect(ready, [ready]);
  return children;
}

/** A failed chunk stays local, and Retry gets a fresh lazy import after the automatic retries. */
export function deferredGameView<P extends object>(load: () => Promise<{ default: (props: P) => ReactNode }>) {
  // Share the resolved type across visits so a cached destination never flashes its fallback again.
  let latestView = lazyView(load);
  return function DeferredGameView(props: P) {
    const [attempt, setAttempt] = useState(0);
    const [View, setView] = useState(() => latestView);
    const handoff = useRef<(() => void) | null>(null), cancel = useRef<(() => void) | null>(null);
    useEffect(() => () => cancel.current?.(), []);
    const ready = useCallback(() => handoff.current?.(), []);
    const retry = (element: HTMLElement) => {
      cancel.current?.();
      const parent = element.parentElement, previous = element.previousElementSibling, next = element.nextElementSibling;
      const stop = () => {
        handoff.current = null; cancel.current = null; clearTimeout(deadline);
        for (const event of ["pointerdown", "wheel", "keydown", "touchstart"]) document.removeEventListener(event, stop, true);
      };
      const deadline = window.setTimeout(stop, 10000);
      cancel.current = stop;
      for (const event of ["pointerdown", "wheel", "keydown", "touchstart"]) document.addEventListener(event, stop, { once: true, capture: true, passive: true });
      handoff.current = () => {
        if (parent?.isConnected && !parent.closest("[hidden], [inert], [data-layer-inactive]")) {
          for (let node = previous?.nextElementSibling ?? parent.firstElementChild; node && node !== next; node = node.nextElementSibling) {
            const heading = node.matches("h1, h2") ? node as HTMLElement : node.querySelector<HTMLElement>("h1, h2");
            if (!heading || heading.closest("[hidden], [inert]") || !heading.getClientRects().length) continue;
            if (!heading.hasAttribute("tabindex")) heading.tabIndex = -1;
            heading.focus({ preventScroll: true }); break;
          }
        }
        stop();
      };
      latestView = lazyView(load);
      setView(() => latestView);
      setAttempt(value => value + 1);
    };
    return <LoadBoundary key={attempt} retry={retry}>
      <Suspense fallback={<GameDestinationLoading/>}><Resolved ready={ready}><View {...props}/></Resolved></Suspense>
    </LoadBoundary>;
  };
}

/** Defer the first visit, then retain filters, pagination and exact Back targets. */
export function GameVisited({ active, children }: { active: boolean; children: ReactNode }) {
  const [visited, setVisited] = useState(active);
  if (active && !visited) setVisited(true);
  return active || visited ? children : null;
}
