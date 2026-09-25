/**
 * Mirrors the Rust SSRF guard in `src-tauri/src/http_fetch.rs` (`is_blocked_ip`):
 * "local network" is exactly the set of targets `harbor_fetch` refuses unless the
 * caller opts in with `allowLocalNetwork: true`.
 *
 * Kept in sync deliberately — if the two sides disagree, a URL the JS side thinks
 * is public gets rejected by the native guard with no way to opt out, which is how
 * self-hosted addons on loopback silently returned 0 streams.
 */
export function isLocalNetworkUrl(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  // `new URL("http://[::1]/").hostname` keeps the brackets.
  const bare = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
  if (bare === "localhost" || bare.endsWith(".localhost")) return true;

  const v4 = parseIpv4(bare);
  if (v4) return isLocalIpv4(v4);
  if (bare.includes(":")) return isLocalIpv6(bare);
  return false;
}

function parseIpv4(host: string): [number, number, number, number] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return null;
  const octets = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
  if (octets.some((o) => o > 255)) return null;
  return octets as [number, number, number, number];
}

function isLocalIpv4([a, b, c, d]: [number, number, number, number]): boolean {
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local
  if (a === 0 && b === 0 && c === 0 && d === 0) return true; // unspecified
  if (a === 255 && b === 255 && c === 255 && d === 255) return true; // broadcast
  return false;
}

function isLocalIpv6(host: string): boolean {
  const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(host);
  if (mapped) {
    const v4 = parseIpv4(mapped[1]);
    return v4 ? isLocalIpv4(v4) : false;
  }
  const groups = expandIpv6(host);
  if (!groups) return false;
  const [first] = groups;
  if (first >= 0xfe80 && first <= 0xfebf) return true; // fe80::/10 link-local
  if (groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff) {
    // ::ffff:a.b.c.d written in hex (::ffff:7f00:1)
    return isLocalIpv4([
      (groups[6] >> 8) & 0xff,
      groups[6] & 0xff,
      (groups[7] >> 8) & 0xff,
      groups[7] & 0xff,
    ]);
  }
  // `::` (unspecified) and `::1` (loopback): all-zero groups but the last.
  return groups.slice(0, 7).every((g) => g === 0) && groups[7] <= 1;
}

function expandIpv6(host: string): number[] | null {
  const raw = host.split("%")[0];
  const halves = raw.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 ? (halves[1] ? halves[1].split(":") : []) : [];
  if (halves.length === 1 && head.length !== 8) return null;
  const missing = 8 - head.length - tail.length;
  if (missing < 0) return null;
  const filled = halves.length === 2 ? Array.from({ length: missing }, () => "0") : [];
  const groups = [...head, ...filled, ...tail];
  if (groups.length !== 8) return null;
  const out: number[] = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/i.test(g)) return null;
    out.push(parseInt(g, 16));
  }
  return out;
}
