import { downloadDir } from "@tauri-apps/api/path";
import { save } from "@tauri-apps/plugin-dialog";
import { useCallback, useState } from "react";
import { t } from "@/lib/i18n";
import type { Meta } from "@/lib/cinemeta";
import {
  cancelDownload,
  enqueueDownload,
  revealDownload,
  useDownloads,
} from "@/lib/download/downloads-store";
import { buildDefaultFilename, extensionFromUrl } from "@/lib/download/filename";
import { useSettings } from "@/lib/settings";
import { isWindowsDesktop } from "@/lib/platform";
import type { PlayEpisode } from "@/lib/view";

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
  headers?: Record<string, string>;
};

export function useVideoDownload({ url, meta, episode, headers }: Args) {
  const { settings } = useSettings();
  const downloads = useDownloads();
  const [downloadId, setDownloadId] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const matchesSource = (item: (typeof downloads)[number]) =>
    item.metaId === meta.id &&
    item.url === url &&
    item.season === (episode?.season ?? null) &&
    item.episode === (episode?.episode ?? null);
  const selected = downloadId ? downloads.find((item) => item.id === downloadId) : null;
  const active = downloads.find(
    (item) => matchesSource(item) && (item.status === "downloading" || item.status === "paused"),
  );
  const current = selected?.status === "canceled" ? active : (selected ?? active);

  const status: DownloadStatus = preparing
    ? { kind: "preparing" }
    : localError
      ? { kind: "error", message: localError }
      : current?.status === "done"
        ? { kind: "done", path: current.path }
        : current?.status === "downloading" || current?.status === "paused"
          ? {
              kind: "downloading",
              ratio: current.ratio,
              receivedBytes: current.receivedBytes,
              totalBytes: current.totalBytes,
            }
          : current?.status === "error" || current?.status === "interrupted"
            ? { kind: "error", message: current.error ?? t("Download interrupted") }
            : { kind: "idle" };

  const start = useCallback(async () => {
    if (preparing || current?.status === "downloading" || current?.status === "paused") return;
    setPreparing(true);
    setLocalError(null);
    const defaultFilename = buildDefaultFilename(meta, episode, url);
    const ext = extensionFromUrl(url);
    const sep = isWindowsDesktop() ? "\\" : "/";
    const settingsDir = settings.downloadDir.trim();
    const dir = settingsDir || (await downloadDir().catch(() => "")) || "";
    const defaultPath = dir
      ? `${dir}${dir.endsWith(sep) ? "" : sep}${defaultFilename}`
      : defaultFilename;
    let path: string | null = null;
    try {
      path = await save({
        defaultPath,
        filters: [{ name: t("Video"), extensions: [ext, "mkv", "mp4", "webm"] }],
      });
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : t("Save dialog failed"));
      setPreparing(false);
      return;
    }
    if (!path) {
      setPreparing(false);
      return;
    }

    try {
      const id = await enqueueDownload({
        meta,
        episode,
        url,
        headers,
        destinationPath: path,
      });
      setDownloadId(id);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : t("Download failed"));
    } finally {
      setPreparing(false);
    }
  }, [current?.status, episode, headers, meta, preparing, settings.downloadDir, url]);

  const cancel = useCallback(() => {
    if (current) cancelDownload(current.id);
  }, [current]);

  const reveal = useCallback(async () => {
    if (current?.status === "done") await revealDownload(current.id);
  }, [current]);

  const reset = useCallback(() => {
    setDownloadId(null);
    setLocalError(null);
  }, []);

  return { status, start, cancel, reveal, reset };
}
