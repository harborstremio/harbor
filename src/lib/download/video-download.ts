import { Channel, invoke } from "@tauri-apps/api/core";

export type DownloadProgress = {
  receivedBytes: number;
  totalBytes: number | null;
  ratio: number;
  retry?: { attempt: number; delaySeconds: number };
};

export type DownloadHandle = {
  promise: Promise<void>;
  abort: () => void;
};

type DownloadEvent =
  | { kind: "started"; total: number | null; resumed: number }
  | { kind: "progress"; received: number; total: number | null }
  | { kind: "retrying"; attempt: number; delaySeconds: number }
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
  let terminalError: Error | null = null;
  let finished = false;
  let receivedBytes = 0;
  let totalBytes: number | null = null;
  let settle = () => {};
  let fail = (_e: Error) => {};
  const promise = new Promise<void>((res, rej) => {
    settle = res;
    fail = rej;
  });

  const emit = (received: number, total: number | null) => {
    receivedBytes = received;
    totalBytes = total;
    onProgress({
      receivedBytes: received,
      totalBytes: total,
      ratio: total ? Math.min(1, received / total) : 0,
    });
  };

  const channel = new Channel<DownloadEvent>();
  channel.onmessage = (ev) => {
    if (finished) return;
    switch (ev.kind) {
      case "started":
        emit(ev.resumed, ev.total);
        break;
      case "progress":
        emit(ev.received, ev.total);
        break;
      case "retrying":
        onProgress({
          receivedBytes,
          totalBytes,
          ratio: totalBytes ? Math.min(1, receivedBytes / totalBytes) : 0,
          retry: { attempt: ev.attempt, delaySeconds: ev.delaySeconds },
        });
        break;
      case "done":
        emit(ev.received, ev.received);
        break;
      case "canceled": {
        const e = new Error("Download canceled");
        e.name = "AbortError";
        terminalError = e;
        break;
      }
      case "error":
        terminalError = new Error(ev.message);
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
  })
    .then(() => {
      finished = true;
      // Wait for native task cleanup before a paused/failed download can restart.
      if (terminalError) fail(terminalError);
      else settle();
    })
    .catch((e: unknown) => {
      finished = true;
      fail(terminalError ?? (e instanceof Error ? e : new Error(String(e))));
    });

  return {
    promise,
    abort: () => {
      terminalError = new Error("Download canceled");
      terminalError.name = "AbortError";
      void invoke("download_cancel", { id });
    },
  };
}
