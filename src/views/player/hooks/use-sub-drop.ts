import { t } from "@/lib/i18n";
import { writePlayerPrefs } from "@/lib/player-prefs";
import type { PlayerBridge } from "@/lib/player/bridge";
import { useEffect, useRef, useState, type RefObject } from "react";

const SUB_EXT = /\.(srt|ass|ssa|vtt|sub)$/i;

export function useSubDrop(bridgeRef: RefObject<PlayerBridge | null>, metaId: string) {
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;
    let un: (() => void) | null = null;
    void (async () => {
      try {
        const { getCurrentWebview } = await import("@tauri-apps/api/webview");
        un = await getCurrentWebview().onDragDropEvent((e) => {
          if (e.payload.type !== "drop") return;
          const path = e.payload.paths.find((p) => SUB_EXT.test(p));
          if (!path) return;
          const name = path.split(/[\\/]/).pop() ?? "Subtitle";
          void bridgeRef.current?.addSubtitle(path, undefined, name.replace(SUB_EXT, ""), true).then((ok) => {
            if (ok) writePlayerPrefs(metaId, { subsOff: false });
            setToast(ok ? t("Loaded {name}", { name }) : t("Couldn't load {name}", { name }));
            if (timer.current) window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => setToast(null), 2200);
          });
        });
      } catch {}
    })();
    return () => {
      un?.();
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [bridgeRef, metaId]);

  return toast;
}
