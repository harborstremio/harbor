import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

function hasVapoursynth(v: unknown): boolean {
  return typeof v === "string" && v.toLowerCase().includes("vapoursynth");
}

export function SvpIndicator({
  engine,
  chromeVisible,
  suppressed = false,
}: {
  engine: "html5" | "mpv";
  chromeVisible: boolean;
  suppressed?: boolean;
}) {
  const { settings } = useSettings();
  const t = useT();
  const enabled = settings.playerSvp && engine === "mpv" && isTauri;
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setActive(false);
      return;
    }
    let cancelled = false;
    const tick = async () => {
      const vf = await invoke("mpv_get_property", { name: "vf" }).catch(() => null);
      if (!cancelled) setActive(hasVapoursynth(vf));
    };
    void tick();
    const id = window.setInterval(() => void tick(), 2000);
    const onFailed = () => setActive(false);
    window.addEventListener("harbor:svp-failed", onFailed);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("harbor:svp-failed", onFailed);
    };
  }, [enabled]);

  if (!enabled || !active) return null;

  return (
    <div
      className={`pointer-events-none absolute top-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-edge-soft bg-canvas/85 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-ink/85 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)] backdrop-blur-md transition-opacity duration-300 ${chromeVisible && !suppressed ? "opacity-100" : "opacity-0"}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
      <span>{t("SVP active")}</span>
    </div>
  );
}
