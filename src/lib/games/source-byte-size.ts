const encoder = new TextEncoder();
const scratch = new Uint8Array(64 * 1024);

/** Exact UTF-8 size up to a limit, without allocating an encoded copy of a feed.
 * Callers only need to distinguish an over-limit value, represented by limit + 1.
 * Synchronous use keeps this context-local buffer exclusive to one measurement. */
export function sourceByteSize(value: string, limit = Infinity): number {
  if (value.length > limit) return limit + 1;
  let bytes = 0, offset = 0;
  if (typeof encoder.encodeInto === 'function') {
    while (offset < value.length) {
      // Some WebViews convert the entire input before copying into the buffer.
      // Bound that input too, and keep UTF-16 pairs together at the boundary.
      let end = Math.min(value.length, offset + 16 * 1024);
      const last = value.charCodeAt(end - 1), next = value.charCodeAt(end);
      if (last >= 0xd800 && last <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) end--;
      const { read, written } = encoder.encodeInto(value.slice(offset, end), scratch);
      offset += read; bytes += written;
      if (bytes > limit) return limit + 1;
    }
  } else {
    // Older WebViews: mirror TextEncoder's replacement of unpaired surrogates.
    for (; offset < value.length; offset++) {
      const code = value.charCodeAt(offset);
      if (code < 0x80) bytes++;
      else if (code < 0x800) bytes += 2;
      else if (code >= 0xd800 && code <= 0xdbff && value.charCodeAt(offset + 1) >= 0xdc00 && value.charCodeAt(offset + 1) <= 0xdfff) { bytes += 4; offset++; }
      else bytes += 3;
      if (bytes > limit) return limit + 1;
    }
  }
  return bytes;
}
