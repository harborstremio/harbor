import { yieldToBrowser } from "../yield-to-browser";

type Limits = {
  signal?: AbortSignal;
  maxBytes?: number;
  idleMs?: number;
  totalMs?: number;
  httpError?: (response: Response) => string;
};

/** Keep stalled or oversized providers from retaining a pending load indefinitely. */
export async function fetchBoundedText(
  request: (signal: AbortSignal) => Promise<Response>,
  {
    signal,
    maxBytes = 80 * 1024 * 1024,
    idleMs = 45_000,
    totalMs = 5 * 60_000,
    httpError,
  }: Limits = {},
): Promise<string> {
  signal?.throwIfAborted();
  const controller = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let rejectAbort!: (reason: unknown) => void;
  const cancelled = new Promise<never>((_, reject) => {
    rejectAbort = reject;
  });
  const cancelReader = () => {
    void reader?.cancel().catch(() => {});
  };
  const onAbort = () => {
    rejectAbort(controller.signal.reason);
    cancelReader();
  };
  const parentAborted = () => controller.abort(signal?.reason);
  const resetIdle = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(
      () =>
        controller.abort(
          new DOMException("Playlist download stopped responding. Please retry.", "TimeoutError"),
        ),
      idleMs,
    );
  };
  controller.signal.addEventListener("abort", onAbort, { once: true });
  signal?.addEventListener("abort", parentAborted, { once: true });
  resetIdle();
  const totalTimer = setTimeout(
    () =>
      controller.abort(
        new DOMException("Playlist download took too long. Please retry.", "TimeoutError"),
      ),
    totalMs,
  );
  try {
    const responseTask = Promise.resolve()
      .then(() => request(controller.signal))
      .then((response) => {
        if (controller.signal.aborted) {
          void response.body?.cancel().catch(() => {});
          throw controller.signal.reason;
        }
        return response;
      });
    const response = await Promise.race([responseTask, cancelled]);
    if (!response.ok) {
      void response.body?.cancel().catch(() => {});
      throw new Error(httpError?.(response) || `HTTP ${response.status} ${response.statusText}`);
    }
    reader = response.body?.getReader();
    if (!reader) return "";
    const tooLarge = () =>
      new Error(`Playlist response exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB limit.`);
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > maxBytes) throw tooLarge();
    resetIdle();
    const decoder = new TextDecoder();
    const pieces: string[] = [];
    let buffered = "";
    let bytes = 0;
    let yieldedAt = 0;
    let chunks = 0;
    while (true) {
      controller.signal.throwIfAborted();
      const { done, value } = await Promise.race([reader.read(), cancelled]);
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw tooLarge();
      if (value.byteLength) resetIdle();
      buffered += decoder.decode(value, { stream: true });
      if (buffered.length >= 64 * 1024) {
        pieces.push(buffered);
        buffered = "";
      }
      chunks++;
      if (bytes - yieldedAt >= 1024 * 1024 || chunks % 128 === 0) {
        yieldedAt = bytes;
        await yieldToBrowser();
      }
    }
    controller.signal.throwIfAborted();
    pieces.push(buffered + decoder.decode());
    return pieces.join("");
  } finally {
    clearTimeout(idleTimer);
    clearTimeout(totalTimer);
    signal?.removeEventListener("abort", parentAborted);
    controller.signal.removeEventListener("abort", onAbort);
    cancelReader();
  }
}
