import assert from "node:assert/strict";
import test from "node:test";
import {
  athleteYoutubeSearch,
  loadAthleteVideos,
  parseAthleteVideos,
} from "../src/lib/sports/athlete-videos.ts";

const NOW = Date.parse("2026-09-14T12:00:00Z");
const clip = (id: string, displayName: string, extra = {}) => ({
  id,
  displayName,
  ...extra,
});
const clips = (...contents: unknown[]) => ({
  results: [{ type: "clips", contents }],
});

test("clips identify the complete athlete name, with accent and punctuation normalization", () => {
  const found = parseAthleteVideos(
    clips(
      clip("101", "Álex Pereira: the best finishes"),
      clip("102", "ALEX—PEREIRA's path to the title"),
      clip("103", "Alex Pereira Jr. discusses training"),
    ),
    "Alex Pereira",
    NOW,
  );
  assert.deepEqual(
    found.map((video) => video.id),
    ["101", "102", "103"],
  );
  assert.equal(found[0].url, "https://www.espn.com/video/clip/_/id/101");
  assert.equal(found[0].embed, "https://www.espn.com/core/video/iframe?id=101&endcard=false");
});

test("related fighters, partial surnames and non-video search groups stay out of an athlete's clips", () => {
  const found = parseAthleteVideos(
    {
      results: [
        { type: "athletes", contents: [clip("1", "Alex Pereira")] },
        {
          type: "clips",
          contents: [
            clip("2", "Israel Adesanya's greatest finishes"),
            clip("3", "Alexandre Pereira signs new deal"),
            clip("4", "Alex Pereiras discusses training"),
            clip("5", "Michel Pereira wins by knockout"),
            clip("6", "Alex Pereira wins by knockout"),
          ],
        },
      ],
    },
    "Alex Pereira",
    NOW,
  );
  assert.deepEqual(
    found.map((video) => video.id),
    ["6"],
  );
  assert.deepEqual(parseAthleteVideos(clips(clip("7", "Li")), "Li", NOW), []);
});

test("repeated results produce one video and provider links cannot override ESPN destinations", () => {
  const found = parseAthleteVideos(
    {
      results: [
        {
          type: "clips",
          contents: [
            clip("42", "Alex Pereira wins", {
              url: "https://unrelated.example/watch",
              embed: "javascript:alert(1)",
            }),
            clip("42", "Alex Pereira duplicate"),
            clip("../43?evil=1", "Alex Pereira malicious id"),
          ],
        },
        {
          type: "clips",
          contents: [clip("42", "Alex Pereira duplicate group")],
        },
      ],
    },
    "Alex Pereira",
    NOW,
  );
  assert.equal(found.length, 1);
  assert.equal(found[0].title, "Alex Pereira wins");
  assert.equal(found[0].url, "https://www.espn.com/video/clip/_/id/42");
  assert.equal(new URL(found[0].embed).hostname, "www.espn.com");
});

test("expired and embargoed clips are excluded at their precise availability boundaries", () => {
  const found = parseAthleteVideos(
    clips(
      clip("1", "Alex Pereira expired", {
        timeRestrictions: { expirationDate: "2026-09-14T11:59:59Z" },
      }),
      clip("2", "Alex Pereira expires now", {
        timeRestrictions: { expirationDate: "2026-09-14T12:00:00Z" },
      }),
      clip("3", "Alex Pereira embargoed", {
        timeRestrictions: { embargoDate: "2026-09-14T12:00:01Z" },
      }),
      clip("4", "Alex Pereira available now", {
        timeRestrictions: {
          embargoDate: "2026-09-14T12:00:00Z",
          expirationDate: "2026-09-14T12:00:01Z",
        },
      }),
      clip("5", "Alex Pereira no restrictions"),
    ),
    "Alex Pereira",
    NOW,
  );
  assert.deepEqual(
    found.map((video) => video.id),
    ["4", "5"],
  );
  assert.equal(found[0].expiresAt, NOW + 1000);
  assert.equal(found[1].expiresAt, undefined);
});

test("invalid duplicate records do not hide a later playable record", () => {
  const found = parseAthleteVideos(
    clips(
      clip("12", "Alex Pereira expired copy", {
        timeRestrictions: { expirationDate: "2026-01-01T00:00:00Z" },
      }),
      clip("12", "Alex Pereira currently available"),
    ),
    "Alex Pereira",
    NOW,
  );
  assert.deepEqual(
    found.map((video) => video.title),
    ["Alex Pereira currently available"],
  );
});

test("untrusted thumbnail URLs are omitted while the official clip remains usable", () => {
  const rejected = [
    "http://a.espncdn.com/image.jpg",
    "https://espncdn.com.evil.example/image.jpg",
    "https://fakeespn.com/image.jpg",
    "https://unrelated.example/image.jpg",
    "https://espncdn.com@unrelated.example/image.jpg",
    "https://a.espncdn.com:444/image.jpg",
    "data:image/svg+xml,<svg />",
    "javascript:alert(1)",
    "/relative/image.jpg",
  ];
  for (const image of rejected) {
    const [found] = parseAthleteVideos(
      clips(clip("1", "Alex Pereira highlights", { image: { default: image } })),
      "Alex Pereira",
      NOW,
    );
    assert.ok(found, image);
    assert.equal(found.image, undefined, image);
  }
  for (const image of [
    "https://a.espncdn.com/media/image.jpg",
    "https://www.espn.com/media/image.jpg",
    "https://media.akamaized.net/media/image.jpg",
  ]) {
    const [found] = parseAthleteVideos(
      clips(clip("1", "Alex Pereira highlights", { image: { default: image } })),
      "Alex Pereira",
      NOW,
    );
    assert.equal(found.image, image);
  }
});

test("credentialed thumbnail URLs are rejected even on trusted hosts", () => {
  const [found] = parseAthleteVideos(
    clips(
      clip("1", "Alex Pereira highlights", {
        image: {
          default: "https://user:password@a.espncdn.com/media/image.jpg",
        },
      }),
    ),
    "Alex Pereira",
    NOW,
  );
  assert.equal(found.image, undefined);
});

test("malformed provider arrays do not discard otherwise valid clips or crash the detail page", () => {
  assert.deepEqual(parseAthleteVideos(null, "Alex Pereira", NOW), []);
  assert.deepEqual(parseAthleteVideos({ results: {} }, "Alex Pereira", NOW), []);
  const found = parseAthleteVideos(
    {
      results: [
        null,
        { type: "clips", contents: null },
        {
          type: "clips",
          contents: [null, false, clip("9", "Alex Pereira highlights")],
        },
      ],
    },
    "Alex Pereira",
    NOW,
  );
  assert.deepEqual(
    found.map((video) => video.id),
    ["9"],
  );
});

test("large search responses yield a bounded set of relevant unique clips", () => {
  const found = parseAthleteVideos(
    clips(
      ...Array.from({ length: 60 }, (_, index) =>
        clip(String(index + 1), "Alex Pereira highlights"),
      ),
    ),
    "Alex Pereira",
    NOW,
  );
  assert.equal(found.length, 8);
  assert.equal(new Set(found.map((video) => video.id)).size, 8);
});

test("YouTube searches target an official league channel and keep athlete text safely encoded", () => {
  const name = "D'Angelo Russell & friends?#é";
  const official = new URL(athleteYoutubeSearch(name, "NBA"));
  assert.equal(official.origin, "https://www.youtube.com");
  assert.equal(official.pathname, "/@NBA/search");
  assert.equal(official.searchParams.get("query"), `${name} highlights`);
  assert.equal(official.hash, "");
  assert.deepEqual([...official.searchParams.keys()], ["query"]);

  const general = new URL(athleteYoutubeSearch("Iga Świątek", "WTA / singles"));
  assert.equal(general.pathname, "/results");
  assert.equal(general.searchParams.get("search_query"), "Iga Świątek WTA / singles highlights");
  assert.equal(new URL(athleteYoutubeSearch("Kyle Larson", "NXS")).pathname, "/@NASCAR/search");
  assert.equal(new URL(athleteYoutubeSearch("Alex Pereira", "UFC")).pathname, "/@ufc/search");
  assert.equal(new URL(athleteYoutubeSearch("Alex Pereira", "__proto__")).pathname, "/results");
});

test("an aborted athlete request stops before provider work or cached results can be returned", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(loadAthleteVideos("Alex Pereira", "MMA", controller.signal), {
    name: "AbortError",
  });
});
