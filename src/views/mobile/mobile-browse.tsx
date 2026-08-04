import { useEffect, useRef, useState, type ReactNode } from "react";
import { MobileHome } from "./mobile-home";
import { MobileMovies } from "./mobile-movies";
import { MobileShows } from "./mobile-shows";
import { MobileAnime } from "./mobile-anime";
import { MobileDiscover } from "./mobile-discover";
import { MobileViewSwitcher } from "./mobile-view-switcher";
import { MobileDeviceSwitcher } from "./mobile-device-switcher";
import { ScrollToTop } from "./scroll-to-top";

export type View = "home" | "movies" | "shows" | "anime" | "discover";

const VIEW_TRANSITION_CSS = `
.harbor-view-layer {
  position: absolute;
  inset: 0;
  opacity: 0;
  transform: translate3d(0, 6px, 0);
  pointer-events: none;
  transition: opacity 260ms var(--ease-out), transform 260ms var(--ease-out);
}
.harbor-view-layer.is-active {
  opacity: 1;
  transform: translate3d(0, 0, 0);
  pointer-events: auto;
}
@media (prefers-reduced-motion: reduce) {
  .harbor-view-layer {
    transition: none;
    transform: none;
  }
}
`;

export function MobileBrowse() {
  const [view, setView] = useState<View>("home");
  const [seen, setSeen] = useState<Set<View>>(() => new Set<View>(["home"]));

  const selectView = (next: View) => {
    setView(next);
    setSeen((prev) => (prev.has(next) ? prev : new Set(prev).add(next)));
  };

  return (
    <div className="relative min-h-0 flex-1">
      <style>{VIEW_TRANSITION_CSS}</style>
      <ViewLayer active={view === "home"}>
        {seen.has("home") && (
          <ViewScroll>
            <MobileHome />
          </ViewScroll>
        )}
      </ViewLayer>
      <ViewLayer active={view === "movies"}>
        {seen.has("movies") && (
          <ViewScroll>
            <MobileMovies />
          </ViewScroll>
        )}
      </ViewLayer>
      <ViewLayer active={view === "shows"}>
        {seen.has("shows") && (
          <ViewScroll>
            <MobileShows />
          </ViewScroll>
        )}
      </ViewLayer>
      <ViewLayer active={view === "anime"}>
        {seen.has("anime") && (
          <ViewScroll>
            <MobileAnime />
          </ViewScroll>
        )}
      </ViewLayer>
      <ViewLayer active={view === "discover"}>
        {seen.has("discover") && (
          <ViewScroll>
            <MobileDiscover />
          </ViewScroll>
        )}
      </ViewLayer>

      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-start justify-between gap-3 px-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)" }}
      >
        <div className="pointer-events-auto min-w-0">
          <MobileDeviceSwitcher />
        </div>
        <div className="pointer-events-auto">
          <MobileViewSwitcher view={view} onSelect={selectView} />
        </div>
      </div>
    </div>
  );
}

function ViewLayer({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <div
      className={`harbor-view-layer flex flex-col${active ? " is-active" : ""}`}
      aria-hidden={active ? undefined : true}
    >
      {children}
    </div>
  );
}

function ViewScroll({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const vh = el.clientHeight || 1;
      setShowTop(el.scrollTop > vh);
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(update);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 84px)" }}
      >
        {children}
      </div>
      <ScrollToTop scrollRef={scrollRef} visible={showTop} />
    </>
  );
}
