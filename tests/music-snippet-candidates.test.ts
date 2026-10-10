import test from "node:test";
import assert from "node:assert/strict";
import { snippetSeedArtists, unheardSnippetCandidates } from "../src/lib/music/snippet-candidates.ts";
import { musicTrackIdentity } from "../src/lib/music/track-identity.ts";
import type { MusicTrack } from "../src/lib/music/types.ts";

const track = (id: string, title: string, artist = "Basshunter"): MusicTrack => ({ id, title, artist, artwork: "", connectorId: "catalog", durationSeconds: 180, durationLabel: "3:00" });
test("discovery tries different original artists instead of repeating the first recent artist", () => {
  const first = track("first", "Elinor"), other = track("other", "Another song", "S3RL");
  const upload = { ...track("upload", "New upload", "Uploader"), collectionOrigin: { id: "original", title: "New song", artist: "Basshunter" } };
  assert.deepEqual(snippetSeedArtists([first, track("second", "Now You're Gone"), upload, other]), [first, other]);
});
test("Quick listen excludes its seed, current recording and heard songs across providers", () => {
  const seed = track("seed", "Elinor"), history = track("youtube:1", "Now You're Gone");
  const resolved = { ...track("soundcloud:2", "Uploader - Elinor official audio", "Uploader"), collectionOrigin: { id: seed.id, title: seed.title, artist: seed.artist } };
  const old = track("deezer:3", "All I Ever Wanted"), fresh = track("deezer:4", "New song");
  assert.deepEqual(unheardSnippetCandidates([seed, resolved, { ...history, id: "deezer:2" }, old, fresh, { ...fresh, id: "duplicate" }], seed, [resolved, history], new Set([musicTrackIdentity(old)])), [fresh]);
});
test("there is no familiar-song fallback when all recommendations have been heard", () => {
  const seed = track("seed", "Elinor"), known = track("known", "Now You're Gone");
  assert.deepEqual(unheardSnippetCandidates([seed, known], seed, [known], new Set()), []);
});
test("unheard does not admit videos or instrumental substitutions", () => {
  const seed = track("seed", "Elinor"), fresh = track("fresh", "New song");
  assert.deepEqual(unheardSnippetCandidates([{ ...fresh, mediaKind: "video" }, track("instrumental", "New song (Instrumental)"), fresh], seed, [], new Set()), [fresh]);
});

test("a new library can discover unheard catalog songs without a seed", () => {
  const heard = track("old", "Already heard"), fresh = track("fresh", "New song");
  assert.deepEqual(unheardSnippetCandidates([
    heard, fresh, track("instrumental", "New song (Instrumental)"),
    track("karaoke", "Another song (Karaoke)"), { ...fresh, id: "video", mediaKind: "video" },
  ], null, [], new Set([musicTrackIdentity(heard)])), [fresh]);
});
