import assert from "node:assert/strict";
import test from "node:test";
import { identityMatches } from "../src/lib/media-server/index-store.ts";
import {
  candidateServerOrigins,
  normalizeServerOrigin,
} from "../src/lib/media-server/transport.ts";
import {
  dedupePhysicalEpisodeItems,
  groupMediaServerTitles,
  matchingServerEpisodes,
  matchingServerItems,
} from "../src/lib/media-server/selectors.ts";
import type { MediaServerItem } from "../src/lib/media-server/types.ts";
import {
  connectionQuality,
  qualityPreset,
  versionFitsQuality,
} from "../src/lib/media-server/quality.ts";
import { decidePlaybackSource } from "../src/lib/media-server/playback-policy.ts";

test("media identity prefers external IDs and isolates episodes", () => {
  assert.equal(identityMatches({ tmdbId: 42 }, { tmdbId: 42 }), true);
  assert.equal(identityMatches({ imdbId: "tt42" }, { imdbId: "tt42" }), true);
  assert.equal(
    identityMatches({ tvdbId: 42, season: 1, episode: 2 }, { tvdbId: 42, season: 1, episode: 3 }),
    false,
  );
  assert.equal(identityMatches({ tmdbId: 42 }, { tmdbId: 43 }), false);
});

test("configured origins discard credentials, paths, queries, and fragments", () => {
  assert.equal(
    normalizeServerOrigin("https://user:pass@example.test:8920/emby/?token=secret#x"),
    "https://example.test:8920/emby",
  );
  assert.throws(() => normalizeServerOrigin("file:///tmp/media"));
});

test("bare media-server hosts try schemes and provider default ports", () => {
  assert.deepEqual(candidateServerOrigins("home.local", "jellyfin"), [
    "http://home.local",
    "http://home.local:8096",
    "https://home.local",
    "https://home.local:8096",
  ]);
  assert.deepEqual(candidateServerOrigins("192.168.1.20:32400", "plex"), [
    "http://192.168.1.20:32400",
    "https://192.168.1.20:32400",
  ]);
});

const item = (patch: Partial<MediaServerItem>): MediaServerItem => ({
  id: "1",
  connectionId: "a",
  libraryId: "movies",
  kind: "movie",
  title: "Example",
  identity: { tmdbId: 42 },
  versions: [{ id: "v1", directPlayable: true }],
  updatedAt: 1,
  ...patch,
});

test("title selector collapses duplicate movies and never exposes seasons or episodes", () => {
  const titles = groupMediaServerTitles([
    item({}),
    item({ id: "2", connectionId: "b", versions: [{ id: "v2", directPlayable: true }] }),
    item({ id: "s", kind: "series", title: "Show", identity: { tvdbId: 7 }, versions: [] }),
    item({
      id: "season",
      kind: "season",
      title: "Season 1",
      identity: { tvdbId: 7 },
      versions: [],
    }),
    item({
      id: "ep",
      kind: "episode",
      title: "Pilot",
      identity: { tvdbId: 7, season: 1, episode: 1 },
      versions: [{ id: "ev", directPlayable: true }],
    }),
  ]);
  assert.equal(titles.length, 2);
  assert.equal(titles.find((title) => title.kind === "movie")?.connectionIds.length, 2);
  assert.equal(titles.find((title) => title.kind === "series")?.episodeCount, 1);
});

test("episode copy matching requires exact season and episode", () => {
  const episodes = [
    item({ kind: "episode", identity: { tmdbId: 8, season: 1, episode: 1 } }),
    item({ id: "2", kind: "episode", identity: { tmdbId: 8, season: 1, episode: 2 } }),
  ];
  assert.deepEqual(
    matchingServerItems(episodes, { tmdbId: 8 }, "series", 1, 2).map((entry) => entry.id),
    ["2"],
  );
});

test("episode matching prefers exact items, then falls back to filename spans", () => {
  const spanning = item({
    id: "span",
    kind: "episode",
    identity: { tmdbId: 8, season: 1, episode: 1, episodeEnd: 2 },
    versions: [
      {
        id: "physical",
        filename: "Show.S01E01-E02.mkv",
        season: 1,
        episode: 1,
        episodeEnd: 2,
        directPlayable: true,
      },
    ],
  });
  assert.deepEqual(
    matchingServerItems([spanning], { tmdbId: 8 }, "series", 1, 2).map((entry) => entry.id),
    ["span"],
  );
  const exact = item({
    id: "exact",
    kind: "episode",
    identity: { tmdbId: 8, season: 1, episode: 2 },
  });
  assert.deepEqual(
    matchingServerItems([spanning, exact], { tmdbId: 8 }, "series", 1, 2).map((entry) => entry.id),
    ["exact"],
  );
});

test("exact episode precedence is isolated to each home server", () => {
  const plexExact = item({
    id: "plex-exact",
    connectionId: "plex",
    kind: "episode",
    identity: { tmdbId: 8, season: 1, episode: 2 },
    versions: [{ id: "plex-part", directPlayable: true }],
  });
  const embySpan = item({
    id: "emby-span",
    connectionId: "emby",
    kind: "episode",
    identity: { tmdbId: 8, season: 1, episode: 1, episodeEnd: 2 },
    versions: [
      {
        id: "emby-part",
        filename: "Show.S01E01-E02.mkv",
        season: 1,
        episode: 1,
        episodeEnd: 2,
        directPlayable: true,
      },
    ],
  });
  const jellyfinSpan = item({
    id: "jellyfin-span",
    connectionId: "jellyfin",
    kind: "episode",
    identity: { tmdbId: 8, season: 1, episode: 1, episodeEnd: 2 },
    versions: [
      {
        id: "jellyfin-part",
        filename: "Show.S01E01-E02.mkv",
        season: 1,
        episode: 1,
        episodeEnd: 2,
        directPlayable: true,
      },
    ],
  });
  assert.deepEqual(
    matchingServerItems([plexExact, embySpan, jellyfinSpan], { tmdbId: 8 }, "series", 1, 2).map(
      (entry) => entry.id,
    ),
    ["plex-exact", "emby-span", "jellyfin-span"],
  );
});

test("duplicate logical server episodes collapse to one physical range", () => {
  const filename = "Show.S01E01-E02.mkv";
  const second = item({
    id: "e2",
    connectionId: "plex",
    kind: "episode",
    identity: { season: 1, episode: 2 },
    versions: [
      { id: "part-2", filename, season: 1, episode: 1, episodeEnd: 2, directPlayable: true },
    ],
  });
  const first = item({
    id: "e1",
    connectionId: "plex",
    kind: "episode",
    identity: { season: 1, episode: 1 },
    versions: [
      { id: "part-1", filename, season: 1, episode: 1, episodeEnd: 2, directPlayable: true },
    ],
  });
  assert.deepEqual(
    dedupePhysicalEpisodeItems([second, first]).map((entry) => entry.id),
    ["e1"],
  );
  assert.equal(dedupePhysicalEpisodeItems([first, { ...second, connectionId: "emby" }]).length, 2);
});

test("episode matching inherits the identity of its series parent", () => {
  const entries = [
    item({ id: "show", kind: "series", identity: { tmdbId: 8 } }),
    item({ id: "ep", kind: "episode", parentId: "show", identity: { season: 1, episode: 2 } }),
  ];
  assert.deepEqual(
    matchingServerItems(entries, { tmdbId: 8 }, "series", 1, 2).map((entry) => entry.id),
    ["ep"],
  );
  assert.deepEqual(
    matchingServerEpisodes(entries, { tmdbId: 8 }).map((entry) => entry.id),
    ["ep"],
  );
});

test("server matching accepts any shared external ID", () => {
  const entries = [item({ identity: { imdbId: "tt0042" } })];
  assert.deepEqual(
    matchingServerItems(entries, { tmdbId: 42, imdbId: "tt0042" }, "movie").map(
      (entry) => entry.id,
    ),
    ["1"],
  );
});

test("media server quality presets retain fitting originals and cap oversized media", () => {
  assert.equal(qualityPreset("720p-4").maxBitrateKbps, 4_000);
  assert.equal(
    versionFitsQuality(
      { id: "fit", directPlayable: true, height: 720, bitrateKbps: 3_900 },
      "720p-4",
    ),
    true,
  );
  assert.equal(
    versionFitsQuality(
      { id: "large", directPlayable: true, height: 1080, bitrateKbps: 8_000 },
      "720p-4",
    ),
    false,
  );
  assert.equal(
    versionFitsQuality(
      { id: "anything", directPlayable: true, height: 2160, bitrateKbps: 80_000 },
      "original",
    ),
    true,
  );
});

test("legacy remote bitrate migrates to a typed quality without changing new defaults", () => {
  assert.equal(
    connectionQuality({ preferredQuality: "original", remoteBitrateKbps: 4_000 }),
    "original",
  );
  assert.equal(
    connectionQuality({ preferredQuality: undefined as never, remoteBitrateKbps: 4_000 }),
    "720p-4",
  );
  assert.equal(connectionQuality({ preferredQuality: undefined as never }), "original");
});

const copy = (connectionId: string, versionId = "v1") => ({
  key: `${connectionId}:${versionId}`,
  category: "home-server" as const,
  label: versionId,
  sourceLabel: connectionId,
  connectionId,
  itemId: "item",
  version: { id: versionId, directPlayable: true },
});

test("shared playback policy never silently crosses source categories", () => {
  assert.deepEqual(
    decidePlaybackSource({ playbackSourcePreference: "local", preferredMediaServerId: null }, 0, [
      copy("a"),
    ]),
    { kind: "chooser", reason: "missing" },
  );
  assert.deepEqual(
    decidePlaybackSource({ playbackSourcePreference: "online", preferredMediaServerId: null }, 1, [
      copy("a"),
    ]),
    { kind: "online" },
  );
  assert.deepEqual(
    decidePlaybackSource(
      { playbackSourcePreference: "home-server", preferredMediaServerId: "b" },
      1,
      [copy("a")],
    ),
    { kind: "chooser", reason: "missing" },
  );
});

test("home-server policy auto-selects only one unambiguous copy", () => {
  assert.equal(
    decidePlaybackSource(
      { playbackSourcePreference: "home-server", preferredMediaServerId: null },
      0,
      [copy("a")],
    ).kind,
    "home-server",
  );
  assert.deepEqual(
    decidePlaybackSource(
      { playbackSourcePreference: "home-server", preferredMediaServerId: null },
      0,
      [copy("a"), copy("b")],
    ),
    { kind: "chooser", reason: "ambiguous" },
  );
  assert.deepEqual(
    decidePlaybackSource(
      { playbackSourcePreference: "home-server", preferredMediaServerId: "a" },
      0,
      [copy("a"), copy("a", "v2")],
    ),
    { kind: "chooser", reason: "ambiguous" },
  );
});
