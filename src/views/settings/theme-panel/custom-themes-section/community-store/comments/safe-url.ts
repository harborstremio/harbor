export const URL_RE = /\bhttps?:\/\/[^\s\]<>"']+/gi;

const SPAM_HOSTS = new Set([
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "goo.gl",
  "ow.ly",
  "buff.ly",
  "is.gd",
  "cutt.ly",
  "rebrand.ly",
  "shorturl.at",
  "rb.gy",
  "adf.ly",
  "grabify.link",
  "iplogger.org",
  "iplogger.com",
  "blasze.tk",
]);

function parseUrl(raw: string): URL | null {
  try {
    return new URL(raw.trim());
  } catch {
    return null;
  }
}

function isSpamHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^www\./, "");
  return SPAM_HOSTS.has(h);
}

export function safeLinkUrl(raw: string): string | null {
  const u = parseUrl(raw);
  if (!u) return null;
  const scheme = u.protocol.toLowerCase();
  if (scheme !== "http:" && scheme !== "https:") return null;
  if (isSpamHost(u.hostname)) return null;
  return u.toString();
}

export function safeImageUrl(raw: string): string | null {
  const u = parseUrl(raw);
  if (!u) return null;
  if (u.protocol.toLowerCase() !== "https:") return null;
  if (isSpamHost(u.hostname)) return null;
  return u.toString();
}
