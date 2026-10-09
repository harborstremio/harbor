import assert from "node:assert/strict";
import test from "node:test";
import { applySteamSaleCardPolicy, currentSteamSale, enrichSteamSaleEvent, parseSteamSaleSchedule, steamSaleDays, steamSalePhase, STEAM_SALE_CARDS_FAQ } from "../src/lib/games/steam-events-data";

const html = `<a href="https://partner.steamgames.com/doc/marketing/upcoming_events/2026_autumn_sale"><span>Steam Autumn Sale 2026</span></a><h2><strong>Autumn Sale 2026</strong> | October 1, 2026 - October 8, 2026</h2><h2>Winter Sale 2026 | December 17, 2026 - January 4, 2027</h2>`;
test("sale schedule uses published ranges only, preserves cross-year dates, and rejects unreadable pages", () => {
  const events = parseSteamSaleSchedule(html, 123);
  assert.equal(events.length, 2); assert.equal(events[0].sourceUrl, "https://partner.steamgames.com/doc/marketing/upcoming_events/2026_autumn_sale");
  assert.equal(events[1].endDate, "2027-01-04"); assert.equal(events[0].startsAt, undefined); assert.equal(events[0].observedAt, 123);
  assert.throws(() => parseSteamSaleSchedule("<h2>Dates coming soon</h2>"));
  assert.throws(() => parseSteamSaleSchedule("<h2>Spring Sale 2027 | February 30, 2027 - March 2, 2027</h2>"));
  assert.equal(parseSteamSaleSchedule(html + html).length, 2);
});
test("published Pacific hours honor DST and precise sale boundaries advance without repeating last year's event", () => {
  const events = parseSteamSaleSchedule(html);
  const autumn = enrichSteamSaleEvent(events[0], '<div class="documentation_bbcode">Steam Autumn Sale runs October 1 - 8, 2026 at 10am Pacific.</div><div id="hashLocationHighlight">');
  const winter = enrichSteamSaleEvent(events[1], '<div class="documentation_bbcode">Steam Winter Sale runs December 17, 2026 - January 4, 2027 at 10am Pacific.</div><div id="hashLocationHighlight">');
  assert.equal(autumn.startsAt, Date.parse("2026-10-01T17:00:00Z")); assert.equal(winter.startsAt, Date.parse("2026-12-17T18:00:00Z"));
  assert.equal(steamSalePhase(autumn, autumn.startsAt! - 1), "upcoming"); assert.equal(steamSalePhase(autumn, autumn.startsAt!), "current");
  assert.equal(steamSalePhase(autumn, autumn.endsAt!), "ended"); assert.equal(currentSteamSale([autumn, winter], autumn.endsAt!)?.id, "winter-2026");
  assert.equal(currentSteamSale([autumn, winter], Date.parse("2027-02-01T12:00:00Z")), null);
});
test("day-only countdown uses Pacific calendar dates and no fabricated hourly precision", () => {
  const event = parseSteamSaleSchedule(html)[0];
  assert.equal(steamSaleDays(event, Date.parse("2026-10-01T01:00:00Z")), 1);
  assert.equal(steamSalePhase(event, Date.parse("2026-10-01T01:00:00Z")), "upcoming");
  assert.equal(enrichSteamSaleEvent(event, '<div class="documentation_bbcode">Steam Autumn Sale dates to follow.</div><div id="hashLocationHighlight">').startsAt, undefined);
  assert.equal(enrichSteamSaleEvent(event, '<div class="documentation_bbcode">Steam Autumn Sale runs October 2 - 9, 2026 at 10am Pacific.</div><div id="hashLocationHighlight">').startsAt, undefined);
});

const faqPage = (content: string, title = "Steam Sale Trading Cards & Badge FAQ", language = 0) => `<div data-faqstore="${JSON.stringify({ faqs: { entry: { title, language, content } } }).replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"></div>`;
test("sale card eligibility follows the live FAQ for both upcoming and current sales", () => {
  const events = parseSteamSaleSchedule(html);
  const result = applySteamSaleCardPolicy(events, faqPage("Steam Sale cards are only available during the Summer and Winter Sales. Crafting the Steam Sale badge earns you an emoticon and a profile background."), 456);
  assert.equal(result[0].cards?.available, false);
  assert.deepEqual(result[1].cards, { available: true, badgeRewards: true, sourceUrl: STEAM_SALE_CARDS_FAQ, observedAt: 456 });
  assert.equal(events[1].cards, undefined);
  assert.equal(steamSalePhase(result[1], Date.parse("2026-12-18T20:00:00Z")), "current");
  assert.equal(steamSalePhase(result[1], Date.parse("2026-10-10T20:00:00Z")), "upcoming");
  // A future change in Valve's policy must change eligibility without a code update.
  const changed = applySteamSaleCardPolicy(events, faqPage("Steam Sale cards are only available during the Autumn Sales."));
  assert.equal(changed[0].cards?.available, true); assert.equal(changed[1].cards?.available, false);
  assert.equal(changed[0].cards?.badgeRewards, false);
});
test("missing, malformed, translated or unrelated FAQ content leaves cards unknown", () => {
  const events = parseSteamSaleSchedule(html);
  const rule = "Steam Sale cards are only available during the Summer and Winter Sales.";
  for (const page of ["unavailable", '<div data-faqstore="broken">', faqPage("Card details coming soon"), faqPage(rule, "Unrelated FAQ"), faqPage(rule, undefined, 5), faqPage(rule).repeat(10000)]) {
    assert.equal(applySteamSaleCardPolicy(events, page), events);
    assert.equal(events[0].cards, undefined);
  }
});
