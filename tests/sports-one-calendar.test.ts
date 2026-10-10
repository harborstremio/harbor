import assert from "node:assert/strict";
import test from "node:test";
import { oneCalendarEvent } from "../src/lib/sports/providers/one-schedule.ts";

const card = {
  url: "https://www.onefc.com/events/one-friday-fights-171/",
  name: "ONE Friday Fights 171",
  timestamp: "1789731000",
  image: "https://cdn.onefc.com/example.jpg",
  venue: "Lumpinee Stadium, Bangkok",
};

test("official calendar preserves exact start time and artwork without inventing fighters or live scores", () => {
  const event = oneCalendarEvent(card)!;
  assert.equal(event.startMs, 1789731000000);
  assert.equal(event.source, "official-one");
  assert.equal(event.artwork, card.image);
  assert.equal(event.context?.venue, card.venue);
  assert.equal(event.state, "pre");
  assert.equal(event.home.name, "");
  assert.equal(event.home.score, "");
});

test("calendar rejects unrelated links and missing dates, and discards foreign images", () => {
  assert.equal(oneCalendarEvent({ ...card, url: "https://unrelated.example/events/fight/" }), null);
  assert.equal(oneCalendarEvent({ ...card, timestamp: "" }), null);
  assert.equal(oneCalendarEvent({ ...card, image: "javascript:alert(1)" })?.artwork, undefined);
  assert.equal(oneCalendarEvent({ ...card, url: "https://www.onefc.com/news/story/" }), null);
});
