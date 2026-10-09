import type { IptvChannel } from "../iptv/types";
import { yieldToBrowser } from "../yield-to-browser";
import {
  buildSportsChannelIndex,
  type PreparedChannel,
  type SportsChannelIndex,
} from "./iptv-match";

const cache = new WeakMap<readonly IptvChannel[], SportsChannelIndex>();
const BATCH_SIZE = 256;
const WORKER_BATCH_TIMEOUT_MS = 15_000;

export async function prepareSportsChannels(
  channels: readonly IptvChannel[],
  signal: AbortSignal,
  publish: (index: SportsChannelIndex) => void,
): Promise<SportsChannelIndex> {
  signal.throwIfAborted();
  const hit = cache.get(channels);
  if (hit) {
    publish(hit);
    return hit;
  }
  const prepared: PreparedChannel[] = [];
  let worker: Worker | null = null;
  try {
    if (typeof Worker !== "undefined")
      worker = new Worker(new URL("./channel-index.worker.ts", import.meta.url), {
        type: "module",
      });
  } catch {
    /* Sandboxed previews can disallow workers; the fallback still yields. */
  }
  let lastPublish = 0;
  try {
    for (let offset = 0; offset < channels.length; offset += BATCH_SIZE) {
      signal.throwIfAborted();
      const batch = channels.slice(offset, offset + BATCH_SIZE);
      let rows: PreparedChannel[];
      if (worker) {
        try {
          rows = await new Promise<PreparedChannel[]>((resolve, reject) => {
            const current = worker!;
            const timer = setTimeout(() => {
              cleanup();
              reject(new Error("Sports index worker did not respond"));
            }, WORKER_BATCH_TIMEOUT_MS);
            const cleanup = () => {
              clearTimeout(timer);
              current.onmessage = null;
              current.onerror = null;
              current.onmessageerror = null;
              signal.removeEventListener("abort", aborted);
            };
            const aborted = () => {
              cleanup();
              reject(signal.reason);
            };
            current.onmessage = (event) => {
              cleanup();
              resolve(event.data);
            };
            current.onerror = () => {
              cleanup();
              reject(new Error("Sports index worker failed"));
            };
            current.onmessageerror = () => {
              cleanup();
              reject(new Error("Sports index worker response could not be read"));
            };
            signal.addEventListener("abort", aborted, { once: true });
            try {
              current.postMessage(batch);
            } catch (error) {
              cleanup();
              reject(error);
            }
          });
          // Retain original playlist objects, not a second copy of stream credentials/metadata.
          const originals = new Map(batch.map((channel) => [channel.id, channel]));
          rows.forEach((row) => {
            row.channel = originals.get(row.channel.id)!;
          });
        } catch {
          signal.throwIfAborted();
          worker.terminate();
          worker = null;
          rows = buildSportsChannelIndex(batch).channels;
        }
      } else rows = buildSportsChannelIndex(batch).channels;
      prepared.push(...rows);
      const scanned = Math.min(offset + BATCH_SIZE, channels.length);
      if (performance.now() - lastPublish > 250 && scanned < channels.length) {
        publish({ channels: prepared.slice(), scanned });
        lastPublish = performance.now();
      }
      await yieldToBrowser();
    }
    signal.throwIfAborted();
    const result = { channels: prepared, scanned: channels.length };
    cache.set(channels, result);
    publish(result);
    return result;
  } finally {
    worker?.terminate();
  }
}
