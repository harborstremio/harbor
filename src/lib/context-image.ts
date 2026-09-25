import { isTauri, convertFileSrc } from "@tauri-apps/api/core";
import {
  MAX_CONTEXT_IMAGE_BYTES,
  imageFilename,
  readImageResponse,
  writeImageResource,
  type ContextImage,
  type LoadedContextImage,
} from "./context-image-policy";

export {
  publicContextImageUrl,
  type ContextImage,
  type LoadedContextImage,
} from "./context-image-policy";

const IMAGE_TIMEOUT_MS = 20_000;
const MAX_CLIPBOARD_PIXELS = 32_000_000;

function inlineImageResponse(src: string): Response {
  const comma = src.indexOf(",");
  if (comma < 0) throw new Error("The inline image is invalid.");
  const metadata = src.slice(5, comma);
  const contentType = metadata.split(";")[0];
  const encoded = src.slice(comma + 1);
  let bytes: Uint8Array;
  if (/;base64$/i.test(metadata)) {
    const decoded = atob(decodeURIComponent(encoded).replace(/\s/g, ""));
    bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  } else {
    // Percent escapes may represent binary bytes that are not valid UTF-8.
    const values = new Uint8Array(Math.min(MAX_CONTEXT_IMAGE_BYTES + 1, encoded.length * 3));
    let length = 0;
    const encoder = new TextEncoder();
    for (let index = 0; index < encoded.length;) {
      const escape = encoded.slice(index, index + 3);
      if (/^%[\da-f]{2}$/i.test(escape)) {
        values[length++] = Number.parseInt(escape.slice(1), 16);
        index += 3;
      } else {
        const next = encoded.indexOf("%", index + 1);
        const stop = next < 0 ? encoded.length : next;
        const segment = encoded.slice(index, stop);
        const result = encoder.encodeInto(segment, values.subarray(length));
        length += result.written;
        if (result.read !== segment.length)
          throw new Error("The image is too large (maximum 32 MB).");
        index = stop;
      }
      if (length > MAX_CONTEXT_IMAGE_BYTES)
        throw new Error("The image is too large (maximum 32 MB).");
    }
    bytes = values.slice(0, length);
  }
  return new Response(bytes, { headers: { "content-type": contentType } });
}

export async function loadContextImage(
  image: ContextImage,
  options: { signal?: AbortSignal } = {},
): Promise<LoadedContextImage> {
  const intended = (image.originalSrc || image.src).trim();
  if (!intended) throw new Error("This image has no source.");
  if (intended.startsWith("data:") && intended.length > MAX_CONTEXT_IMAGE_BYTES * 1.5)
    throw new Error("The image is too large (maximum 32 MB).");
  const native = isTauri();
  let src = intended;
  if (/^[a-z]:[\\/]/i.test(src)) {
    if (!native) throw new Error("Local images require the desktop app.");
    src = convertFileSrc(src);
  }
  if (/^file:/i.test(src)) {
    if (!native) throw new Error("Local images require the desktop app.");
    const file = new URL(src);
    if (file.host && file.host !== "localhost")
      throw new Error("Network file URLs are not supported.");
    src = convertFileSrc(decodeURIComponent(file.pathname).replace(/^\/([a-z]:\/)/i, "$1"));
  }
  const url = new URL(
    src,
    typeof window === "undefined" ? "http://localhost" : window.location.href,
  );
  if (
    !["http:", "https:", "data:", "blob:", "asset:", "tauri:"].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new Error("This image source is not supported.");
  }
  if (url.protocol === "data:" && !/^data:image\//i.test(src))
    throw new Error("The source is not an image.");
  const controller = new AbortController();
  const abort = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(
    () => controller.abort(new Error("Image loading timed out.")),
    IMAGE_TIMEOUT_MS,
  );
  try {
    if (controller.signal.aborted) throw controller.signal.reason;
    // Data URLs are inline bytes; decoding them avoids a network/CSP connect operation.
    if (url.protocol === "data:") return await readImageResponse(inlineImageResponse(src));
    const isRemote =
      /^https?:$/.test(url.protocol) &&
      url.hostname !== "asset.localhost" &&
      url.hostname !== "tauri.localhost" &&
      url.origin !== (typeof window === "undefined" ? "" : window.location.origin);
    const response =
      native && isRemote
        ? await (
            await import("@tauri-apps/plugin-http")
          ).fetch(url.href, {
            signal: controller.signal,
            maxRedirections: 5,
            connectTimeout: IMAGE_TIMEOUT_MS,
          })
        : await fetch(url.href, {
            signal: controller.signal,
            credentials: "omit",
            referrerPolicy: "no-referrer",
          });
    return await readImageResponse(response);
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error(
        options.signal?.aborted ? "Image loading cancelled." : "Image loading timed out.",
        { cause: error },
      );
    throw error;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
  }
}

export async function saveContextImage(image: ContextImage) {
  const loaded = await loadContextImage(image);
  const { saveBinaryToDisk } = await import("./download/save-binary");
  return saveBinaryToDisk(
    loaded.bytes,
    imageFilename(image.filename || image.label, loaded.extension),
    loaded.extension,
    loaded.mime,
  );
}

async function imageCanvas(image: ContextImage): Promise<HTMLCanvasElement> {
  const loaded = await loadContextImage(image);
  const url = URL.createObjectURL(loaded.blob);
  const element = new Image();
  try {
    element.src = url;
    await element.decode();
    const width = element.naturalWidth;
    const height = element.naturalHeight;
    if (!width || !height || width * height > MAX_CLIPBOARD_PIXELS)
      throw new Error("The image is too large to copy. Save the original image instead.");
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image copying is unavailable.");
    context.drawImage(element, 0, 0);
    return canvas;
  } finally {
    element.src = "";
    URL.revokeObjectURL(url);
  }
}

export function canCopyContextImage(): boolean {
  if (isTauri()) return !/Android|iPhone|iPad/i.test(navigator.userAgent);
  return typeof ClipboardItem !== "undefined" && !!navigator.clipboard?.write;
}

export async function copyContextImage(image: ContextImage): Promise<void> {
  if (!canCopyContextImage())
    throw new Error("Copy image is unavailable here. Save the image instead.");
  if (isTauri()) {
    const canvas = await imageCanvas(image);
    try {
      const [{ Image: NativeImage }, { invoke }] = await Promise.all([
        import("@tauri-apps/api/image"),
        import("@tauri-apps/api/core"),
      ]);
      const pixels = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
      const resource = await NativeImage.new(
        new Uint8Array(pixels.data.buffer),
        canvas.width,
        canvas.height,
      );
      // JsImage accepts a resource ID. Passing it directly also avoids instanceof
      // mismatches when the clipboard package resolves a different API patch.
      await writeImageResource(resource, (value) =>
        invoke("plugin:clipboard-manager|write_image", { image: value.rid }),
      );
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
    return;
  }
  // Construct and write the item before awaiting image IO to preserve browser activation.
  const png = imageCanvas(image).then(
    (canvas) =>
      new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          canvas.width = 0;
          canvas.height = 0;
          if (blob) resolve(blob);
          else reject(new Error("The browser could not copy this image."));
        }, "image/png");
      }),
  );
  await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
}
