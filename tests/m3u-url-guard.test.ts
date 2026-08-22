import assert from "node:assert/strict";
import test from "node:test";
import { isPlayableChannelUrl, parseM3u } from "../src/lib/iptv/m3u.ts";

test("rejects playlist URLs that native players would read as options", () => {
  assert.equal(isPlayableChannelUrl("--script=/tmp/evil.lua"), false);
  assert.equal(isPlayableChannelUrl("-vf=lavfi"), false);
  assert.equal(isPlayableChannelUrl("  --log-file=/tmp/x  "), false);
  assert.equal(isPlayableChannelUrl("http://host/a\r\nrun"), false);
  assert.equal(isPlayableChannelUrl(""), false);
});

test("keeps the URL shapes real playlists use", () => {
  assert.equal(isPlayableChannelUrl("http://host:8080/live/id.m3u8"), true);
  assert.equal(isPlayableChannelUrl("https://host/stream?token=a-b-c"), true);
  assert.equal(isPlayableChannelUrl("rtmp://host/app/stream"), true);
  assert.equal(isPlayableChannelUrl("udp://@239.0.0.1:1234"), true);
  assert.equal(isPlayableChannelUrl("/Volumes/media/channel.ts"), true);
});

test("drops option-shaped entries while parsing, keeping the rest", () => {
  const playlist = [
    "#EXTM3U",
    '#EXTINF:-1 tvg-id="good" group-title="News",Good Channel',
    "http://host/good.m3u8",
    '#EXTINF:-1 tvg-id="evil" group-title="News",Evil Channel',
    "--log-file=/Users/someone/.zshrc",
    '#EXTINF:-1 tvg-id="also-good",Another Channel',
    "http://host/another.m3u8",
  ].join("\n");

  const channels = parseM3u(playlist, "src");

  assert.deepEqual(
    channels.map((c) => c.url),
    ["http://host/good.m3u8", "http://host/another.m3u8"],
  );
  assert.equal(
    channels.some((c) => c.name === "Evil Channel"),
    false,
  );
});
