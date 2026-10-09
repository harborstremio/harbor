import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { LoaderCircle, Pause, Play } from "@/components/icons/music-icons";
import { useT } from "@/lib/i18n";
import { useCollectionPlayback } from "@/lib/music/use-collection-playback";
import { MUSIC_SCROLL_POSITION_EVENT } from "@/lib/music/scroll-continuity";
import type { MusicTrack } from "@/lib/music/types";
import "./music-sticky-title.css";

export function MusicStickyTitle({
  title,
  tracks,
  onPlay,
  children,
  revealAfter,
}: {
  title: string;
  tracks: MusicTrack[];
  onPlay: (track: MusicTrack, queue: MusicTrack[]) => void;
  children?: ReactNode;
  revealAfter?: RefObject<HTMLElement | null>;
}) {
  const t = useT();
  const host = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  const now = useRef(false);
  const { playing, busy, play } = useCollectionPlayback(tracks, onPlay);
  useLayoutEffect(() => {
    const node = host.current;
    const scroller = node?.closest("main");
    if (!node || !scroller) return;
    const read = () => {
      const pin =
        scroller.getBoundingClientRect().top +
        Number.parseFloat(getComputedStyle(scroller).paddingTop || "0");
      const next = (revealAfter?.current?.getBoundingClientRect().bottom ?? node.getBoundingClientRect().top) <= pin + 1;
      if (next === now.current) return;
      now.current = next;
      setStuck(next);
    };
    read();
    scroller.addEventListener("scroll", read, { passive: true });
    scroller.addEventListener(MUSIC_SCROLL_POSITION_EVENT, read);
    const watch = new ResizeObserver(read);
    watch.observe(scroller);
    if (revealAfter?.current) watch.observe(revealAfter.current);
    return () => {
      scroller.removeEventListener("scroll", read);
      scroller.removeEventListener(MUSIC_SCROLL_POSITION_EVENT, read);
      watch.disconnect();
    };
  }, [title, revealAfter]);
  const label = t(playing ? "music.pause" : "music.play");
  return (
    <div ref={host} className="music-sticky-title" data-on={stuck || undefined}>
      <div className="music-sticky-title-bar" inert={!stuck} aria-hidden={!stuck}>
        <button
          type="button"
          className="music-sticky-play"
          onClick={play}
          disabled={!tracks.length || busy}
          tabIndex={stuck ? 0 : -1}
          aria-hidden={!stuck}
          aria-label={label}
          title={label}
        >
          {busy ? (
            <LoaderCircle
              size={20}
              className="animate-spin motion-reduce:animate-none"
              aria-hidden
            />
          ) : playing ? (
            <Pause size={20} fill="currentColor" aria-hidden />
          ) : (
            <Play size={20} fill="currentColor" aria-hidden />
          )}
        </button>
        <span className="music-sticky-name">{title}</span>
        {children}
      </div>
    </div>
  );
}
