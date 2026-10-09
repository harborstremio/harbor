import test from "node:test";
import assert from "node:assert/strict";

const host = { location: { hostname: "harbor.local" } };
(globalThis as unknown as { window: typeof host }).window = host;

const DEEZER_KING_VON = {
  data: [
    {
      id: 222422125,
      name: "King Von",
      nb_album: 1,
      nb_fan: 53,
      picture_big:
        "https://cdn-images.dzcdn.net/images/artist/96499a08274b946187ae10833fa91fd0/500x500-000000-80-0-0.jpg",
      picture_xl:
        "https://cdn-images.dzcdn.net/images/artist/96499a08274b946187ae10833fa91fd0/1000x1000-000000-80-0-0.jpg",
      type: "artist",
    },
    {
      id: 115195732,
      name: "King Von",
      nb_album: 2,
      nb_fan: 54,
      picture_big:
        "https://cdn-images.dzcdn.net/images/artist/bb31cbb878d76a281651cf92e0ab2a73/500x500-000000-80-0-0.jpg",
      picture_xl:
        "https://cdn-images.dzcdn.net/images/artist/bb31cbb878d76a281651cf92e0ab2a73/1000x1000-000000-80-0-0.jpg",
      type: "artist",
    },
    {
      id: 119988042,
      name: "King Von",
      nb_album: 4,
      nb_fan: 96,
      picture_big:
        "https://cdn-images.dzcdn.net/images/artist/8b49d96aa47351b8e05786310be1e379/500x500-000000-80-0-0.jpg",
      picture_xl:
        "https://cdn-images.dzcdn.net/images/artist/8b49d96aa47351b8e05786310be1e379/1000x1000-000000-80-0-0.jpg",
      type: "artist",
    },
    {
      id: 12431462,
      name: "King Von",
      nb_album: 34,
      nb_fan: 306176,
      picture_big:
        "https://cdn-images.dzcdn.net/images/artist/b09e4a95b142b80f4730ab0c64356e3c/500x500-000000-80-0-0.jpg",
      picture_xl:
        "https://cdn-images.dzcdn.net/images/artist/b09e4a95b142b80f4730ab0c64356e3c/1000x1000-000000-80-0-0.jpg",
      type: "artist",
    },
    {
      id: 49818632,
      name: "POLO G",
      nb_album: 49,
      nb_fan: 754870,
      picture_big:
        "https://cdn-images.dzcdn.net/images/artist/9faf91af495202aeab93e2d91b975851/500x500-000000-80-0-0.jpg",
      picture_xl:
        "https://cdn-images.dzcdn.net/images/artist/9faf91af495202aeab93e2d91b975851/1000x1000-000000-80-0-0.jpg",
      type: "artist",
    },
    {
      id: 1336,
      name: "Kings of Convenience",
      nb_album: 13,
      nb_fan: 70927,
      picture_big:
        "https://cdn-images.dzcdn.net/images/artist/22a982e025b2f51b5cde2c4f6c1fee26/500x500-000000-80-0-0.jpg",
      picture_xl:
        "https://cdn-images.dzcdn.net/images/artist/22a982e025b2f51b5cde2c4f6c1fee26/1000x1000-000000-80-0-0.jpg",
      type: "artist",
    },
    {
      id: 315692181,
      name: "king chimp von",
      nb_album: 0,
      nb_fan: 0,
      picture_big: "https://cdn-images.dzcdn.net/images/artist//500x500-000000-80-0-0.jpg",
      picture_xl: "https://cdn-images.dzcdn.net/images/artist//1000x1000-000000-80-0-0.jpg",
      type: "artist",
    },
    {
      id: 334559911,
      name: "King Von lll",
      nb_album: 0,
      nb_fan: 0,
      picture_big: "https://cdn-images.dzcdn.net/images/artist//500x500-000000-80-0-0.jpg",
      picture_xl: "https://cdn-images.dzcdn.net/images/artist//1000x1000-000000-80-0-0.jpg",
      type: "artist",
    },
  ],
  total: 20,
};

const { DEEZER_AURORA, DEEZER_DRAKE, DEEZER_JOHN_WILLIAMS } =
  await import("./fixtures/deezer-namesakes");
const { collapseArtistRows } = await import("../src/lib/music/search-artists");
const { artistIdentityKey, resolveArtist } = await import("../src/lib/music/artist-authority");

const LOCALE = "en-US";
const FANS = "Deezer fans";

let calls = 0;
(globalThis as unknown as { fetch: unknown }).fetch = async (url: string) => {
  calls += 1;
  const asked = decodeURIComponent(String(url));
  const body = /John Williams/i.test(asked)
    ? DEEZER_JOHN_WILLIAMS
    : /Aurora/i.test(asked)
      ? DEEZER_AURORA
      : /Drake/i.test(asked)
        ? DEEZER_DRAKE
        : DEEZER_KING_VON;
  return { ok: true, status: 200, json: async () => body };
};

type Row = { id: number; name: string };
const refsOf = (rows: Row[]) => rows.map((row) => deezer(row.id, row.name));

const deezer = (id: number, name: string, subtitle?: string) => ({
  id: `deezer:artist:${id}`,
  connectorId: "catalog",
  name,
  ...(subtitle ? { subtitle } : {}),
});

const FLAGSHIP = {
  id: "ytm:UCPo4Wr2xLhNH2TJZUxYzHHw",
  connectorId: "youtube",
  name: "King Von",
  artwork: "https://lh3.googleusercontent.com/king-von",
  subtitle: "Artist • 21.6M monthly audience",
};

const KING_VONS = [
  deezer(222422125, "King Von"),
  deezer(115195732, "King Von"),
  deezer(119988042, "King Von"),
  deezer(12431462, "King Von"),
];

const seed = () => resolveArtist("King Von");

test("five King Von records collapse to the one the user meant", async () => {
  await seed();
  assert.ok(calls > 0);
  const rows = collapseArtistRows([...KING_VONS, FLAGSHIP], LOCALE, FANS);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "deezer:artist:12431462");
  assert.ok(rows[0].subtitle?.includes("21.6M"), rows[0].subtitle ?? "no subtitle");
});

test("the deezer fan count captions the row when no source carries an audience line", async () => {
  await seed();
  const rows = collapseArtistRows(KING_VONS, LOCALE, FANS);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "deezer:artist:12431462");
  assert.equal(rows[0].subtitle, `${(306176).toLocaleString(LOCALE)} ${FANS}`);
});

test("a genuine tie keeps both namesakes, strongest first", () => {
  const rows = collapseArtistRows(
    [deezer(9001, "Tie Namesake", "250,000 fans"), deezer(9002, "Tie Namesake", "400,000 fans")],
    LOCALE,
    FANS,
  );
  assert.equal(rows.length, 2);
  assert.deepEqual(
    rows.map((row) => row.id),
    ["deezer:artist:9002", "deezer:artist:9001"],
  );
});

test("an official artist channel that did not fold is never hidden", () => {
  const rows = collapseArtistRows(
    [
      deezer(9101, "Split Namesake", "500,000 fans"),
      deezer(9102, "Split Namesake", "50 fans"),
      {
        id: "ytm:a",
        connectorId: "youtube",
        name: "Split Namesake",
        subtitle: "Artist • 9.4M monthly audience",
      },
      {
        id: "ytm:b",
        connectorId: "youtube",
        name: "Split Namesake",
        subtitle: "Artist • 2.1M monthly audience",
      },
    ],
    LOCALE,
    FANS,
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].id, "deezer:artist:9101");
  assert.equal(rows[1].id, "ytm:a");
});

test("different names keep their own rows in the order the merge gave them", async () => {
  await seed();
  const rows = collapseArtistRows(
    [
      ...KING_VONS,
      deezer(49818632, "POLO G"),
      deezer(1336, "Kings of Convenience"),
      deezer(315692181, "king chimp von"),
      deezer(334559911, "King Von lll"),
    ],
    LOCALE,
    FANS,
  );
  assert.deepEqual(
    rows.map((row) => row.name),
    ["King Von", "POLO G", "Kings of Convenience", "king chimp von", "King Von lll"],
  );
  assert.equal(rows[0].id, "deezer:artist:12431462");
});

test("a cold cache renders one row, and holds the row the caller is still resolving", () => {
  const drakes = refsOf(DEEZER_DRAKE.data.filter((row) => row.name === "Drake"));
  assert.equal(drakes.length, 4);
  assert.equal(collapseArtistRows(drakes, LOCALE, FANS).length, 1);
  assert.equal(collapseArtistRows(drakes, LOCALE, FANS, "drake").length, 0);
});

test("the held rows become one correct row once the authority answers", async () => {
  const drakes = refsOf(DEEZER_DRAKE.data.filter((row) => row.name === "Drake"));
  await resolveArtist("Drake");
  const rows = collapseArtistRows(drakes, LOCALE, FANS, "drake");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "deezer:artist:246791");
  assert.equal(rows[0].subtitle, `${(24081631).toLocaleString(LOCALE)} ${FANS}`);
});

test("a namesake with a catalogue of its own keeps its row", async () => {
  await resolveArtist("John Williams");
  const rows = collapseArtistRows(refsOf(DEEZER_JOHN_WILLIAMS.data), LOCALE, FANS);
  const exact = rows.filter((row) => row.name === "John Williams");
  assert.equal(DEEZER_JOHN_WILLIAMS.data.filter((row) => row.name === "John Williams").length, 9);
  assert.deepEqual(
    exact.map((row) => row.id),
    ["deezer:artist:805", "deezer:artist:5604436"],
  );
});

test("three real artists named Aurora stay three artists", async () => {
  await resolveArtist("Aurora");
  const rows = collapseArtistRows(refsOf(DEEZER_AURORA.data), LOCALE, FANS);
  const exact = rows.filter((row) => artistIdentityKey(row.name) === "aurora");
  assert.deepEqual(
    exact.map((row) => row.id),
    ["deezer:artist:7699874", "deezer:artist:9028", "deezer:artist:7068105"],
  );
});

test("a collapsed row reports every source that agreed on it", async () => {
  await resolveArtist("King Von");
  const rows = collapseArtistRows(
    [
      { ...deezer(12431462, "King Von"), sourceCount: 1, sourceConnectorIds: ["catalog"] },
      { ...FLAGSHIP, sourceCount: 1, sourceConnectorIds: ["youtube"] },
    ],
    LOCALE,
    FANS,
  );
  assert.equal(rows.length, 1);
  const ranked = rows[0] as (typeof rows)[0] & {
    sourceCount?: number;
    sourceConnectorIds?: string[];
  };
  assert.deepEqual(ranked.sourceConnectorIds, ["catalog", "youtube"]);
  assert.equal(ranked.sourceCount, 2);
});
