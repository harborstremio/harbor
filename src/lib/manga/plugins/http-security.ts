function isPrivateV4(host: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return false;
  const first = Number(match[1]);
  const second = Number(match[2]);
  if (first === 0 || first === 10 || first === 127) return true;
  if (first === 100 && second >= 64 && second <= 127) return true;
  if (first === 169 && second === 254) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  return first === 192 && second === 168;
}

function embeddedV4(host: string): string | null {
  const dotted = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(host);
  if (dotted && /(::ffff:|64:ff9b:)/i.test(host)) return dotted[1];
  const hex = /::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(host);
  if (!hex) return null;
  const high = Number.parseInt(hex[1], 16);
  const low = Number.parseInt(hex[2], 16);
  return `${(high >> 8) & 255}.${high & 255}.${(low >> 8) & 255}.${low & 255}`;
}

function isPrivateHost(host: string): boolean {
  const normalized = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized === "localhost" || normalized.endsWith(".localhost")) return true;
  if (normalized === "::1" || normalized === "0.0.0.0" || normalized === "::") return true;
  if (normalized.endsWith(".local") || normalized.endsWith(".internal")) return true;
  if (
    normalized.startsWith("fe80:") ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("64:ff9b:")
  ) {
    return true;
  }
  if (isPrivateV4(normalized)) return true;
  const v4 = embeddedV4(normalized);
  return v4 != null && isPrivateV4(v4);
}

export function assertNetworkSafeUrl(raw: string): string {
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`scheme not allowed: ${url.protocol}`);
  }
  if (isPrivateHost(url.hostname)) throw new Error(`blocked private host: ${url.hostname}`);
  return url.href;
}

export function resolveNetworkSafeRedirect(currentUrl: string, location: string): string {
  return assertNetworkSafeUrl(new URL(location, currentUrl).href);
}
