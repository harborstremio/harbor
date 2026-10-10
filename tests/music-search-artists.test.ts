import test from "node:test";
import assert from "node:assert/strict";
import { uniqueSearchArtists } from "../src/lib/music/search-artists";
test("deduplicates artists by identity and removes resolved collaboration placeholders", () => {
  const a = { id: "deezer:artist:1", connectorId: "catalog", name: "Artist A" },
    b = { id: "deezer:artist:2", connectorId: "catalog", name: "Artist B" };
  assert.deepEqual(
    uniqueSearchArtists([
      a,
      b,
      { ...b, artwork: "portrait" },
      { id: "search:combined", connectorId: "catalog", name: "Artist A feat. Artist B" },
    ]).map((x) => x.name),
    ["Artist A", "Artist B"],
  );
  assert.equal(uniqueSearchArtists([b, { ...b, artwork: "portrait" }])[0].artwork, "portrait");
});
test("does not merge same-name people or split a verified band", () => {
  const a = { id: "deezer:artist:1", connectorId: "catalog", name: "A & B" };
  assert.equal(uniqueSearchArtists([a, { ...a, id: "deezer:artist:2" }]).length, 2);
});

test("comma and ampersand credits resolve individually", async () => {
  const { resolveSearchCollaborations } = await import("../src/lib/music/search-artists");
  const names = ["DJ Twin", "Sean Kingston", "Lil Bibby"];
  const combined = { id: "search:credit", connectorId: "catalog", name: names.join(",") };
  const resolved = await resolveSearchCollaborations([combined], async (name) => [
    { id: `deezer:artist:${names.indexOf(name)}`, connectorId: "catalog", name },
  ]);
  assert.deepEqual(resolved.map((x) => x.name).sort(), [...names].sort());
});

test("uniqueSearchArtists keeps namesakes apart; collapsing them is collapseArtistRows job", () => {
  const a = { id: "deezer:artist:222422125", connectorId: "catalog", name: "King Von" };
  const b = { id: "deezer:artist:12431462", connectorId: "catalog", name: "King Von" };
  assert.equal(uniqueSearchArtists([a, b]).length, 2);
  assert.deepEqual(
    uniqueSearchArtists([a, b]).map((x) => x.id),
    [a.id, b.id],
  );
});
