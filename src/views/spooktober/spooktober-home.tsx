import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Home } from "@/views/home";
import { isSpooktoberSeason, nextSpooktoberDateCheck } from "@/lib/spooktober-season";
import { useView } from "@/lib/view";
import { SPOOKTOBER_PLAYLIST_EVENT, takeSpooktoberPlaylistRequest, type SpooktoberPlaylistRequest } from "@/lib/spooktober-navigation";
import { SpooktoberInvitation } from "./spooktober-entry";
import { SpooktoberLoadingScene } from "./spooktober-loading";
import { useOnboarding } from "@/lib/onboarding";

const Festival = lazy(() => import("./spooktober-view").then(module => ({ default: module.SpooktoberView })));

export function SpooktoberHome({ active = true, onReady }: { active?: boolean; onReady?: () => void }) {
  const { setView } = useView();
  const { isDismissed, dismiss } = useOnboarding();
  const [available, setAvailable] = useState(isSpooktoberSeason);
  const [screen, setScreen] = useState<"home" | "festival">("home");
  const [festivalOpened, setFestivalOpened] = useState(false);
  const [entryToken, setEntryToken] = useState(0);
  const [playlistRequest, setPlaylistRequest] = useState<SpooktoberPlaylistRequest | null>(null);
  const close = useCallback(() => {
    setScreen("home");
    setPlaylistRequest(null);
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>("[data-spooktober-invitation]")?.focus({ preventScroll: true }));
  }, []);
  const prepareFestival = () => setFestivalOpened(true);
  const openFestival = () => { prepareFestival(); setEntryToken(value => value + 1); setScreen("festival"); };
  useEffect(() => {
    const receive = () => {
      const request = takeSpooktoberPlaylistRequest();
      if (!request) return;
      setPlaylistRequest(request);
      setFestivalOpened(true);
      setScreen("festival");
      setView("home");
    };
    window.addEventListener(SPOOKTOBER_PLAYLIST_EVENT, receive);
    receive();
    return () => window.removeEventListener(SPOOKTOBER_PLAYLIST_EVENT, receive);
  }, [setView]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      clearTimeout(timer);
      const now = new Date(), inSeason = isSpooktoberSeason(now);
      setAvailable(inSeason);
      if (!inSeason) setScreen("home");
      timer = setTimeout(check, nextSpooktoberDateCheck(now));
    };
    check();
    document.addEventListener("visibilitychange", check);
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", check); };
  }, []);
  return (
    <div className="spooktober-home">
      <div className="spooktober-home-base" inert={screen !== "home"} style={{ visibility: screen === "home" ? "visible" : "hidden" }}>
        <Home active={active && screen === "home"} onReady={onReady} seasonalInvitation={available ? <SpooktoberInvitation collapsed={isDismissed("spooktober")} onDismiss={() => dismiss("spooktober")} onOpen={openFestival} onPrepare={prepareFestival} /> : undefined} />
      </div>
      {festivalOpened && <div className="spooktober-surface" data-spooktober-surface hidden={screen !== "festival"} inert={screen !== "festival"}>
        <Suspense fallback={<SpooktoberLoadingScene onBack={active && screen === "festival" ? close : undefined} />}><Festival active={active && screen === "festival"} onBack={close} playlistRequest={playlistRequest} entryToken={entryToken} /></Suspense>
      </div>}
    </div>
  );
}
