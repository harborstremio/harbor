import type { Meta } from "@/lib/cinemeta";
import { buildDefaultFilename, extensionFromUrl } from "@/lib/download/filename";
import { startDownload, type DownloadHandle, type DownloadProgress } from "@/lib/download/video-download";
import { useSettings } from "@/lib/settings";
import { randomUuid } from "@/lib/uuid";
import type { PlayEpisode } from "@/lib/view";
import { downloadDir } from "@tauri-apps/api/path";
import { save } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useRef, useState } from "react";

export type DownloadStatus =
  | { kind: "idle" }
  | { kind: "preparing" }
  | { kind: "downloading"; ratio: number; receivedBytes: number; totalBytes: number | null }
  | { kind: "done"; path: string }
  | { kind: "error"; message: string };

type Args = {
  url: string;
  meta: Meta;
  episode?: PlayEpisode;
};

export function useVideoDownload({ url, meta, episode }: Args) {
  const { settings } = useSettings();
  const [status, setStatus] = useState<DownloadStatus>({ kind: "idle" });
  const handleRef = useRef<DownloadHandle | null>(null);

  useEffect(
    () => () => {
      handleRef.current?.abort();
    },
    [],
  );

  const start = useCallback(async () => {
    if (handleRef.current) return;
    setStatus({ kind: "preparing" });
    const defaultFilename = buildDefaultFilename(meta, episode, url);
    const ext = extensionFromUrl(url);
    const sep = navigator.platform.toLowerCase().includes("win") ? "\\" : "/";
    const settingsDir = settings.downloadDir.trim();
    const dir = settingsDir || (await downloadDir().catch(() => "")) || "";
    const defaultPath = dir ? `${dir}${dir.endsWith(sep) ? "" : sep}${defaultFilename}` : defaultFilename;
    let path: string | null = null;
    try {
      path = await save({
        defaultPath,
        filters: [{ name: "Video", extensions: [ext, "mkv", "mp4", "webm"] }],
      });
    } catch (e) {
      setStatus({
        kind: "error",
        message: e instanceof Error ? e.message : "Save dialog failed",
      });
      return;
    }
    if (!path) {
      setStatus({ kind: "idle" });
      return;
    }

    setStatus({ kind: "downloading", ratio: 0, receivedBytes: 0, totalBytes: null });
    const id = randomUuid();
    const handle = startDownload(id, url, path, (p: DownloadProgress) => {
      setStatus({
        kind: "downloading",
        ratio: p.ratio,
        receivedBytes: p.receivedBytes,
        totalBytes: p.totalBytes,
      });
    });
    handleRef.current = handle;
    handle.promise
      .then(async () => {
        setStatus({ kind: "done", path: path! });
        try {
          await revealItemInDir(path!);
        } catch {
          return;
        }
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name === "AbortError") {
          setStatus({ kind: "idle" });
          return;
        }
        setStatus({
          kind: "error",
          message: e instanceof Error ? e.message : "Download failed",
        });
      })
      .finally(() => {
        handleRef.current = null;
      });
  }, [url, meta, episode, settings.downloadDir]);

  const cancel = useCallback(() => {
    handleRef.current?.abort();
  }, []);

  const reveal = useCallback(async () => {
    if (status.kind !== "done") return;
    try {
      await revealItemInDir(status.path);
    } catch {
      return;
    }
  }, [status]);

  const reset = useCallback(() => {
    setStatus({ kind: "idle" });
  }, []);

  return { status, start, cancel, reveal, reset };
}
