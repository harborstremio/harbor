export type ExternalLinkProtocol = "http:" | "https:";

export type ExternalLinkDestination = {
  href: string;
  hostname: string;
  protocol: ExternalLinkProtocol;
  canOpenInHarbor: boolean;
};

export type ExternalLinkParseFailureReason =
  | "invalid-url"
  | "unsupported-protocol"
  | "embedded-credentials";

export type ExternalLinkParseResult =
  | { ok: true; link: ExternalLinkDestination }
  | { ok: false; reason: ExternalLinkParseFailureReason };

export function parseExternalLink(raw: string): ExternalLinkParseResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: "invalid-url" };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, reason: "invalid-url" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "unsupported-protocol" };
  }
  if (!url.hostname) return { ok: false, reason: "invalid-url" };
  if (url.username || url.password) {
    return { ok: false, reason: "embedded-credentials" };
  }

  return {
    ok: true,
    link: {
      href: url.href,
      hostname: url.hostname,
      protocol: url.protocol,
      canOpenInHarbor: url.protocol === "https:",
    },
  };
}
