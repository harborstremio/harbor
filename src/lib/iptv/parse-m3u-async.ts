import { iterateM3uChannels } from "./m3u";
import { yieldToBrowser } from "../yield-to-browser";
import type { IptvChannel } from "./types";

const WORKER_IDLE_TIMEOUT_MS = 15_000;

export async function parseM3uAsync(
  text: string,
  baseId: string,
  onProgress?: (channels: IptvChannel[]) => void,
  signal?: AbortSignal,
): Promise<IptvChannel[]> {
  signal?.throwIfAborted();
  const channels: IptvChannel[] = [];
  let publishedAt = 0;
  const append = (batch: IptvChannel[]) => {
    channels.push(...batch);
    if (onProgress && (publishedAt === 0 || performance.now() - publishedAt >= 750)) {
      onProgress(channels.slice());
      publishedAt = performance.now();
    }
  };
  let worker: Worker | null = null;
  try {
    if (typeof Worker !== "undefined")
      worker = new Worker(new URL("./m3u.worker.ts", import.meta.url), {
        type: "module",
      });
    if (worker) {
      const active = worker;
      await new Promise<void>((resolve, reject) => {
        let timer: ReturnType<typeof setTimeout>;
        const cleanup = () => {
          clearTimeout(timer);
          active.onmessage = null;
          active.onerror = null;
          active.onmessageerror = null;
          signal?.removeEventListener("abort", aborted);
        };
        const failed = (error: unknown) => {
          cleanup();
          reject(error);
        };
        const aborted = () => failed(signal?.reason);
        const armDeadline = () => {
          clearTimeout(timer);
          timer = setTimeout(
            () => failed(new Error("Playlist parser worker did not respond")),
            WORKER_IDLE_TIMEOUT_MS,
          );
        };
        active.onerror = () => failed(new Error("Playlist parser worker failed"));
        active.onmessageerror = () =>
          failed(new Error("Playlist parser response could not be read"));
        active.onmessage = (event: MessageEvent<{ channels: IptvChannel[]; done: boolean }>) => {
          try {
            signal?.throwIfAborted();
            append(event.data.channels);
            if (event.data.done) {
              cleanup();
              resolve();
            } else {
              armDeadline();
              active.postMessage({});
            }
          } catch (error) {
            failed(error);
          }
        };
        signal?.addEventListener("abort", aborted, { once: true });
        armDeadline();
        try {
          active.postMessage({ text, baseId });
        } catch (error) {
          failed(error);
        }
      });
      return channels;
    }
  } catch {
    signal?.throwIfAborted();
    channels.length = 0;
    publishedAt = 0;
  } finally {
    worker?.terminate();
  }
  const parser = iterateM3uChannels(text, baseId);
  let done = false;
  while (!done) {
    signal?.throwIfAborted();
    const batch: IptvChannel[] = [];
    for (let i = 0; i < 128; i++) {
      const next = parser.next();
      if (next.done) {
        done = true;
        break;
      }
      batch.push(next.value);
    }
    append(batch);
    if (!done) await yieldToBrowser();
  }
  signal?.throwIfAborted();
  return channels;
}
