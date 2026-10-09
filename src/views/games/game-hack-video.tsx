import "./game-hack-video.css";
import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ArrowUpRight, X } from "lucide-react";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useSectionBack } from "@/lib/section-back";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import type { HackVideo } from "@/lib/games/hack-editorial";

const Watch = createContext<(video: HackVideo) => void>(video => { void openUrl(`https://www.youtube.com/watch?v=${video.id}`); });
export const useHackVideo = () => useContext(Watch);
export function HackVideoProvider({ active, children }: { active: boolean; children: ReactNode }) {
  const [video, setVideo] = useState<HackVideo | null>(null);
  useEffect(() => { if (!active) setVideo(null); }, [active]);
  const watch = (next: HackVideo) => {
    if (!active) return;
    for (const other of document.querySelectorAll<HTMLMediaElement>('.games-view audio,.games-view video')) if (!other.paused) other.pause();
    void import('@/lib/music/player').then(({ getMusicState, toggleMusicPlayback }) => { if (getMusicState().phase === 'playing') toggleMusicPlayback(); }).catch(() => {});
    setVideo(next);
  };
  return <Watch.Provider value={watch}>{children}{active && video && <HackVideoDialog key={video.id} video={video} close={() => setVideo(null)}/>}</Watch.Provider>;
}
function HackVideoDialog({ video, close }: { video: HackVideo; close: () => void }) {
  const t = useT(), title = useId(), { closing, close: dismiss } = useModalExit(close);
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = content.current;
    const first = dialog?.querySelector<HTMLButtonElement>('button');
    first?.focus({ preventScroll: true });
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !dialog) return;
      const items = [...dialog.querySelectorAll<HTMLElement>('button, a[href], iframe')];
      const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const retainFocus = () => { if (dialog && !dialog.contains(document.activeElement)) first?.focus({ preventScroll: true }); };
    document.addEventListener('keydown', trap);
    document.addEventListener('focusin', retainFocus);
    return () => { document.removeEventListener('keydown', trap); document.removeEventListener('focusin', retainFocus); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  useSectionBack(dismiss, true);
  return <ModalShell closing={closing} onDismiss={dismiss} width={980} labelledBy={title}>
    <div className="games-hack-watch" ref={content}>
      <header><div><small>{video.gameName}{video.creator ? ` · ${video.creator}` : ""}</small><h2 id={title}>{video.title}</h2></div><button className="games-icon-button" onClick={dismiss} aria-label={t("common.close")}><X size={21}/></button></header>
      {!closing && <iframe src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0&playsinline=1`} title={video.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/>}
      <footer><span>{t("games.hub.videoNote")}</span><a href={`https://www.youtube.com/watch?v=${video.id}`} onClick={event => { event.preventDefault(); void openUrl(event.currentTarget.href); }}>{t("games.hub.onYouTube")}<ArrowUpRight size={16}/></a></footer>
    </div>
  </ModalShell>;
}
