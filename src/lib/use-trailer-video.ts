import { useEffect, useRef, useState, type RefObject } from "react";
import { claimTrailerVideo, releaseTrailerVideo, trailerVideoHeldBy } from "@/lib/trailer-video";

const SRC_DELAY_MS = 120;

export function useTrailerVideo(opts: {
  src: string | null;
  active: boolean;
  className: string;
  loop: boolean;
  onEnded?: () => void;
}): {
  slot: RefObject<HTMLDivElement | null>;
  video: RefObject<HTMLVideoElement | null>;
  ready: boolean;
} {
  const { src, active, className, loop, onEnded } = opts;
  const slot = useRef<HTMLDivElement | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const token = useRef<object>({});
  const finish = useRef(onEnded);
  finish.current = onEnded;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const mount = slot.current;
    if (!src || !active || !mount) return;
    const mine = token.current;
    const node = claimTrailerVideo(mine, mount);
    video.current = node;
    node.className = className;
    node.loop = loop;
    node.playsInline = true;
    const holds = node.getAttribute("src") === src;
    setReady(holds && node.readyState >= 3);
    const onCanPlay = () => setReady(true);
    const onFinish = () => finish.current?.();
    node.addEventListener("canplay", onCanPlay);
    node.addEventListener("ended", onFinish);
    const timer = window.setTimeout(() => {
      if (video.current !== node || !trailerVideoHeldBy(mine)) return;
      if (node.getAttribute("src") === src) {
        if (node.readyState >= 3) setReady(true);
        return;
      }
      node.preload = "auto";
      node.src = src;
    }, SRC_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
      node.removeEventListener("canplay", onCanPlay);
      node.removeEventListener("ended", onFinish);
      video.current = null;
      setReady(false);
      releaseTrailerVideo(mine);
    };
  }, [src, active, className, loop]);

  return { slot, video, ready };
}
