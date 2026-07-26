import { createPortal } from "react-dom";
import { useEffect } from "react";
import { ArrowUpCircle, X } from "lucide-react";
import {
  dismissUpdate,
  openUpdatePanel,
  startUpdateWatcher,
  updateAvailable,
  useUpdate,
} from "@/lib/updater/use-update";
import { isLinuxDesktop } from "@/lib/platform";
import { UpdateCard } from "./update-card";

export function UpdateRoot() {
  const u = useUpdate();
  useEffect(() => {
    if (isLinuxDesktop()) return;
    startUpdateWatcher();
  }, []);

  if (isLinuxDesktop()) return null;

  if (u.panelOpen) return createPortal(<UpdateCard />, document.body);
  if (!updateAvailable(u)) return null;
  if (u.status === "available" && u.version && u.version === u.dismissed) return null;

  const label =
    u.status === "downloading"
      ? `Downloading ${Math.round(u.progress * 100)}%`
      : u.status === "downloaded"
        ? "Restart to update"
        : "Update ready";

  return createPortal(
    <div className="fixed bottom-5 end-5 z-[120] flex items-center gap-1.5">
      <button
        onClick={openUpdatePanel}
        className="group flex h-11 items-center gap-2.5 rounded-full border border-accent/30 bg-elevated ps-3 pe-4 shadow-[0_14px_40px_rgba(0,0,0,0.42)] transition-transform hover:-translate-y-0.5"
      >
        <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 text-accent">
          <ArrowUpCircle size={17} strokeWidth={2.3} />
          {u.status === "available" && (
            <span className="absolute inset-0 animate-ping rounded-full border border-accent/40" />
          )}
        </span>
        <span className="text-[13.5px] font-semibold text-ink">{label}</span>
        {u.version && <span className="text-[12px] text-ink-subtle">{u.version}</span>}
      </button>
      {u.status === "available" && (
        <button
          onClick={dismissUpdate}
          aria-label="Dismiss"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-elevated/90 text-ink-subtle shadow-md transition-colors hover:bg-raised hover:text-ink"
        >
          <X size={13} strokeWidth={2.4} />
        </button>
      )}
    </div>,
    document.body,
  );
}
