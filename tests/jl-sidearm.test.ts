import assert from "node:assert/strict";
import test from "node:test";
import {
  calendarSports,
  decodeHtml,
  eventsForSport,
  icsStart,
  isDirectStream,
  isLiveNow,
  matchupText,
  newsForSport,
  parseCalendar,
  parseNews,
  parsePlayerBio,
  parseRoster,
  parseSchoolSports,
  seasonRecord,
  slugForSport,
  sportName,
  splitSeason,
} from "../src/lib/jl/sports/sidearm.ts";

const ICS = [
  "BEGIN:VCALENDAR",
  "X-WR-CALNAME:Gallaudet University Athletics",
  "BEGIN:VEVENT",
  "SUMMARY:[W] Gallaudet University Football vs Example College",
  "DTSTART:20260912T170000Z",
  "DESCRIPTION:W 28-14\\nStreaming Video: https://example.test/watch/1",
  "LOCATION:Hotchkiss Field\\, Washington",
  "URL:https://gallaudetbison.com/calendar.aspx?id=1&amp;game_id=101&amp;sport_id=3",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "SUMMARY:Gallaudet University Football at Sample State",
  "DTSTART;TZID=America/New_York:20261010T130000",
  "DESCRIPTION:Streaming Video: https://example.test/live/2.m3u8",
  "URL:https://gallaudetbison.com/calendar.aspx?id=2&game_id=102&sport_id=3",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "SUMMARY:Gallaudet University Men's Basketball vs Other",
  "DTSTART;VALUE=DATE:20261120",
  "DESCRIPTION:Streaming Video: http://insecure.test/x",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "SUMMARY:Gallaudet University Football at Sample State",
  "DTSTART;TZID=America/New_York:20261010T130000",
  "URL:https://gallaudetbison.com/calendar.aspx?id=2&game_id=102&sport_id=3",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

function must<T>(v: T | null | undefined): T {
  if (v == null) throw new Error("expected a value");
  return v;
}

test("parses a SIDEARM calendar: school, sports, results, streams, time zones", () => {
  const cal = must(parseCalendar(ICS));
  assert.equal(cal.school, "Gallaudet University");
  assert.equal(cal.events.length, 3, "duplicate game ids appear once");
  const [won, away, hoops] = cal.events;
  assert.equal(won.sport, "Football");
  assert.equal(won.result, "W");
  assert.equal(won.score, "28-14");
  assert.equal(won.opponent, "Example College");
  assert.equal(won.home, true);
  assert.equal(won.location, "Hotchkiss Field, Washington");
  assert.equal(won.stream, "https://example.test/watch/1");
  assert.equal(won.sportId, "3");
  assert.equal(won.id, "g:101");
  assert.equal(away.home, false);
  assert.equal(away.start, "2026-10-10T17:00:00.000Z", "13:00 in New York (EDT) is 17:00 UTC");
  assert.equal(hoops.sport, "Men's Basketball");
  assert.equal(hoops.allDay, true);
  assert.equal(hoops.stream, null, "only https stream links");
  assert.deepEqual(calendarSports(cal.events), ["Football", "Men's Basketball"]);
  assert.equal(parseCalendar("<html>"), null);
});

test("time zone conversion handles standard time", () => {
  assert.equal(icsStart("20261201T190000", "America/Chicago")?.start, "2026-12-02T01:00:00.000Z");
  assert.equal(icsStart("20261201T190000Z", null)?.start, "2026-12-01T19:00:00.000Z");
  assert.equal(icsStart("bad", null), null);
});

test("matches sports between site slugs and calendar names", () => {
  const cal = must(parseCalendar(ICS));
  assert.equal(eventsForSport(cal.events, "football").length, 2);
  assert.equal(eventsForSport(cal.events, "mens-basketball").length, 1);
  assert.equal(eventsForSport(cal.events, "Men's Basketball").length, 1);
  assert.equal(sportName("womens-swimming-and-diving"), "Women's Swimming and Diving");
  const sports = [
    { slug: "mens-swimming-and-diving", name: "Men's Swimming and Diving" },
    { slug: "football", name: "Football" },
  ];
  assert.equal(slugForSport("Men's Swimming", sports), "mens-swimming-and-diving");
  assert.equal(slugForSport("Football", sports), "football");
  assert.equal(slugForSport("Golf", sports), null);
});

test("splits a season and counts the record", () => {
  const cal = must(parseCalendar(ICS));
  const now = Date.parse("2026-10-10T18:00:00Z");
  const { upcoming, results } = splitSeason(cal.events, now);
  assert.deepEqual(
    upcoming.map((e) => e.id),
    ["g:102", cal.events[2].id],
  );
  assert.deepEqual(
    results.map((e) => e.id),
    ["g:101"],
  );
  assert.equal(isLiveNow(upcoming[0], now), true);
  assert.equal(isLiveNow(upcoming[1], now), false);
  assert.deepEqual(seasonRecord(cal.events), { W: 1, L: 0, T: 0 });
  assert.equal(matchupText(upcoming[0]), "at Sample State");
});

test("direct streams play in the player, pages open in the browser", () => {
  assert.equal(isDirectStream("https://example.test/live/2.m3u8?token=x"), true);
  assert.equal(isDirectStream("https://example.test/watch/1"), false);
  assert.equal(isDirectStream("nope"), false);
});

test("reads the sports a site lists", () => {
  const html =
    '<a href="/sports/football/roster">x</a><a href="/sports/mens-basketball/schedule">y</a>' +
    '<a href="/sports/football/roster">dup</a><a href="/sports/Bad_Slug/roster">z</a>';
  assert.deepEqual(parseSchoolSports(html), [
    { slug: "football", name: "Football" },
    { slug: "mens-basketball", name: "Men's Basketball" },
  ]);
});

test("parses a SIDEARM roster", () => {
  const html = `
    <ul><li class="sidearm-roster-player" data-player-id="55" data-player-url="/sports/football/roster/jane-doe/55">
      <img data-src="/images/2026/9/1/jane.jpg?width=80" alt="Jane Doe - View Profile">
      <span class="sidearm-roster-player-jersey-number">12</span>
      <div class="sidearm-roster-player-position"><span class="text-bold">QB</span></div>
      <span class="sidearm-roster-player-academic-year">Jr.</span>
      <span class="sidearm-roster-player-hometown">Austin, Texas</span>
      <span class="sidearm-roster-player-height">6&#39;1&quot;</span>
    </li>
    <li class="sidearm-roster-player"><span>no id</span></li></ul>`;
  const players = parseRoster(html, "gallaudetbison.com");
  assert.equal(players.length, 1);
  const p = players[0];
  assert.equal(p.id, "55");
  assert.equal(p.name, "Jane Doe");
  assert.equal(p.number, "12");
  assert.equal(p.position, "QB");
  assert.equal(p.year, "Jr.");
  assert.equal(p.hometown, "Austin, Texas");
  assert.equal(p.height, `6'1"`);
  assert.equal(p.photo, "https://gallaudetbison.com/images/2026/9/1/jane.jpg?width=600&quality=90");
  assert.equal(p.profile, "https://gallaudetbison.com/sports/football/roster/jane-doe/55");
});

test("reads a player's bio and statistics tables", () => {
  const html = `
    <meta property="og:description" content="Jane Doe is a junior quarterback from Austin, Texas.">
    <h3>Passing Statistics</h3>
    <table><tr><th>Season</th><th>GP</th><th>Yds</th></tr>
      <tr><td>2025</td><td>10</td><td>1,820</td></tr>
      <tr><td>2026</td><td>5</td><td>930</td></tr></table>
    <table><tr><th>Name</th><th>Link</th></tr><tr><td>Coach</td><td>Profile</td></tr></table>`;
  const bio = parsePlayerBio(html);
  assert.equal(bio.bio, "Jane Doe is a junior quarterback from Austin, Texas.");
  assert.equal(bio.stats.length, 1, "non-numeric tables are not stats");
  assert.equal(bio.stats[0].title, "Passing Statistics");
  assert.deepEqual(bio.stats[0].headers, ["Season", "GP", "Yds"]);
  assert.deepEqual(bio.stats[0].rows[1], ["2026", "5", "930"]);
  assert.deepEqual(parsePlayerBio("<p>nothing</p>"), { bio: null, stats: [] });
});

test("parses the news feed and filters by sport", () => {
  const xml = `<rss><channel>
    <item><title><![CDATA[Bison win opener]]></title><link>https://gallaudetbison.com/news/1</link>
      <pubDate>Sat, 12 Sep 2026 20:00:00 EDT</pubDate><category>Football, General</category>
      <enclosure url="https://gallaudetbison.com/images/a.jpg" type="image/jpeg"/></item>
    <item><title>Hoops schedule out</title><link>https://gallaudetbison.com/news/2</link>
      <category>Men's Basketball</category></item>
    <item><title>Insecure</title><link>http://x.test/3</link></item>
  </channel></rss>`;
  const news = parseNews(xml);
  assert.equal(news.length, 2);
  assert.equal(news[0].title, "Bison win opener");
  assert.equal(news[0].published, "2026-09-13T00:00:00.000Z");
  assert.deepEqual(news[0].sports, ["Football"]);
  assert.equal(news[0].image, "https://gallaudetbison.com/images/a.jpg");
  assert.equal(news[1].published, null);
  assert.deepEqual(
    newsForSport(news, "Men's Basketball").map((n) => n.url),
    ["https://gallaudetbison.com/news/2"],
  );
  assert.equal(newsForSport(news, null).length, 2);
});

test("decodes HTML entities", () => {
  assert.equal(decodeHtml("A &amp; M &#8211; &#x41;&nbsp;b"), "A & M – A b");
});
