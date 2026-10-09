import assert from "node:assert/strict";
import test from "node:test";
import { communityText, gameReviewUrl, INITIAL_REVIEW_FILTERS, parseGameNews, parseGameReviews, parseReviewAuthor, reviewAuthorRequest, reviewRequest } from "../src/lib/games/community";

test("studio feed verifies game identity, official feed, links, art and text without injecting remote markup", () => {
  const item = { gid: "12345", appid: 42, title: "[b]A new chapter[/b]", date: 100, feedname: "steam_community_announcements", url: "https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/12345", contents: "[h1]Update[/h1] <script>bad()</script><p>Out now &amp; ready.</p>{STEAM_CLAN_IMAGE}/123/abc123.png" };
  const result = parseGameNews({ appnews: { appid: 42, newsitems: [item, item, { ...item, gid: "2", feedname: "pcgamer" }, { ...item, gid: "3", appid: 4 }, { ...item, gid: "4", url: "javascript:bad()" }] } }, 42);
  assert.equal(result.length, 1); assert.equal(result[0].title, "A new chapter"); assert.equal(result[0].image, "https://clan.akamai.steamstatic.com/images/123/abc123.png"); assert.equal(result[0].body, "Update Out now & ready.");
  assert.throws(() => parseGameNews({ appnews: { appid: 43, newsitems: [] } }, 42));
  assert.equal(communityText("[url=javascript:alert(1)]text[/url] [img]https://evil.test/i.png[/img]"), "text");
  const paragraph = parseGameNews({ appnews: { appid: 42, newsitems: [{ ...item, contents: '[p]For a fully localized version of this post, [url="https://example.com"]visit here[/url].[/p][h1]INTRO[/h1][p]During our last season.[/p]' }] } }, 42);
  assert.equal(paragraph[0].body, "INTRO During our last season.");
});

test("escaped announcement headings and closing list-item tags remain readable", () => {
  const source = '[p]\\[ MISC ][/p][list][*][p]Fixed pixel gaps.[/p][/*][*][p]Clipping adjustments.[/p][/*][/list]';
  assert.equal(communityText(source).replace(/\s+/g, " "), "MISC Fixed pixel gaps. Clipping adjustments.");
  assert.equal(communityText("An item [not a tag] stays readable."), "An item [not a tag] stays readable.");
});

test("current review API uses numeric enums, exact cursor encoding, and explicit optional filters", () => {
  const url = new URL(reviewRequest(42, { ...INITIAL_REVIEW_FILTERS, sentiment: "negative", hours: 100, purchase: "other", deck: true, language: "all" }, "abc+=/"));
  assert.equal(url.pathname, "/IUserReviewsService/GetAppReviews/v1/");
  assert.deepEqual(JSON.parse(url.searchParams.get("input_json")!), { appid: 42, filter: 1, languages: ["all"], day_range: 365, cursor: "abc+=/", review_type: 2, purchase_type: 2, num_per_page: 6, playtime_min_hours: 100, primarily_steam_deck: true });
  assert.throws(() => reviewRequest(-1, INITIAL_REVIEW_FILTERS)); assert.throws(() => reviewRequest(42, INITIAL_REVIEW_FILTERS, "x\n"));
});

test("reviews preserve disclosures and literal text, never round uint64 IDs, and stop repeated cursors", () => {
  const review = { recommendationid: "18446744073709551615", author: { steamid: "76561199435972925", playtime_at_review: 721 }, review: "[b]Great[/b]\n<svg onload='bad()'>Text</svg>", timestamp_created: 10, voted_up: true, steam_purchase: true, received_for_free: true, written_during_early_access: true, refunded: true, primarily_steam_deck: true, votes_up: 4, developer_response: "[b]Thanks[/b]" };
  const result = parseGameReviews({ response: { reviews: [review, review, { ...review, recommendationid: "3", author: { steamid: "bad" } }], cursor: "abc=", total_matching: 2, query_summary: { total_positive: 1, total_negative: 1, total_reviews: 2 } } });
  assert.equal(result.reviews.length, 1); assert.equal(result.reviews[0].id, "18446744073709551615"); assert.equal(result.reviews[0].body, "Great\nText"); assert.equal(result.reviews[0].minutes, 721); assert.equal(result.reviews[0].response, "Thanks");
  assert.ok(result.reviews[0].free && result.reviews[0].earlyAccess && result.reviews[0].refunded && result.reviews[0].deck);
  assert.equal(gameReviewUrl(result.reviews[0], 42), "https://steamcommunity.com/profiles/76561199435972925/recommended/42/"); assert.equal(result.summary?.positive, 1);
  assert.equal(parseGameReviews({ response: { reviews: [review], cursor: "abc=" } }, "abc=").cursor, null);
  assert.equal(parseGameReviews({ response: { reviews: [], cursor: "abc=" } }).cursor, null);
  assert.throws(() => parseGameReviews({ response: {} }));
  assert.deepEqual(parseGameReviews({ response: { query_summary: { num_reviews: 0 }, total_matching: 0 } }).reviews, []);
});

test("reviewer profiles use exact account IDs and validated Steam artwork with literal names", () => {
  assert.equal(reviewAuthorRequest("76561199650668112"), "https://steamcommunity.com/miniprofile/1690402384/json/");
  for (const id of ["bad", "76561197960265727", "76561202255233024", "76561199650668112/evil"]) assert.throws(() => reviewAuthorRequest(id));
  const profile = parseReviewAuthor({ persona_name: "<b>Player & friends</b>", avatar_url: "https://avatars.fastly.steamstatic.com/a_full.jpg" });
  assert.equal(profile.name, "<b>Player & friends</b>");
  assert.equal(profile.avatar, "https://avatars.fastly.steamstatic.com/a_full.jpg");
  for (const url of ["javascript:bad()", "https://steamstatic.com.evil.test/a.jpg", "https://name:secret@avatars.steamstatic.com/a.jpg"]) assert.equal(parseReviewAuthor({ persona_name: "Player", avatar_url: url }).avatar, "");
  assert.throws(() => parseReviewAuthor({}));
});

test("total playtime and review-time playtime retain their distinct meanings, including zero", () => {
  const base = { recommendationid: "123", author: { steamid: "76561199435972925", playtime_at_review: 0, playtime_forever: 180, num_reviews: 7 }, review: "Review", timestamp_created: 10, voted_up: false };
  const parsed = parseGameReviews({ response: { reviews: [base] } }).reviews[0];
  assert.equal(parsed.minutes, 0); assert.equal(parsed.totalMinutes, 180); assert.equal(parsed.reviewCount, 7);
  const absent = parseGameReviews({ response: { reviews: [{ ...base, author: { steamid: base.author.steamid, playtime_forever: -1, num_reviews: "5" } }] } }).reviews[0];
  assert.equal(absent.minutes, undefined); assert.equal(absent.totalMinutes, undefined); assert.equal(absent.reviewCount, undefined);
});
