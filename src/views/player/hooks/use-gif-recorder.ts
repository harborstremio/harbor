import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import {
  captureBaseTitle,
  captureDir,
  formatStamp,
  joinPath,
  safeName,
} from "@/lib/player/capture-path";
import type { FrameGrabToast } from "./use-frame-grab";
import type { PlayerSrc } from "@/lib/view";

export type GifState = "idle" | "recording" | "encoding";

const MAX_SECONDS = 30;
const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export function useGifRecorder(params: { src: PlayerSrc }): {
  state: GifState;
  elapsedSec: number;
  toast: FrameGrabToast | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
  toggle: () => void;
} {
  const { src } = params;
  const [state, setState] = useState<GifState>("idle");
  const [elapsedSec, setElapsedSec] = useState(0);
  const [toast, setToast] = useState<FrameGrabToast | null>(null);
  const stateRef = useRef<GifState>("idle");
  const tickRef = useRef<number | null>(null);
  const dismissRef = useRef<number | null>(null);

  const setPhase = (s: GifState) => {
    stateRef.current = s;
    setState(s);
  };

  const clearTick = () => {
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = null;
  };

  const stop = useCallback(async () => {
    if (stateRef.current !== "recording") return;
    clearTick();
    setPhase("encoding");
    const filename = `${safeName(captureBaseTitle(src))} - ${formatStamp(new Date())}.gif`;
    const dir = await captureDir();
    const outPath = dir ? await joinPath(dir, filename) : filename;
    if (dismissRef.current) window.clearTimeout(dismissRef.current);
    try {
      const result = await invoke<{ path: string; frames: number }>("mpv_gif_stop", { outPath });
      setToast({
        id: Date.now(),
        kind: "ok",
        text: t("GIF saved to {path}", { path: dir ? "Pictures/Harbor" : "downloads" }),
        path: result.path,
      });
    } catch (e) {
      setToast({
        id: Date.now(),
        kind: "error",
        text: typeof e === "string" ? e : t("GIF export failed"),
      });
    } finally {
      setPhase("idle");
      setElapsedSec(0);
      dismissRef.current = window.setTimeout(() => setToast(null), 6000);
    }
  }, [src]);

  const start = useCallback(async () => {
    if (!isTauri || stateRef.current !== "idle") return;
    try {
      await invoke("mpv_gif_start");
    } catch {
      return;
    }
    setPhase("recording");
    setElapsedSec(0);
    const startedAt = Date.now();
    clearTick();
    tickRef.current = window.setInterval(() => {
      const secs = Math.floor((Date.now() - startedAt) / 1000);
      setElapsedSec(secs);
      if (secs >= MAX_SECONDS) void stop();
    }, 250);
  }, [stop]);

  const abort = useCallback(async () => {
    if (stateRef.current === "idle") return;
    clearTick();
    setPhase("idle");
    setElapsedSec(0);
    try {
      await invoke("mpv_gif_abort");
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    if (stateRef.current === "recording") void stop();
    else if (stateRef.current === "idle") void start();
  }, [start, stop]);

  useEffect(
    () => () => {
      clearTick();
      if (dismissRef.current) window.clearTimeout(dismissRef.current);
      if (stateRef.current !== "idle") void invoke("mpv_gif_abort").catch(() => {});
    },
    [],
  );

  return {
    state,
    elapsedSec,
    toast,
    start: () => void start(),
    stop: () => void stop(),
    abort: () => void abort(),
    toggle,
  };
}
