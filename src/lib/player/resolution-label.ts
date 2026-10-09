export function realQualityLabel(width: number, height: number): string | null {
  const w = Math.round(width);
  const h = Math.round(height);
  if (w <= 0 && h <= 0) return null;
  if (h >= 2160 || w >= 3840) return "4K";
  if (h >= 1440 || w >= 2560) return "1440p";
  if (h >= 1080 || w >= 1920) return "1080p";
  if (h >= 720 || w >= 1280) return "720p";
  if (h >= 480 || w >= 854) return "480p";
  return "SD";
}

const DV_TOKEN = /dolby\s*vision|\bdovi\b|\bdv\b/;
const HDR_TOKEN = /\bhdr10\+?\b|hdr10plus|\bhdr\b|\bhlg\b/;

export function hdrFormatLabel(
  hdrGamma: string,
  ...formats: Array<string | null | undefined>
): string | null {
  const q = formats.filter(Boolean).join(" ").toLowerCase();
  const isDv = DV_TOKEN.test(q);
  const isHdr10Plus = /hdr10\s*\+|hdr10plus/.test(q);
  if (hdrGamma === "pq" || hdrGamma === "hlg") return isDv ? "DV" : isHdr10Plus ? "HDR10+" : "HDR";
  if (hdrGamma) return null;
  if (isDv) return "DV";
  if (isHdr10Plus) return "HDR10+";
  if (HDR_TOKEN.test(q)) return "HDR";
  return null;
}
