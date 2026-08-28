import assert from "node:assert/strict";
import test from "node:test";
import { isP2pStream } from "../src/lib/streams/cached.ts";

test("a raw torrent remains P2P when an addon also supplies a fallback URL", () => {
  assert.equal(
    isP2pStream({
      infoHash: "0123456789abcdef0123456789abcdef01234567",
      url: "https://addon.example/resolve",
      cached: {},
      name: "Torrentio",
    }),
    true,
  );
});

test("debrid-tagged and cache-confirmed torrent results remain debrid transports", () => {
  const infoHash = "0123456789abcdef0123456789abcdef01234567";

  assert.equal(
    isP2pStream({
      infoHash,
      url: "https://addon.example/resolve",
      cached: {},
      name: "[TB+] Torrentio",
    }),
    false,
  );
  assert.equal(
    isP2pStream({
      infoHash,
      url: "https://addon.example/resolve",
      cached: { tb: true },
      name: "Torrentio",
    }),
    false,
  );
});

test("a direct-only addon result is never classified as P2P", () => {
  assert.equal(
    isP2pStream({ url: "https://addon.example/video.mkv", cached: {}, name: "Direct" }),
    false,
  );
});
