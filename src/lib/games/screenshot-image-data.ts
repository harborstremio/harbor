import { gameImage } from "./steam-data";

export function cacheableScreenshot(value: string): boolean {
  try { const url = new URL(value); return value.length <= 2500 && !!gameImage(value) && !url.username && !url.password && (!url.port || url.port === "443") && /\.(?:jpe?g|png|webp)$/i.test(url.pathname); }
  catch { return false; }
}

/** Read dimensions before bitmap decoding, then let the browser validate the actual pixels. */
export function screenshotImageHeader(bytes: Uint8Array): { width: number; height: number; mime: string } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (offset: number, count: number) => String.fromCharCode(...bytes.subarray(offset, offset + count));
  const result = (width: number, height: number, mime: string) => width > 0 && height > 0 && width <= 16384 && height <= 16384 && width * height <= 40_000_000 ? { width, height, mime } : null;
  if (bytes.length >= 24 && bytes.slice(0, 8).every((value, i) => value === [137, 80, 78, 71, 13, 10, 26, 10][i]) && ascii(12, 4) === "IHDR") return result(view.getUint32(16), view.getUint32(20), "image/png");
  if (bytes.length >= 30 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    const kind = ascii(12, 4), u24 = (offset: number) => bytes[offset] | bytes[offset + 1] << 8 | bytes[offset + 2] << 16;
    if (kind === "VP8X") return result(u24(24) + 1, u24(27) + 1, "image/webp");
    if (kind === "VP8L" && bytes[20] === 0x2f) return result((view.getUint32(21, true) & 0x3fff) + 1, (view.getUint32(21, true) >>> 14 & 0x3fff) + 1, "image/webp");
    if (kind === "VP8 " && ascii(23, 3) === "\x9d\x01\x2a") return result(view.getUint16(26, true) & 0x3fff, view.getUint16(28, true) & 0x3fff, "image/webp");
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset++] !== 0xff) return null;
      while (offset < bytes.length && bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xd9 || marker === 0xda || offset + 2 > bytes.length) return null;
      if (marker === 0x01 || marker >= 0xd0 && marker <= 0xd7) continue;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) return null;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) return length >= 8 ? result(view.getUint16(offset + 5), view.getUint16(offset + 3), "image/jpeg") : null;
      offset += length;
    }
  }
  return null;
}
