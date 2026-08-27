import assert from "node:assert/strict";
import test from "node:test";
import { parseExternalLink } from "../src/lib/social/external-link-policy.ts";

test("normalizes HTTP(S) destinations and limits Harbor to HTTPS", () => {
  assert.deepEqual(parseExternalLink("  https://Example.COM/path?q=1  "), {
    ok: true,
    link: {
      href: "https://example.com/path?q=1",
      hostname: "example.com",
      protocol: "https:",
      canOpenInHarbor: true,
    },
  });

  const http = parseExternalLink("http://example.com/path");
  assert.equal(http.ok, true);
  if (http.ok) assert.equal(http.link.canOpenInHarbor, false);
});

test("rejects malformed, relative, privileged, and credential-bearing values", () => {
  for (const value of [
    "",
    "not a url",
    "/relative",
    "//example.com/path",
    "javascript:alert(1)",
    "data:text/html,hello",
    "file:///tmp/a",
    "blob:https://example.com/id",
    "asset://localhost/file",
    "tauri://localhost",
    "stremio://example.com/manifest.json",
    "mailto:test@example.com",
    "tel:+15555550100",
  ]) {
    assert.equal(parseExternalLink(value).ok, false, value);
  }
  assert.deepEqual(parseExternalLink("https://trusted.example@evil.example/path"), {
    ok: false,
    reason: "embedded-credentials",
  });
});

test("normalizes IDN and IPv6 hosts without inventing display identities", () => {
  const idn = parseExternalLink("https://bücher.example/");
  assert.equal(idn.ok, true);
  if (idn.ok) assert.equal(idn.link.hostname, "xn--bcher-kva.example");

  const ipv6 = parseExternalLink("https://[2001:db8::1]/");
  assert.equal(ipv6.ok, true);
  if (ipv6.ok) assert.equal(ipv6.link.hostname, "[2001:db8::1]");
});
