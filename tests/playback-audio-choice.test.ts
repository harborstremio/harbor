import assert from "node:assert/strict";
import test from "node:test";
import { playbackAudioChoice, selectPlaybackAudio } from "../src/lib/player/audio-choice";
import type { TrackInfo } from "../src/lib/player/bridge";

const track = (id: string, title: string): TrackInfo => ({
  id,
  title,
  label: title,
  lang: "eng",
  codec: "aac",
  channels: "stereo",
  kind: "audio",
  selected: true,
});
test("restores distinguishable same-language audio by semantic track details after id changes", () => {
  const choice = playbackAudioChoice(track("1", "Original mix"));
  const tracks = [track("8", "Commentary"), track("9", "Original mix")];
  assert.equal(selectPlaybackAudio(tracks, choice)?.id, "9");
});
test("ambiguous indistinguishable tracks are not guessed after their ids change", () => {
  const choice = playbackAudioChoice(track("1", "English"));
  assert.equal(selectPlaybackAudio([track("8", "English"), track("9", "English")], choice), null);
  assert.equal(
    selectPlaybackAudio([track("1", "English"), track("9", "English")], choice)?.id,
    "1",
  );
});

test("mpv codec description enrichment does not change the identity of the same audio codec", () => {
  const choice = playbackAudioChoice({
    ...track("2", "Commentary"),
    codec: "AAC (ADVANCED AUDIO CODING)",
  });
  assert.equal(
    selectPlaybackAudio([{ ...track("2", "Commentary"), codec: "aac" }], choice)?.id,
    "2",
  );
});

test("mpv unknown2 layout before decoder activation matches the saved stereo track with the same count", () => {
  const selected = { ...track("2", "Commentary"), lang: "ara", channelCount: 2 };
  const inactive = { ...selected, selected: false, channels: "unknown2" };
  assert.equal(selectPlaybackAudio([inactive], playbackAudioChoice(selected))?.id, "2");
  assert.equal(selectPlaybackAudio([selected], playbackAudioChoice(inactive))?.id, "2");
});

test("an unresolved layout cannot conceal a different or unverified channel count", () => {
  const selected = { ...track("2", "Commentary"), lang: "ara", channelCount: 2 };
  for (const other of [
    { channels: "unknown6", channelCount: 6 },
    { channels: "unknown2", channelCount: 6 },
    { channels: "unknown2", channelCount: undefined },
    { channels: "5.1", channelCount: 6 },
    { channels: "downmix", channelCount: 2 },
  ]) {
    assert.equal(
      selectPlaybackAudio([{ ...selected, ...other }], playbackAudioChoice(selected)),
      null,
    );
  }
});
