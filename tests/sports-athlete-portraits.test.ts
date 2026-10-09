import test from "node:test";
import assert from "node:assert/strict";
import { ADDITIONAL_LEAGUES } from "../src/lib/sports/additional-sports-catalog.ts";
import {
  createAthletePortraitResolver,
  espnAthletePortrait,
  sportsDbAthletePortrait,
  publishedPortraitUrl,
} from "../src/lib/sports/athlete-portraits.ts";

const request = { path: "tennis/atp", id: "11685", name: "Jacob Fearnley" };
const image = "https://r2.thesportsdb.com/images/media/player/cutout/u09ons1761039456.png";
const player = {
  idPlayer: "34421345",
  strPlayer: "Jacob Fearnley",
  strSport: "Tennis",
  strGender: "Male",
  strCutout: image,
};
const db = (entry = player) => ({ player: [entry] });
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test("accepts published athlete images and refuses flags, unrelated hosts and guessed values", () => {
  assert.equal(publishedPortraitUrl(image), image);
  assert.equal(
    publishedPortraitUrl("https://a.espncdn.com/i/headshots/golf/players/full/9478.png"),
    "https://a.espncdn.com/i/headshots/golf/players/full/9478.png",
  );
  for (const value of [
    "https://a.espncdn.com/i/teamlogos/countries/500/gbr.png",
    "https://a.espncdn.com.evil.example/i/headshots/tennis/players/full/1.png",
    "https://user:password@a.espncdn.com/i/headshots/tennis/players/full/1.png",
    "javascript:alert(1)",
    "11685",
  ])
    assert.equal(publishedPortraitUrl(value), "");
  assert.equal(
    espnAthletePortrait(
      {
        athlete: {
          id: "11685",
          displayName: "Jacob Fearnley",
          flag: {
            href: "https://a.espncdn.com/i/teamlogos/countries/500/gbr.png",
          },
        },
      },
      request,
    ),
    null,
  );
  const person = {
    id: "9478",
    displayName: "Scottie Scheffler",
    headshot: {
      href: "https://a.espncdn.com/i/headshots/golf/players/full/9478.png",
    },
  };
  assert.equal(
    espnAthletePortrait(
      { athlete: person },
      { path: "golf/pga", id: "9478", name: "Scottie Scheffler" },
    )?.source,
    "ESPN",
  );
  assert.equal(
    espnAthletePortrait(
      { athlete: person },
      { path: "golf/pga", id: "9478", name: "Someone Else" },
    ),
    null,
  );
});

test("secondary lookup preserves exact person, sport, tour and ambiguous-name boundaries", () => {
  assert.equal(sportsDbAthletePortrait(db(), request)?.url, image);
  assert.equal(sportsDbAthletePortrait(db({ ...player, strPlayer: "Jacob Smith" }), request), null);
  assert.equal(sportsDbAthletePortrait(db({ ...player, strSport: "Soccer" }), request), null);
  assert.equal(
    sportsDbAthletePortrait({ player: [player, { ...player, idPlayer: "42" }] }, request),
    null,
  );
  assert.equal(sportsDbAthletePortrait(db(), { ...request, path: "tennis/wta" }), null);
  assert.ok(
    sportsDbAthletePortrait(db({ ...player, strPlayer: "Iga Świątek", strGender: "Female" }), {
      path: "tennis/wta",
      id: "3730",
      name: "Iga Swiatek",
    }),
  );
});

test("numeric boxing and individual-sport catalog paths resolve by name and sport without ESPN IDs", async () => {
  const snooker = ADDITIONAL_LEAGUES.find((league) => league.key === "WST")!;
  for (const fixture of [
    { path: "4445", group: "boxing", name: "Audit Boxer", sport: "Boxing" },
    { path: snooker.path, group: snooker.group, name: "Audit Player", sport: "Snooker" },
  ]) {
    const urls: string[] = [];
    const resolver = createAthletePortraitResolver({
      fetchJson: async (url) => {
        urls.push(url);
        return db({ ...player, strPlayer: fixture.name, strSport: fixture.sport });
      },
    });
    // A numeric schedule-side ID is not necessarily an ESPN athlete ID.
    const who = { path: fixture.path, group: fixture.group, id: "123", name: fixture.name };
    assert.equal((await resolver.resolve(who))?.url, image);
    assert.equal(urls.length, 1);
    assert.equal(new URL(urls[0]).hostname, "www.thesportsdb.com");
    assert.equal(new URL(urls[0]).searchParams.get("p"), fixture.name);
    assert.equal((await resolver.resolve(who))?.url, image);
    assert.equal(urls.length, 1, "A verified portrait remains cached");
  }
});

test("provider-path fallbacks retain sport, full-name and ambiguity checks and scope negative cache", async () => {
  const boxer = { ...player, strPlayer: "Audit Boxer", strSport: "Boxing" };
  const who = { path: "4445", group: "boxing", id: "", name: boxer.strPlayer };
  assert.equal(sportsDbAthletePortrait(db({ ...boxer, strPlayer: "Different Boxer" }), who), null);
  assert.equal(sportsDbAthletePortrait(db({ ...boxer, strSport: "Fighting" }), who), null);
  assert.equal(
    sportsDbAthletePortrait({ player: [boxer, { ...boxer, idPlayer: "42" }] }, who),
    null,
  );
  let calls = 0;
  const resolver = createAthletePortraitResolver({
    fetchJson: async () => {
      calls++;
      return db(boxer);
    },
  });
  assert.equal(await resolver.resolve({ ...who, group: undefined }), null);
  assert.equal(calls, 0, "A provider route alone cannot establish the sport");
  assert.equal(await resolver.resolve({ ...who, group: "snooker" }), null);
  assert.equal(await resolver.resolve({ ...who, group: "snooker" }), null);
  assert.equal(calls, 3, "Unavailable portraits are negatively cached within their sport");
  assert.equal((await resolver.resolve(who))?.url, image);
  assert.equal(calls, 4, "One sport's negative cache cannot suppress another sport's identity");
});

test("visible-athlete lookups deduplicate, cap parallel work and cache unavailable photos", async () => {
  let active = 0,
    maximum = 0,
    calls = 0;
  const gates: (() => void)[] = [];
  const resolver = createAthletePortraitResolver({
    concurrency: 2,
    fetchJson: async () => {
      calls++;
      active++;
      maximum = Math.max(maximum, active);
      await new Promise<void>((resolve) => gates.push(resolve));
      active--;
      return { player: null };
    },
  });
  const first = resolver.resolve(request),
    duplicate = resolver.resolve(request);
  const second = resolver.resolve({
    ...request,
    id: "2012",
    name: "Roberto Carballes Baena",
  });
  const thirdRequest = { ...request, id: "3204", name: "Jurij Rodionov" };
  const third = resolver.resolve(thirdRequest);
  assert.equal(calls, 2);
  const settled = Promise.all([first, duplicate, second, third]);
  let finished = false;
  void settled.then(() => {
    finished = true;
  });
  for (let pass = 0; pass < 20 && !finished; pass++) {
    gates.splice(0).forEach((release) => release());
    await tick();
  }
  assert.deepEqual(await settled, [null, null, null, null]);
  assert.equal(maximum, 2);
  const before = calls;
  await resolver.resolve(thirdRequest);
  assert.equal(calls, before, "A cached miss never asks a source again");
});

test("one unmounted subscriber does not abort another and cancelled queue entries never fetch", async () => {
  let finish!: () => void,
    calls = 0,
    aborted = false;
  const resolver = createAthletePortraitResolver({
    concurrency: 1,
    fetchJson: async (_url, signal) => {
      calls++;
      signal.addEventListener("abort", () => {
        aborted = true;
      });
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      return db();
    },
  });
  const firstController = new AbortController();
  const first = resolver.resolve(request, firstController.signal);
  const firstRejection = assert.rejects(first, { name: "AbortError" });
  const second = resolver.resolve(request);
  firstController.abort();
  await firstRejection;
  assert.equal(aborted, false);
  const queuedController = new AbortController();
  const queued = resolver.resolve(
    { ...request, id: "other", name: "Another Person" },
    queuedController.signal,
  );
  const queuedRejection = assert.rejects(queued, { name: "AbortError" });
  queuedController.abort();
  await queuedRejection;
  finish();
  assert.equal((await second)?.url, image);
  await tick();
  assert.equal(calls, 1);
});

test("an immediate remount gets a fresh job after all subscribers cancel", async () => {
  let calls = 0;
  const resolver = createAthletePortraitResolver({
    concurrency: 1,
    fetchJson: async (_url, signal) => {
      calls++;
      if (calls === 1)
        await new Promise((_resolve, reject) =>
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          }),
        );
      return db();
    },
  });
  const controller = new AbortController();
  const first = resolver.resolve(request, controller.signal);
  const rejection = assert.rejects(first, { name: "AbortError" });
  controller.abort();
  const retry = resolver.resolve(request);
  await rejection;
  assert.equal((await retry)?.url, image);
  assert.equal(calls, 2);
});

test("reload cache paints valid portraits immediately without a request; expired entries refresh", async () => {
  const key = "tennis/atp:11685:jacob fearnley";
  const value = {
    url: image,
    source: "TheSportsDB",
    sourceUrl: "https://www.thesportsdb.com/player/34421345",
  };
  let clock = 100000,
    calls = 0;
  const stored = JSON.stringify([[key, { at: clock, value }]]);
  const resolver = createAthletePortraitResolver({
    now: () => clock,
    storage: { getItem: () => stored, setItem: () => {} },
    fetchJson: async () => {
      calls++;
      return db();
    },
  });
  assert.deepEqual(resolver.peek(request), value);
  assert.deepEqual(await resolver.resolve(request), value);
  assert.deepEqual(await resolver.resolve({ ...request, group: "tennis" }), value);
  assert.equal(calls, 0);
  clock += 8 * 86400000;
  assert.equal((await resolver.resolve(request))?.url, image);
  assert.equal(calls, 1);
});

test("portrait warmup uses async cache before API requests and rejects unsafe attribution links", async () => {
  const key = "tennis/atp:11685:jacob fearnley";
  const value = {
    url: image,
    source: "TheSportsDB",
    sourceUrl: "https://www.thesportsdb.com/player/34421345",
  };
  let calls = 0;
  const resolver = createAthletePortraitResolver({
    now: () => 100000,
    fetchJson: async () => {
      calls++;
      return db();
    },
    asyncStorage: {
      getItem: async () => JSON.stringify([[key, { at: 100000, value }]]),
      setItem: async () => {},
    },
  });
  assert.equal((await resolver.resolve(request))?.url, image);
  assert.equal(calls, 0);
  const invalid = createAthletePortraitResolver({
    now: () => 100000,
    fetchJson: async () => db(),
    storage: {
      getItem: () =>
        JSON.stringify([
          [
            key,
            {
              at: 100000,
              value: { ...value, sourceUrl: "javascript:alert(1)" },
            },
          ],
        ]),
      setItem: () => {},
    },
  });
  assert.equal(invalid.peek(request), undefined);
});
