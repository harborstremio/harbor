import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Volume2, VolumeX } from "lucide-react";
import { useT } from "@/lib/i18n";
import { loadSportsYoutubeVideos, type SportsYoutubeQuery } from "@/lib/sports/youtube-videos";
import "./sports-video-preview.css";

type Player = {
  mute(): void;
  unMute(): void;
  getCurrentTime(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  destroy(): void;
};
type Resume = { seconds: number; unmuted: boolean; at: number };
const resumes = new Map<string, Resume>();
function saveResume(id: string, seconds: number, unmuted: boolean) {
  if (!Number.isFinite(seconds) || seconds < 0) return;
  resumes.delete(id);
  resumes.set(id, { seconds, unmuted, at: Date.now() });
  for (const [key, value] of resumes) if (Date.now() - value.at > 30 * 60_000) resumes.delete(key);
  while (resumes.size > 40) resumes.delete(resumes.keys().next().value!);
}
type YoutubeApi = {
  Player: new (element: HTMLElement, options: Record<string, unknown>) => Player;
};
type YoutubeWindow = Window & {
  YT?: YoutubeApi;
  onYouTubeIframeAPIReady?: () => void;
};
let apiPromise: Promise<YoutubeApi> | undefined;
let stopCurrent: (() => void) | undefined;

/** Load the official player once, only after someone dwells on a video card. */
function youtubeApi(): Promise<YoutubeApi> {
  const scope = window as YoutubeWindow;
  if (scope.YT?.Player) return Promise.resolve(scope.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<YoutubeApi>((resolve, reject) => {
    const previous = scope.onYouTubeIframeAPIReady;
    const script = document.createElement("script");
    const finish = (error?: Error) => {
      clearTimeout(deadline);
      if (scope.onYouTubeIframeAPIReady === ready) scope.onYouTubeIframeAPIReady = previous;
      if (error) {
        script.remove();
        apiPromise = undefined;
        reject(error);
      } else if (scope.YT) resolve(scope.YT);
    };
    const ready = () => {
      try {
        previous?.();
      } finally {
        finish();
      }
    };
    const deadline = setTimeout(() => finish(new Error("Video player unavailable")), 10000);
    scope.onYouTubeIframeAPIReady = ready;
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => finish(new Error("Video player unavailable"));
    document.head.appendChild(script);
  });
  return apiPromise;
}

/** Video and sound control inside a marked card; match activation stays separate. */
export function SportsVideoPreview({
  query,
  videoUrl,
  title,
  enabled = true,
}: {
  query?: SportsYoutubeQuery;
  videoUrl?: string;
  title: string;
  enabled?: boolean;
}) {
  const t = useT();
  const root = useRef<HTMLSpanElement>(null);
  const toggleSound = useRef<(() => void) | undefined>(undefined);
  const [muted, setMuted] = useState(true);
  const [state, setState] = useState<"idle" | "loading" | "playing" | "buffering" | "unavailable">(
    "idle",
  );
  const key = JSON.stringify({ query, videoUrl });
  useEffect(() => {
    const layer = root.current;
    const trigger = layer?.closest<HTMLElement>("button,[data-sports-preview-trigger]");
    if (!layer || !trigger || !enabled) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const fine = matchMedia("(any-hover: hover) and (any-pointer: fine)");
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cleanup: (() => void) | undefined;
    let serial = 0;
    const stop = () => {
      serial++;
      clearTimeout(timer);
      timer = undefined;
      cleanup?.();
      cleanup = undefined;
      toggleSound.current = undefined;
      layer.querySelector(".sh-video-preview-host")?.replaceChildren();
      setState("idle");
      if (stopCurrent === stop) stopCurrent = undefined;
    };
    const unavailable = () => {
      stop();
      setState("unavailable");
    };
    const eligible = () => {
      const connection = (navigator as Navigator & { connection?: { saveData?: boolean } })
        .connection;
      if (document.hidden || motion.matches || connection?.saveData) return false;
      const dialogs = [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')];
      if (dialogs.length && !dialogs.at(-1)!.contains(trigger)) return false;
      const rect = layer.getBoundingClientRect();
      // YouTube requires at least a 200 × 200 player; small thumbnails stay static.
      const visibleHeight = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0));
      const visibleWidth = Math.max(0, Math.min(rect.right, innerWidth) - Math.max(rect.left, 0));
      return (
        rect.width >= 200 &&
        rect.height >= 200 &&
        visibleWidth * visibleHeight > (rect.width * rect.height) / 2
      );
    };
    const start = () => {
      stop();
      if (!eligible()) return;
      stopCurrent?.();
      stopCurrent = stop;
      const controller = new AbortController();
      let player: Player | undefined;
      let videoId: string | undefined;
      let soundOn = false;
      let intentional = false;
      let ended = false;
      let deadline: ReturnType<typeof setTimeout> | undefined;
      const observer = new MutationObserver(() => {
        if (!eligible()) stop();
      });
      const onKey = (event: KeyboardEvent) => {
        if (event.key === "Escape") stop();
      };
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["aria-modal"],
      });
      document.addEventListener("scroll", stop, true);
      document.addEventListener("visibilitychange", stop);
      document.addEventListener("keydown", onKey, true);
      window.addEventListener("blur", stop);
      window.addEventListener("resize", stop);
      motion.addEventListener("change", stop);
      cleanup = () => {
        controller.abort();
        clearTimeout(deadline);
        observer.disconnect();
        document.removeEventListener("scroll", stop, true);
        document.removeEventListener("visibilitychange", stop);
        document.removeEventListener("keydown", onKey, true);
        window.removeEventListener("blur", stop);
        window.removeEventListener("resize", stop);
        motion.removeEventListener("change", stop);
        if (player && videoId && !ended) {
          try {
            saveResume(videoId, player.getCurrentTime(), soundOn);
          } catch {
            /* Player may not have become ready. */
          }
        }
        player?.destroy();
      };
      const generation = serial;
      timer = setTimeout(async () => {
        if (!eligible()) return stop();
        setState("loading");
        deadline = setTimeout(unavailable, 12000);
        try {
          const videos = await loadSportsYoutubeVideos(
            {
              ...query,
              names: query?.names ?? [],
              providerUrls: videoUrl
                ? [videoUrl, ...(query?.providerUrls ?? [])]
                : query?.providerUrls,
            },
            controller.signal,
          );
          if (controller.signal.aborted || generation !== serial) return;
          if (!videos.length) return unavailable();
          const api = await youtubeApi();
          if (controller.signal.aborted || generation !== serial || !eligible()) return;
          const host = document.createElement("span");
          layer.querySelector(".sh-video-preview-host")?.appendChild(host);
          videoId = videos[0].id;
          const saved = resumes.get(videoId);
          const resume = saved && Date.now() - saved.at < 30 * 60_000 ? saved : undefined;
          soundOn = resume?.unmuted ?? false;
          intentional = soundOn;
          setMuted(!soundOn);
          player = new api.Player(host, {
            host: "https://www.youtube-nocookie.com",
            width: "100%",
            height: "100%",
            videoId: videos[0].id,
            playerVars: {
              autoplay: 0,
              start: Math.floor(resume?.seconds ?? 0),
              controls: 0,
              disablekb: 1,
              playsinline: 1,
              rel: 0,
              origin: location.origin,
            },
            events: {
              onReady: ({ target }: { target: Player }) => {
                if (!controller.signal.aborted) {
                  if (soundOn) target.unMute();
                  else target.mute();
                  if (resume && resume.seconds > 0) target.seekTo(resume.seconds, true);
                  toggleSound.current = () => {
                    soundOn = !soundOn;
                    intentional = true;
                    if (soundOn) target.unMute();
                    else target.mute();
                    setMuted(!soundOn);
                    clearTimeout(deadline);
                  };
                  target.playVideo();
                }
              },
              onStateChange: ({ data }: { data: number }) => {
                if (controller.signal.aborted) return;
                if (data === 1) {
                  clearTimeout(deadline);
                  if (!intentional) deadline = setTimeout(stop, 30000);
                  setState("playing");
                } else if (data === 3) {
                  setState((previous) =>
                    previous === "playing" || previous === "buffering" ? "buffering" : "loading",
                  );
                  clearTimeout(deadline);
                  deadline = setTimeout(unavailable, 7000);
                } else if (data === 0) {
                  ended = true;
                  if (videoId) resumes.delete(videoId);
                  stop();
                } else if (data === 2) stop();
              },
              onError: unavailable,
              onAutoplayBlocked: () => {
                if (soundOn && player) {
                  soundOn = false;
                  setMuted(true);
                  player.mute();
                  player.playVideo();
                } else unavailable();
              },
            },
          });
          const frame = layer.querySelector("iframe");
          if (frame) {
            frame.tabIndex = -1;
            frame.title = videos[0].title || title;
            frame.setAttribute("aria-hidden", "true");
          }
        } catch {
          if (!controller.signal.aborted) unavailable();
        }
      }, 900);
    };
    const pointer = (event: PointerEvent) => {
      if (event.pointerType !== "touch" && event.buttons === 0 && fine.matches) start();
    };
    const isControl = (target: EventTarget | null) =>
      target instanceof Element && !!target.closest(".sh-video-preview-sound");
    const activate = (event: Event) => {
      if (!isControl(event.target)) stop();
    };
    const blur = (event: FocusEvent) => {
      if (!(event.relatedTarget instanceof Node) || !trigger.contains(event.relatedTarget)) stop();
    };
    const focus = (event: FocusEvent) => {
      if (isControl(event.target) || cleanup) return;
      if (event.target instanceof HTMLElement && event.target.matches(":focus-visible")) start();
    };
    trigger.addEventListener("pointerenter", pointer);
    trigger.addEventListener("pointerleave", stop);
    trigger.addEventListener("focusin", focus);
    trigger.addEventListener("focusout", blur);
    trigger.addEventListener("pointerdown", activate);
    trigger.addEventListener("click", activate, true);
    return () => {
      stop();
      trigger.removeEventListener("pointerenter", pointer);
      trigger.removeEventListener("pointerleave", stop);
      trigger.removeEventListener("focusin", focus);
      trigger.removeEventListener("focusout", blur);
      trigger.removeEventListener("pointerdown", activate);
      trigger.removeEventListener("click", activate, true);
    };
  }, [key, title, enabled]);
  return (
    <span ref={root} className="sh-video-preview" data-state={state}>
      <span className="sh-video-preview-host" />
      {(state === "loading" || state === "buffering") && (
        <LoaderCircle className="sh-video-preview-loading" size={22} />
      )}
      {state === "unavailable" && (
        <span className="sh-video-preview-unavailable" role="status">
          {t("Preview unavailable")}
        </span>
      )}
      {(state === "playing" || state === "buffering") && (
        <button
          type="button"
          className="sh-video-preview-sound"
          aria-label={t(muted ? "Unmute" : "Mute")}
          title={t(muted ? "Unmute" : "Mute")}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") event.stopPropagation();
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            toggleSound.current?.();
          }}
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          {t(muted ? "Unmute" : "Mute")}
        </button>
      )}
    </span>
  );
}
