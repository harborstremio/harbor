import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "@/components/icons/music-icons";
import { useT } from "@/lib/i18n";
import { isWindowsDesktop } from "@/lib/platform";
import { useView } from "@/lib/view";
import {
  embedYouTubeMusic,
  openYouTubeMusic,
  setYouTubeMusicRect,
  setYouTubeMusicVisible,
  unembedYouTubeMusic,
} from "@/lib/music/ytmusic";

/**
 * Hosts YouTube Music inside the Music tab. The page itself renders in a native child window
 * sitting over this element, so this element only reserves the space and keeps reporting where
 * that space is, the same contract the embedded mpv surface uses.
 */
export function MusicYouTube({ active, onFellBack }: { active: boolean; onFellBack: () => void }) {
  const t = useT();
  // Pushing a player or a detail page only marks the view stack invisible in CSS, which a
  // native child window ignores. "music" being the top frame is the real test for whether
  // anything is stacked over this surface.
  const { topKind } = useView();
  const onTop = active && topKind === "music";
  const host = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  // The child window's lifetime is tied to mount and unmount, nothing else. Keeping the
  // callback in a ref keeps it out of the embed effect's deps: this component's parent
  // re-renders on every playback tick, and a changing dep there would tear the window down
  // and rebuild it several times a second.
  const fellBack = useRef(onFellBack);
  fellBack.current = onFellBack;

  const rect = useCallback(() => {
    const element = host.current;
    if (!element) return null;
    const box = element.getBoundingClientRect();
    if (box.width < 1 || box.height < 1) return null;
    return {
      cssLeft: box.left,
      cssTop: box.top,
      cssWidth: box.width,
      cssHeight: box.height,
      cssViewW: window.innerWidth,
      cssViewH: window.innerHeight,
    };
  }, []);

  const push = useCallback(() => {
    const next = rect();
    if (!next) return;
    // The window can be destroyed behind this component's back. close_aux_windows closes
    // everything but "main", and the updater uses it. A rejected reposition is the signal that
    // it is gone, so the overlay comes back rather than leaving an empty panel.
    void setYouTubeMusicRect(next).catch(() => setReady(false));
  }, [rect]);

  useEffect(() => {
    let cancelled = false;
    // parent_raw is a real child window only on Windows. Everywhere else this falls back to
    // the separate window rather than pretending to embed.
    if (!isWindowsDesktop()) {
      void openYouTubeMusic()
        .then(() => fellBack.current())
        .catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
      return;
    }

    // The host can measure 0x0 on the first frame, and while the Music view is hidden. Waiting
    // for a real box beats returning silently and leaving an empty panel behind.
    let frame = 0;
    const attempt = () => {
      if (cancelled) return;
      const initial = rect();
      if (!initial) {
        frame = window.requestAnimationFrame(attempt);
        return;
      }
      void embedYouTubeMusic(initial)
        .then(() => {
          if (!cancelled) setReady(true);
        })
        .catch((cause) => {
          if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
        });
    };
    attempt();

    return () => {
      cancelled = true;
      if (frame) window.cancelAnimationFrame(frame);
      setReady(false);
      void unembedYouTubeMusic().catch(() => {});
    };
  }, [rect]);

  // A native child window does not honour the display:none Harbor puts on an inactive view,
  // and the view stays mounted for a minute after navigation, so visibility is explicit.
  useEffect(() => {
    void setYouTubeMusicVisible(onTop).catch(() => {});
  }, [onTop]);

  // Not gated on `ready`: if the embed reported an error but a window exists anyway, the rect
  // should still track rather than freezing wherever it first landed.
  useEffect(() => {
    push();
    const observer = new ResizeObserver(push);
    if (host.current) observer.observe(host.current);
    window.addEventListener("resize", push);
    window.addEventListener("scroll", push, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", push);
      window.removeEventListener("scroll", push, true);
    };
  }, [push]);

  return (
    <div ref={host} className="relative min-h-[70vh] w-full overflow-hidden rounded-2xl">
      {!ready && (
        <div className="absolute inset-0 grid place-items-center">
          {error ? (
            <span className="max-w-md px-6 text-center text-[13px] text-danger">{error}</span>
          ) : (
            <span className="flex items-center gap-2 text-[13px] text-ink-muted">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {t("music.ytm.loading")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
