import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("stream proxy and prebuffer use the tested redirect policy", () => {
  const source = readFileSync(new URL("../src-tauri/src/stream_proxy.rs", import.meta.url), "utf8");
  // Native loopback tests create their own clients; only production wiring matters here.
  const production = source.split(/#\[cfg\(test\)\]\s*mod tests\s*\{/)[0];
  assert.equal((production.match(/redirect\(reqwest::redirect::Policy::none\(\)\)/g) ?? []).length, 2);
  assert.match(production, /http_redirect::send_get\(&client, req, url\)/);
  assert.match(production, /stream_headers\(&state\.client, req, &session\.url, STREAM_HEADER_TIMEOUT\)/);
  assert.match(
    production,
    /tokio::time::timeout\(deadline, crate::http_redirect::send_get\(client, request, origin\)\)/,
    "the header deadline must preserve the tested redirect policy",
  );
  assert.doesNotMatch(production, /(?:req|request)\.send\(\)/);
});

test("native plugin fetch strips unknown credential names at origin changes", () => {
  const source = readFileSync(new URL("../src-tauri/src/http_fetch.rs", import.meta.url), "utf8");
  assert.match(
    source,
    /if cross_origin \{\s*subtitle_credential = None;\s*headers.retain\(\|\(name, _\)\| crate::http_redirect::safe_cross_origin_header\(name\)\);/,
  );
});
