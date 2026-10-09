import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("stream proxy and prebuffer use the tested redirect policy", () => {
  const source = readFileSync(new URL("../src-tauri/src/stream_proxy.rs", import.meta.url), "utf8");
  assert.equal((source.match(/redirect\(reqwest::redirect::Policy::none\(\)\)/g) ?? []).length, 2);
  assert.match(source, /http_redirect::send_get\(&client, req, url\)/);
  assert.match(source, /http_redirect::send_get\(&state.client, req, &session.url\)/);
  assert.doesNotMatch(source, /req\.send\(\)/);
});

test("native plugin fetch strips unknown credential names at origin changes", () => {
  const source = readFileSync(new URL("../src-tauri/src/http_fetch.rs", import.meta.url), "utf8");
  assert.match(
    source,
    /if cross_origin \{\s*subtitle_credential = None;\s*headers.retain\(\|\(name, _\)\| crate::http_redirect::safe_cross_origin_header\(name\)\);/,
  );
});
