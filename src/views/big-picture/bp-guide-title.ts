export type BpChannelLabel = { name: string; badge: string | null };

const COUNTRY_RE = /^([A-Za-z]{2,5})\s*[|:\-]\s*/;
const LEAD_DECOR_RE = /^[\s#*_~=.\-|>]+/;
const TRAIL_DECOR_RE = /[\s#*_~=.\-|<]+$/;
const LEAD_STRAY_RE = /^[\s#*_~=.\-|>:,]+/;
const TRAIL_STRAY_RE = /[\s#*_~=.\-|<:,]+$/;
const NOISE_RE = /\b(?:RAW|60FPS|HEVC|H264|H265|VIP|BACKUP|\d{3,4}P)\b/gi;
const SPACE_RE = /\s+/g;
const NON_ALNUM_RE = /[^\p{L}\p{N}]+/gu;

// Highest quality first, so ESPN 4K HD badges 4K and never SD.
const QUALITY: ReadonlyArray<readonly [string, RegExp]> = [
  ["4K", /\b4K\b/gi],
  ["UHD", /\bUHD\b/gi],
  ["FHD", /\bFHD\b/gi],
  ["HD", /\bHD\b/gi],
  ["SD", /\bSD\b/gi],
];

// Caps are left alone deliberately. Every title-casing rule that tidies
// 24/7 ACTION/ADVENTURE also wrecks ESPN and BBC NEWS, and these playlists are
// mostly acronyms. The noise was the ## and the RAW 60fps, never the caps.
// Do not swap this for extractTitleFromChannelName: that one is a hydration
// query builder and returns null for anything containing NEWS or SPORT.
export function bpChannelLabel(raw: string): BpChannelLabel {
  const source = raw ?? "";
  let out = source.replace(COUNTRY_RE, "").replace(LEAD_DECOR_RE, "").replace(TRAIL_DECOR_RE, "");

  let badge: string | null = null;
  for (const [token, re] of QUALITY) {
    const stripped = out.replace(re, " ");
    if (stripped === out) continue;
    badge = token;
    out = stripped;
    break;
  }

  out = out
    .replace(NOISE_RE, " ")
    .replace(SPACE_RE, " ")
    .replace(LEAD_STRAY_RE, "")
    .replace(TRAIL_STRAY_RE, "")
    .trim();

  return { name: out === "" ? source.trim() : out, badge };
}

export function bpSameText(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = (a ?? "").toLowerCase().replace(NON_ALNUM_RE, "");
  if (na === "") return false;
  const nb = (b ?? "").toLowerCase().replace(NON_ALNUM_RE, "");
  if (nb === "") return false;
  return na === nb;
}

export function bpGroupLabel(group: string | null | undefined, name: string): string | null {
  if (!group) return null;
  const cleaned = bpChannelLabel(group).name;
  if (cleaned === "" || bpSameText(cleaned, name)) return null;
  return cleaned;
}
