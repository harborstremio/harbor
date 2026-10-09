import test from "node:test";
import assert from "node:assert/strict";
import {
  dismissSurprisePrompt, noteSurpriseTrack, resetSurpriseFeedback, surpriseEnjoyed,
  surpriseFeedbackState, surpriseNotEnjoyed,
} from "../src/lib/music/surprise-feedback.ts";
import type { MusicTrack } from "../src/lib/music/types.ts";

const song = (n: number, artwork: string | undefined = `cover-${n}.jpg`): MusicTrack => ({
  id: `deezer:track:${n}`, title: `Song ${n}`, artist: "Someone", artwork: artwork as string,
  durationSeconds: 180, durationLabel: "3:00", connectorId: "catalog",
});
const play = (from: number, to: number) => { for (let n = from; n <= to; n += 1) noteSurpriseTrack(song(n)); };

test("the mix waits until it has played enough to be worth judging", () => {
  resetSurpriseFeedback();
  play(1, 3);
  assert.equal(surpriseFeedbackState().step, "idle");
  assert.equal(surpriseFeedbackState().heard, 3);
  noteSurpriseTrack(song(4));
  assert.equal(surpriseFeedbackState().step, "rate");
  assert.equal(surpriseFeedbackState().heard, 4);
});

test("it keeps only the last few covers, and never a duplicate or a missing one", () => {
  resetSurpriseFeedback();
  play(1, 5);
  assert.deepEqual(surpriseFeedbackState().covers, ["cover-3.jpg", "cover-4.jpg", "cover-5.jpg"]);
  noteSurpriseTrack(song(5));
  assert.deepEqual(surpriseFeedbackState().covers, ["cover-3.jpg", "cover-4.jpg", "cover-5.jpg"]);
  noteSurpriseTrack(song(6, ""));
  assert.deepEqual(surpriseFeedbackState().covers, ["cover-3.jpg", "cover-4.jpg", "cover-5.jpg"]);
  assert.equal(surpriseFeedbackState().heard, 7);
});

test("an answered mix never asks again, and a new mix may ask once more", () => {
  resetSurpriseFeedback();
  play(1, 4);
  surpriseEnjoyed();
  assert.equal(surpriseFeedbackState().step, "idle");
  play(5, 20);
  assert.equal(surpriseFeedbackState().step, "idle", "a rated mix stays quiet");
  assert.equal(surpriseFeedbackState().heard, 4, "counting stops once answered");
  resetSurpriseFeedback();
  play(1, 4);
  assert.equal(surpriseFeedbackState().step, "rate", "the next mix starts fresh");
});

test("dismissing is final for that mix, and thumbs down opens the redirect step", () => {
  resetSurpriseFeedback();
  play(1, 4);
  dismissSurprisePrompt();
  play(5, 20);
  assert.equal(surpriseFeedbackState().step, "idle");
  resetSurpriseFeedback();
  play(1, 4);
  surpriseNotEnjoyed();
  assert.equal(surpriseFeedbackState().step, "redirect");
  assert.ok(surpriseFeedbackState().covers.length, "the redirect step still has art to show");
  surpriseEnjoyed();
  assert.equal(surpriseFeedbackState().step, "idle", "back closes without re-asking");
  play(5, 20);
  assert.equal(surpriseFeedbackState().step, "idle");
});
