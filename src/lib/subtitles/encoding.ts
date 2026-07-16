export type SubtitleEncodingOptions = {
  encoding?: string;
  lang?: string;
};

export function decodeSubtitleBytes(
  bytes: Uint8Array,
  options: SubtitleEncodingOptions = {},
): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe)
    return new TextDecoder("utf-16le").decode(bytes.slice(2));
  if (bytes[0] === 0xfe && bytes[1] === 0xff)
    return new TextDecoder("utf-16be").decode(bytes.slice(2));
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)
    return new TextDecoder("utf-8").decode(bytes.slice(3));
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    const lang = (options.lang ?? "").trim().toLowerCase();
    const fallback =
      lang === "ar" || lang === "ara" || lang === "arabic" ? "windows-1256" : "windows-1252";
    const encoding = options.encoding?.trim() || fallback;
    try {
      return new TextDecoder(encoding).decode(bytes);
    } catch {
      return new TextDecoder(fallback).decode(bytes);
    }
  }
}
