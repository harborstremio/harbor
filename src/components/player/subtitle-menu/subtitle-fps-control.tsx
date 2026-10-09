import { useCallback, useEffect, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { HoverTooltip } from "@/components/hover-tooltip";
import { useAutoSyncHandle } from "@/components/player/autosync/autosync-store";
import { useT } from "@/lib/i18n";
import type { TrackInfo } from "@/lib/player/bridge";
import { readMpvSubtitleFps } from "@/lib/player/mpv-properties";
import { createSubtitleFpsAvailabilityController } from "@/lib/player/subtitle-fps";
import { SubtitleFpsIcon } from "./subtitle-fps-icon";
import { SubtitleFpsPanel } from "./subtitle-fps-panel";

type MpvPlaybackEvent = { event: string };

function isMainTauriWindow(): boolean {
  return (
    typeof window !== "undefined" &&
    "__TAURI_INTERNALS__" in window &&
    getCurrentWindow().label === "main"
  );
}

export function SubtitleFpsControl({
  engine,
  track,
  hasSecondary,
}: {
  engine: "html5" | "mpv";
  track: TrackInfo | null;
  hasSecondary: boolean;
}) {
  const tr = useT();
  const autoSync = useAutoSyncHandle();
  const [open, setOpen] = useState(false);
  const [supported, setSupported] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const supportControllerRef = useRef<ReturnType<
    typeof createSubtitleFpsAvailabilityController
  > | null>(null);
  if (!supportControllerRef.current) {
    supportControllerRef.current = createSubtitleFpsAvailabilityController({
      read: async () => (await readMpvSubtitleFps()).supported,
      commit: setSupported,
    });
  }

  const refreshSupport = useCallback((hideWhileChecking = false) => {
    if (hideWhileChecking) setSupported(false);
    void supportControllerRef.current?.refresh();
  }, []);

  const closeAndRestoreFocus = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  useEffect(() => {
    if (engine !== "mpv" || !isMainTauriWindow()) {
      supportControllerRef.current?.invalidate();
      setSupported(false);
      setOpen(false);
      return;
    }

    refreshSupport();
    return () => {
      supportControllerRef.current?.invalidate();
    };
  }, [engine, refreshSupport, track?.id]);

  useEffect(() => {
    if (engine !== "mpv" || !isMainTauriWindow()) return;

    let disposed = false;
    let unlisten: UnlistenFn | null = null;
    void listen<MpvPlaybackEvent>("mpv://event", ({ payload }) => {
      if (payload.event === "file-loaded") {
        refreshSupport();
        return;
      }
      if (payload.event === "end-file" || payload.event === "shutdown") {
        setOpen(false);
        refreshSupport(true);
      }
    })
      .then((dispose) => {
        if (disposed) dispose();
        else unlisten = dispose;
      })
      .catch((error) =>
        console.warn("[subtitles] could not observe mpv playback availability", error),
      );
    return () => {
      disposed = true;
      supportControllerRef.current?.invalidate();
      unlisten?.();
    };
  }, [engine, refreshSupport]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (wrapRef.current?.contains(target)) return;
      if ((target as Element).closest?.("[data-dropdown-menu]")) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      closeAndRestoreFocus();
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  if (engine !== "mpv" || !supported) return null;

  const autoSyncActive =
    autoSync?.status === "analyzing" ||
    autoSync?.status === "synced" ||
    autoSync?.status === "best-effort" ||
    autoSync?.status === "offer";

  return (
    <div ref={wrapRef} className="relative">
      <HoverTooltip label={tr("Subtitle FPS")} side="bottom" align="end">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={tr("Subtitle FPS")}
          aria-expanded={open}
          className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
            open ? "bg-raised text-ink" : "text-ink-muted hover:bg-raised hover:text-ink"
          }`}
        >
          <SubtitleFpsIcon size={18} />
        </button>
      </HoverTooltip>

      {open && (
        <div className="absolute end-0 top-[calc(100%+6px)] z-[60] w-[300px] overflow-hidden rounded-md bg-elevated shadow-[0_18px_44px_-18px_rgba(0,0,0,0.85)] animate-menu-pop">
          <SubtitleFpsPanel
            track={track}
            engine={engine}
            hasSecondary={hasSecondary}
            autoSyncActive={autoSyncActive}
            onBeforeApply={autoSync?.stop}
            onBack={closeAndRestoreFocus}
          />
        </div>
      )}
    </div>
  );
}
