import http from "node:http";
import https from "node:https";

const PORT = parseInt(process.env.PORT ?? "3141", 10);
const TIMEOUT_MS = 30_000;

function corsHeaders(origin) {
  return {
    "access-control-allow-origin": origin ?? "*",
    "access-control-allow-methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
    "access-control-allow-headers": "authorization, content-type, x-harbor-auth, accept",
    "access-control-max-age": "86400",
  };
}

function proxyRequest(targetUrl, method, headers, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(targetUrl);
    const transport = parsed.protocol === "https:" ? https : http;

    const req = transport.request(
      targetUrl,
      {
        method,
        headers,
        timeout: TIMEOUT_MS,
        rejectUnauthorized: false,
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const resBody = Buffer.concat(chunks);
          const resHeaders = {};
          for (const [k, v] of Object.entries(res.headers)) {
            if (v) resHeaders[k] = v;
          }
          resolve({ status: res.statusCode ?? 502, headers: resHeaders, body: resBody });
        });
        res.on("error", reject);
      },
    );

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("upstream timeout"));
    });
    req.on("error", reject);

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  const cors = corsHeaders(origin);
  Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const urlPath = req.url ?? "/";

  if (!urlPath.startsWith("/proxy/")) {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, name: "harbor-proxy", version: "1.0.0" }));
    return;
  }

  const proxyPath = urlPath.slice("/proxy/".length);
  const slashIdx = proxyPath.indexOf("/");
  if (slashIdx === -1) {
    res.writeHead(400, { "content-type": "text/plain" });
    res.end("missing hostname in proxy path");
    return;
  }

  const hostname = proxyPath.slice(0, slashIdx);
  const remainingPath = proxyPath.slice(slashIdx);
  const targetUrl = `https://${hostname}${remainingPath}`;

  const proxyHeaders = {};
  for (const [k, v] of Object.entries(req.headers)) {
    const lower = k.toLowerCase();
    if (lower === "host" || lower === "origin" || lower === "referer") continue;
    if (lower === "x-harbor-auth") {
      proxyHeaders["authorization"] = v;
      continue;
    }
    proxyHeaders[lower] = v;
  }

  const bodyChunks = [];
  req.on("data", (chunk) => bodyChunks.push(chunk));
  req.on("end", async () => {
    const body = bodyChunks.length > 0 ? Buffer.concat(bodyChunks) : null;

    try {
      const result = await proxyRequest(targetUrl, req.method, proxyHeaders, body);

      const respHeaders = { ...result.headers };
      ["transfer-encoding", "content-encoding", "content-length"].forEach((h) => {
        delete respHeaders[h];
      });

      Object.entries(respHeaders).forEach(([k, v]) => {
        res.setHeader(k, v);
      });
      Object.entries(cors).forEach(([k, v]) => {
        res.setHeader(k, v);
      });

      res.writeHead(result.status);
      res.end(result.body);
    } catch (err) {
      console.error(`[proxy] ${targetUrl} → ${err.message}`);
      res.writeHead(502, { "content-type": "text/plain" });
      res.end(`proxy error: ${err.message}`);
    }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[harbor-proxy] listening on port ${PORT}`);
});
