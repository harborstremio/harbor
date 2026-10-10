import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import {
  DEEZER_KING_VON_SEARCH,
  YTM_KING_VON_FLAGSHIP,
  YTM_KING_VON_IMPOSTOR,
  YTM_KING_VON_SMALL,
} from "./fixtures/deezer-king-von";
import {
  DEEZER_AMR_DIAB,
  DEEZER_DRAKE,
  DEEZER_JOHN_WILLIAMS,
  DEEZER_MAKAN,
} from "./fixtures/deezer-namesakes";

type Authority = typeof import("../src/lib/music/artist-authority.ts");
type Popularity = typeof import("../src/lib/music/artist-popularity.ts");

const EXACT = [
  "deezer:artist:222422125",
  "deezer:artist:115195732",
  "deezer:artist:119988042",
  "deezer:artist:12431462",
];

function build(modules: Record<string, any>, key: string, file: string) {
  const input = readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");
  const output = ts.transpileModule(input, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", output)(
    (name: string) => {
      assert.ok(name in modules, name);
      return modules[name];
    },
    module,
    module.exports,
  );
  modules[key] = module.exports;
  return module.exports;
}

function harness(payloads: (url: string) => unknown, top?: (ref: any) => Promise<any[]>) {
  const calls: string[] = [];
  const modules: Record<string, any> = {
    "@/lib/debug": { dwarn: () => {} },
    "@/lib/safe-fetch": {
      safeFetch: async (url: string) => {
        calls.push(url);
        return { ok: true, json: async () => payloads(url) };
      },
    },
  };
  build(modules, "@/lib/cache", "lib/cache.ts");
  build(modules, "./search-normalize", "lib/music/search-normalize.ts");
  build(modules, "./artist-recording-match", "lib/music/artist-recording-match.ts");
  modules["./catalog"] = { artistTop: top ?? (async () => []) };
  modules["@/lib/progressive-rows"] = { withTimeout: (promise: Promise<unknown>) => promise };
  const popularity = build(
    modules,
    "./artist-popularity",
    "lib/music/artist-popularity.ts",
  ) as Popularity;
  const authority = build(
    modules,
    "./artist-authority",
    "lib/music/artist-authority.ts",
  ) as Authority;
  return { authority, popularity, calls };
}

function offline() {
  const calls: string[] = [];
  const modules: Record<string, any> = {
    "@/lib/debug": { dwarn: () => {} },
    "@/lib/safe-fetch": {
      safeFetch: async (url: string) => {
        calls.push(url);
        throw new Error("offline");
      },
    },
  };
  build(modules, "@/lib/cache", "lib/cache.ts");
  build(modules, "./search-normalize", "lib/music/search-normalize.ts");
  build(modules, "./artist-popularity", "lib/music/artist-popularity.ts");
  const authority = build(
    modules,
    "./artist-authority",
    "lib/music/artist-authority.ts",
  ) as Authority;
  return { authority, calls };
}

function jump(minutes: number) {
  const real = Date.now;
  Date.now = () => real() + minutes * 60_000;
  return () => {
    Date.now = real;
  };
}

const kingVon = () => harness(() => DEEZER_KING_VON_SEARCH);

test("a later search ref joins the dock's canonical artist only with shared recordings", async () => {
  const tracks = [{ title: "2 Phones", artist: "Kevin Gates", durationSeconds: 240 }, { title: "Really Really", artist: "Kevin Gates", durationSeconds: 233 }];
  const { authority } = harness(() => ({ data: [{ id: 123, name: "Kevin Gates", nb_fan: 697654 }] }),
    async (ref) => ref.id === "other-person" ? [{ title: "Unrelated", artist: "Kevin Gates", durationSeconds: 100 }] : tracks);
  const dock = await authority.resolveArtist("Kevin Gates");
  const search = await authority.identityForRef({ id: "youtube-kevin", connectorId: "youtube", name: "Kevin Gates" });
  assert.equal(search.id, dock.canonical?.id);
  const namesake = await authority.identityForRef({ id: "other-person", connectorId: "youtube", name: "Kevin Gates" });
  assert.equal(namesake.id, "other-person");
});

const ytm = (subtitle: string) => ({
  id: "UCkingvonchannel00000001",
  connectorId: "youtube",
  name: "King Von",
  subtitle,
});

test("the real King Von wins through the real chain, not Deezer result order", async () => {
  const { authority, calls } = kingVon();
  const ranking = await authority.resolveArtist("King Von");
  const ids = ranking.clusters.flatMap((cluster) => cluster.members.map((member) => member.id));
  assert.deepEqual([...ids].sort(), [...EXACT].sort());
  assert.equal(ids.length, 4);
  assert.equal(ranking.canonical?.id, "deezer:artist:12431462");
  assert.equal(ranking.ambiguous, false);
  assert.equal(ranking.measured, true);
  assert.ok(ranking.clusters[0].decades > 3, `decades ${ranking.clusters[0].decades}`);
  assert.equal(calls.length, 1);
  assert.ok(!calls.some((url) => url.includes("musicbrainz.org")));
});

test("a flagship YouTube channel folds onto the dominant Deezer record and carries its caption", async () => {
  const { authority, popularity } = kingVon();
  const ranking = await authority.resolveArtist("King Von", { hint: [ytm(YTM_KING_VON_FLAGSHIP)] });
  assert.equal(ranking.canonical?.id, "deezer:artist:12431462");
  assert.equal(ranking.clusters.length, 4);
  assert.equal(ranking.clusters[0].folded, true);
  assert.equal(ranking.clusters[0].flagship, true);
  assert.equal(ranking.clusters[0].members.length, 2);
  const caption = popularity.captionFor(ranking.clusters[0], "Deezer fans", "en");
  assert.ok(caption.includes("21.6M"), caption);
});

test("a tier one YouTube namesake never folds, however small it is", async () => {
  for (const subtitle of [YTM_KING_VON_IMPOSTOR, YTM_KING_VON_SMALL]) {
    const { authority, popularity } = kingVon();
    const ranking = await authority.resolveArtist("King Von", { hint: [ytm(subtitle)] });
    assert.equal(ranking.clusters.length, 5);
    assert.equal(ranking.clusters[0].folded, false);
    assert.equal(ranking.canonical?.id, "deezer:artist:12431462");
    assert.ok(ranking.clusters.some((cluster) => cluster.lead.connectorId === "youtube"));
    const caption = popularity.captionFor(ranking.clusters[0], "Deezer fans", "en");
    assert.equal(caption, `${(306176).toLocaleString("en")} Deezer fans`);
  }
});

test("the wordings YouTube actually sends parse into the right tier", () => {
  const { popularity } = kingVon();
  assert.deepEqual(popularity.parseAudience(YTM_KING_VON_FLAGSHIP), {
    value: 21600000,
    unit: "monthlyAudience",
    tier: 2,
  });
  assert.deepEqual(popularity.parseAudience(YTM_KING_VON_IMPOSTOR), {
    value: 1940,
    unit: "subscribers",
    tier: 1,
  });
  assert.deepEqual(popularity.parseAudience(YTM_KING_VON_SMALL), {
    value: 65,
    unit: "subscribers",
    tier: 1,
  });
  assert.deepEqual(popularity.parseAudience("1,236,341 listens"), {
    value: 1236341,
    unit: "listens",
    tier: 1,
  });
  assert.equal(popularity.parseAudience("#3"), null);
  assert.equal(popularity.audienceValue(YTM_KING_VON_FLAGSHIP), 21600000);
  assert.equal(popularity.audienceValue(undefined), 0);
});

test("two records from one connector never fold, however far apart their audiences are", () => {
  const { popularity } = kingVon();
  const candidate = (id: string, metric: number, index: number) => ({
    id,
    connectorId: "catalog",
    name: "King Von",
    sourceId: "catalog",
    metric,
    tier: 2 as const,
    albums: 0,
    index,
  });
  const ranking = popularity.rankArtistCandidates([
    candidate("deezer:artist:222422125", 53, 0),
    candidate("deezer:artist:12431462", 306176, 1),
  ]);
  assert.equal(ranking.clusters.length, 2);
  assert.equal(ranking.clusters[0].folded, false);
  assert.equal(ranking.canonical?.id, "deezer:artist:12431462");
});

test("a click on a junk namesake opens the record that dominates its own source", async () => {
  const { authority } = kingVon();
  const junk = { id: "deezer:artist:222422125", connectorId: "catalog", name: "King Von" };
  const resolved = await authority.identityForRef(junk);
  assert.equal(resolved.id, "deezer:artist:12431462");
  assert.ok(resolved.artwork);
});

test("a namesake with an audience of its own is never swapped for the bigger name", async () => {
  const { authority } = harness(() => DEEZER_JOHN_WILLIAMS);
  const guitarist = { id: "deezer:artist:5604436", connectorId: "catalog", name: "John Williams" };
  const resolved = await authority.identityForRef(guitarist);
  assert.equal(resolved.id, "deezer:artist:5604436");
  assert.ok(resolved.artwork);
  const composer = await authority.identityForRef({
    id: "deezer:artist:805",
    connectorId: "catalog",
    name: "John Williams",
  });
  assert.equal(composer.id, "deezer:artist:805");
});

test("priming from refs that carry no audience never silences the probe", async () => {
  const { authority, calls } = kingVon();
  authority.primeArtistCandidates("king von", [
    { id: "deezer:artist:222422125", connectorId: "catalog", name: "King Von" },
    { id: "deezer:artist:115195732", connectorId: "catalog", name: "King Von" },
  ]);
  assert.equal(calls.length, 0);
  assert.equal(authority.peekArtistIdentity("King Von").probed, false);
  const ranking = await authority.resolveArtist("King Von");
  assert.equal(calls.length, 1);
  assert.equal(ranking.canonical?.id, "deezer:artist:12431462");
  assert.equal(ranking.measured, true);
  assert.equal(authority.peekArtistIdentity("King Von").probed, true);
});

test("a search for one name never decides another name", async () => {
  const { authority, calls } = harness(() => DEEZER_DRAKE);
  authority.primeArtistCandidates("drake", [
    { id: "deezer:artist:67927442", connectorId: "catalog", name: "Drake" },
    { id: "deezer:artist:67926762", connectorId: "catalog", name: "Drake" },
    {
      id: "UCimpostor000000000000001",
      connectorId: "youtube",
      name: "Drake",
      subtitle: YTM_KING_VON_IMPOSTOR,
    },
  ]);
  const ranking = await authority.resolveArtist("Drake");
  assert.equal(calls.length, 1);
  assert.equal(ranking.canonical?.id, "deezer:artist:246791");
});

test("an unreachable probe is retried, a measured one is not", async () => {
  const dark = offline();
  const first = await dark.authority.resolveArtist("King Von");
  assert.equal(dark.calls.length, 1);
  assert.equal(first.measured, false);
  let restore = jump(6);
  await dark.authority.resolveArtist("King Von");
  restore();
  assert.equal(dark.calls.length, 2);
  const live = kingVon();
  await live.authority.resolveArtist("King Von");
  restore = jump(6);
  const warm = await live.authority.resolveArtist("King Von");
  restore();
  assert.equal(live.calls.length, 1);
  assert.equal(warm.canonical?.id, "deezer:artist:12431462");
});

test("a search that answers with a single artist is an identity, a crowd is not", async () => {
  const single = harness(() => DEEZER_AMR_DIAB);
  const diab = await single.authority.resolveArtist("عمرو دياب");
  assert.equal(single.calls.length, 1);
  assert.equal(diab.canonical?.id, "deezer:artist:99345");
  assert.equal(diab.measured, true);
  const crowd = harness(() => DEEZER_MAKAN);
  const makan = await crowd.authority.resolveArtist("Макан");
  assert.equal(makan.canonical, null);
  assert.equal(makan.measured, false);
});

test("a ref the caller already held is measured by the probe, never demoted below it", async () => {
  const { authority } = harness(() => DEEZER_DRAKE);
  const held = { id: "deezer:artist:246791", connectorId: "catalog", name: "Drake" };
  const ranking = await authority.resolveArtist("Drake", { hint: [held] });
  assert.equal(ranking.canonical?.id, "deezer:artist:246791");
  assert.equal(ranking.clusters[0].members[0].metric, 24081631);
  assert.equal(ranking.clusters.length, 4);
});

test("a topic channel probes under the artist name, not the channel title", async () => {
  const { authority, calls } = kingVon();
  const ranking = await authority.resolveArtist("King Von - Topic");
  assert.ok(calls[0].includes("q=King%20Von&"), calls[0]);
  assert.equal(ranking.canonical?.id, "deezer:artist:12431462");
});

test("an unmeasured set is returned untouched rather than silently re-pointed", async () => {
  const { authority } = harness(() => ({ data: [] }));
  const ref = { id: "UCunknown0000000000000001", connectorId: "youtube", name: "Nobody At All" };
  assert.equal(await authority.identityForRef(ref), ref);
});

test("concurrent resolutions of one name share a single request", async () => {
  const { authority, calls } = kingVon();
  const [first, second] = await Promise.all([
    authority.resolveArtist("King Von"),
    authority.resolveArtist("King Von"),
  ]);
  assert.equal(calls.length, 1);
  assert.equal(first.canonical?.id, second.canonical?.id);
  const warm = await authority.resolveArtist("king von");
  assert.equal(calls.length, 1);
  assert.equal(warm.canonical?.id, "deezer:artist:12431462");
});

test("track narrowing fires only on an indecisive lead and stays inside two requests", async () => {
  const tie = DEEZER_KING_VON_SEARCH.data.slice(0, 2);
  const narrowed = {
    data: [{ title: "Crazy Story", artist: { id: 115195732, name: "King Von" } }],
  };
  const { authority, calls } = harness((url) =>
    url.includes("/search/artist?") ? { data: tie } : narrowed,
  );
  const track = {
    id: "deezer:track:1",
    connectorId: "catalog",
    title: "Crazy Story",
    artist: "King Von",
  };
  const ranking = await authority.resolveArtist("King Von", { track: track as never });
  assert.equal(calls.length, 2);
  assert.ok(calls[1].includes("/search?q="));
  assert.equal(ranking.canonical?.id, "deezer:artist:115195732");
  assert.ok(!calls.some((url) => url.includes("musicbrainz.org")));
});

test("the identity key folds a topic channel and never uses a locale lowercase", () => {
  const { popularity } = kingVon();
  assert.equal(popularity.artistIdentityKey("King Von - Topic"), "king von");
  assert.equal(popularity.artistIdentityKey("KING VON"), "king von");
  assert.equal(popularity.artistIdentityKey("ISTANBUL"), "istanbul");
});
