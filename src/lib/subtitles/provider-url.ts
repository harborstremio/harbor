/** Internal renderer-to-native policy marker. It must never be sent upstream. */
export const SUBTITLE_PUBLIC_NETWORK_HEADER = "X-Harbor-Public-Network-Only";

function ipv4Octets(host: string): number[] | null {
  const parts = host.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/u.test(part))) return null;
  const octets = parts.map(Number);
  return octets.every((octet) => octet >= 0 && octet <= 255) ? octets : null;
}

function isPublicIpv4(octets: readonly number[]): boolean {
  const [a, b, c] = octets;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0) return false;
  if (a === 192 && b === 88 && c === 99) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 192 && b === 0 && c === 2) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

function ipv6Segments(host: string): number[] | null {
  const value = host.replace(/^\[|\]$/gu, "").toLowerCase();
  if (!value.includes(":")) return null;
  const halves = value.split("::");
  if (halves.length > 2) return null;
  const parseHalf = (half: string): number[] | null => {
    if (!half) return [];
    const segments: number[] = [];
    for (const part of half.split(":")) {
      const ipv4 = ipv4Octets(part);
      if (ipv4) {
        segments.push((ipv4[0] << 8) | ipv4[1], (ipv4[2] << 8) | ipv4[3]);
        continue;
      }
      if (!/^[\da-f]{1,4}$/u.test(part)) return null;
      segments.push(Number.parseInt(part, 16));
    }
    return segments;
  };
  const left = parseHalf(halves[0]);
  const right = parseHalf(halves[1] ?? "");
  if (!left || !right) return null;
  const omitted = halves.length === 2 ? 8 - left.length - right.length : 0;
  if (omitted < 0 || (halves.length === 1 && left.length !== 8)) return null;
  const segments = [...left, ...Array.from({ length: omitted }, () => 0), ...right];
  return segments.length === 8 ? segments : null;
}

function isPublicIpv6(segments: readonly number[]): boolean {
  const mapped = segments.slice(0, 5).every((part) => part === 0) && segments[5] === 0xffff;
  if (mapped) {
    return isPublicIpv4([
      segments[6] >> 8,
      segments[6] & 0xff,
      segments[7] >> 8,
      segments[7] & 0xff,
    ]);
  }
  // Provider downloads have no reason to use non-global-unicast IPv6.
  if ((segments[0] & 0xe000) !== 0x2000) return false;
  if (segments[0] === 0x2002) return false;
  if (segments[0] === 0x2001 && segments[1] === 0x0db8) return false;
  if (segments[0] === 0x2001 && segments[1] < 0x0200) return false;
  return true;
}

export function isPublicNetworkHost(hostname: string): boolean {
  const host = hostname
    .replace(/^\[|\]$/gu, "")
    .replace(/\.$/u, "")
    .toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".lan") ||
    host.endsWith(".internal") ||
    host.endsWith(".home.arpa")
  ) {
    return false;
  }
  const ipv4 = ipv4Octets(host);
  if (ipv4) return isPublicIpv4(ipv4);
  const ipv6 = ipv6Segments(host);
  if (ipv6) return isPublicIpv6(ipv6);
  return Boolean(host);
}

/** Provider-derived subtitles may only cross the public HTTP(S) boundary. */
export function isSafeProviderSubtitleUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username &&
      !url.password &&
      isPublicNetworkHost(url.hostname)
    );
  } catch {
    return false;
  }
}
