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
  mediaKind?: "audio",
): DownloadHandle {
  let settle = () => {};
  let fail = (_e: Error) => {};
  const promise = new Promise<void>((res, rej) => {
    settle = res;
    fail = rej;
  });

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
        settle();
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

  invoke("download_start", {
    id,
    url,
    dest: destPath,
    headers: headers && Object.keys(headers).length > 0 ? headers : null,
    onEvent: channel,
    mediaKind: mediaKind ?? null,
  }).catch((e: unknown) => {
    fail(e instanceof Error ? e : new Error(String(e)));
  });

  return {
    promise,
    abort: () => {
      void invoke("download_cancel", { id });
    },
  };
}
