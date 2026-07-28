const HEX40 = /^[a-fA-F0-9]{40}$/;
const BASE32_32 = /^[a-zA-Z2-7]{32}$/;

export type ParsedMagnet = {
  infoHash: string;
  name: string | null;
  trackers: string[];
};

export function isMagnetInput(value: string): boolean {
  const v = value.trim();
  if (v.toLowerCase().startsWith("magnet:")) return true;
  return HEX40.test(v) || BASE32_32.test(v);
}



export function isDirectVideoUrl(value: string): boolean {
  const v = value.trim();
  if (!/^https?:\/\//i.test(v)) return false;
  try {
    new URL(v);
    return true;
  } catch {
    return false;
  }
}

const WEB_READY_EXT = /\.(mp4|m4v|webm)(\?|#|$)/i;
const NOT_WEB_READY_EXT = /\.(mkv|avi|ts|m3u8|mpd|flv|wmv|mpg|mpeg|m2ts)(\?|#|$)/i;

export function directUrlNotWebReady(value: string): boolean {
  try {
    const path = new URL(value.trim()).pathname;
    if (NOT_WEB_READY_EXT.test(path)) return true;
    if (WEB_READY_EXT.test(path)) return false;
    return false;
  } catch {
    return false;
  }
}

export function parseMagnet(value: string): ParsedMagnet | null {
  const v = value.trim();
  if (HEX40.test(v)) return { infoHash: v.toLowerCase(), name: null, trackers: [] };
  if (BASE32_32.test(v)) {
    const hex = base32ToHex(v);
    return hex ? { infoHash: hex, name: null, trackers: [] } : null;
  }
  if (!v.toLowerCase().startsWith("magnet:")) return null;

  let params: URLSearchParams;
  try {
    params = new URL(v).searchParams;
  } catch {
    params = new URLSearchParams(v.slice(v.indexOf("?") + 1));
  }

  let infoHash: string | null = null;
  for (const xt of params.getAll("xt")) {
    const m = xt.match(/urn:btih:([a-zA-Z0-9]+)/i);
    if (!m) continue;
    const raw = m[1];
    if (HEX40.test(raw)) {
      infoHash = raw.toLowerCase();
      break;
    }
    if (BASE32_32.test(raw)) {
      const hex = base32ToHex(raw);
      if (hex) {
        infoHash = hex;
        break;
      }
    }
  }
  if (!infoHash) return null;

  const name = params.get("dn");
  return {
    infoHash,
    name: name ? decodeURIComponent(name.replace(/\+/g, " ")) : null,
    trackers: params.getAll("tr").filter(Boolean),
  };
}

export function infoHashFromUrl(url: string): { infoHash: string; fileIdx?: number } | null {
  const m = url.match(/(?:^|[/=])([a-fA-F0-9]{40})(?:\/(\d+))?(?=[/?#]|$)/);
  if (!m) return null;
  const fileIdx = m[2] != null ? Number(m[2]) : undefined;
  return {
    infoHash: m[1].toLowerCase(),
    fileIdx: fileIdx != null && Number.isFinite(fileIdx) ? fileIdx : undefined,
  };
}

export function infoHashFromSources(sources?: string[]): string | null {
  if (!sources) return null;
  for (const s of sources) {
    const m = s.match(/^dht:([a-fA-F0-9]{40})$/i);
    if (m) return m[1].toLowerCase();
  }
  return null;
}

function base32ToHex(input: string): string | null {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = input.toUpperCase().replace(/=+$/, "");
  let bits = "";
  for (const ch of clean) {
    const idx = alphabet.indexOf(ch);
    if (idx === -1) return null;
    bits += idx.toString(2).padStart(5, "0");
  }
  let hex = "";
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    hex += parseInt(bits.slice(i, i + 8), 2).toString(16).padStart(2, "0");
  }
  return hex.length === 40 ? hex : null;
}
