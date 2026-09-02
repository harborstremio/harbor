import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { readWindowFullscreen, setWindowFullscreen } from "@/lib/window";

const FLAG = "harbor.bigpicture.forcedFullscreen";

// The window is normally clamped to the work area so maximising never hides the
// taskbar. Fullscreen has to cover it, so the clamp is lifted for the duration.
function setMaximizeClamp(enabled: boolean): void {
  void invoke("set_maximize_clamp", { enabled }).catch(() => {});
}

function markForced(on: boolean): void {
  try {
    if (on) localStorage.setItem(FLAG, "1");
    else localStorage.removeItem(FLAG);
  } catch {
  }
}

function wasForced(): boolean {
  try {
    return localStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
}

export async function releaseBigPictureFullscreen(): Promise<void> {
  if (!wasForced()) return;
  markForced(false);
  await setWindowFullscreen(false).catch(() => {});
  setMaximizeClamp(true);
}

export function useBpFullscreen(active: boolean): void {
  const forced = useRef(false);

  useEffect(() => {
    if (!active) return;
    let alive = true;

    const release = () => {
      if (!forced.current) return;
      forced.current = false;
      markForced(false);
      void setWindowFullscreen(false).catch(() => {});
      setMaximizeClamp(true);
    };

    void (async () => {
      const already = await readWindowFullscreen().catch(() => false);
      if (!alive) return;
      if (already) return;
      forced.current = true;
      markForced(true);
      setMaximizeClamp(false);
      await setWindowFullscreen(true).catch(() => {});
    })();

    window.addEventListener("beforeunload", release);
    window.addEventListener("pagehide", release);

    return () => {
      alive = false;
      window.removeEventListener("beforeunload", release);
      window.removeEventListener("pagehide", release);
      release();
    };
  }, [active]);
}
