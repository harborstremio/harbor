// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  bindSubtitleDownloadAuth,
  clearSubtitleDownloadCredentials,
  subtitleCredentialRequest,
  subtitleDownloadHeaders,
} from "../src/lib/subtitles/provider-auth.ts";

test("subtitle download credentials stay bound to the search result that created them", async () => {
  await clearSubtitleDownloadCredentials();
  const first = await bindSubtitleDownloadAuth("subsource-api-key", " first-key ");
  const second = await bindSubtitleDownloadAuth("subsource-api-key", "second-key");

  assert.ok(first);
  assert.ok(second);
  assert.notEqual(first.credentialId, second.credentialId);
  assert.deepEqual(subtitleDownloadHeaders(first, "https://api.subsource.net/api/v1/download"), {
    "X-API-Key": "first-key",
  });
  assert.deepEqual(subtitleDownloadHeaders(second, "https://api.subsource.net/api/v1/download"), {
    "X-API-Key": "second-key",
  });
});

test("subtitle download credentials are opaque, optional, and revocable", async () => {
  await clearSubtitleDownloadCredentials();
  assert.equal(await bindSubtitleDownloadAuth("subsource-api-key", "  "), undefined);
  assert.equal(subtitleDownloadHeaders(undefined, "https://api.subsource.net/download"), undefined);

  const auth = await bindSubtitleDownloadAuth("subsource-api-key", "secret-key");
  assert.ok(auth);
  assert.deepEqual(Object.keys(auth).sort(), ["credentialId", "kind"]);
  assert.equal(JSON.stringify(auth).includes("secret-key"), false);

  await clearSubtitleDownloadCredentials();
  assert.equal(subtitleDownloadHeaders(auth, "https://api.subsource.net/download"), undefined);
});

test("provider credentials are applied only to their exact documented origins", async () => {
  await clearSubtitleDownloadCredentials();
  const subsource = await bindSubtitleDownloadAuth("subsource-api-key", "source-secret");
  const subdl = await bindSubtitleDownloadAuth("subdl-api-key", "dl-secret");

  assert.ok(subsource);
  assert.ok(subdl);
  assert.deepEqual(
    subtitleCredentialRequest("https://api.subsource.net/api/v1/subtitles", subsource),
    {
      url: "https://api.subsource.net/api/v1/subtitles",
      headers: { "X-API-Key": "source-secret" },
    },
  );
  const subdlRequest = subtitleCredentialRequest(
    "https://api.subdl.com/api/v1/subtitles?imdb_id=tt1",
    subdl,
  );
  assert.ok(subdlRequest);
  assert.equal(new URL(subdlRequest.url).searchParams.get("api_key"), "dl-secret");
  assert.equal(subdlRequest.headers, undefined);

  for (const denied of [
    "http://api.subsource.net/api/v1/subtitles",
    "https://api.subsource.net.evil.test/api/v1/subtitles",
    "https://api.subsource.net:444/api/v1/subtitles",
    "https://api.subdl.com.evil.test/api/v1/subtitles",
  ]) {
    assert.equal(
      subtitleCredentialRequest(denied, denied.includes("subdl") ? subdl : subsource),
      undefined,
    );
  }
  assert.equal(
    subtitleCredentialRequest("https://api.subdl.com/api/v1/subtitles?api_key=visible", subdl),
    undefined,
  );
});
