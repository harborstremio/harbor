import { captureBaseTitle, captureDir, formatStamp, joinPath, safeName } from "@/lib/player/capture-path";
import type { PlayerSrc } from "@/lib/view";
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";

import type { FrameGrabToast } from "./use-frame-grab";

const CLIP_SECONDS = 30;
const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export function useClipRecorder(params: { src: PlayerSrc }): {
  saving: boolean;
  chooserOpen: boolean;
  toast: FrameGrabToast | null;
  openChooser: () => void;
  closeChooser: () => void;
  saveClip: (withSubs: boolean) => void;
} {
  const { src } = params;
  const [saving, setSaving] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [toast, setToast] = useState<FrameGrabToast | null>(null);
  const busyRef = useRef(false);
  const dismissRef = useRef<number | null>(null);

  const openChooser = useCallback(() => {
    if (busyRef.current) return;
    setChooserOpen((o) => !o);
  }, []);
  const closeChooser = useCallback(() => setChooserOpen(false), []);

  const saveClip = useCallback(
    async (withSubs: boolean) => {
      setChooserOpen(false);
      if (!isTauri || busyRef.current) return;
      busyRef.current = true;
      setSaving(true);
      if (dismissRef.current) window.clearTimeout(dismissRef.current);
      setToast({ id: Date.now(), kind: "ok", text: "Saving clip…" });
      try {
        const filename = `${safeName(captureBaseTitle(src))} - ${formatStamp(new Date())}.mp4`;
        const dir = await captureDir();
        const outPath = dir ? await joinPath(dir, filename) : filename;
        const result = await invoke<{ path: string; duration: number }>("mpv_clip_save", {
          withSubs,
          beforeSec: CLIP_SECONDS,
          outPath,
        });
        setToast({
          id: Date.now(),
          kind: "ok",
          text: `Clip saved to ${dir ? "Pictures/Harbor" : "downloads"}`,
          path: result.path,
        });
      } catch (e) {
        setToast({
          id: Date.now(),
          kind: "error",
          text: typeof e === "string" ? e : "Clip save failed",
        });
      } finally {
        setSaving(false);
        busyRef.current = false;
        dismissRef.current = window.setTimeout(() => setToast(null), 6000);
      }
    },
    [src],
  );

  useEffect(
    () => () => {
      if (dismissRef.current) window.clearTimeout(dismissRef.current);
    },
    [],
  );

  return { saving, chooserOpen, toast, openChooser, closeChooser, saveClip };
}
