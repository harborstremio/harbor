import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { isMangaReaderRoute } from "@/lib/platform";
import { isSetupRoute } from "@/lib/platform";
import { hasSetupToken } from "./onboard/setup-wire";
import { HarborLoader } from "@/components/harbor-loader";
import { MobileBrowse } from "./mobile-browse";
import { MobileProfile } from "./mobile-profile";
import { MobileSearch } from "./mobile-search";
import { MobileLibrary } from "./mobile-library";
import { DpadRemote } from "./dpad-remote";
import { BottomTabBar, type MobileTab } from "./bottom-tab-bar";
import { MobileRemoteProvider, useMobileRemote } from "./mobile-remote";
import { SheetLockProvider, useSheetLock } from "./mobile-sheet-lock";
import { useMobileRemoteStyle } from "./remote-style";
import { ScrollToTop } from "./scroll-to-top";
import { MangaNowBar } from "./manga-remote/manga-now-bar";

const RemoteApp = lazy(() => import("@/views/remote-app").then((m) => ({ default: m.RemoteApp })));
const MangaRemote = lazy(() => import("./manga-remote/manga-remote").then((m) => ({ default: m.MangaRemote })));
const MangaLocalReader = lazy(() => import("./manga-read/manga-local-reader").then((m) => ({ default: m.MangaLocalReader })));
const MobileOnboard = lazy(() => import("./onboard").then((m) => ({ default: m.MobileOnboard })));

export function MobileShell() {
  // Held in state rather than re-read per render. Leaving setup strips the
  // query parameter, and a page that decided what to render straight from the
  // URL would have no way to tell "user finished" from "URL still says setup".
  // /setup is the onboarding surface and /remote is the bridge. The token is
  // still honoured so an already-issued QR keeps working, but the path is what
  // decides, so onboarding can never take over the remote again.
  const [setup, setSetup] = useState(() => isSetupRoute() || hasSetupToken());
  return (
    <MobileRemoteProvider>
      <SheetLockProvider>
        {setup ? (
          <Suspense fallback={<HarborLoader />}>
            <MobileOnboard onExit={() => setSetup(false)} />
          </Suspense>
        ) : isMangaReaderRoute() ? (
          <MangaReaderShell />
        ) : (
          <ShellBody />
        )}
      </SheetLockProvider>
    </MobileRemoteProvider>
  );
}

function MangaReaderShell() {
  const [local, setLocal] = useState(false);
  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-canvas">
      <Suspense fallback={<FullLoader />}>
        {local ? (
          <MangaLocalReader onExit={() => setLocal(false)} />
        ) : (
          <MangaRemote standalone onReadHere={() => setLocal(true)} />
        )}
      </Suspense>
    </div>
  );
}

function ShellBody() {
  const [tab, setTab] = useState<MobileTab>("home");
  const [seen, setSeen] = useState<Set<MobileTab>>(() => new Set<MobileTab>(["home"]));
  const showNowPlaying = tab !== "remote";
  const rootRef = useRef<HTMLDivElement>(null);

  const selectTab = (next: MobileTab) => {
    setTab(next);
    setSeen((prev) => (prev.has(next) ? prev : new Set(prev).add(next)));
  };

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const rgb = getComputedStyle(el).backgroundColor;
    if (!rgb) return;
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", rgb);
  }, []);

  return (
    <div ref={rootRef} className="absolute inset-0 z-30 flex flex-col bg-canvas">
      <style>{TAB_TRANSITION_CSS}</style>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <TabLayer active={tab === "home"}>
          {seen.has("home") && <MobileBrowse />}
        </TabLayer>
        <TabLayer active={tab === "search"}>
          {seen.has("search") && (
            <BrowseScroll>
              <MobileSearch />
            </BrowseScroll>
          )}
        </TabLayer>
        <TabLayer active={tab === "profile"}>
          {seen.has("profile") && (
            <BrowseScroll>
              <MobileProfile onOpenRemote={() => selectTab("remote")} />
            </BrowseScroll>
          )}
        </TabLayer>
        <TabLayer active={tab === "mystuff"}>
          {seen.has("mystuff") && (
            <BrowseScroll>
              <MobileLibrary />
            </BrowseScroll>
          )}
        </TabLayer>
        <TabLayer active={tab === "remote"}>{seen.has("remote") && <RemoteSurface />}</TabLayer>
      </div>
      {showNowPlaying && <NowPlayingBar onExpand={() => selectTab("remote")} />}
      <BottomTabBar active={tab} onSelect={selectTab} />
    </div>
  );
}

const TAB_TRANSITION_CSS = `
.harbor-tab-layer {
  position: absolute;
  inset: 0;
  opacity: 0;
  transform: translate3d(0, 8px, 0);
  pointer-events: none;
  transition: opacity 260ms var(--ease-out), transform 260ms var(--ease-out);
}
.harbor-tab-layer.is-active {
  opacity: 1;
  transform: translate3d(0, 0, 0);
  pointer-events: auto;
}
@media (prefers-reduced-motion: reduce) {
  .harbor-tab-layer {
    transition: none;
    transform: none;
  }
}
`;

function TabLayer({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`harbor-tab-layer flex flex-col${active ? " is-active" : ""}`}
      aria-hidden={active ? undefined : true}
    >
      {children}
    </div>
  );
}

function BrowseScroll({ children }: { children: React.ReactNode }) {
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

const NOW_PLAYING_CSS = `
.harbor-nowplaying-in {
  animation: harbor-nowplaying-in 420ms var(--ease-out) both;
}
.harbor-nowplaying-out {
  animation: harbor-nowplaying-out 200ms var(--ease-out) both;
}
@keyframes harbor-nowplaying-in {
  0% { opacity: 0; transform: translate3d(0, 16px, 0) scale(0.985); }
  55% { opacity: 1; }
  78% { transform: translate3d(0, -2px, 0) scale(1); }
  100% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
}
@keyframes harbor-nowplaying-out {
  0% { opacity: 1; transform: translate3d(0, 0, 0); }
  100% { opacity: 0; transform: translate3d(0, 8px, 0); }
}
.harbor-nowplaying-slide {
  transition: transform 320ms var(--ease-out);
}
.harbor-nowplaying-slide[data-hidden="true"] {
  transform: translateY(calc(100% + env(safe-area-inset-bottom, 0px) + 74px + 24px));
}
@media (prefers-reduced-motion: reduce) {
  .harbor-nowplaying-in, .harbor-nowplaying-out { animation: none; }
  .harbor-nowplaying-slide { transition: none; }
  .harbor-nowplaying-slide[data-hidden="true"] { transform: none; visibility: hidden; }
}
`;

function NowPlayingBar({ onExpand }: { onExpand: () => void }) {
  const { connected, snapshot } = useMobileRemote();
  const { sheetOpen } = useSheetLock();
  const active = connected && !snapshot.idle && !!snapshot.mediaId;
  const [render, setRender] = useState(active);
  const lastActive = useRef(snapshot);
  if (active) lastActive.current = snapshot;

  useEffect(() => {
    if (active) {
      setRender(true);
      return;
    }
    const timer = window.setTimeout(() => setRender(false), 200);
    return () => window.clearTimeout(timer);
  }, [active]);

  const manga = snapshot.manga;
  if (connected && manga?.open) {
    return <MangaNowBar m={manga} hidden={sheetOpen} onExpand={onExpand} />;
  }

  if (!render) return null;
  const snap = active ? snapshot : lastActive.current;
  const ep = snap.episode ? `S${snap.episode.season} · E${snap.episode.episode}` : null;
  return (
    <div
      className="harbor-nowplaying-slide pointer-events-none fixed inset-x-0 z-30 flex justify-center px-3"
      data-hidden={sheetOpen ? "true" : undefined}
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 74px)" }}
    >
      <style>{NOW_PLAYING_CSS}</style>
      <div className={`w-[min(440px,100%)] ${active ? "harbor-nowplaying-in" : "harbor-nowplaying-out"}`}>
        <button
          type="button"
          onClick={onExpand}
          className="pointer-events-auto flex w-full items-center gap-3 rounded-2xl border border-edge-soft/60 bg-elevated/80 p-2 pe-4 text-start shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)] backdrop-blur-2xl transition-transform active:scale-[0.99]"
        >
          <span className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-surface">
            {snap.posterUrl && (
              <img src={snap.posterUrl} alt="" className="h-full w-full object-cover" />
            )}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[13.5px] font-semibold text-ink">{snap.mediaTitle || "Now playing"}</span>
            <span className="truncate text-[11.5px] text-ink-muted">
              {ep ? `${ep} · on your computer` : "on your computer"}
            </span>
          </span>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-canvas">
            {snap.playing ? (
              <Pause size={16} strokeWidth={0} fill="currentColor" />
            ) : (
              <Play size={16} strokeWidth={0} fill="currentColor" />
            )}
          </span>
        </button>
      </div>
    </div>
  );
}

function RemoteSurface() {
  const { snapshot } = useMobileRemote();
  const style = useMobileRemoteStyle();
  const content = snapshot.manga?.open ? (
    <Suspense fallback={<FullLoader />}>
      <MangaRemote />
    </Suspense>
  ) : style === "dpad" ? (
    <DpadRemote />
  ) : (
    <Suspense fallback={<FullLoader />}>
      <RemoteApp />
    </Suspense>
  );
  return <div className="min-h-0 flex-1 overflow-hidden overscroll-none">{content}</div>;
}

function FullLoader() {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-canvas">
      <HarborLoader size="lg" />
    </div>
  );
}
