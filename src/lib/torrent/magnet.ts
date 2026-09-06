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

const VIDEO_URL_EXT = /\.(mp4|m4v|mkv|webm|mov|avi|ts|m3u8|mpd|flv|wmv|mpg|mpeg|m2ts)(\?|#|$)/i;

export function isDirectVideoUrl(value: string): boolean {
  const v = value.trim();
  if (!/^https?:\/\//i.test(v)) return false;
  let url: URL;
  try {
    url = new URL(v);
  } catch {
    return false;
  }
  return VIDEO_URL_EXT.test(url.pathname);
}

const WEB_READY_EXT = /\.(mp4|m4v|webm)(\?|#|$)/i;

export function directUrlNotWebReady(value: string): boolean {
  try {
    return !WEB_READY_EXT.test(new URL(value.trim()).pathname);
  } catch {
    return true;
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

export function serializeMagnet(magnet: ParsedMagnet): string {
  const params = new URLSearchParams();

  params.append('xt', `urn:btih:${magnet.infoHash}`);

  if (magnet.name) {
    params.append('dn', magnet.name);
  }

  for (const tracker of magnet.trackers) {
    params.append('tr', tracker);
  }

  return `magnet:?${params.toString()}`;
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
