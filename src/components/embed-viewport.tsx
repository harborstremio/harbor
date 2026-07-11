import { ArrowUpRight, ExternalLink, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const EVENT = "harbor:open-embed-viewport";

type EmbedDetail = { url: string; title?: string };

export function openEmbedViewport(url: string, title?: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<EmbedDetail>(EVENT, { detail: { url, title } }));
}

export function EmbedViewportRoot() {
  const [request, setRequest] = useState<EmbedDetail | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<EmbedDetail>).detail;
      if (detail?.url) setRequest(detail);
    };
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);

  if (!request) return null;
  return (
    <EmbedViewport
      url={request.url}
      title={request.title ?? new URL(request.url).hostname}
      onClose={() => setRequest(null)}
    />
  );
}

function EmbedViewport({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
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
    }, 7500);
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [loaded]);

  const openExternally = () => {
    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      return;
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[235] flex flex-col bg-black/82 backdrop-blur-md">
      <header
        data-tauri-drag-region
        className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-canvas/60 px-5 text-ink backdrop-blur-md"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-accent">In-app browser</span>
          <span className="hidden truncate text-[12.5px] font-medium text-ink-muted sm:inline">· {title}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openExternally}
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
              <span className="text-[13px]">Loading {title}…</span>
            </div>
          </div>
        )}
        {blocked && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
            <p className="text-[14px] font-semibold text-ink">{title} blocks embedding from outside its site.</p>
            <p className="max-w-[44ch] text-[12.5px] text-ink-muted">
              That&apos;s a normal security setting. Use the button below to open it in your browser instead.
            </p>
            <button
              type="button"
              onClick={() => {
                openExternally();
                onClose();
              }}
              className="flex h-10 items-center gap-1.5 rounded-full bg-ink px-4 text-[13px] font-semibold text-canvas transition-opacity hover:opacity-90"
            >
              <ArrowUpRight size={13} strokeWidth={2.4} />
              Open in browser
            </button>
          </div>
        )}
        <iframe
          src={url}
          title={title}
          onLoad={() => setLoaded(true)}
          className="h-full w-full border-0"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="clipboard-write; encrypted-media; fullscreen"
        />
      </div>
    </div>,
    document.body,
  );
}
