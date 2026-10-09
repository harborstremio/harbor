import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const RELAY = "https://app.harbor.site";
const DISCORD_URL_LIMIT = 512;

function loadDeepLink() {
  const source = readFileSync(
    new URL("../src/lib/music/deep-link.ts", import.meta.url),
    "utf8",
  ).replace(/^import[^\n]+;\r?\n/gm, "");
  const { outputText } = ts.transpileModule(`const HARBOR_RELAY_BASE = "${RELAY}";\n${source}`, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;charset=utf-8,${encodeURIComponent(outputText)}`);
}

const deepLink = await loadDeepLink();
const musicTrackPath = deepLink.musicTrackPath as (a: string, t: string) => string;
const musicAlbumPath = deepLink.musicAlbumPath as (a: string, b: string) => string;
const musicArtistPath = deepLink.musicArtistPath as (a: string) => string;
const musicBounceUrl = deepLink.musicBounceUrl as (p: string) => string;
const musicDeepLinkUrl = deepLink.musicDeepLinkUrl as (p: string) => string;
const parseMusicDeepLink = deepLink.parseMusicDeepLink as (
  u: string,
) => { kind: string; artist: string; name?: string } | null;
const musicDeepLinkQuery = deepLink.musicDeepLinkQuery as (l: {
  artist: string;
  name?: string;
}) => string;

const presenceSource = readFileSync(
  new URL("../src/lib/discord/presence.ts", import.meta.url),
  "utf8",
);
const musicPresenceSource = readFileSync(
  new URL("../src/lib/music/presence.ts", import.meta.url),
  "utf8",
);

test("track, album and artist links round trip through the harbor scheme", () => {
  const track = parseMusicDeepLink(musicDeepLinkUrl(musicTrackPath("AC/DC", "Thunderstruck")));
  assert.deepEqual(track, { kind: "track", artist: "AC/DC", name: "Thunderstruck" });
  const album = parseMusicDeepLink(musicDeepLinkUrl(musicAlbumPath("AC/DC", "Back in Black")));
  assert.deepEqual(album, { kind: "album", artist: "AC/DC", name: "Back in Black" });
  const artist = parseMusicDeepLink(musicDeepLinkUrl(musicArtistPath("Фёдор Чистяков")));
  assert.deepEqual(artist, { kind: "artist", artist: "Фёдор Чистяков", name: undefined });
});

test("malformed and unknown music links parse to null", () => {
  assert.equal(parseMusicDeepLink("harbor://music/"), null);
  assert.equal(parseMusicDeepLink("harbor://music/playlist/x/y"), null);
  assert.equal(parseMusicDeepLink("harbor://music/track//Thunderstruck"), null);
  assert.equal(parseMusicDeepLink("harbor://detail/movie/tt0111161"), null);
  assert.equal(parseMusicDeepLink(musicDeepLinkUrl("track/%E0%A4/x")), null);
});

test("bounce urls stay inside the discord link budget for every script", () => {
  const cases: Array<[string, string]> = [
    ["Fairuz", "فيروز و الأطفال يغنون لبيروت في حفلة الأعياد الكبرى"],
    ["Гражданская оборона", "Всё идёт по плану на большом концерте"],
    ["米津玄師", "パプリカ 🎵 フルバージョン 特別編集 ライブ音源 ボーナストラック"],
    ["A".repeat(400), "B".repeat(400)],
  ];
  for (const [artist, title] of cases) {
    const url = musicBounceUrl(musicTrackPath(artist, title));
    assert.ok(url.startsWith(`${RELAY}/?harbor-music=track/`), `missing bounce for ${artist}`);
    assert.ok(url.length <= DISCORD_URL_LIMIT, `${artist} produced ${url.length} chars`);
    assert.ok(musicBounceUrl(musicArtistPath(artist)).length <= DISCORD_URL_LIMIT);
    assert.ok(musicBounceUrl(musicAlbumPath(artist, title)).length <= DISCORD_URL_LIMIT);
  }
});

test("a search query is rebuilt from the link", () => {
  const track = { artist: "Boards of Canada", name: "Roygbiv" };
  assert.equal(musicDeepLinkQuery(track), "Boards of Canada Roygbiv");
  assert.equal(musicDeepLinkQuery({ artist: "Burial" }), "Burial");
});

test("music presence never reaches the social activity feed", () => {
  const setter = presenceSource.slice(presenceSource.indexOf("export function setMusicPresence"));
  const body = setter.slice(0, setter.indexOf("\n}"));
  assert.ok(body.includes("schedule()"), "setMusicPresence must schedule a flush");
  assert.ok(!body.includes("emitActivity"), "setMusicPresence must not emit a social activity");
  const shape = "export type ActivityState = { playback: PlaybackPresence | null;";
  assert.ok(
    presenceSource.includes(`${shape} party: PartyPresence | null };`),
    "ActivityState must stay limited to playback and party",
  );
});

test("a watch party keeps its own activity instead of the listening one", () => {
  assert.ok(
    presenceSource.includes("if (music && config.showMusic && !party &&"),
    "the music branch must yield to an active watch party",
  );
});

test("every deep link builder has a caller", () => {
  assert.ok(musicPresenceSource.includes("musicTrackPath(track.artist, track.title)"));
  assert.ok(musicPresenceSource.includes("musicArtistPath(track.artist)"));
  assert.ok(musicPresenceSource.includes("musicAlbumPath(track.artist, album)"));
});
