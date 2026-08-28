import { ExternalLink, Loader2, RotateCw, X } from "lucide-react";
import { useLayoutEffect, useState } from "react";
import { HarborLoader } from "@/components/harbor-loader";
import {
  EXTERNAL_LINK_FRAME_PERMISSIONS,
  EXTERNAL_LINK_FRAME_SANDBOX,
  createSoftLoadTimeout,
} from "@/lib/external-link-viewer-modal";
import type { ExternalLinkDestination } from "@/lib/social/external-link-policy";

const headerButtonClass =
  "flex h-9 items-center gap-1.5 rounded-full border border-edge-soft px-3 text-[12px] " +
  "font-semibold text-ink-muted transition-colors hover:border-edge hover:text-ink disabled:opacity-50";
const closeButtonClass =
  "flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition-colors " +
  "hover:bg-elevated/60 hover:text-ink";

type ExternalLinkViewerFrameProps = {
  link: ExternalLinkDestination;
  reloadKey: number;
  openingBrowser: boolean;
  browserError: string | null;
  onOpenBrowser: () => void;
  onReload: () => void;
};

function ExternalLinkViewerFrame({
  link,
  reloadKey,
  openingBrowser,
  browserError,
  onOpenBrowser,
  onReload,
}: ExternalLinkViewerFrameProps) {
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  const [timeout] = useState(() => createSoftLoadTimeout(() => setSlow(true), window));

  useLayoutEffect(() => {
    timeout.start();
    return () => timeout.dispose();
  }, [timeout]);

  return (
    <div className="relative flex-1 overflow-hidden bg-white">
      {browserError && (
        <p
          role="alert"
          className="absolute inset-x-4 top-4 z-20 rounded-xl bg-danger px-4 py-3 text-[12.5px] text-white shadow-xl"
        >
          {browserError}
        </p>
      )}
      {!loaded && !slow && (
        <div
          role="status"
          aria-label={`Loading ${link.hostname}`}
          className="absolute inset-0 z-10 flex items-center justify-center bg-canvas"
        >
          <HarborLoader size="lg" caption={`Loading ${link.hostname}`} />
        </div>
      )}
      {slow && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
          <div role="status" aria-live="polite">
            <p className="text-[14px] font-semibold text-ink">Still loading?</p>
            <p className="max-w-[44ch] text-[12.5px] text-ink-muted">
              This site may not support Harbor&apos;s temporary viewer. Retry the original link or
              open it in your browser.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={onReload}
              className="rounded-full border border-edge-soft px-4 py-2 text-[12.5px] font-semibold text-ink"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={onOpenBrowser}
              disabled={openingBrowser}
              className="rounded-full bg-ink px-4 py-2 text-[12.5px] font-semibold text-canvas disabled:opacity-50"
            >
              Open in browser
            </button>
          </div>
        </div>
      )}
      <iframe
        key={reloadKey}
        src={link.href}
        title={`External site: ${link.hostname}`}
        sandbox={EXTERNAL_LINK_FRAME_SANDBOX}
        referrerPolicy="no-referrer"
        allow={EXTERNAL_LINK_FRAME_PERMISSIONS}
        tabIndex={-1}
        onLoad={() => {
          timeout.settle();
          setLoaded(true);
          setSlow(false);
        }}
        className="absolute inset-0 h-full w-full border-0 bg-white"
      />
    </div>
  );
}

export type ExternalLinkViewerProps = {
  link: ExternalLinkDestination;
  label?: string;
  openingBrowser: boolean;
  browserError: string | null;
  onOpenBrowser: () => void;
  onClose: () => void;
  onReload: () => void;
};

export function ExternalLinkViewer({
  link,
  label,
  openingBrowser,
  browserError,
  onOpenBrowser,
  onClose,
  onReload,
}: ExternalLinkViewerProps) {
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => {
    onReload();
    setReloadKey((value) => value + 1);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-canvas">
      <header
        data-tauri-drag-region
        className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-canvas/60 px-3 text-ink backdrop-blur-md sm:px-5"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-elevated ring-1 ring-edge-soft">
            <ExternalLink size={14} className="text-accent" strokeWidth={2.2} />
          </span>
          <span className="truncate text-[10.5px] font-bold uppercase tracking-[0.24em] text-accent">
            External | {link.hostname}
          </span>
          {label && (
            <span className="hidden truncate text-[12px] font-medium text-ink-muted md:inline">
              {label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={reload}
            aria-label="Reload original link"
            className={headerButtonClass}
          >
            <RotateCw
              size={12}
              strokeWidth={2.4}
              style={{
                transform: `rotate(${reloadKey * 360}deg)`,
                transition: "transform 0.6s cubic-bezier(0.22,0.61,0.36,1)",
              }}
            />
            <span className="hidden sm:inline">Reload</span>
          </button>
          <button
            type="button"
            onClick={onOpenBrowser}
            disabled={openingBrowser}
            aria-label="Open in system browser"
            className={headerButtonClass}
          >
            {openingBrowser ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <ExternalLink size={12} strokeWidth={2.4} />
            )}
            <span className="hidden sm:inline">Open in browser</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            autoFocus
            data-tv-initial-focus
            className={closeButtonClass}
          >
            <X size={16} strokeWidth={2.2} />
          </button>
        </div>
      </header>
      <ExternalLinkViewerFrame
        key={`${link.href}::${reloadKey}`}
        link={link}
        reloadKey={reloadKey}
        openingBrowser={openingBrowser}
        browserError={browserError}
        onOpenBrowser={onOpenBrowser}
        onReload={reload}
      />
    </div>
  );
}
