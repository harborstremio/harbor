import {
  closeUpdatePanel,
  downloadUpdate,
  installUpdate,
  dismissUpdate,
  checkForUpdate,
  useUpdate,
} from "@/lib/updater/use-update";
import { ArrowUpCircle, Check, Download, Loader2, RefreshCw, RotateCw, X } from "lucide-react";
import { useEffect, useState } from "react";

function mb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function UpdateCard() {
  const u = useUpdate();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const pct = Math.round(u.progress * 100);
  const determinate = u.totalBytes > 0;

  return (
    <div
      className={`fixed bottom-5 end-5 z-[120] w-[372px] max-w-[calc(100vw-2.5rem)] transition-all duration-300 ${
        shown ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
      }`}
    >
      <div className="overflow-hidden rounded-2xl border border-edge bg-elevated shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
        <div className="flex items-start gap-3 px-5 pt-4 pb-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
            {u.status === "installing" ? (
              <Loader2 size={22} className="animate-spin" />
            ) : (
              <ArrowUpCircle size={22} strokeWidth={2} />
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-[15px] font-semibold text-ink">
              {u.status === "downloaded"
                ? "Update ready to install"
                : u.status === "installing"
                  ? "Installing update"
                  : u.status === "downloading"
                    ? "Downloading update"
                    : u.status === "error"
                      ? "Update failed"
                      : "Update available"}
            </span>
            {u.version && <span className="text-[12.5px] text-ink-subtle">Harbor {u.version}</span>}
          </div>
          {u.status !== "installing" && u.status !== "downloading" && (
            <button
              onClick={closeUpdatePanel}
              aria-label="Close"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
            >
              <X size={16} strokeWidth={2.2} />
            </button>
          )}
        </div>

        {u.status === "available" && u.notes && (
          <div className="mx-5 mb-1 max-h-40 overflow-y-auto rounded-xl border border-edge-soft/60 bg-canvas/40 px-3.5 py-3 text-[12.5px] leading-relaxed whitespace-pre-line text-ink-muted">
            {u.notes.trim()}
          </div>
        )}

        {(u.status === "downloading" || u.status === "downloaded") && (
          <div className="px-5 pb-1">
            <div className="h-2 overflow-hidden rounded-full bg-raised">
              <div
                className={`h-full rounded-full bg-accent transition-[width] duration-300 ${
                  u.status === "downloading" && !determinate ? "w-2/5 animate-pulse" : ""
                }`}
                style={determinate ? { width: `${Math.max(4, pct)}%` } : undefined}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11.5px] text-ink-subtle">
              <span>
                {u.status === "downloaded"
                  ? "Download complete"
                  : determinate
                    ? `${mb(u.downloadedBytes)} of ${mb(u.totalBytes)}`
                    : "Fetching the latest build"}
              </span>
              {u.status === "downloading" && determinate && <span>{pct}%</span>}
            </div>
          </div>
        )}

        {u.status === "error" && (
          <div className="mx-5 mb-1 rounded-xl border border-danger/40 bg-danger/10 px-3.5 py-3 text-[12.5px] leading-relaxed text-ink-muted">
            {u.error ?? "Something went wrong reaching the update server."}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 px-5 pb-4 pt-3">
          {u.status === "available" && (
            <>
              <GhostButton onClick={dismissUpdate}>Later</GhostButton>
              <PrimaryButton onClick={() => void downloadUpdate()}>
                <Download size={16} strokeWidth={2.2} /> Download
              </PrimaryButton>
            </>
          )}
          {u.status === "downloaded" && (
            <>
              <GhostButton onClick={dismissUpdate}>Later</GhostButton>
              <PrimaryButton onClick={() => void installUpdate()}>
                <RotateCw size={16} strokeWidth={2.2} /> Install & restart
              </PrimaryButton>
            </>
          )}
          {u.status === "installing" && (
            <span className="text-[12px] text-ink-subtle">Harbor will restart automatically.</span>
          )}
          {u.status === "error" && (
            <>
              <GhostButton onClick={closeUpdatePanel}>Close</GhostButton>
              <PrimaryButton onClick={() => void checkForUpdate(true)}>
                <RefreshCw size={16} strokeWidth={2.2} /> Try again
              </PrimaryButton>
            </>
          )}
          {u.status === "downloading" && (
            <span className="flex items-center gap-1.5 text-[12px] text-ink-subtle">
              <Check size={14} strokeWidth={2.4} className="text-accent" /> Keep using Harbor while it downloads
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function PrimaryButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-11 items-center gap-2 rounded-xl bg-accent px-4 text-[14px] font-semibold text-[#1b1304] transition-[filter] hover:brightness-105"
    >
      {children}
    </button>
  );
}

function GhostButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-11 items-center rounded-xl px-4 text-[14px] font-medium text-ink-muted transition-colors hover:bg-raised hover:text-ink"
    >
      {children}
    </button>
  );
}
