export type ContextImage = {
  /** The rendered source, including an app-owned blob or asset URL. */
  src: string;
  /** Explicit full-resolution source supplied by the owning component. Never guessed from a thumbnail. */
  originalSrc?: string;
  /** Only supplied by owners that know the image is public. Loading never adds account credentials. */
  publicUrl?: string;
  label?: string;
  filename?: string;
};

export const MAX_CONTEXT_IMAGE_BYTES = 32 * 1024 * 1024;
export type LoadedContextImage = {
  bytes: Uint8Array;
  mime: string;
  extension: string;
  blob: Blob;
};

export function publicContextImageUrl(image: ContextImage): string | null {
  if (!image.publicUrl) return null;
  try {
    const url = new URL(image.publicUrl);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.hash) return null;
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    // A declared public image must not expose device/LAN endpoints or signed credentials.
    if (
      !host.includes(".") ||
      host.includes(":") ||
      host === "localhost" ||
      /\.(localhost|local|internal|lan)$/.test(host)
    )
      return null;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return null;
    const publicParams = new Set([
      "w",
      "h",
      "width",
      "height",
      "q",
      "quality",
      "fit",
      "format",
      "auto",
      "dpr",
    ]);
    for (const key of url.searchParams.keys())
      if (!publicParams.has(key.toLowerCase())) return null;
    if (/\/(?:auth|token|session|private)(?:\/|$)/i.test(url.pathname)) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function imageFilename(name: string | undefined, extension: string): string {
  let base = (name || "image").split(/[\\/]/).pop() || "image";
  base =
    base
      .replace(/\.(?:jpe?g|png|gif|webp|svg|avif|bmp|ico)$/i, "")
      .replace(/[<>:"/\\|?*]/g, "")
      .split("")
      .filter((character) => character.charCodeAt(0) >= 32)
      .join("")
      .replace(/^[. ]+|[. ]+$/g, "")
      .slice(0, 140) || "image";
  if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(base)) base = `image-${base}`;
  return `${base}.${extension}`;
}

function imageFormat(bytes: Uint8Array): { mime: string; extension: string } | null {
  const has = (signature: number[], at = 0) =>
    signature.every((value, i) => bytes[at + i] === value);
  const ascii = (at: number, length: number) =>
    String.fromCharCode(...bytes.subarray(at, at + length));
  if (has([137, 80, 78, 71, 13, 10, 26, 10])) return { mime: "image/png", extension: "png" };
  if (has([255, 216, 255])) return { mime: "image/jpeg", extension: "jpg" };
  if (/^GIF8[79]a$/.test(ascii(0, 6))) return { mime: "image/gif", extension: "gif" };
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP")
    return { mime: "image/webp", extension: "webp" };
  if (ascii(0, 2) === "BM") return { mime: "image/bmp", extension: "bmp" };
  if (has([0, 0, 1, 0])) return { mime: "image/x-icon", extension: "ico" };
  if (ascii(4, 4) === "ftyp" && /avif|avis/.test(ascii(8, Math.min(bytes.length - 8, 48))))
    return { mime: "image/avif", extension: "avif" };
  const text = new TextDecoder()
    .decode(bytes.subarray(0, 4096))
    .replace(/^\uFEFF/, "")
    .trimStart()
    .replace(/^<\?xml[^>]*\?>\s*/i, "")
    .replace(/^(?:<!--[\s\S]*?-->\s*)*/, "");
  if (/^<svg(?:\s|>)/i.test(text)) return { mime: "image/svg+xml", extension: "svg" };
  return null;
}

export async function readImageResponse(
  response: Response,
  maxBytes = MAX_CONTEXT_IMAGE_BYTES,
): Promise<LoadedContextImage> {
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Image request failed (${response.status}).`);
  }
  const declared = (response.headers.get("content-type") || "")
    .split(";")[0]
    .trim()
    .toLowerCase()
    .replace("image/jpg", "image/jpeg");
  if (declared && !declared.startsWith("image/") && declared !== "application/octet-stream") {
    await response.body?.cancel();
    throw new Error("The source did not return an image.");
  }
  if (Number(response.headers.get("content-length")) > maxBytes) {
    await response.body?.cancel();
    throw new Error("The image is too large (maximum 32 MB).");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("The image response is empty.");
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error("The image is too large (maximum 32 MB).");
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }
  const format = imageFormat(bytes);
  if (!format) throw new Error("The source is not a supported image.");
  if (
    declared.startsWith("image/") &&
    declared !== format.mime &&
    !(format.extension === "ico" && declared === "image/vnd.microsoft.icon")
  ) {
    throw new Error("The image content does not match its reported format.");
  }
  return { bytes, ...format, blob: new Blob([bytes.buffer], { type: format.mime }) };
}

/** The caller owns the native resource even when clipboard permission is denied. */
export async function writeImageResource<T extends { close(): Promise<void> }>(
  resource: T,
  write: (image: T) => Promise<void>,
): Promise<void> {
  try {
    await write(resource);
  } finally {
    await resource.close();
  }
}
