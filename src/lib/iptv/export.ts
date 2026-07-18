import type { IptvChannel } from "./types";

const PASSTHROUGH_ATTRS = new Set([
  "tvg-id",
  "tvg-name",
  "tvg-logo",
  "tvg-chno",
  "tvg-shift",
  "tvg-language",
  "tvg-country",
  "group-title",
  "catchup",
  "catchup-source",
  "catchup-days",
  "duration",
]);

export function buildM3u(channels: IptvChannel[], epgUrl?: string | null): string {
  const head = epgUrl ? `#EXTM3U url-tvg="${escapeAttr(epgUrl)}"` : "#EXTM3U";
  const lines: string[] = [head];
  for (const ch of channels) {
    const attrs: Array<[string, string]> = [];
    if (ch.tvgId) attrs.push(["tvg-id", ch.tvgId]);
    if (ch.logo) attrs.push(["tvg-logo", ch.logo]);
    if (ch.group) attrs.push(["group-title", ch.group]);
    if (ch.catchupSource) {
      const baked = !ch.attrs["catchup"] || ch.attrs["catchup"] === "default";
      if (baked) attrs.push(["catchup", ch.attrs["catchup"] || "default"]);
      attrs.push(["catchup-source", ch.catchupSource]);
    }
    for (const [k, v] of Object.entries(ch.attrs)) {
      if (!PASSTHROUGH_ATTRS.has(k.toLowerCase())) continue;
      if (attrs.some(([key]) => key.toLowerCase() === k.toLowerCase())) continue;
      attrs.push([k, v]);
    }
    const attrStr = attrs.length
      ? " " + attrs.map(([k, v]) => `${k}="${escapeAttr(v)}"`).join(" ")
      : "";
    const duration = typeof ch.durationSec === "number" && ch.durationSec > 0 ? ch.durationSec : -1;
    lines.push(`#EXTINF:${duration}${attrStr},${ch.name}`);
    lines.push(ch.url);
  }
  return lines.join("\n") + "\n";
}

function escapeAttr(value: string): string {
  return value.replace(/"/g, '\\"');
}

export function suggestExportFilename(playlistName: string): string {
  const safe =
    playlistName
      .trim()
      .replace(/[^a-z0-9-]+/gi, "-")
      .replace(/^-+|-+$/g, "") || "playlist";
  const stamp = new Date().toISOString().slice(0, 10);
  return `${safe}-${stamp}.m3u`;
}

export type XtreamCreds = {
  host: string;
  port?: string;
  username: string | null;
  password: string | null;
  type: string | null;
  output: string | null;
  fullUrl: string;
};

export function parseXtreamCreds(url: string): XtreamCreds | null {
  try {
    const u = new URL(url);
    const params = u.searchParams;
    const username = params.get("username");
    const password = params.get("password");
    const type = params.get("type");
    const output = params.get("output");
    if (!username && !password && !u.pathname.includes("get.php") && !u.pathname.includes("/live/"))
      return null;
    return {
      host: `${u.protocol}//${u.hostname}`,
      port: u.port || undefined,
      username,
      password,
      type,
      output,
      fullUrl: url,
    };
  } catch {
    return null;
  }
}
