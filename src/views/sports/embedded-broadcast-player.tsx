import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import {
  ArrowLeft,
  Expand,
  ExternalLink,
  LoaderCircle,
  Maximize2,
  MessageSquare,
  Minus,
  PictureInPicture2,
  Plus,
  Shrink,
  X,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import { useView, type PlayerSrc } from "@/lib/view";
import { openUrl } from "@/lib/window";
import {
  esportsChatPopoutUrl,
  esportsExternalUrl,
  esportsPlayback,
  type EsportsStream,
} from "@/lib/sports/esports-streams";
import { broadcastPipSession } from "@/lib/sports/broadcast-pip";
import { officialBroadcastSource } from "@/lib/sports/esports-streams";
import "./embedded-broadcast-player.css";
import { BroadcastChannelAvatar } from "./broadcast-channel-avatar";
import { BroadcastScoreTicker } from "./broadcast-score-ticker";
import { useDockDrag } from "./use-dock-drag";

export function EmbeddedBroadcastPlayer({
  src,
  stream,
}: {
  src: PlayerSrc;
  stream: EsportsStream;
}) {
  const view = useView();
  return <BroadcastPlayer src={src} stream={stream} actions={view} />;
}

export function EmbeddedBroadcastPip({
  stream,
  onClose,
}: {
  stream: EsportsStream;
  onClose: () => void;
}) {
  const src = { ...officialBroadcastSource(stream)!, sportsDocked: false };
  return (
    <BroadcastPlayer
      src={src}
      stream={stream}
      detached
      actions={{ replacePlayerSrc: () => {}, exitPlayback: onClose }}
    />
  );
}

function BroadcastPlayer({
  src,
  stream,
  actions,
  detached = false,
}: {
  src: PlayerSrc;
  stream: EsportsStream;
  detached?: boolean;
  actions: Pick<ReturnType<typeof useView>, "replacePlayerSrc" | "exitPlayback">;
}) {
  const t = useT();
  const { replacePlayerSrc, exitPlayback } = actions;
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 534, height: 300, scale: 1 });
  const trigger = useRef(document.activeElement as HTMLElement | null);
  const [minimized, setMinimized] = useState(false);
  const [loaded, setLoaded] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [windowFailed, setWindowFailed] = useState(false);
  const [openingPip, setOpeningPip] = useState(false);
  const [pipFailed, setPipFailed] = useState(false);
  const [chatFailed, setChatFailed] = useState(false);
  const openingPipRef = useRef(false);
  const docked = src.sportsDocked !== false;
  const playback = esportsPlayback(stream, window.location.hostname);
  const rawEmbed = playback?.mode === "iframe" ? playback.url : null;
  const embed =
    detached && rawEmbed
      ? rawEmbed.replace(
          /autoplay=(?:false|0)/,
          stream.platform === "youtube" ? "autoplay=1" : "autoplay=true",
        )
      : rawEmbed;
  // Twitch refuses an iframe at Harbor's packaged origin, so the channel plays top-level.
  const windowUrl = playback?.mode === "window" ? playback.url : null;
  const external = esportsExternalUrl(stream.url);
  const chatPopoutUrl = esportsChatPopoutUrl(stream);
  const drag = useDockDrag(root, docked && !detached && !isFullscreen);
  useEffect(() => setMinimized(false), [stream.url]);
  useEffect(() => {
    const update = () =>
      setIsFullscreen(
        !!document.fullscreenElement && !!root.current?.contains(document.fullscreenElement),
      );
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);
  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      const width = element.clientWidth,
        height = element.clientHeight;
      // Keep the provider's full minimum viewport, scaling it to fit instead of clipping it.
      // Ignore the collapsed stage so background playback retains its viewport.
      if (!width || !height) return;
      const scale = Math.min(1, width / 400, height / 300);
      setViewport({ width: width / scale, height: height / scale, scale });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const leaveFullscreen = useCallback(async () => {
    if (document.fullscreenElement && root.current?.contains(document.fullscreenElement)) {
      await document.exitFullscreen().catch(() => {});
    }
  }, []);
  const restoreDock = useCallback(() => {
    void leaveFullscreen();
    setMinimized(false);
    replacePlayerSrc({ ...src, sportsDocked: true });
  }, [src, replacePlayerSrc, leaveFullscreen]);
  const close = useCallback(() => {
    void leaveFullscreen();
    exitPlayback();
  }, [exitPlayback, leaveFullscreen]);
  const openWindow = useCallback(async (url: string) => {
    setWindowFailed(false);
    try {
      if ("__TAURI_INTERNALS__" in window) await invoke("browser_open", { url });
      else openUrl(url);
    } catch {
      setWindowFailed(true);
    }
  }, []);
  const openedRef = useRef("");
  useEffect(() => {
    // Mounting this player is the watch intent, so the channel opens once per selection.
    if (!windowUrl || openedRef.current === windowUrl) return;
    openedRef.current = windowUrl;
    void openWindow(windowUrl);
  }, [windowUrl, openWindow]);
  useEffect(() => {
    const back = (event: Event) => {
      event.preventDefault();
      if (detached || docked) close();
      else restoreDock();
    };
    window.addEventListener("harbor:local-back", back);
    return () => window.removeEventListener("harbor:local-back", back);
  }, [detached, docked, close, restoreDock]);
  useEffect(() => {
    const element = root.current;
    const previous = trigger.current;
    return () => {
      if (document.fullscreenElement && element?.contains(document.fullscreenElement))
        void document.exitFullscreen().catch(() => {});
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  const fullscreen = () => {
    setMinimized(false);
    const request = root.current?.requestFullscreen;
    if (request)
      void request
        .call(root.current)
        .catch(() => replacePlayerSrc({ ...src, sportsDocked: false }));
    else replacePlayerSrc({ ...src, sportsDocked: false });
  };
  const popOut = async () => {
    if (openingPipRef.current) return;
    openingPipRef.current = true;
    setOpeningPip(true);
    setPipFailed(false);
    try {
      await invoke("pip_open", { session: broadcastPipSession(stream) });
      // Only release the in-app player once the separate native window was created.
      await leaveFullscreen();
      exitPlayback();
    } catch {
      setPipFailed(true);
    } finally {
      openingPipRef.current = false;
      setOpeningPip(false);
    }
  };
  const popOutChat = async () => {
    if (!chatPopoutUrl) return;
    setChatFailed(false);
    try {
      if ("__TAURI_INTERNALS__" in window) {
        await invoke("browser_open", { url: chatPopoutUrl });
        const { Window: NativeWindow, LogicalSize } = await import("@tauri-apps/api/window");
        const chatWindow = await NativeWindow.getByLabel("harbor-browser");
        await chatWindow?.setSize(new LogicalSize(400, 640)).catch(() => {});
      } else openUrl(chatPopoutUrl);
    } catch {
      setChatFailed(true);
    }
  };
  return createPortal(
    <section
      ref={root}
      className="sports-embed-player"
      data-docked={docked}
      data-minimized={minimized && docked}
      style={drag.style}
      aria-label={stream.title}
      role="region"
    >
      <header {...drag.handlers} data-tauri-drag-region={detached || undefined}>
        {!docked && !detached && (
          <button
            type="button"
            data-tauri-drag-region="false"
            onClick={restoreDock}
            aria-label={t("Back")}
            title={t("Back")}
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <BroadcastChannelAvatar stream={stream} />
        <span data-tauri-drag-region={detached || undefined}>
          <strong>{stream.title}</strong>
          <small>
            {stream.platform === "twitch"
              ? "Twitch"
              : stream.platform === "youtube"
                ? "YouTube"
                : stream.platform === "kick"
                  ? "Kick"
                  : t("Official broadcast")}
          </small>
        </span>
        {docked && (
          <button
            type="button"
            data-tauri-drag-region="false"
            onClick={() => setMinimized((value) => !value)}
            aria-label={t(minimized ? "Restore video" : "Minimize player")}
            title={t(minimized ? "Restore video" : "Minimize player")}
          >
            {minimized ? <Plus size={17} /> : <Minus size={17} />}
          </button>
        )}
        <button
          type="button"
          data-tauri-drag-region="false"
          onClick={close}
          aria-label={t(detached ? "Exit PiP" : "Close")}
          title={t(detached ? "Exit PiP" : "Close")}
        >
          <X size={18} />
        </button>
      </header>
      <div className="sports-embed-body">
        <div
          ref={stage}
          className="sports-embed-stage"
          aria-hidden={minimized && docked}
          inert={minimized && docked}
        >
          {embed ? (
            <>
              {loaded !== embed && (
                <span
                  className="sports-embed-loading"
                  role="status"
                  aria-label={t("Loading broadcast…")}
                >
                  <LoaderCircle size={22} />
                </span>
              )}
              <iframe
                key={embed}
                title={stream.title}
                src={embed}
                onLoad={() => setLoaded(embed)}
                style={{
                  width: viewport.width,
                  height: viewport.height,
                  transform: `scale(${viewport.scale})`,
                }}
                allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </>
          ) : windowUrl ? (
            <div className="sports-embed-unavailable">
              <p>{t("Watch on the official channel")}</p>
              <button
                type="button"
                style={{ alignSelf: "center" }}
                onClick={() => void openWindow(windowUrl)}
              >
                <ExternalLink size={15} />
                <span>{t("Open broadcast")}</span>
              </button>
              {windowFailed && <span role="alert">{t("Try again")}</span>}
            </div>
          ) : (
            <div className="sports-embed-unavailable">
              <p>{t("Watch on the official channel")}</p>
              <p>{t("Choose the current broadcast on the organizer’s channel.")}</p>
            </div>
          )}
        </div>
      </div>
      <footer>
        {external && !windowUrl && (
          <button type="button" onClick={() => openUrl(external)} title={t("Open broadcast")}>
            <ExternalLink size={15} />
            <span>{t("Open broadcast")}</span>
          </button>
        )}
        {(!docked || isFullscreen) && !detached ? (
          <div className="sports-embed-spacer sports-embed-scores">
            <BroadcastScoreTicker
              streamUrl={stream.url}
              onWatch={(next) => {
                const source = officialBroadcastSource(next);
                if (source) replacePlayerSrc({ ...source, sportsDocked: false });
              }}
            />
          </div>
        ) : (
          <span className="sports-embed-spacer" />
        )}
        {chatPopoutUrl && (
          <button
            type="button"
            onClick={() => void popOutChat()}
            title={`Kick · ${t("Chat")}`}
            aria-label={t("Chat")}
          >
            <MessageSquare size={17} />
            <span>{t("Chat")}</span>
            <ExternalLink size={13} />
          </button>
        )}
        {chatFailed && <span role="alert">{t("Try again")}</span>}
        {!detached && embed && "__TAURI_INTERNALS__" in window && (
          <button
            type="button"
            onClick={() => void popOut()}
            disabled={openingPip}
            aria-label={t("Picture-in-picture")}
            title={t("Picture-in-picture")}
          >
            {openingPip ? <LoaderCircle size={18} /> : <PictureInPicture2 size={18} />}
          </button>
        )}
        {pipFailed && <span role="alert">{t("Try again")}</span>}
        {docked && (
          <button
            type="button"
            onClick={() => {
              setMinimized(false);
              replacePlayerSrc({ ...src, sportsDocked: false });
            }}
            aria-label={t("Expand player and controls")}
            title={t("Expand player and controls")}
          >
            <Maximize2 size={17} />
          </button>
        )}
        {!windowUrl && (
          <button
            type="button"
            onClick={() => {
              if (isFullscreen) void leaveFullscreen();
              else fullscreen();
            }}
            aria-label={t(isFullscreen ? "Exit fullscreen" : "Fullscreen")}
            title={t(isFullscreen ? "Exit fullscreen" : "Fullscreen")}
          >
            {isFullscreen ? <Shrink size={17} /> : <Expand size={17} />}
          </button>
        )}
      </footer>
    </section>,
    document.body,
  );
}
