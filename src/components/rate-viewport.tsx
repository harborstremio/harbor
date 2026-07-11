import { openUrl } from "@/lib/window";
import { ArrowUpRight, ExternalLink, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function RateViewport({
  url,
  title,
  logo,
  onClose,
}: {
  url: string;
  title: string;
  logo?: string | null;
  onClose: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    timerRef.current = window.setTimeout(() => {
      if (!loaded) setBlocked(true);
    }, 6500);
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [loaded]);

  return createPortal(
    <div className="fixed inset-0 z-[230] flex flex-col bg-black/82 backdrop-blur-md">
      <header
        data-tauri-drag-region
        className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-canvas/60 px-5 text-ink backdrop-blur-md"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {logo && (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-elevated ring-1 ring-edge-soft">
              <img
                src={logo}
                alt=""
                draggable={false}
                className="h-full w-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </span>
          )}
          <span className="truncate text-[10.5px] font-bold uppercase tracking-[0.22em] text-accent">
            Rate · powered by stremio-addons.net
          </span>
          <span className="hidden truncate text-[12.5px] font-medium text-ink-muted sm:inline">· {title}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openUrl(url)}
            className="flex h-9 items-center gap-1.5 rounded-full border border-edge-soft px-3 text-[12px] font-semibold text-ink-muted transition-colors hover:border-edge hover:text-ink"
          >
            <ExternalLink size={12} strokeWidth={2.4} />
            Open in browser
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-elevated/60 hover:text-ink"
          >
            <X size={16} strokeWidth={2.2} />
          </button>
        </div>
      </header>

      <div className="relative flex-1 overflow-hidden bg-white">
        {!loaded && !blocked && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-canvas">
            <div className="flex items-center gap-2 text-ink-muted">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-[13px]">Loading stremio-addons.net…</span>
            </div>
          </div>
        )}
        {blocked && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
            <p className="text-[14px] font-semibold text-ink">
              stremio-addons.net blocks embedding from outside their site.
            </p>
            <p className="max-w-[40ch] text-[12.5px] text-ink-muted">
              That&apos;s the correct security posture: it stops other sites from impersonating the rating UI. Use the
              button below to rate in your browser.
            </p>
            <button
              type="button"
              onClick={() => {
                openUrl(url);
                onClose();
              }}
              className="flex h-10 items-center gap-1.5 rounded-full bg-ink px-4 text-[13px] font-semibold text-canvas transition-opacity hover:opacity-90"
            >
              <ArrowUpRight size={13} strokeWidth={2.4} />
              Open on stremio-addons.net
            </button>
          </div>
        )}
        <iframe
          src={url}
          title={`${title} on stremio-addons.net`}
          onLoad={() => setLoaded(true)}
          className="h-full w-full border-0"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="clipboard-write"
        />
      </div>
    </div>,
    document.body,
  );
}
