import assert from "node:assert/strict";
import test from "node:test";
import { sameSiteHost } from "../src/lib/same-site-host.ts";

test("site grouping uses registrable domains including private suffixes", () => {
  for (const [a, b] of [
    ["cdn.example.com", "example.com"],
    ["cdn.example.co.uk", "www.example.co.uk"],
    ["WWW.Example.COM.", "example.com"],
    ["cdn.alpha.github.io", "alpha.github.io"],
  ])
    assert.equal(sameSiteHost(a, b), true, `${a} / ${b}`);
  for (const [a, b] of [
    ["alpha.co.uk", "beta.co.uk"],
    ["alpha.github.io", "beta.github.io"],
    ["alpha.pages.dev", "beta.pages.dev"],
    ["alpha.s3.amazonaws.com", "beta.s3.amazonaws.com"],
    ["1.2.3.4", "9.2.3.4"],
    ["alpha.unknownsuffix", "beta.unknownsuffix"],
    ["example.com", "example.com.evil.org"],
  ])
    assert.equal(sameSiteHost(a, b), false, `${a} / ${b}`);
  assert.equal(sameSiteHost(null, "example.com"), false);
  assert.equal(sameSiteHost("", ""), false);
});
