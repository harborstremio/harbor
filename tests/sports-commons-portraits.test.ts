import test from "node:test";
import assert from "node:assert/strict";
import { commonsAthletePortrait } from "../src/lib/sports/athlete-commons-portraits";
import { createAthletePortraitResolver } from "../src/lib/sports/athlete-portraits";

const who = { path: "tennis/wta", id: "", name: "Melisa Ercan" };
const root = {
  query: {
    pages: [
      {
        ns: 14,
        title: "Category:Melisa Ercan",
        categories: [{ title: "Category:Female tennis players from Australia" }],
      },
    ],
    categorymembers: [{ ns: 14, title: "Category:Melisa Ercan in 2025" }],
  },
};
const photo = {
  ns: 6,
  title: "File:Melisa Ercan 1604202 (recadré).jpg",
  imageinfo: [
    {
      width: 1488,
      height: 2011,
      thumburl:
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ae/Melisa_Ercan_1604202_%28recadr%C3%A9%29.jpg/330px-Melisa_Ercan_1604202_%28recadr%C3%A9%29.jpg",
    },
  ],
};
const images = {
  query: {
    pages: [{ ...photo, title: "File:Maquet basile aulia bulte master'U 1603973.jpg" }, photo],
  },
};

test("Commons resolves the exact tennis player's photo without an English Wikipedia article", async () => {
  const urls: string[] = [];
  const resolver = createAthletePortraitResolver({
    fetchJson: async (url) => {
      urls.push(url);
      if (url.includes("searchplayers")) return { player: null };
      if (url.includes("/summary/")) throw new Error("404");
      return new URL(url).searchParams.has("generator") ? images : root;
    },
  });
  const result = await resolver.resolve(who);
  assert.equal(result?.source, "Wikimedia Commons");
  assert.equal(result?.url, photo.imageinfo[0].thumburl);
  assert.match(
    result!.sourceUrl,
    /^https:\/\/commons.wikimedia.org\/wiki\/File%3AMelisa_Ercan/,
  );
  assert.equal(urls.length, 4);
  assert.equal(new URL(urls[3]).searchParams.get("gcmlimit"), "8");
  assert.deepEqual(await resolver.resolve(who), result);
  assert.equal(urls.length, 4);
});

test("category namesakes, missing pages and wrong sports never trigger a photo read", async () => {
  for (const page of [
    { ...root.query.pages[0], title: "Category:Another Person" },
    { ...root.query.pages[0], missing: true },
    { ...root.query.pages[0], categories: [{ title: "Category:Australian singers" }] },
  ]) {
    let calls = 0;
    assert.equal(
      await commonsAthletePortrait(who, /\btennis\b/i, async () => {
        calls++;
        return { query: { ...root.query, pages: [page] } };
      }),
      null,
    );
    assert.equal(calls, 1);
  }
});

test("unrelated files, unrelated subcategories and unsafe URLs are rejected", async () => {
  for (const members of [
    [],
    [{ ns: 14, title: "Category:Tennis players" }],
    [{ ns: 6, title: "File:Someone else.jpg" }],
  ]) {
    let calls = 0;
    assert.equal(
      await commonsAthletePortrait(who, /tennis/i, async () => {
        calls++;
        return { query: { ...root.query, categorymembers: members } };
      }),
      null,
    );
    assert.equal(calls, 1);
  }
  for (const bad of [
    { ...photo, title: "File:Unrelated group photograph.jpg" },
    { ...photo, imageinfo: [{ thumburl: "https://evil.example/person.jpg" }] },
    {
      ...photo,
      imageinfo: [{ thumburl: "http://thumb.wikimedia.org/wikipedia/commons/a.jpg" }],
    },
  ]) {
    let calls = 0;
    assert.equal(
      await commonsAthletePortrait(who, /tennis/i, async () =>
        ++calls === 1 ? root : { query: { pages: [bad] } },
      ),
      null,
    );
  }
});

test("direct category photos resolve without a third request and prefer the portrait crop", async () => {
  const urls: string[] = [];
  const result = await commonsAthletePortrait(who, /tennis/i, async (url) => {
    urls.push(url);
    return urls.length === 1 ? { query: { ...root.query, categorymembers: [photo] } } : images;
  });
  assert.equal(result?.url, photo.imageinfo[0].thumburl);
  assert.equal(urls.length, 2);
  assert.equal(new URL(urls[1]).searchParams.get("titles"), photo.title);
});

test("older negative cache entries retry new sources while current Commons cache reloads", async () => {
  let calls = 0;
  const key = "tennis/wta::melisa ercan";
  const storage = {
    getItem: () => JSON.stringify([[key, { at: 100, value: null }]]),
    setItem: () => {},
  };
  const resolver = createAthletePortraitResolver({
    now: () => 101,
    storage,
    fetchJson: async (url) => {
      calls++;
      return url.includes("commons.wikimedia")
        ? new URL(url).searchParams.has("generator")
          ? images
          : root
        : {};
    },
  });
  const value = await resolver.resolve(who);
  assert.equal(value?.source, "Wikimedia Commons");
  assert.equal(calls, 4);
  const reloaded = createAthletePortraitResolver({
    now: () => 102,
    storage: { getItem: () => JSON.stringify([[key, { at: 101, value }]]), setItem: () => {} },
    fetchJson: async () => {
      throw new Error("Cache must paint without a fetch");
    },
  });
  assert.deepEqual(reloaded.peek(who), value);
});

test("cancelling a Commons lookup prevents the second media request", async () => {
  const controller = new AbortController();
  const urls: string[] = [];
  const resolver = createAthletePortraitResolver({
    fetchJson: async (url, signal) => {
      urls.push(url);
      if (!url.includes("commons.wikimedia")) return {};
      await new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        controller.abort();
      });
      return root;
    },
  });
  await assert.rejects(resolver.resolve(who, controller.signal), { name: "AbortError" });
  assert.equal(urls.length, 3);
});

test("shared fallback is available for each supported sport group", async () => {
  for (const group of [
    "soccer",
    "basketball",
    "football",
    "baseball",
    "hockey",
    "combat",
    "boxing",
    "motorsport",
    "tennis",
    "golf",
    "rugby",
    "cricket",
    "aussie",
    "lacrosse",
    "volleyball",
    "handball",
    "badminton",
    "tabletennis",
    "cycling",
    "snooker",
    "darts",
    "athletics",
    "swimming",
    "winter",
    "netball",
    "fieldhockey",
    "esports",
    "waterpolo",
    "softball",
  ]) {
    const hosts: string[] = [];
    const resolver = createAthletePortraitResolver({
      fetchJson: async (url) => {
        hosts.push(new URL(url).hostname);
        return {};
      },
    });
    await resolver.resolve({ path: "1234", group, id: "", name: "Named Athlete" });
    assert.deepEqual(
      hosts,
      ["www.thesportsdb.com", "en.wikipedia.org", "commons.wikimedia.org"],
      group,
    );
  }
});
