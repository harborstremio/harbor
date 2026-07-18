import { Cast, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { fetchTrailer, resolveTrailerQuality, trailerSrc } from "@/lib/trailer";
import { isMacDesktop } from "@/lib/platform";
import { openUrl } from "@/lib/window";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { useT } from "@/lib/i18n";
import { NativeTrailerPlayer } from "./native-trailer-player";
import { Tooltip } from "./tooltip";

export function TrailerOverlay({
  id,
  title,
  logo,
  onClose,
}: {
  id: string;
  title: string;
  logo?: string;
  onClose: () => void;
}) {
  const t = useT();
  const { setChromeHidden } = useView();
  const { settings } = useSettings();
  const [open, setOpen] = useState(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [extractFailed, setExtractFailed] = useState(false);
  const closingRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const r = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(r);
  }, []);

  useEffect(() => {
    setChromeHidden(true);
    return () => setChromeHidden(false);
  }, [setChromeHidden]);

  useEffect(() => {
    let cancelled = false;
    fetchTrailer(id, resolveTrailerQuality(settings.trailerQuality)).then((info) => {
      if (cancelled) return;
      if (info) setStreamUrl(trailerSrc(info));
      else setExtractFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [id, settings.trailerQuality]);

  const dismiss = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    const v = videoRef.current;
    if (v) {
      v.pause();
      if (document.pictureInPictureElement === v) {
        document.exitPictureInPicture().catch(() => {});
      }
    }
    setOpen(false);
    setTimeout(onClose, 280);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dismiss]);

  return createPortal(
    <div
      onClick={dismiss}
      className="fixed inset-0 z-[120] flex cursor-zoom-out items-center justify-center"
      style={{
        backgroundColor: open
          ? isMacDesktop()
            ? "rgba(0,0,0,1)"
            : "rgba(0,0,0,0.82)"
          : "rgba(0,0,0,0)",
        backdropFilter: open ? "blur(32px) saturate(1.2)" : "blur(0px)",
        WebkitBackdropFilter: open ? "blur(32px) saturate(1.2)" : "blur(0px)",
        transition:
          "background-color 360ms cubic-bezier(0.32,0.72,0.24,1), backdrop-filter 360ms cubic-bezier(0.32,0.72,0.24,1)",
      }}
    >
      <div
        className="absolute end-7 top-16 z-10 flex items-center gap-2.5"
        style={{
          opacity: open ? 1 : 0,
          transform: open ? "scale(1)" : "scale(0.85)",
          transition:
            "opacity 320ms ease 60ms, transform 360ms cubic-bezier(0.32,0.72,0.24,1) 60ms",
        }}
      >
        {!extractFailed && <CastButton videoRef={videoRef} />}
        <Tooltip label={t("Close · Esc")}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              dismiss();
            }}
            aria-label={t("Close trailer")}
            className="relative flex h-11 w-11 items-center justify-center rounded-full bg-canvas/90 text-ink shadow-[0_8px_22px_rgba(0,0,0,0.4)] transition-colors duration-200 before:absolute before:-inset-3 before:content-[''] hover:bg-canvas active:scale-[0.94]"
          >
            <X size={18} strokeWidth={2.4} />
          </button>
        </Tooltip>
      </div>
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative aspect-video w-[min(1280px,86vw)] cursor-default overflow-hidden rounded-[22px] bg-black shadow-[0_30px_80px_rgba(0,0,0,0.55)]"
        style={{
          opacity: open ? 1 : 0,
          transform: open ? "scale(1)" : "scale(0.93)",
          transition: "opacity 320ms ease, transform 420ms cubic-bezier(0.32,0.72,0.24,1)",
        }}
      >
        {streamUrl ? (
          <NativeTrailerPlayer src={streamUrl} videoRef={videoRef} />
        ) : extractFailed ? (
          isMacDesktop() ? (
            <ExternalTrailerFallback id={id} title={title} logo={logo} />
          ) : (
            <YouTubeEmbed id={id} title={title} />
          )
        ) : (
          <TrailerLoader title={title} logo={logo} />
        )}
      </div>
      <span
        className="pointer-events-none absolute bottom-7 left-1/2 -translate-x-1/2 select-none text-[11px] font-medium uppercase tracking-[0.18em] text-ink/45"
        style={{
          opacity: open ? 1 : 0,
          transition: "opacity 320ms ease 220ms",
        }}
      >
        {t("Esc or click outside to close")}
      </span>
    </div>,
    document.body,
  );
}

function YouTubeEmbed({ id, title }: { id: string; title: string }) {
  const t = useT();
  const params = new URLSearchParams({
    autoplay: "1",
    modestbranding: "1",
    rel: "0",
    iv_load_policy: "3",
    playsinline: "1",
    fs: "1",
  });
  const proto = typeof window !== "undefined" ? (window.location?.protocol ?? "") : "";
  if (/^https?:$/.test(proto) && window.location?.origin) {
    params.set("origin", window.location.origin);
  }
  return (
    <>
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`}
        title={`${title} trailer`}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className="absolute inset-0 h-full w-full border-0"
      />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          openUrl(`https://www.youtube.com/watch?v=${id}`);
        }}
        className="absolute bottom-4 end-4 z-10 flex items-center gap-1.5 rounded-full bg-canvas/90 px-3.5 py-2 text-[12.5px] font-semibold text-ink shadow-[0_8px_22px_rgba(0,0,0,0.4)] backdrop-blur-sm transition-colors hover:bg-canvas"
      >
        {t("Watch on YouTube")}
      </button>
    </>
  );
}

function ExternalTrailerFallback({
  id,
  title,
  logo,
}: {
  id: string;
  title: string;
  logo?: string;
}) {
  const t = useT();
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-8 text-center">
      {logo ? (
        <img
          src={logo}
          alt={title}
          className="max-h-24 w-auto max-w-[55%] object-contain opacity-90 drop-shadow-[0_18px_45px_rgba(0,0,0,0.55)]"
        />
      ) : (
        <p className="font-display text-[40px] font-medium leading-[0.98] tracking-tight text-white drop-shadow-[0_18px_45px_rgba(0,0,0,0.55)]">
          {title}
        </p>
      )}
      <p className="max-w-sm text-[14px] leading-relaxed text-white/55">
        {t("This trailer plays on YouTube.")}
      </p>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          openUrl(`https://www.youtube.com/watch?v=${id}`);
        }}
        className="flex h-11 items-center rounded-full bg-white px-6 text-[14px] font-semibold text-black shadow-[0_8px_22px_rgba(0,0,0,0.4)] transition-transform active:scale-[0.97]"
      >
        {t("Watch on YouTube")}
      </button>
    </div>
  );
}

function TrailerLoader({ title, logo }: { title: string; logo?: string }) {
  const t = useT();
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-7">
      {logo ? (
        <img
          src={logo}
          alt={title}
          className="max-h-32 w-auto max-w-[60%] animate-loader-pulse object-contain drop-shadow-[0_24px_60px_rgba(0,0,0,0.65)]"
        />
      ) : (
        <p className="animate-loader-pulse font-display text-[56px] font-medium leading-[0.96] tracking-tight text-white drop-shadow-[0_18px_45px_rgba(0,0,0,0.55)]">
          {title}
        </p>
      )}
      <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-white/45">
        {t("Loading trailer")}
      </p>
    </div>
  );
}

type RemoteEnabled = HTMLVideoElement & {
  remote?: {
    watchAvailability: (cb: (avail: boolean) => void) => Promise<number>;
    cancelWatchAvailability: (id?: number) => Promise<void>;
    prompt: () => Promise<void>;
  };
};

function CastButton({ videoRef }: { videoRef: React.RefObject<HTMLVideoElement | null> }) {
  const t = useT();
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const v = videoRef.current as RemoteEnabled | null;
    if (!v || !v.remote || typeof v.remote.watchAvailability !== "function") return;
    let watchId: number | null = null;
    let cancelled = false;
    v.remote
      .watchAvailability((avail) => {
        if (!cancelled) setAvailable(avail);
      })
      .then((id) => {
        watchId = id;
        if (cancelled && v.remote) {
          v.remote.cancelWatchAvailability(id).catch(() => {});
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (watchId !== null && v.remote) {
        v.remote.cancelWatchAvailability(watchId).catch(() => {});
      }
    };
  }, [videoRef]);

  if (!available) return null;

  return (
    <Tooltip label={t("Cast to a device")}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          const v = videoRef.current as RemoteEnabled | null;
          if (!v || !v.remote) return;
          v.remote.prompt().catch(() => {});
        }}
        aria-label={t("Cast")}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-canvas/90 text-ink shadow-[0_8px_22px_rgba(0,0,0,0.4)] transition-colors duration-200 hover:bg-canvas active:scale-[0.94]"
      >
        <Cast size={20} strokeWidth={2} />
      </button>
    </Tooltip>
  );
}
