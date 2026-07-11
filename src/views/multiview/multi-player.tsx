import Hls from "hls.js";
import mpegts from "mpegts.js";
import { useEffect, useRef } from "react";

type Kind = "hls" | "mpegts" | "native";

function sniffKind(url: string): Kind {
  const u = url.toLowerCase().split("?")[0];
  if (u.endsWith(".m3u8") || u.includes(".m3u8/")) return "hls";
  if (u.endsWith(".ts")) return "mpegts";
  if (u.endsWith(".mpd")) return "native";
  if (u.endsWith(".mp4") || u.endsWith(".webm") || u.endsWith(".mov")) return "native";
  return "hls";
}

export function MultiPlayer({
  url,
  muted,
  cover = false,
  onPlaying,
  onError,
}: {
  url: string;
  muted: boolean;
  cover?: boolean;
  onPlaying?: () => void;
  onError?: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const onPlayingRef = useRef(onPlaying);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onPlayingRef.current = onPlaying;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    cleanupRef.current?.();
    let disposed = false;

    const kind = sniffKind(url);
    let hls: Hls | null = null;
    let ts: ReturnType<typeof mpegts.createPlayer> | null = null;

    const handlePlaying = () => {
      if (!disposed) onPlayingRef.current?.();
    };
    const handleError = () => {
      if (!disposed) onErrorRef.current?.();
    };

    video.addEventListener("playing", handlePlaying);
    video.addEventListener("error", handleError);
    video.addEventListener("stalled", handleError);

    const tryNative = () => {
      video.src = url;
      video.play().catch(handleError);
    };

    if (kind === "hls" && Hls.isSupported()) {
      hls = new Hls({
        maxBufferLength: 8,
        maxMaxBufferLength: 20,
        lowLatencyMode: true,
        backBufferLength: 4,
        manifestLoadingMaxRetry: 1,
        manifestLoadingRetryDelay: 1500,
        levelLoadingMaxRetry: 1,
        levelLoadingRetryDelay: 1500,
        fragLoadingMaxRetry: 2,
        fragLoadingRetryDelay: 1500,
      });
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return;
        handleError();
      });
    } else if (kind === "mpegts" && mpegts.isSupported()) {
      ts = mpegts.createPlayer(
        { type: "mpegts", url, isLive: true, cors: true },
        { enableWorker: true, liveBufferLatencyChasing: true, lazyLoadMaxDuration: 4 },
      );
      ts.attachMediaElement(video);
      ts.on(mpegts.Events.ERROR, handleError);
      ts.load();
      ts.play()?.catch(() => {});
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      tryNative();
    } else {
      tryNative();
    }

    cleanupRef.current = () => {
      disposed = true;
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("error", handleError);
      video.removeEventListener("stalled", handleError);
      if (hls) {
        try {
          hls.destroy();
        } catch {
          /* ignore */
        }
      }
      if (ts) {
        try {
          ts.pause();
          ts.unload();
          ts.detachMediaElement();
          ts.destroy();
        } catch {
          /* ignore */
        }
      }
      try {
        video.pause();
        video.removeAttribute("src");
        video.load();
      } catch {
        /* ignore */
      }
    };

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [url]);

  useEffect(() => {
    if (ref.current) ref.current.muted = muted;
  }, [muted]);

  return (
    <video
      ref={ref}
      className={`h-full w-full bg-black ${cover ? "object-cover" : "object-contain"}`}
      playsInline
      autoPlay
      muted={muted}
    />
  );
}
