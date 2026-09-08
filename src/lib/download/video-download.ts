import { Channel, invoke } from "@tauri-apps/api/core";

export type DownloadProgress = {
  receivedBytes: number;
  totalBytes: number | null;
  ratio: number;
};

export type DownloadHandle = {
  promise: Promise<void>;
  abort: () => void;
};

type DownloadEvent =
  | { kind: "started"; total: number | null; resumed: number }
  | { kind: "progress"; received: number; total: number | null }
  | { kind: "done"; received: number }
  | { kind: "error"; message: string }
  | { kind: "canceled"; received: number };

export function startDownload(
  id: string,
  url: string,
  destPath: string,
  onProgress: (p: DownloadProgress) => void,
  headers?: Record<string, string>,
): DownloadHandle {
  let finish = (_error: Error | null) => {};
  // Channel events can arrive before the native command releases its writer.
  const terminal = new Promise<Error | null>((resolve) => {
    finish = resolve;
  });
  const fail = (error: unknown) =>
    finish(error instanceof Error ? error : new Error(String(error)));

  const emit = (received: number, total: number | null) =>
    onProgress({
      receivedBytes: received,
      totalBytes: total,
      ratio: total ? Math.min(1, received / total) : 0,
    });

  const channel = new Channel<DownloadEvent>();
  channel.onmessage = (ev) => {
    switch (ev.kind) {
      case "started":
        emit(ev.resumed, ev.total);
        break;
      case "progress":
        emit(ev.received, ev.total);
        break;
      case "done":
        emit(ev.received, ev.received);
        finish(null);
        break;
      case "canceled": {
        const e = new Error("Download canceled");
        e.name = "AbortError";
        fail(e);
        break;
      }
      case "error":
        fail(new Error(ev.message));
        break;
    }
  };

  const command = invoke("download_start", {
    id,
    url,
    dest: destPath,
    headers: headers && Object.keys(headers).length > 0 ? headers : null,
    onEvent: channel,
  });
  const promise = command.then(async () => {
    const error = await terminal;
    if (error) throw error;
  });

  return {
    promise,
    abort: () => {
      void invoke("download_cancel", { id }).catch(fail);
    },
  };
}
