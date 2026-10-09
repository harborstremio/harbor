import assert from "node:assert/strict";
import test from "node:test";
import { load } from "cheerio";
import {
  boxingCalendarDate,
  boxingEasternTime,
  parsePbcCalendar,
  parseQueensberryCalendar,
} from "../src/lib/sports/providers/boxing-partners.ts";

// Compact excerpts of the official calendars captured on September 14, 2026.
const pbc = `<div class="fight-row"><h4 class="schedule-date"><span><abbr>Sat</abbr>,</span> <span><abbr>Sep</abbr></span> 19, 2026 <span class="time">8PM <abbr>ET</abbr> / 5PM <abbr>PT</abbr></span></h4><h2><a href="/isaac-cruz-vs-nestor-bravo"><span>Isaac Cruz</span><em>vs</em><span>Nestor Bravo</span></a></h2><h2><a><span>Jesus Ramos</span><span>Meiirim Nursultanov</span></a></h2><li class="arena">Pechanga Arena, San Diego, California</li><a href="/fight-night-september-19-2026">View Fight Night</a></div><script type="application/ld+json">{"startDate":"2026-09-19T20:00:00-05:00","image":"wrong-fight.jpg"}</script>`;
const queensberry = `<div class="upcoming-events-blocks"><div><img src="//queensberry.co.uk/cdn/shop/files/Home-Stretch-1080x1350.jpg?v=1785253285"></div><div class="upcoming-events-content"><h3>Homestretch</h3><div class="upcoming-first-icon-text">Saturday, 26 September 2026</div><div class="upcoming-second-icon-text">BP Pulse Live, Birmingham, UK</div><div class="upcoming-first-btn"><a href="/pages/liam-davies-vs-nathaniel-collins-homestretch">Event Info</a></div></div></div><script type="application/ld+json">{"@type":"SportsEvent","name":"Stale 2025 fight","startDate":"2025-02-08"}</script>`;

interface DomNode {
  textContent: string;
  getAttribute(name: string): string | null;
  querySelector(selector: string): DomNode | null;
  querySelectorAll(selector: string): DomNode[];
}
function withInertDocument<T>(run: () => T): T {
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
          const wrap = (nodes: ReturnType<typeof $>): DomNode => ({
            textContent: nodes.text(),
            getAttribute: (name) => nodes.attr(name) ?? null,
            querySelector: (selector) => {
              const found = nodes.find(selector).first();
              return found.length ? wrap(found) : null;
            },
            querySelectorAll: (selector) =>
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
  try {
    return run();
  } finally {
    globalThis.document = previous;
  }
}

test("published date parsing rejects impossible dates and ambiguous numeric formats", () => {
  assert.equal(boxingCalendarDate("Saturday, 26 September 2026"), "2026-09-26");
  assert.equal(boxingCalendarDate("Sat, Sep 19, 2026"), "2026-09-19");
  assert.equal(boxingCalendarDate("31 February 2026"), undefined);
  assert.equal(boxingCalendarDate("09/10/26"), undefined);
});

test("Eastern broadcasts use real daylight and winter offsets", () => {
  assert.equal(
    boxingEasternTime("2026-09-19", "8PM ET / 5PM PT"),
    Date.parse("2026-09-20T00:00:00Z"),
  );
  assert.equal(
    boxingEasternTime("2026-12-19", "8:30PM ET / 5:30PM PT"),
    Date.parse("2026-12-20T01:30:00Z"),
  );
  assert.equal(boxingEasternTime("2026-03-08", "2:30AM ET"), undefined);
  assert.equal(boxingEasternTime("2026-09-19", "8PM CT"), undefined);
});

test("PBC reads the actual main bout and visible broadcast time, ignoring incorrect schema", () =>
  withInertDocument(() => {
    const games = parsePbcCalendar(pbc);
    assert.equal(games.length, 1);
    const game = games[0];
    assert.equal(game.id, "pbc:fight-night-september-19-2026");
    assert.equal(game.home.name, "Isaac Cruz");
    assert.equal(game.away.name, "Nestor Bravo");
    assert.equal(game.startMs, Date.parse("2026-09-20T00:00:00Z"));
    assert.equal(game.state, "pre");
    assert.equal(game.context?.draw, "Premier Boxing Champions");
    assert.equal(game.artwork, undefined);
    assert.equal(game.dateOnly, undefined);
  }));

test("Queensberry keeps the actual date-only campaign and poster instead of stale schema", () =>
  withInertDocument(() => {
    const [game] = parseQueensberryCalendar(queensberry);
    assert.equal(game.context?.name, "Homestretch");
    assert.equal(game.dateOnly, "2026-09-26");
    assert.equal(new Date(game.startMs).getHours(), 12);
    assert.equal(
      game.poster,
      "https://queensberry.co.uk/cdn/shop/files/Home-Stretch-1080x1350.jpg?v=1785253285",
    );
    assert.equal(game.home.name, "");
    assert.equal(game.away.id, "");
    assert.equal(game.context?.draw, "Queensberry");
  }));

test("calendar parsers reject external event links, cap cards and deduplicate identities", () =>
  withInertDocument(() => {
    assert.equal(
      parsePbcCalendar(
        pbc.replace('href="/fight-night-', 'href="https://unrelated.example/fight-night-'),
      ).length,
      0,
    );
    assert.equal(
      parseQueensberryCalendar(
        queensberry.replace('href="/pages/', 'href="https://unrelated.example/pages/'),
      ).length,
      0,
    );
    assert.equal(parsePbcCalendar(pbc.repeat(31)).length, 1);
    assert.throws(() => parseQueensberryCalendar("x".repeat(1_000_001)), /size limit/);
    assert.throws(() => parsePbcCalendar("<html>Unavailable</html>"), /unavailable/);
  }));
