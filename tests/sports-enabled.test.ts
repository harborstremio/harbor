import assert from "node:assert/strict";
import test from "node:test";
import { hasSportsSource } from "../src/lib/sports/enabled.ts";
import type { StoredPlaylist } from "../src/lib/iptv/playlists-store.ts";

const source: StoredPlaylist = {
  id: "test",
  name: "Test source",
  kind: "m3u",
  url: "https://example.com/authorized.m3u",
};

test("sports stays disabled without a configured playback source", () => {
  assert.equal(hasSportsSource([]), false);
  assert.equal(hasSportsSource([{ ...source, url: "   " }]), false);
  assert.equal(hasSportsSource([{ ...source, kind: "epg" }]), false);
  assert.equal(
    hasSportsSource([
      {
        ...source,
        kind: "xtream",
        url: "",
        xtream: { server: "https://example.com", username: "viewer", password: "" },
      },
    ]),
    false,
  );
});

test("existing M3U and fully configured Xtream accounts unlock sports", () => {
  assert.equal(hasSportsSource([source]), true);
  assert.equal(hasSportsSource([{ ...source, kind: undefined }]), true);
  assert.equal(
    hasSportsSource([
      {
        ...source,
        kind: "xtream",
        url: "",
        xtream: { server: "https://example.com", username: "viewer", password: "test-only" },
      },
    ]),
    true,
  );
  assert.equal(hasSportsSource([{ ...source, kind: "epg" }, source]), true);
});
