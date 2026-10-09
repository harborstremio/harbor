import test from "node:test";
import assert from "node:assert/strict";
import {
  esportsChatPopoutUrl,
  esportsEmbedUrl,
  esportsExternalUrl,
  esportsPlayback,
  officialBroadcastSource,
} from "../src/lib/sports/esports-streams.ts";

// Harbor's packaged origin. `useHttpsScheme` is absent from src-tauri/tauri.conf.json, so the
// default http applies and this is the host every real build embeds from. "localhost" and
// "127.0.0.1" are the only two hosts Twitch special-cases with http plus wildcard ports, so a
// suite that only passes those two cannot see what a packaged build sees.
const PACKAGED_HOST = "tauri.localhost";

test("Kick chat popout stays tied to the selected validated channel", () => {
  const stream = { title: "Fiesta", url: "https://kick.com/fiesta_cs", platform: "kick" as const };
  assert.equal(esportsChatPopoutUrl(stream), "https://kick.com/popout/fiesta_cs/chat");
  assert.equal(
    esportsChatPopoutUrl({ ...stream, url: "https://kick.com.evil.test/fiesta_cs" }),
    null,
  );
  assert.equal(esportsChatPopoutUrl({ ...stream, url: "https://kick.com/fiesta_cs/other" }), null);
});

test("match-listed Kick channels embed without redirecting to a generic Twitch channel", () => {
  const stream = {
    title: "fiesta_cs",
    url: "https://kick.com/fiesta_cs",
    platform: "kick" as const,
  };
  assert.equal(
    esportsEmbedUrl(stream, "localhost"),
    "https://player.kick.com/fiesta_cs?autoplay=false",
  );
  assert.equal(officialBroadcastSource(stream)?.isLive, true);
  assert.equal(
    esportsEmbedUrl({ ...stream, url: "https://kick.com.evil.test/fiesta_cs" }, "localhost"),
    null,
  );
});

test("official broadcasts enter the persistent live dock with provider identity", () => {
  const stream = { title: "ESL", url: "https://www.twitch.tv/eslcs", platform: "twitch" as const };
  const source = officialBroadcastSource(stream)!;
  assert.equal(source.sportsDocked, true);
  assert.equal(source.isLive, true);
  assert.ok(source.meta.id.startsWith("iptv:"));
  assert.deepEqual(source.officialBroadcast, stream);
  assert.equal(officialBroadcastSource({ ...stream, url: "javascript:alert(1)" }), null);
});

test("official Twitch embeds use current host and never autoplay", () => {
  const value = new URL(
    esportsEmbedUrl(
      { title: "Riot", url: "https://www.twitch.tv/riotgames", platform: "twitch" },
      "127.0.0.1",
    )!,
  );
  assert.equal(value.hostname, "player.twitch.tv");
  assert.equal(value.searchParams.get("parent"), "127.0.0.1");
  assert.equal(value.searchParams.get("channel"), "riotgames");
  assert.equal(value.searchParams.get("autoplay"), "false");
});
test("YouTube videos embed, channel directories remain direct links", () => {
  const url = esportsEmbedUrl(
    { title: "Video", url: "https://www.youtube.com/watch?v=abcdefghijk", platform: "youtube" },
    "localhost",
  );
  assert(url?.startsWith("https://www.youtube-nocookie.com/embed/abcdefghijk"));
  assert.equal(
    esportsEmbedUrl(
      { title: "Channel", url: "https://www.youtube.com/@valorantesports", platform: "youtube" },
      "localhost",
    ),
    null,
  );
  assert.equal(
    esportsEmbedUrl(
      { title: "VOD", url: "https://www.twitch.tv/videos/123", platform: "twitch" },
      "localhost",
    ),
    null,
  );
});
test("Twitch never plays in an iframe, at the packaged origin or anywhere else", () => {
  // MEASURED 2026-09-30 against live endpoints, with parent=tauri.localhost:
  //   player.twitch.tv                      -> frame-ancestors https://tauri.localhost
  //   www.twitch.tv/embed/<channel>/chat    -> frame-ancestors https://tauri.localhost
  // Harbor loads from http://tauri.localhost, so both are refused in every packaged build.
  // One behaviour on every host on purpose: a dev-only iframe path is what hid this bug.
  const stream = { title: "ESL", url: "https://www.twitch.tv/eslcs", platform: "twitch" as const };
  for (const host of [PACKAGED_HOST, "localhost", "127.0.0.1"]) {
    const playback = esportsPlayback(stream, host);
    assert.equal(playback?.mode, "window", `Twitch must open top-level on ${host}`);
    assert.equal(playback?.url, "https://www.twitch.tv/eslcs");
  }
  // Twitch chat rides along on the channel page, so it is not a second popout window.
  assert.equal(esportsChatPopoutUrl(stream), null);
});

test("Kick and YouTube still embed inline at the packaged origin", () => {
  // MEASURED 2026-09-30: player.kick.com sends neither frame-ancestors nor X-Frame-Options,
  // and youtube-nocookie sends a CSP with no frame-ancestors directive.
  assert.deepEqual(
    esportsPlayback(
      { title: "fiesta_cs", url: "https://kick.com/fiesta_cs", platform: "kick" },
      PACKAGED_HOST,
    ),
    { mode: "iframe", url: "https://player.kick.com/fiesta_cs?autoplay=false" },
  );
  const youtube = esportsPlayback(
    { title: "Video", url: "https://www.youtube.com/watch?v=abcdefghijk", platform: "youtube" },
    PACKAGED_HOST,
  );
  assert.equal(youtube?.mode, "iframe");
  assert.ok(youtube?.url.startsWith("https://www.youtube-nocookie.com/embed/abcdefghijk"));
});

test("the playback gate keeps the whole embed allowlist at the packaged origin", () => {
  for (const url of [
    "javascript:alert(1)",
    "https://twitch.tv.evil.test/riotgames",
    "http://twitch.tv/riotgames",
    "https://www.twitch.tv/riotgames/other",
    "https://www.twitch.tv/videos/123",
    "https://www.twitch.tv/directory",
  ])
    assert.equal(esportsPlayback({ title: "Unsafe", url, platform: "twitch" }, PACKAGED_HOST), null);
  assert.equal(
    esportsPlayback(
      { title: "Channel", url: "https://www.youtube.com/@valorantesports", platform: "youtube" },
      PACKAGED_HOST,
    ),
    null,
  );
  assert.equal(
    esportsPlayback(
      { title: "Lookalike", url: "https://kick.com.evil.test/fiesta_cs", platform: "kick" },
      PACKAGED_HOST,
    ),
    null,
  );
  assert.equal(
    esportsPlayback({ title: "Feed", url: "https://example.test/feed", platform: "external" }, PACKAGED_HOST),
    null,
  );
});

test("untrusted stream URLs cannot become embedded content", () => {
  for (const url of [
    "javascript:alert(1)",
    "https://twitch.tv.evil.test/riotgames",
    "http://twitch.tv/riotgames",
    "https://www.twitch.tv/riotgames/other",
  ])
    for (const host of ["localhost", PACKAGED_HOST])
      assert.equal(esportsEmbedUrl({ title: "Unsafe", url, platform: "twitch" }, host), null);
  assert.equal(esportsExternalUrl("https://name:password@example.com"), null);
  assert.equal(esportsExternalUrl("file:///tmp/test"), null);
});
