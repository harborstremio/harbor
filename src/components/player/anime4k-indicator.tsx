import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSettings } from "@/lib/settings";
import type { Anime4kMode } from "@/lib/player/anime4k-modes";
import type { Anime4kChoice } from "@/views/player/hooks/use-anime4k";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

function shadersActive(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

export function Anime4kIndicator({ engine, chromeVisible, suppressed = false }: { engine: "html5" | "mpv"; chromeVisible: boolean; suppressed?: boolean }) {
  const { settings } = useSettings();
  const enabled = settings.playerAnime4kIndicator && engine === "mpv" && isTauri;
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setActive(false);
      return;
    }
    let cancelled = false;
    const tick = async () => {
      const shaders = await invoke("mpv_get_property", { name: "glsl-shaders" }).catch(() => null);
      if (!cancelled) setActive(shadersActive(shaders));
    };
    void tick();
    const id = window.setInterval(() => void tick(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled]);

  if (!active) return null;

  // Determine the effective mode: HUD override takes precedence over base setting
  const choice = (settings.playerAnime4kOverride as Anime4kChoice) || "auto";
  const isAuto = choice === "auto";
  const autoActive = isAuto && settings.playerAnime4k && settings.playerAnime4kFolder;
  const effectiveMode = isAuto && autoActive ? (settings.playerAnime4kMode as Anime4kMode) : (choice === "off" ? "Off" : choice);

  return (
    <div
      className={`pointer-events-none absolute left-1/2 top-[3.25rem] z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-edge-soft bg-canvas/85 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-ink/85 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)] backdrop-blur-md transition-opacity duration-300 ${chromeVisible && !suppressed ? "opacity-100" : "opacity-0"}`}
    >
      <Sparkles size={13} className="text-accent" />
      <span>Anime4K</span>
      {effectiveMode && <span className="text-ink-subtle">{effectiveMode}</span>}
    </div>
  );
}
