import { unzip } from "fflate";
import { safeFetchBytes } from "../safe-fetch";

const MAX_ARCHIVE = 12 * 1024 * 1024;
const MAX_IMAGE = 8 * 1024 * 1024;
export type MapBlueprint = { name: string; data: Uint8Array; mime: string };

export async function readMapBlueprints(url: string, signal: AbortSignal): Promise<MapBlueprint[]> {
  const source = new URL(url);
  if (
    source.protocol !== "https:" ||
    source.hostname !== "ubistatic-a.ubisoft.com" ||
    !source.pathname.endsWith(".zip")
  )
    throw new Error("Unsupported blueprint source");
  const bounded = AbortSignal.any([signal, AbortSignal.timeout(12_000)]);
  const response = await safeFetchBytes(url, { signal: bounded }, 12_000, MAX_ARCHIVE);
  if (!response.ok || Number(response.headers.get("content-length")) > MAX_ARCHIVE)
    throw new Error("Blueprint download unavailable");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Blueprint archive unavailable");
  const chunks: Uint8Array[] = [];
  let size = 0;
  const cancel = () => {
    void reader.cancel().catch(() => {});
  };
  bounded.addEventListener("abort", cancel, { once: true });
  try {
    while (true) {
      bounded.throwIfAborted();
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_ARCHIVE) throw new Error("Blueprint archive too large");
      chunks.push(chunk.value);
    }
  } finally {
    bounded.removeEventListener("abort", cancel);
    await reader.cancel().catch(() => {});
  }
  bounded.throwIfAborted();
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return decodeMapBlueprints(bytes, bounded);
}

export function decodeMapBlueprints(
  bytes: Uint8Array,
  signal: AbortSignal,
): Promise<MapBlueprint[]> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    let total = 0;
    let count = 0;
    let settled = false;
    const cancel = () => {
      stop();
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
    };
    const stop = unzip(
      bytes,
      {
        filter: (file) => {
          if (
            !/\.(jpe?g|png)$/i.test(file.name) ||
            file.originalSize > MAX_IMAGE ||
            file.originalSize <= 0 ||
            file.name.startsWith("__MACOSX/")
          )
            return false;
          total += file.originalSize;
          count++;
          return count <= 12 && total <= 32 * 1024 * 1024;
        },
      },
      (error, files) => {
        settled = true;
        signal.removeEventListener("abort", cancel);
        if (signal.aborted) {
          reject(signal.reason);
          return;
        }
        if (error) {
          reject(error);
          return;
        }
        const images = Object.entries(files)
          .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
          .flatMap(([name, data]) => {
            const png = data[0] === 137 && data[1] === 80 && data[2] === 78 && data[3] === 71;
            const jpeg = data[0] === 255 && data[1] === 216 && data[2] === 255;
            return png || jpeg
              ? [
                  {
                    name: name.split("/").pop() || name,
                    data,
                    mime: png ? "image/png" : "image/jpeg",
                  },
                ]
              : [];
          });
        if (!images.length) reject(new Error("Blueprint images unavailable"));
        else resolve(images);
      },
    );
    if (!settled) {
      signal.addEventListener("abort", cancel, { once: true });
      if (signal.aborted) cancel();
    }
  });
}
