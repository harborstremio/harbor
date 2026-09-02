import { invoke } from "@tauri-apps/api/core";

export type MediaServerResponse<T = unknown> = {
  status: number;
  headers: Record<string, string>;
  body: T;
};

export function normalizeServerOrigin(value: string): string {
  const trimmed = value.trim();
  const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`);
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw new Error("Media server must use HTTP or HTTPS");
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString().replace(/\/$/, "");
}

export function candidateServerOrigins(
  value: string,
  provider: "jellyfin" | "emby" | "plex",
): string[] {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return [];
  const explicitScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed);
  const seed = explicitScheme ? trimmed : `http://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(seed);
  } catch {
    return [];
  }
  const hasPort = parsed.port !== "";
  const defaultPort = provider === "plex" ? "32400" : provider === "emby" ? "8096" : "8096";
  const schemes = explicitScheme
    ? [parsed.protocol, parsed.protocol === "http:" ? "https:" : "http:"]
    : ["http:", "https:"];
  const out: string[] = [];
  for (const protocol of schemes) {
    const direct = new URL(parsed.toString());
    direct.protocol = protocol;
    out.push(normalizeServerOrigin(direct.toString()));
    if (!hasPort) {
      const withPort = new URL(direct.toString());
      withPort.port = defaultPort;
      out.push(normalizeServerOrigin(withPort.toString()));
    }
  }
  return [...new Set(out)];
}

export async function mediaServerRequest<T>(
  origin: string,
  path: string,
  init: {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
    timeoutMs?: number;
  } = {},
): Promise<MediaServerResponse<T>> {
  const normalized = normalizeServerOrigin(origin);
  // A server may be configured below a reverse-proxy prefix (for example
  // https://example.test/jellyfin). Treat adapter paths as relative to it.
  const url = new URL(path.replace(/^\/+/, ""), `${normalized}/`);
  if (url.origin !== new URL(normalized).origin)
    throw new Error("Media server request escaped its configured origin");
  const response = await invoke<{ status: number; headers: Record<string, string>; body: string }>(
    "media_server_request",
    {
      args: {
        origin: normalized,
        url: url.toString(),
        method: init.method,
        headers: init.headers,
        body: init.body == null ? undefined : JSON.stringify(init.body),
        timeoutMs: init.timeoutMs,
      },
    },
  );
  let body: unknown = response.body;
  try {
    body = response.body ? JSON.parse(response.body) : null;
  } catch {
    /* non-JSON response */
  }
  if (response.status < 200 || response.status >= 300)
    throw new Error(`Media server request failed (${response.status})`);
  return { ...response, body: body as T };
}
