import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { ArrowUpCircle, X } from "lucide-react";
import {
  dismissUpdate,
  openUpdatePanel,
  startUpdateWatcher,
  updateAvailable,
  useUpdate,
} from "@/lib/updater/use-update";
import { isLinuxDesktop } from "@/lib/platform";
import { useT } from "@/lib/i18n";
import { UpdateCard } from "./update-card";

const AUTO_DISMISS_MS = 12_000;

function useChromeHidden(): boolean {
  const [hidden, setHidden] = useState(
    () =>
      typeof document !== "undefined" && document.documentElement.dataset.chromeHidden === "true",
  );
  useEffect(() => {
    const root = document.documentElement;
    const read = () => setHidden(root.dataset.chromeHidden === "true");
    read();
    const obs = new MutationObserver(read);
    obs.observe(root, { attributes: true, attributeFilter: ["data-chrome-hidden"] });
    return () => obs.disconnect();
  }, []);
  return hidden;
}

export function UpdateRoot() {
  const t = useT();
  const u = useUpdate();
  const chromeHidden = useChromeHidden();
  const [autoHidden, setAutoHidden] = useState<string | null>(null);

  useEffect(() => {
    if (isLinuxDesktop()) return;
    startUpdateWatcher();
  }, []);

  useEffect(() => {
    setAutoHidden(null);
  }, [u.version]);

  const pillVisible =
    !u.panelOpen &&
    updateAvailable(u) &&
    u.version !== u.dismissed &&
    u.version !== autoHidden &&
    !chromeHidden;

  useEffect(() => {
    if (!pillVisible || u.status === "downloading") return;
    const id = window.setTimeout(() => setAutoHidden(u.version), AUTO_DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [pillVisible, u.status, u.version]);

  if (isLinuxDesktop()) return null;

  if (u.panelOpen) return createPortal(<UpdateCard />, document.body);
  if (!pillVisible) return null;

  const label =
    u.status === "downloading"
      ? t("Downloading {pct}%", { pct: Math.round(u.progress * 100) })
      : u.status === "downloaded"
        ? t("Restart to update")
        : t("Update ready");

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
      {u.status !== "downloading" && (
        <button
          onClick={dismissUpdate}
          aria-label={t("Dismiss")}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-elevated/90 text-ink-subtle shadow-md transition-colors hover:bg-raised hover:text-ink"
        >
          <X size={13} strokeWidth={2.4} />
        </button>
      )}
    </div>,
    document.body,
  );
}
