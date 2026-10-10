import assert from "node:assert/strict";
import test from "node:test";
import {
  approvedEventMedia,
  commonsEventPhoto,
  dataDragonChampionId,
  dotaHeroArt,
  dotaHeroId,
  esportsEventGameArt,
  eventMapArt,
  eventPlaylistFeedUrl,
  fetchEventVideos,
  lolChampionArt,
  parseEventPlaylistFeed,
  resetEventMediaCaches,
  resolveEventHero,
  valorantAgentArt,
  valorantAgentIndex,
  valorantMapIndex,
  valorantMapName,
  wikidataEventLogo,
  type EventMediaRequest,
} from "../src/lib/sports/esports-event-media";

const EVENT: EventMediaRequest = {
  game: "cs2",
  name: "Intel Extreme Masters Katowice",
  edition: "2026",
  venue: "Spodek",
  city: "Katowice",
};

const photoInfo = (extra: Record<string, unknown> = {}) => ({
  width: 4000,
  height: 2250,
  thumbwidth: 1280,
  thumburl:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Spodek_IEM.jpg/1280px-Spodek_IEM.jpg?utm_source=commons&utm_campaign=filepath",
  url: "https://upload.wikimedia.org/wikipedia/commons/a/ab/Spodek_IEM.jpg",
  extmetadata: {
    LicenseShortName: { value: "CC BY 2.0" },
    LicenseUrl: { value: "https://creativecommons.org/licenses/by/2.0" },
    AttributionRequired: { value: "true" },
    Artist: { value: '<a href="//commons.wikimedia.org/wiki/User:Someone">Someone</a>' },
    Restrictions: { value: "" },
    ...extra,
  },
});
const photoPage = (extra: Record<string, unknown> = {}) => ({
  ns: 6,
  title: "File:Spodek IEM.jpg",
  imageinfo: [photoInfo(extra)],
});
const search = (...pages: unknown[]) => ({ query: { pages } });

test("the forbidden media hosts cannot reach a renderer through any resolver", () => {
  for (const blocked of [
    "https://liquipedia.net/commons/images/thumb/a/iem.png",
    "https://api.liquipedia.net/commons/images/a/iem.png",
    "https://cdn.pandascore.co/images/tournament/image/799px-cct_2024_europe_allmode-png.png",
    "https://zsr.octane.gg/events/rlcs.png",
    "http://upload.wikimedia.org/wikipedia/commons/a/ab/Spodek.jpg",
    "https://user:pass@upload.wikimedia.org/wikipedia/commons/a/ab/Spodek.jpg",
    "https://upload.wikimedia.org:8443/wikipedia/commons/a/ab/Spodek.jpg",
    "https://evil.example/wikipedia/commons/a/ab/Spodek.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/a/ab/Spodek.exe",
    "not a url",
    "",
  ])
    assert.equal(approvedEventMedia(blocked), "", blocked);
});

test("Commons campaign parameters survive verbatim rather than being stripped", () => {
  const href = photoInfo().thumburl;
  assert.equal(approvedEventMedia(href), href);
  assert.match(approvedEventMedia(href), /utm_source=commons&utm_campaign=filepath$/);
});

test("every title resolves publisher art, so no hero can paint blank", () => {
  for (const game of ["cs2", "dota2", "lol", "valorant", "rocketleague"] as const) {
    const art = esportsEventGameArt(game);
    assert.ok(art.url, game);
    assert.equal(approvedEventMedia(art.url), art.url, game);
  }
  assert.match(esportsEventGameArt("cs2").fallback || "", /apps\/730\/header\.jpg$/);
  assert.equal(esportsEventGameArt("lol").fallback, undefined);
});

test("a licensed landscape photograph wins the hero and reports its credit", async () => {
  const urls: string[] = [];
  const photo = await commonsEventPhoto(EVENT, async (url) => {
    urls.push(url);
    return search(
      { ns: 6, title: "File:IEM logo.svg", imageinfo: [photoInfo()] },
      { ...photoPage(), title: "File:Spodek portrait.jpg", imageinfo: [{ ...photoInfo(), width: 900, height: 1600 }] },
      photoPage(),
    );
  });
  assert.equal(photo?.url, photoInfo().thumburl);
  assert.equal(photo?.licence, "CC BY 2.0");
  assert.equal(photo?.attribution, "Someone");
  assert.equal(photo?.attributionRequired, true);
  assert.equal(photo?.width, 1280);
  assert.equal(photo?.sourceUrl, "https://commons.wikimedia.org/wiki/File%3ASpodek_IEM.jpg");
  // The venue search answers first, so the event-name search is never issued.
  assert.equal(urls.length, 1);
  assert.match(urls[0], /gsrsearch=filetype%3Abitmap\+Spodek\+Katowice/);
  assert.match(urls[0], /iiextmetadatafilter=.*AttributionRequired/);
});

test("restricted, non-free and uncreditable files are rejected, not shown uncredited", async () => {
  for (const extra of [
    { Restrictions: { value: "trademarked" } },
    { LicenseShortName: { value: "Fair use" } },
    { LicenseShortName: { value: "All rights reserved" } },
    { Artist: { value: "" }, Credit: { value: "" } },
  ]) {
    let calls = 0;
    const photo = await commonsEventPhoto(EVENT, async () => {
      calls++;
      return search(photoPage(extra));
    });
    assert.equal(photo, null, JSON.stringify(extra));
    // Both terms are tried before giving up, and neither produced an image.
    assert.equal(calls, 2);
  }
});

test("an unapproved image host in a licensed Commons record still rejects", async () => {
  const photo = await commonsEventPhoto(EVENT, async () =>
    search({
      ns: 6,
      title: "File:Spodek IEM.jpg",
      imageinfo: [{ ...photoInfo(), thumburl: "https://liquipedia.net/commons/images/a/iem.jpg", url: "" }],
    }),
  );
  assert.equal(photo, null);
});

test("a Wikidata namesake can never supply an event logo", async () => {
  let calls = 0;
  const logo = await wikidataEventLogo({ ...EVENT, name: "Katowice" }, async () => {
    calls++;
    return { search: [{ id: "Q123", label: "Katowice Airport" }] };
  });
  assert.equal(logo, null);
  assert.equal(calls, 1);
});

test("P154 resolves through the same licence gate as the photograph", async () => {
  const urls: string[] = [];
  const logo = await wikidataEventLogo({ ...EVENT, wikidataId: "Q7719" }, async (url) => {
    urls.push(url);
    if (url.includes("EntityData"))
      return {
        entities: {
          Q7719: { claims: { P154: [{ mainsnak: { datavalue: { value: "Ti-logo-copy.png" } } }] } },
        },
      };
    return search({
      ns: 6,
      title: "File:Ti-logo-copy.png",
      imageinfo: [
        {
          ...photoInfo(),
          thumburl: "https://upload.wikimedia.org/wikipedia/commons/a/ab/Ti-logo-copy.png",
          extmetadata: {
            LicenseShortName: { value: "CC BY-SA 4.0" },
            AttributionRequired: { value: "false" },
            Restrictions: { value: "" },
          },
        },
      ],
    });
  });
  assert.equal(logo?.licence, "CC BY-SA 4.0");
  assert.equal(logo?.attributionRequired, false);
  // An explicit entity id skips the search entirely.
  assert.equal(urls.length, 2);
  assert.match(urls[0], /Special:EntityData\/Q7719\.json$/);
  assert.match(urls[1], /titles=File%3ATi-logo-copy\.png/);
});

test("the hero still resolves when every licensed source fails", async () => {
  const hero = await resolveEventHero(EVENT, async () => {
    throw new Error("Commons is unavailable");
  });
  assert.equal(hero.photo, undefined);
  assert.equal(hero.logo, undefined);
  assert.deepEqual(hero.credits, []);
  assert.equal(hero.art.url, esportsEventGameArt("cs2").url);
});

test("a required credit reaches the hero exactly once", async () => {
  const hero = await resolveEventHero(EVENT, async (url) =>
    url.includes("commons.wikimedia") ? search(photoPage()) : { search: [] },
  );
  assert.deepEqual(hero.credits, ["Someone (CC BY 2.0)"]);
  assert.ok(hero.photo?.url);
});

const PLAYLIST = "PLDaLNkCsG9WlOtMEcefvymoa0Ufw8pStZ";
const feed = (entries: string) =>
  `<?xml version="1.0"?><feed xmlns:yt="http://www.youtube.com/xml/schemas/2015">` +
  `<yt:playlistId>${PLAYLIST}</yt:playlistId><title>IEM Rio Major 2022</title>${entries}</feed>`;
const entry = (id: string, title: string, published: string, author?: string) =>
  `<entry><yt:videoId>${id}</yt:videoId><yt:channelId>UC${id}</yt:channelId>` +
  `<title>${title}</title><published>${published}</published>` +
  (author ? `<author><name>${author}</name></author>` : "") +
  `</entry>`;

test("playlist entries from different channels are all kept", () => {
  const videos = parseEventPlaylistFeed(
    feed(
      entry("aaaaaaaaaaa", "Grand Final Highlights", "2026-02-01T10:00:00+00:00", "ESL CS") +
        entry("bbbbbbbbbbb", "Full Match: Map 2 &amp; Overtime", "2026-02-02T10:00:00+00:00", "BLAST"),
    ),
    PLAYLIST,
  );
  assert.deepEqual(
    videos.map((video) => [video.id, video.channel, video.kind]),
    [
      ["bbbbbbbbbbb", "BLAST", "vod"],
      ["aaaaaaaaaaa", "ESL CS", "highlight"],
    ],
  );
  assert.equal(videos[0].title, "Full Match: Map 2 & Overtime");
  assert.equal(videos[0].url, "https://www.youtube.com/watch?v=bbbbbbbbbbb");
  assert.equal(videos[0].image, "https://i.ytimg.com/vi/bbbbbbbbbbb/maxresdefault.jpg");
  assert.equal(videos[0].imageFallback, "https://i.ytimg.com/vi/bbbbbbbbbbb/hqdefault.jpg");
});

test("the playlist feed caps at fifteen entries and falls back to the feed title", () => {
  const many = Array.from({ length: 20 }, (_value, index) =>
    entry(`vid${String(index).padStart(8, "0")}`, `Group Stage ${index}`, "2026-02-01T10:00:00Z"),
  ).join("");
  const videos = parseEventPlaylistFeed(feed(many), PLAYLIST);
  assert.equal(videos.length, 15);
  assert.equal(videos[0].channel, "IEM Rio Major 2022");
  assert.equal(videos[0].kind, "video");
});

test("a hostile, mismatched or unparseable feed produces nothing", () => {
  assert.deepEqual(
    parseEventPlaylistFeed(`<!DOCTYPE feed><feed>${entry("aaaaaaaaaaa", "x", "2026-01-01Z")}</feed>`, PLAYLIST),
    [],
  );
  assert.deepEqual(parseEventPlaylistFeed(feed(entry("aaaaaaaaaaa", "x", "2026-02-01T10:00:00Z")), "PLother1234567890"), []);
  assert.deepEqual(parseEventPlaylistFeed("<rss></rss>", PLAYLIST), []);
  assert.deepEqual(parseEventPlaylistFeed(feed(entry("short", "x", "2026-02-01T10:00:00Z")), PLAYLIST), []);
  assert.deepEqual(parseEventPlaylistFeed(feed(entry("aaaaaaaaaaa", "x", "not a date")), PLAYLIST), []);
  assert.equal(eventPlaylistFeedUrl("javascript:alert(1)"), "");
  assert.equal(
    eventPlaylistFeedUrl(PLAYLIST),
    `https://www.youtube.com/feeds/videos.xml?playlist_id=${PLAYLIST}`,
  );
});

test("an absent playlist id is an empty wall, not a request or an error", async () => {
  let calls = 0;
  assert.deepEqual(
    await fetchEventVideos(EVENT, async () => {
      calls++;
      return "";
    }),
    [],
  );
  assert.equal(calls, 0);
  assert.deepEqual(
    await fetchEventVideos({ ...EVENT, youtubePlaylistId: PLAYLIST }, async () => {
      throw new Error("offline");
    }),
    [],
  );
});

test("CS2 map names join the in-tree radar catalog by exact string", () => {
  const maps = eventMapArt("cs2", ["Dust II", "Mirage", "de_nuke", "Dust II"]);
  assert.deepEqual(
    maps.map((map) => [map.id, map.name, map.matched]),
    [
      ["de_dust2", "Dust II", true],
      ["de_mirage", "Mirage", true],
      ["de_nuke", "Nuke", true],
    ],
  );
  assert.match(maps[0].url, /^https:\/\/raw\.githubusercontent\.com\/.*de_dust2_radar_psd\.png$/);
  assert.match(maps[0].fallback || "", /^https:\/\/cdn\.jsdelivr\.net\//);
  assert.equal(maps[0].sourceLabel, "Valve radar · asset source");
});

test("an unknown map name paints publisher art rather than a hole", () => {
  const maps = eventMapArt("cs2", ["de_retired_workshop_map", ""]);
  assert.equal(maps.length, 1);
  assert.equal(maps[0].matched, false);
  assert.equal(maps[0].url, esportsEventGameArt("cs2").url);
  assert.ok(maps[0].url);
});

test("Dota map art comes from the dota key while the feed union says dota2", () => {
  const maps = eventMapArt("dota2", ["Dota 2 · 7.40"]);
  assert.equal(maps[0].matched, true);
  assert.match(maps[0].url, /^https:\/\/www\.opendota\.com\//);
});

const VALORANT_MAPS = {
  data: [
    {
      uuid: "7eaecc1b-4337-bbf6-6ab9-04b8f06b3319",
      displayName: "Ascent",
      mapUrl: "/Game/Maps/Ascent/Ascent",
      splash: "https://media.valorant-api.com/maps/7eaecc1b-4337-bbf6-6ab9-04b8f06b3319/splash.png",
    },
    {
      uuid: "d960549e-485c-e861-8d71-aa9d1aed12a2",
      displayName: "Split",
      mapUrl: "/Game/Maps/Bonsai/Bonsai",
      splash: "https://media.valorant-api.com/maps/d960549e-485c-e861-8d71-aa9d1aed12a2/splash.png",
    },
    {
      uuid: "ee613ee9-28b7-4beb-9666-08db13bb2244",
      displayName: "The Range",
      mapUrl: "/Game/Maps/Poveglia/Range",
      splash: "https://media.valorant-api.com/maps/ee613ee9-28b7-4beb-9666-08db13bb2244/splash.png",
    },
    {
      uuid: "ada4e3b9-b5f0-7b23-c41c-7e9f4b1ddc3e",
      displayName: "The Range",
      mapUrl: "/Game/Maps/Range2/Range2",
      splash: "",
    },
  ],
};

test("the VALORANT codename table translates Riot names and never keys on displayName", async () => {
  resetEventMediaCaches();
  let calls = 0;
  const read = async () => {
    calls++;
    return VALORANT_MAPS;
  };
  const index = await valorantMapIndex(read);
  assert.equal(index.byCodename.bonsai, "Split");
  assert.equal(index.byCodename.ascent, "Ascent");
  // Both "The Range" rows survive because the index is keyed on uuid.
  assert.equal(Object.keys(index.byUuid).length, 4);
  assert.equal(index.byUuid["ada4e3b9-b5f0-7b23-c41c-7e9f4b1ddc3e"].name, "The Range");
  // A second reader never issues a second request.
  await valorantMapIndex(async () => {
    throw new Error("the index is cached");
  });
  assert.equal(calls, 1);
});

test("Riot codenames reach map art, and the measured seed works with no fetch", () => {
  assert.equal(valorantMapName("Bonsai"), "Split");
  assert.equal(valorantMapName("Triad"), "Haven");
  assert.equal(valorantMapName("Duality"), "Bind");
  assert.equal(valorantMapName("Ascent"), "Ascent");
  assert.equal(valorantMapName(""), "");
  const maps = eventMapArt("valorant", ["Canyon", "Port"]);
  assert.deepEqual(
    maps.map((map) => [map.name, map.matched]),
    [
      ["Fracture", true],
      ["Icebox", true],
    ],
  );
  assert.match(maps[0].url, /^https:\/\/cmsassets\.rgpub\.io\//);
});

test("a failed VALORANT table still returns the measured seed", async () => {
  resetEventMediaCaches();
  const index = await valorantMapIndex(async () => {
    throw new Error("valorant-api is unavailable");
  });
  assert.equal(index.byCodename.foxtrot, "Breeze");
  assert.deepEqual(index.byUuid, {});
  assert.equal(index.at, 0);
});

test("Data Dragon champion ids match Riot's irregular spellings", () => {
  for (const [input, expected] of [
    ["Wukong", "MonkeyKing"],
    ["MonkeyKing", "MonkeyKing"],
    ["Kai'Sa", "Kaisa"],
    ["Cho'Gath", "Chogath"],
    ["Rek'Sai", "RekSai"],
    ["Nunu & Willump", "Nunu"],
    ["Jarvan IV", "JarvanIV"],
    ["Renata Glasc", "Renata"],
    ["Aurelion Sol", "AurelionSol"],
    ["Lee Sin", "LeeSin"],
    ["TwistedFate", "TwistedFate"],
    ["ahri", "Ahri"],
  ] as const)
    assert.equal(dataDragonChampionId(input), expected, input);
});

test("champion splash carries no version segment while the square portrait does", () => {
  const splash = lolChampionArt("Wukong");
  assert.equal(
    splash.url,
    "https://ddragon.leagueoflegends.com/cdn/img/champion/splash/MonkeyKing_0.jpg",
  );
  assert.match(splash.fallback || "", /\/cdn\/16\.\d+\.\d+\/img\/champion\/MonkeyKing\.png$/);
  assert.equal(
    lolChampionArt("Ahri", "square", "16.19.1").url,
    "https://ddragon.leagueoflegends.com/cdn/16.19.1/img/champion/Ahri.png",
  );
  assert.match(lolChampionArt("Ahri", "loading").url, /\/cdn\/img\/champion\/loading\/Ahri_0\.jpg$/);
  // A name that cannot form an id still paints the publisher backdrop.
  assert.equal(lolChampionArt("###").url, esportsEventGameArt("lol").url);
});

test("VALORANT agent art joins on uuid and degrades to publisher art", async () => {
  resetEventMediaCaches();
  const index = await valorantAgentIndex(async () => ({
    data: [
      { uuid: "add6443a-41bd-e414-f6ad-e58d267f4e95", displayName: "Jett", isPlayableCharacter: true },
      { uuid: "ded3520f-4264-bfed-162d-b080e2abccf9", displayName: "Sova", isPlayableCharacter: true },
    ],
  }));
  assert.equal(index.jett.uuid, "add6443a-41bd-e414-f6ad-e58d267f4e95");
  const jett = valorantAgentArt("Jett", index);
  assert.equal(
    jett.url,
    "https://media.valorant-api.com/agents/add6443a-41bd-e414-f6ad-e58d267f4e95/fullportrait.png",
  );
  assert.match(jett.fallback || "", /\/displayicon\.png$/);
  const unknown = valorantAgentArt("Nobody", index);
  assert.equal(unknown.url, esportsEventGameArt("valorant").url);
  assert.equal(valorantAgentArt("Jett").url, esportsEventGameArt("valorant").url);
});

test("Dota hero ids follow Valve's internal names, not the published ones", () => {
  for (const [input, expected] of [
    ["Anti-Mage", "antimage"],
    ["Nature's Prophet", "furion"],
    ["Queen of Pain", "queenofpain"],
    ["Outworld Destroyer", "obsidian_destroyer"],
    ["Wraith King", "skeleton_king"],
    ["Io", "wisp"],
    ["Zeus", "zuus"],
    ["Crystal Maiden", "crystal_maiden"],
    ["Keeper of the Light", "keeper_of_the_light"],
    ["npc_dota_hero_monkey_king", "monkey_king"],
    ["Monkey King", "monkey_king"],
  ] as const)
    assert.equal(dotaHeroId(input), expected, input);
});

test("Dota hero art hotlinks the Steam CDN with a publisher backdrop behind it", () => {
  const art = dotaHeroArt("Anti-Mage");
  assert.equal(
    art.url,
    "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/antimage.png",
  );
  assert.match(art.fallback || "", /\/heroes\/icons\/antimage\.png$/);
  assert.equal(dotaHeroArt("###").url, esportsEventGameArt("dota2").url);
});
