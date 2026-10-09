import { validSourceHttpHost } from './source-host';

export const MAGNET_MAX_BYTES = 64 * 1024;
export const MAGNET_MAX_TRACKERS = 512;
const encoder = new TextEncoder();
const trackerValidity = new Map<string, boolean>();
const canonicalPrefix = "magnet:?xt=urn%3Abtih%3A";
const canonicalHashEnd = canonicalPrefix.length + 40;
const trackerTails = new Map<string, number>();
let trackerTailBytes = 0;

function rememberTrackerTail(value: string) {
  const tail = value.slice(canonicalHashEnd);
  if (!tail || trackerTails.has(tail)) return;
  while (trackerTails.size >= 256 || trackerTailBytes + tail.length > 1024 * 1024) {
    const first = trackerTails.keys().next().value!;
    trackerTailBytes -= trackerTails.get(first)!; trackerTails.delete(first);
  }
  trackerTails.set(tail, tail.length); trackerTailBytes += tail.length;
}

function validTracker(value: string) {
  const cached = trackerValidity.get(value);
  if (cached !== undefined) return cached;
  let valid = false;
  if (encoder.encode(value).byteLength <= 2048) {
    try { const url = new URL(value); valid = ["http:", "https:", "udp:"].includes(url.protocol) && !!url.hostname && !url.username && !url.password && (url.protocol === 'udp:' || validSourceHttpHost(url.hostname)); } catch { /* Invalid hints cannot reach the native engine. */ }
  }
  if (trackerValidity.size >= 2048) trackerValidity.delete(trackerValidity.keys().next().value!);
  trackerValidity.set(value, valid);
  return valid;
}

function hashHex(value: string): string | undefined {
  if (/^[a-f\d]{40}$/i.test(value)) return value.toLowerCase();
  if (!/^[a-z2-7]{32}$/i.test(value)) return;
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, count = 0, result = "";
  for (const character of value.toUpperCase()) {
    bits = (bits << 5) | alphabet.indexOf(character); count += 5;
    if (count >= 8) { count -= 8; result += ((bits >>> count) & 255).toString(16).padStart(2, "0"); }
  }
  return result;
}

/** Only torrent identity and validated tracker hints cross into the native review. */
export function normalizeMagnet(value: string): string | undefined {
  if (value.length > MAGNET_MAX_BYTES) return;
  // Stored catalogs repeat the same canonical tracker list across many identities.
  // Only reuse exact ASCII output already fully validated below; still check each hash.
  if (value.startsWith(canonicalPrefix) && /^[a-f\d]{40}$/.test(value.slice(canonicalPrefix.length, canonicalHashEnd))) {
    const tail = value.slice(canonicalHashEnd);
    if (!tail || trackerTails.has(tail)) return value;
  }
  if (encoder.encode(value).byteLength > MAGNET_MAX_BYTES) return;
  try {
    const input = new URL(value);
    if (input.protocol !== "magnet:" || input.host || input.username || input.password) return;
    let hash: string | undefined;
    const trackers = new Set<string>();
    for (const [key, value] of input.searchParams) {
      if (key === "xt") {
        // Hybrid links may advertise a v2 topic; this engine resolves the v1 identity.
        if (/^urn:btmh:1220[a-f\d]{64}$/i.test(value)) continue;
        if (!/^urn:btih:/i.test(value)) return;
        const next = hashHex(value.slice(9));
        if (!next || hash && hash !== next) return;
        hash = next;
      } else if (key === "tr" || /^tr\.\d+$/.test(key)) {
        // Optional broken hints must not hide a valid release or corrupt a saved catalog.
        if (!validTracker(value)) continue;
        trackers.add(value);
        if (trackers.size > MAGNET_MAX_TRACKERS) return;
      }
    }
    if (!hash) return;
    const result = new URLSearchParams(); result.append("xt", `urn:btih:${hash}`);
    for (const tracker of trackers) result.append("tr", tracker);
    const normalized = `magnet:?${result}`;
    if (encoder.encode(normalized).byteLength > MAGNET_MAX_BYTES) return;
    rememberTrackerTail(normalized);
    return normalized;
  } catch { return; }
}
