import assert from "node:assert/strict";
import test from "node:test";
import { broadcastFromPipSession, broadcastPipSession } from "../src/lib/sports/broadcast-pip.ts";

test("native broadcast sessions restore the selected public provider as an embed", () => {
  for (const stream of [
    { title: "Tournament", url: "https://www.twitch.tv/eslcs", platform: "twitch" as const },
    { title: "Match", url: "https://kick.com/fiesta_cs", platform: "kick" as const },
    {
      title: "Official video",
      url: "https://www.youtube.com/watch?v=abcdefghijk",
      platform: "youtube" as const,
    },
  ]) {
    const session = broadcastPipSession(stream);
    assert.equal(session.url, stream.url);
    assert.equal(session.playing, true);
    assert.deepEqual(broadcastFromPipSession(session, "localhost"), stream);
  }
});

test("media URLs and lookalike provider destinations do not become broadcast embeds", () => {
  for (const url of [
    "https://media.example/video.mp4",
    "https://twitch.tv.evil.test/eslcs",
    "https://kick.com/fiesta_cs/other",
    "https://www.twitch.tv/videos/123",
    "javascript:alert(1)",
  ])
    assert.equal(broadcastFromPipSession({ url, title: null }, "localhost"), null);
});
