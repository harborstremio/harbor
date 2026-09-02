import { useEffect, useRef } from "react";
import Hls from "hls.js";
import mpegts from "mpegts.js";

// Long enough that an IPTV stream rebuffering on a busy line is never mistaken
// for a dead one, short enough that a genuinely dead channel still reports.
const STALL_GRACE_MS = 12000;

// Live IPTV throws fatal-but-recoverable errors as a matter of course. Six
// in-place recoveries before the channel is called dead.
const MAX_RECOVERIES = 6;

type Kind = "hls" | "mpegts" | "native";

function sniffKind(url: string): Kind {
  const u = url.toLowerCase().split("?")[0];
  if (u.endsWith(".m3u8") || u.includes(".m3u8/")) return "hls";
  if (u.endsWith(".ts")) return "mpegts";
  if (u.endsWith(".mpd")) return "native";
  if (u.endsWith(".mp4") || u.endsWith(".webm") || u.endsWith(".mov")) return "native";
  return "hls";
}

// Multiview runs four of these on purpose, so exclusivity is opt in. The Big
// Picture previews pass it: exactly one channel is ever being fetched, the one
// under the ring, and moving on tears the previous one down before the next
// opens a socket. IPTV resellers commonly cap concurrent connections, so a
// second stream does not just waste bandwidth, it gets the first one dropped.
let exclusiveOwner: symbol | null = null;
const exclusiveTeardown = new Map<symbol, () => void>();

export function MultiPlayer({
  url,
  muted,
  cover = false,
  exclusive = false,
  onPlaying,
  onError,
}: {
  url: string;
  muted: boolean;
  cover?: boolean;
  exclusive?: boolean;
  onPlaying?: () => void;
  onError?: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const tokenRef = useRef<symbol | null>(null);
  if (tokenRef.current === null) tokenRef.current = Symbol("bp-preview");
  const token = tokenRef.current;
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
    // Claim the slot before touching the network. Any other exclusive preview
    // is torn down first, so only the hovered channel is ever being fetched.
    if (exclusive) {
      if (exclusiveOwner && exclusiveOwner !== token) {
        exclusiveTeardown.get(exclusiveOwner)?.();
        exclusiveTeardown.delete(exclusiveOwner);
      }
      exclusiveOwner = token;
    }
    let disposed = false;

    const kind = sniffKind(url);
    let hls: Hls | null = null;
    let ts: ReturnType<typeof mpegts.createPlayer> | null = null;

    // stalled is not a failure. The spec fires it whenever media data has not
    // arrived for about three seconds, which on a live IPTV stream is ordinary
    // buffering. Treating it as an error meant every routine hiccup tore the
    // stream down, and the callers blacklist a channel on the first error, so a
    // working channel stopped for good. A stream that has genuinely died still
    // fails, it just has to stay silent for STALL_GRACE_MS first.
    let stallTimer = 0;
    const clearStall = () => {
      if (!stallTimer) return;
      window.clearTimeout(stallTimer);
      stallTimer = 0;
    };
    const handlePlaying = () => {
      clearStall();
      if (!disposed) onPlayingRef.current?.();
    };
    const handleError = () => {
      clearStall();
      if (!disposed) onErrorRef.current?.();
    };
    const handleStalled = () => {
      if (disposed || stallTimer) return;
      stallTimer = window.setTimeout(() => {
        stallTimer = 0;
        handleError();
      }, STALL_GRACE_MS);
    };

    video.addEventListener("playing", handlePlaying);
    video.addEventListener("timeupdate", clearStall);
    video.addEventListener("error", handleError);
    video.addEventListener("stalled", handleStalled);
    video.addEventListener("waiting", handleStalled);

    const tryNative = () => {
      video.src = url;
      video.play().catch(handleError);
    };

    if (kind === "hls" && Hls.isSupported()) {
      // lowLatencyMode makes hls.js chase the live edge by ALTERING PLAYBACK
      // RATE: it speeds up, overshoots, slows down, and on a reseller IPTV line
      // it never settles. That is the preview visibly surging and stalling. A
      // preview does not need to be near the edge, it needs to be smooth, so
      // the chase is off and the buffer is deep enough to ride out a hiccup.
      hls = new Hls({
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        lowLatencyMode: false,
        backBufferLength: 10,
        manifestLoadingMaxRetry: 3,
        manifestLoadingRetryDelay: 1000,
        levelLoadingMaxRetry: 3,
        levelLoadingRetryDelay: 1000,
        fragLoadingMaxRetry: 4,
        fragLoadingRetryDelay: 1000,
      });
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });
      // hls.js documents fatal network and media errors as RECOVERABLE, and a
      // live IPTV line throws both routinely. Reporting the first one is why a
      // channel that had been playing fine went blank and stayed blank. Retry
      // in place, and only surrender once recovery itself keeps failing.
      let recoveries = 0;
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return;
        if (recoveries >= MAX_RECOVERIES) {
          handleError();
          return;
        }
        recoveries += 1;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls?.startLoad();
          return;
        }
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls?.recoverMediaError();
          return;
        }
        handleError();
      });
    } else if (kind === "mpegts" && mpegts.isSupported()) {
      ts = mpegts.createPlayer(
        { type: "mpegts", url, isLive: true, cors: true },
        { enableWorker: true, liveBufferLatencyChasing: false, lazyLoad: false },
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

    if (exclusive) exclusiveTeardown.set(token, () => cleanupRef.current?.());

    cleanupRef.current = () => {
      disposed = true;
      clearStall();
      if (exclusive) {
        exclusiveTeardown.delete(token);
        if (exclusiveOwner === token) exclusiveOwner = null;
      }
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("timeupdate", clearStall);
      video.removeEventListener("error", handleError);
      video.removeEventListener("stalled", handleStalled);
      video.removeEventListener("waiting", handleStalled);
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
