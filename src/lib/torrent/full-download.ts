import { readStreamSizeLimit, streamSizeAllowed } from "../streams/size-limit";

const controllers = new Map<string, AbortController>();

export function fullDownloadEnabled(): boolean {
  try {
    const raw = localStorage.getItem("harbor.settings");
    if (!raw) return false;
    return (JSON.parse(raw) as { torrentFullDownload?: boolean }).torrentFullDownload === true;
  } catch {
    return false;
  }
}

export function startFullDownload(infoHash: string, url: string): void {
  if (controllers.has(infoHash)) return;
  const ctrl = new AbortController();
  controllers.set(infoHash, ctrl);
  void (async () => {
    try {
      const res = await fetch(url, { signal: ctrl.signal, headers: { Range: "bytes=0-" } });
      const rangeSize = res.headers.get("content-range")?.match(/\/(\d+)$/)?.[1];
      const size = Number(rangeSize ?? res.headers.get("content-length"));
      if (!streamSizeAllowed(size, readStreamSizeLimit())) {
        ctrl.abort();
        await res.body?.cancel();
        return;
      }
      const reader = res.body?.getReader();
      if (!reader) return;
      for (;;) {
        const { done } = await reader.read();
        if (done) break;
      }
    } catch {
      /* aborted, stream ended, or network error - safe to drop */
    } finally {
      controllers.delete(infoHash);
    }
  })();
}

export function stopFullDownload(infoHash: string): void {
  const c = controllers.get(infoHash);
  if (c) {
    c.abort();
    controllers.delete(infoHash);
  }
}
