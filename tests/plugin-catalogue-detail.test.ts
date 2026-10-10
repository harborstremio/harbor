import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalIdOf,
  capstanDetailFrom,
  capstanId,
  isCapstanId,
  loadCapstanDetail,
  parseCapstanId,
  titlesAgree,
} from "../src/lib/streams/plugins/extension/detail.ts";
import type { BridgeMedia } from "../src/lib/streams/plugins/extension/bridge.ts";

const media = (over: Partial<BridgeMedia> = {}): BridgeMedia => ({
  name: "Example Show",
  url: "https://provider.example/watch/1",
  type: "tvseries",
  year: 2019,
  playableData: null,
  episodes: [],
  ...over,
});

const build = (media: Partial<BridgeMedia> = {}, origin?: { id: string; name: string }) =>
  capstanDetailFrom(
    capstanId("ext/provider", "https://provider.example/watch/1"),
    "series",
    media as BridgeMedia,
    origin,
  );

test("a catalogue id carries its provider and url back out intact", () => {
  for (const [providerId, url] of [
    ["ext/provider", "https://provider.example/watch/1?id=2&x=a:b"],
    ["plugin:abc.def", "https://p.example/a/b/c?q=1:2:3#frag"],
    ["plain", "https://p.example/é/ünïcode"],
    ["ext/with:colon", "https://p.example/"],
  ] as Array<[string, string]>) {
    assert.deepEqual(parseCapstanId(capstanId(providerId, url)), { providerId, url });
  }
});

test("only a well formed catalogue id is claimed", () => {
  assert.ok(isCapstanId(capstanId("p", "https://x/")));
  for (const id of ["", "tt0133093", "tmdb:movie:603", "harbor-plugin://x", "capstan", "CAPSTAN:a:b"]) {
    assert.equal(isCapstanId(id), false, id);
    assert.equal(parseCapstanId(id), null, id);
  }
  assert.equal(parseCapstanId("capstan:"), null);
  assert.equal(parseCapstanId("capstan:provideronly"), null);
  assert.equal(parseCapstanId("capstan::https%3A%2F%2Fx%2F"), null);
});

test("the provider's answer becomes the item the detail page reads", () => {
  const { meta } = build({
    year: 2019,
    plot: "A plot.",
    posterUrl: "https://x/p.jpg",
    backgroundPosterUrl: "https://x/b.jpg",
    tags: ["Drama", "Mystery"],
    durationMinutes: 47,
    episodes: [{ data: "d1", name: "Pilot", season: 1, episode: 1, track: "" }],
  });
  assert.equal(meta.releaseInfo, "2019");
  assert.equal(meta.poster, "https://x/p.jpg");
  assert.equal(meta.background, "https://x/b.jpg");
  assert.equal(meta.description, "A plot.");
  assert.deepEqual(meta.genres, ["Drama", "Mystery"]);
  assert.equal(meta.runtime, "47 min");
  assert.deepEqual(meta.videos, [
    {
      season: 1,
      episode: 1,
      name: "Pilot",
      title: "Pilot",
      overview: undefined,
      description: undefined,
      thumbnail: undefined,
      runtime: undefined,
      released: undefined,
    },
  ]);
});

test("an episode keeps its own still, description and length", () => {
  const { meta } = build({
    episodes: [
      {
        data: "d1",
        name: "Pilot",
        season: 1,
        episode: 1,
        track: "",
        posterUrl: "https://x/e1.jpg",
        description: "Where it begins.",
        runtimeMinutes: 52,
      },
    ],
  });
  const [video] = meta.videos ?? [];
  assert.equal(video.thumbnail, "https://x/e1.jpg");
  assert.equal(video.overview, "Where it begins.");
  assert.equal(video.description, "Where it begins.");
  assert.equal(video.runtime, 52);
});

test("an episode date is read in whichever unit the provider used", () => {
  const asMillis = 1568000000000;
  const iso = new Date(asMillis).toISOString();
  for (const airDate of [asMillis, asMillis / 1000]) {
    const { meta } = build({
      episodes: [{ data: "d", name: null, season: 1, episode: 1, track: "", airDate }],
    });
    assert.equal(meta.videos?.[0].released, iso, String(airDate));
  }
  const { meta } = build({
    episodes: [{ data: "d", name: null, season: 1, episode: 1, track: "", airDate: 0 }],
  });
  assert.equal(meta.videos?.[0].released, undefined);
});

test("the provider's age rating is carried beside the item, not inside it", () => {
  assert.equal(build({ contentRating: "TV-14" }).contentRating, "TV-14");
  assert.equal(build({ contentRating: "  " }).contentRating, undefined);
  assert.equal(build().contentRating, undefined);
});

test("provider-declared actors become a name-only cast, cleaned and capped", () => {
  const { cast } = build({
    actors: ["Ada Lovelace", "  Ada Lovelace  ", "", "Grace Hopper", null as unknown as string],
  });
  assert.deepEqual(cast, ["Ada Lovelace", "Grace Hopper"]);
  const many = build({ actors: Array.from({ length: 40 }, (_, i) => `Actor ${i}`) });
  assert.equal(many.cast.length, 20);
  assert.deepEqual(build().cast, []);
});

test("a provider's recommendations are addressed the way its catalogue addresses them", () => {
  const origin = { id: "plugin:ext.provider", name: "Example" };
  const { recommendations } = build(
    {
      recommendations: [
        {
          name: "Another Show",
          url: "https://provider.example/watch/2",
          type: "tvseries",
          posterUrl: "https://x/r.jpg",
          quality: "1080p",
        },
        { name: "No url", url: "", type: null, posterUrl: null, quality: null },
        { name: "", url: "https://provider.example/watch/3", type: null, posterUrl: null, quality: null },
      ],
    },
    origin,
  );
  assert.equal(recommendations.length, 1);
  const [rec] = recommendations;
  assert.equal(rec.id, capstanId("ext/provider", "https://provider.example/watch/2"));
  assert.equal(rec.name, "Another Show");
  assert.equal(rec.type, "series");
  assert.equal(rec.poster, "https://x/r.jpg");
  assert.equal(rec.pluginQuality, "1080p");
  assert.deepEqual(rec.addonOrigin, origin);
  // Opening one lands on its own detail page, so the id has to parse back to this provider.
  assert.deepEqual(parseCapstanId(rec.id), {
    providerId: "ext/provider",
    url: "https://provider.example/watch/2",
  });
});

test("an unknown year and an empty episode list leave the fields out rather than faking them", () => {
  const { meta } = build({ year: null });
  assert.equal(meta.releaseInfo, undefined);
  assert.equal(meta.videos, undefined);
  assert.equal(meta.description, undefined);
  assert.equal(meta.genres, undefined);
  assert.equal(meta.runtime, undefined);
  assert.equal(build({ year: 0 }).meta.releaseInfo, undefined);
  assert.equal(build({ durationMinutes: 0 }).meta.runtime, undefined);
});

test("a provider numbering no episodes still yields a list rather than losing them", () => {
  const { meta } = build({
    episodes: [{ data: "d1", name: "One", season: null, episode: null, track: "" }],
  });
  assert.deepEqual(meta.videos?.[0], {
    season: undefined,
    episode: undefined,
    name: "One",
    title: "One",
    overview: undefined,
    description: undefined,
    thumbnail: undefined,
    runtime: undefined,
    released: undefined,
  });
});

test("loading without a live bridge answers nothing instead of throwing", async () => {
  assert.equal(await loadCapstanDetail("tt0133093", "movie"), null);
  assert.equal(await loadCapstanDetail("capstan:", "movie"), null);
  assert.equal(await loadCapstanDetail(capstanId("p", "https://x/1"), "movie"), null);
});

test("an id the rest of Harbor can resolve is taken only in a shape it accepts", () => {
  assert.equal(canonicalIdOf({ imdbId: "tt0903747" }, "series"), "tt0903747");
  assert.equal(canonicalIdOf({ tmdbId: "1396" }, "series"), "tmdb:tv:1396");
  assert.equal(canonicalIdOf({ tmdbId: "1396" }, "movie"), "tmdb:movie:1396");
  // A show declared as anime still resolves as television.
  assert.equal(canonicalIdOf({ tmdbId: "1396" }, "anime"), "tmdb:tv:1396");
  // IMDb wins when both are declared, because it resolves on either provider.
  assert.equal(canonicalIdOf({ imdbId: "tt0903747", tmdbId: "1396" }, "series"), "tt0903747");
  for (const bad of [
    undefined,
    null,
    {},
    { imdbId: "12345" },
    { imdbId: "tt12" },
    { imdbId: "nm0000123" },
    { tmdbId: "tt1396" },
    { tmdbId: "" },
    "tt0903747",
  ]) {
    assert.equal(canonicalIdOf(bad, "series"), null, JSON.stringify(bad));
  }
});

test("a declared id is refused when the record it points at is a different title", () => {
  assert.ok(titlesAgree("Breaking Bad", "Breaking Bad"));
  // Providers decorate names; the decoration is not a disagreement.
  assert.ok(titlesAgree("Breaking Bad (2008) [VO]", "Breaking Bad"));
  assert.ok(titlesAgree("Breaking Bad", "breaking bad"));
  // The real case: a row named after everything it carries still resolves to its title.
  assert.ok(
    titlesAgree(
      "Slow Horses (Season 1-6) [E02 Added] {English With Subtitles} [Hindi Subs] WeB-DL 720p 10Bit [300MB] || 1080p [1.5GB]",
      "Slow Horses",
    ),
  );
  assert.ok(titlesAgree("Slow Horses S01 1080p", "Slow Horses"));
  assert.ok(titlesAgree("Dune Part Two 2160p", "Dune: Part Two"));
  // A sequel must never pass as its predecessor, which a whole-title match is what prevents.
  assert.equal(titlesAgree("Dune", "Dune: Part Two"), false);
  assert.equal(titlesAgree("Breaking Bad", "Better Call Saul"), false);
  assert.equal(titlesAgree("Breaking Bad", undefined), false);
  assert.equal(titlesAgree("Breaking Bad", null), false);
  assert.equal(titlesAgree("", "Breaking Bad"), false);
});

test("the provider's own word for the kind outranks the catalogue's guess", () => {
  assert.equal(build({ type: "tvseries" }).kind, "series");
  assert.equal(build({ type: "movie" }).kind, "movie");
  assert.equal(build({ type: "anime" }).kind, "series");
  assert.equal(build({ type: "ova" }).kind, "series");
  assert.equal(build({ type: "cartoon" }).kind, "series");
  assert.equal(build({ type: "asiandrama" }).kind, "series");
  // An anime film is a film. The catalogue's own map reads this one as "anime", which is why the
  // pipeline's sets are the ones consulted here.
  assert.equal(build({ type: "animemovie" }).kind, "movie");
  assert.equal(build({ type: "documentary" }).kind, "movie");
});

test("a kind the provider does not name is settled by its episode list, then by the row", () => {
  // The provider named nothing recognisable and posted no episodes, so the row's word stands.
  assert.equal(build({ type: "" }).kind, "series");
  assert.equal(build({ type: "something-new" }).kind, "series");
  // An episode list settles it even when the row says otherwise.
  assert.equal(
    capstanDetailFrom(
      capstanId("p", "https://x/1"),
      "movie",
      media({ type: "", episodes: [{ data: "d", name: null, season: 1, episode: 1, track: "" }] }),
    ).kind,
    "series",
  );
  // With no episodes either, a row that asked for a movie keeps it a movie.
  assert.equal(
    capstanDetailFrom(capstanId("p", "https://x/1"), "movie", media({ type: "" })).kind,
    "movie",
  );
});

test("the provider's declared id rides along with the record it describes", () => {
  assert.equal(build({ syncIds: { imdbId: "tt0903747" } }).canonicalId, "tt0903747");
  assert.equal(build({ syncIds: { tmdbId: "1396" } }).canonicalId, "tmdb:tv:1396");
  assert.equal(build().canonicalId, null);
});
