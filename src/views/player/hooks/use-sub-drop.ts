import { useEffect, useRef, useState, type RefObject } from "react";
import type { PlayerBridge } from "@/lib/player/bridge";
import { t } from "@/lib/i18n";
import { writePlayerPrefs } from "@/lib/player-prefs";
import { markImportedSub } from "@/lib/player/imported-subs";
import { writeRememberedSub } from "@/lib/subtitles/subtitle-memory";

const SUB_EXT = /\.(srt|ass|ssa|vtt|sub)$/i;

export function useSubDrop(
  bridgeRef: RefObject<PlayerBridge | null>,
  metaId: string,
  mediaKey: string,
) {
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;
    let cancelled = false;
    let un: (() => void) | null = null;
    void (async () => {
      try {
        const { getCurrentWebview } = await import("@tauri-apps/api/webview");
        const unlisten = await getCurrentWebview().onDragDropEvent((e) => {
          if (e.payload.type !== "drop") return;
          const path = e.payload.paths.find((p) => SUB_EXT.test(p));
          if (!path) return;
          const name = path.split(/[\\/]/).pop() ?? "Subtitle";
          const title = name.replace(SUB_EXT, "");
          void bridgeRef.current
            ?.addSubtitle(path, undefined, title, true)
            .then((ok) => {
              if (ok) {
                writePlayerPrefs(metaId, { subsOff: false });
                markImportedSub(title);
                writeRememberedSub(mediaKey, { source: path, title, imported: true });
              }
              setToast(ok ? t("Loaded {name}", { name }) : t("Couldn't load {name}", { name }));
              if (timer.current) window.clearTimeout(timer.current);
              timer.current = window.setTimeout(() => setToast(null), 2200);
            });
        });
        if (cancelled) {
          unlisten();
        } else {
          un = unlisten;
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
      un?.();
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [bridgeRef, metaId, mediaKey]);

  return toast;
}
