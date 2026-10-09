import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MusicNowPlayingMark } from "@/components/music/music-now-playing-mark";
import { useMusicPlaybackOrigin } from "@/lib/music/playback-origin";
import { useMusicNowPlaying } from "@/lib/music/use-now-playing";

export function SpooktoberPlaylistIndicator({ root, active }: { root: ShadowRoot; active: boolean }) {
  const origin = useMusicPlaybackOrigin();
  const now = useMusicNowPlaying();
  const [target, setTarget] = useState<Element | null>(null);
  const id = origin?.kind === "playlist" && origin.id.startsWith("spooktober:") ? origin.id.slice(11) : null;
  const visible = active && !!now.id && ["playing", "paused", "resolving"].includes(now.phase);
  useEffect(() => {
    let card: HTMLElement | undefined;
    const sync = () => {
      const next = visible && id
        ? [...root.querySelectorAll<HTMLElement>(".playlist-card")].find(item => item.dataset.playlist === id)
        : undefined;
      if (card !== next) card?.removeAttribute("aria-current");
      card = next;
      card?.setAttribute("aria-current", "true");
      setTarget(card?.querySelector(".mix-art") ?? null);
    };
    sync();
    // The event renderer replaces its cards when navigating back from a section.
    const observer = new MutationObserver(sync);
    if (visible && id) observer.observe(root, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      card?.removeAttribute("aria-current");
    };
  }, [root, visible, id]);
  return target ? createPortal(
    <span className="spook-playlist-playing" data-paused={now.phase === "paused" || undefined}>
      <MusicNowPlayingMark loading={now.phase === "resolving"} />
    </span>, target,
  ) : null;
}
