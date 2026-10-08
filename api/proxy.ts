// Vercel Edge Function behind /api-proxy/<host>/<path> for the JL Media Vision web build.
// Mirrors src-tauri/relay/harbor-web.nginx: only the API hosts safe-fetch proxies, never video.
export const config = { runtime: "edge" };

const TARGET_PARAM = "__target";

const HOSTS = new Set([
  "v3-cinemeta.strem.io",
  "opensubtitles-v3.strem.io",
  "opensubtitles.strem.io",
  "opensubtitles.stremio.homes",
  "api.torbox.app",
  "api.real-debrid.com",
  "api.alldebrid.com",
  "debrid-link.com",
  "www.premiumize.me",
  "www.thesportsdb.com",
  "api.the-odds-api.com",
  "api.collegefootballdata.com",
  "prod.api.market",
]);

const SUFFIXES = [
  ".elfhosted.com",
  ".strem.fun",
  ".strem.io",
  ".stremio.homes",
  ".baby-beamup.club",
  ".workers.dev",
  ".debridio.com",
  ".code.run",
  ".fly.dev",
  ".onrender.com",
  ".vercel.app",
  ".netlify.app",
  ".railway.app",
  ".deno.dev",
];

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

function allowed(host: string): boolean {
  return /^[a-z0-9.-]+$/.test(host) && (HOSTS.has(host) || SUFFIXES.some((s) => host.endsWith(s)));
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  // vercel.json rewrites /api-proxy/<host>/<path> here as ?__target=<host>/<path>.
  const target = url.searchParams.get(TARGET_PARAM) ?? "";
  url.searchParams.delete(TARGET_PARAM);
  const match = /^([^/]+)(\/.*)?$/.exec(target);
  if (!match) return new Response("Not found", { status: 404 });
  const host = match[1].toLowerCase();
  if (!allowed(host)) return new Response("Forbidden", { status: 403 });

  const headers = new Headers({ "User-Agent": USER_AGENT, Accept: "application/json" });
  const auth = req.headers.get("x-harbor-auth");
  if (auth) headers.set("Authorization", auth);
  // AllSports API (api.market) takes the viewer's key in its own header.
  const marketKey = req.headers.get("x-api-market-key");
  if (marketKey && host === "prod.api.market") headers.set("x-api-market-key", marketKey);
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const query = url.searchParams.toString();
  const upstream = await fetch(`https://${host}${match[2] ?? "/"}${query ? `?${query}` : ""}`, {
    method: req.method,
    headers,
    body: hasBody ? await req.arrayBuffer() : undefined,
    redirect: "follow",
    signal: AbortSignal.timeout(60_000),
  });

  const out = new Headers(upstream.headers);
  out.delete("set-cookie");
  out.delete("www-authenticate");
  out.delete("content-encoding");
  out.delete("content-length");
  return new Response(upstream.body, { status: upstream.status, headers: out });
}
