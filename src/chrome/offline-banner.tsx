import { useDownloads } from "@/lib/download/downloads-store";
import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";
import { WifiOff } from "lucide-react";
import { useEffect, useRef, useSyncExternalStore } from "react";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

export function OfflineBanner() {
  const online = useOnline();
  const { view, setView } = useView();
  const items = useDownloads();
  const t = useT();
  const routed = useRef(false);
  const hasSaved = items.some((d) => d.status === "done");

  useEffect(() => {
    if (routed.current) return;
    routed.current = true;
    if (!navigator.onLine && hasSaved) setView("downloads");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (online) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-50 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-edge-soft bg-elevated/95 py-2 ps-4 pe-2 shadow-[0_8px_28px_-8px_rgba(0,0,0,0.55)] backdrop-blur-md">
        <WifiOff size={14} strokeWidth={2.2} className="text-ink-subtle" />
        <span className="text-[12.5px] font-medium text-ink-muted">
          {hasSaved ? t("You're offline. Your downloads still play.") : t("You're offline")}
        </span>
        {hasSaved && view !== "downloads" ? (
          <button
            onClick={() => setView("downloads")}
            className="rounded-full bg-ink px-3 py-1 text-[12px] font-semibold text-canvas transition-opacity hover:opacity-90"
          >
            {t("nav.downloads")}
          </button>
        ) : (
          <span className="w-1.5" />
        )}
      </div>
    </div>
  );
}
