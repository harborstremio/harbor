import assert from "node:assert/strict";
import test from "node:test";
import { load } from "cheerio";
import {
  boxingOnDay,
  BOXING_CALENDARS,
  createBoxingScheduleLoader,
  mergeBoxingGames,
  officialBoxingUrl,
  parseMatchroomCards,
  parseMatchroomEvent,
  publishedBoxingDate,
} from "../src/lib/sports/providers/boxing-schedule.ts";

const url = "https://www.matchroomboxing.com/events/hedges-vs-brown/";
const calendar = `<section class="events-upcoming"><div class="fight-card"><a href="${url}" title="Hedges vs Brown">See event</a><span class="location">Co-op Live, Manchester</span><div class="image"><img data-src="https://www.matchroomboxing.com/app/uploads/2026/07/hedgesbrown.jpg"></div></div></section><section class="events-previous"><div class="fight-card"><a href="https://example.com/not-a-fight">Ignore</a></div></section>`;
const event = `<link rel="canonical" href="${url}"><section class="single-event-hero"><div class="event-details"><p class="date">Saturday 19 September 2026</p><div class="boxer-1"><span class="first-name">John</span><span class="last-name">Hedges</span><img class="main" src="https://www.matchroomboxing.com/app/uploads/hedges.png"><div class="record"><p>W 11</p><p>L 0</p></div></div><div class="boxer-2"><span class="first-name">Pat</span><span class="last-name">Brown</span></div></div></section><a href="https://www.dazn.com/">Watch on DAZN</a>`;
function dom() {
  const previous = globalThis.document;
  globalThis.document = {
    createElement() {
      let html = "";
      return {
        set innerHTML(value: string) {
          html = value;
        },
        get content() {
          const $ = load(html);
          const wrap = (nodes: ReturnType<typeof $>): any => ({
            textContent: nodes.text(),
            getAttribute: (name: string) => nodes.attr(name) ?? null,
            querySelector: (selector: string) => {
              const found = nodes.find(selector).first();
              return found.length ? wrap(found) : null;
            },
            querySelectorAll: (selector: string) =>
              nodes
                .find(selector)
                .toArray()
                .map((node) => wrap($(node))),
          });
          return wrap($.root());
        },
      };
    },
  } as unknown as Document;
  return () => {
    globalThis.document = previous;
  };
}
function fixture() {
  const restore = dom();
  try {
    return parseMatchroomEvent(event, parseMatchroomCards(calendar)[0])!;
  } finally {
    restore();
  }
}
test("Matchroom reads explicit event-year and actual main fighters, not the post publication date", () => {
  const game = fixture();
  assert.equal(game.dateOnly, "2026-09-19");
  assert.equal(game.home.name, "John Hedges");
  assert.equal(game.away.name, "Pat Brown");
  assert.equal(game.home.record, "W 11 · L 0");
  assert.equal(game.context?.venue, "Co-op Live, Manchester");
  assert.deepEqual(game.broadcasts, ["DAZN"]);
  assert.equal(officialBoxingUrl(game), url);
});
test("Unknown repeated TBC fighters become the named event, never fabricated participants", () => {
  const restore = dom();
  try {
    const card = {
      url: url.replace("hedges-vs-brown", "monte-carlo-showdown-vii"),
      title: "TBC vs TBC",
      venue: "Monaco",
    };
    const game = parseMatchroomEvent(
      event
        .replaceAll(url, card.url)
        .replace("John", "TBC")
        .replace("Hedges", "TBC")
        .replace("Pat", "TBC")
        .replace("Brown", "TBC"),
      card,
    )!;
    assert.equal(game.home.name, "");
    assert.equal(game.away.name, "");
    assert.equal(game.context?.name, "Monte Carlo Showdown VII");
  } finally {
    restore();
  }
});
test("Calendar parser rejects moved identities, unknown years and unsafe provider links", () => {
  assert.equal(publishedBoxingDate("19 Sep"), undefined);
  assert.equal(publishedBoxingDate("31 February 2026"), undefined);
  const restore = dom();
  try {
    assert.equal(
      parseMatchroomEvent(event, {
        url: url.replace("hedges", "other"),
        title: "Other",
        venue: "",
      }),
      null,
    );
    assert.equal(
      parseMatchroomCards(calendar.replaceAll("www.matchroomboxing.com", "untrusted.example"))
        .length,
      0,
    );
  } finally {
    restore();
  }
  assert.equal(
    officialBoxingUrl({ ...fixture(), id: "matchroom:events/../../private" }),
    undefined,
  );
});
test("Official date-only matchup replaces the duplicate midnight feed entry but retains another dated rematch", () => {
  const game = fixture();
  const db = {
    ...game,
    id: "2548283",
    source: "thesportsdb-hub",
    dateOnly: undefined,
    startMs: Date.parse("2026-09-19T00:00:00Z"),
    home: { ...game.home, name: "John Hedges vs Pat Brown" },
    away: { ...game.away, name: "" },
  };
  const rematch = {
    ...db,
    id: "later",
    startMs: Date.parse("2026-10-19T00:00:00Z"),
  };
  const games = mergeBoxingGames([game], [db, rematch]);
  assert.equal(games.length, 2);
  assert.equal(games[0].source, "official-boxing");
  assert.equal(games[0].dateOnly, "2026-09-19");
});
test("Date-only filter follows published calendar date rather than a timezone-shifted anchor", () => {
  const game = { ...fixture(), startMs: Date.parse("2026-09-18T23:00:00Z") };
  assert.equal(boxingOnDay(game, "20260919"), true);
  assert.equal(boxingOnDay(game, "20260918"), false);
  assert.equal(boxingOnDay(game, "20260919", true), true);
  assert.equal(boxingOnDay(game, "20260920", true), false);
});
test("Concurrent day/discovery consumers share requests; one abort cannot cancel its peer; warm and failed-refresh data remain available", async () => {
  const restore = dom();
  try {
    let calls = 0,
      fail = false,
      now = 0;
    const loader = createBoxingScheduleLoader(
      async (address, signal) => {
        calls++;
        await new Promise((resolve) => setTimeout(resolve, 5));
        signal.throwIfAborted();
        if (fail) throw Error("Unavailable");
        if (address === BOXING_CALENDARS.matchroom) return calendar;
        if (address === url) return event;
        throw Error("Other promoter unavailable");
      },
      () => now,
    );
    const a = new AbortController(),
      b = new AbortController();
    const first = loader(a.signal);
    const second = loader(b.signal);
    const aborted = assert.rejects(first, { name: "AbortError" });
    a.abort();
    await aborted;
    assert.equal((await second).length, 1);
    assert.equal(calls, 4);
    await loader(new AbortController().signal);
    assert.equal(calls, 4);
    now = 61_000;
    fail = true;
    assert.equal((await loader(new AbortController().signal)).length, 1);
    assert.equal(calls, 7);
  } finally {
    restore();
  }
});
test("Closing the last consumer cancels provider work and does not cache its failure", async () => {
  const restore = dom();
  try {
    let aborted = 0;
    const loader = createBoxingScheduleLoader(
      async (_address, signal) =>
        new Promise<string>((_resolve, reject) => {
          signal.addEventListener(
            "abort",
            () => {
              aborted++;
              reject(new DOMException("Aborted", "AbortError"));
            },
            { once: true },
          );
        }),
    );
    const controller = new AbortController();
    const request = loader(controller.signal);
    const rejected = assert.rejects(request, { name: "AbortError" });
    controller.abort();
    await rejected;
    assert.equal(aborted, 2);
  } finally {
    restore();
  }
});
