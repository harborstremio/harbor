import test from "node:test";
import assert from "node:assert/strict";
import { parseAtlasGame } from "../src/lib/games/igdb-data";
import { romCollections, romCollectionScenes, romConsoleNames, romPreview } from "../src/lib/games/rom-presentation";

test('collection continuation preserves existing order and chooses distinct scenes', () => {
  const first = parseAtlasGame({ id: 1, name: 'First', franchises: [{ id: 30, name: 'First series' }], collections: [{ id: 31, name: 'First subseries' }], screenshots: [{ image_id: 'shared' }, { image_id: 'first' }] });
  const second = parseAtlasGame({ id: 2, name: 'Second', franchises: [{ id: 40, name: 'Second series' }], screenshots: [{ image_id: 'shared' }, { image_id: 'second' }] });
  const more = parseAtlasGame({ id: 3, name: 'Another second', franchises: [{ id: 40, name: 'Second series' }] });
  const initial = romCollections([first, second]), extended = romCollections([first, second, more]);
  assert.deepEqual(extended.map(group => group.id), initial.map(group => group.id));
  assert.deepEqual(extended.map(group => group.id), [30, 40]);
  const scenes = [...romCollectionScenes(extended).values()];
  assert.equal(new Set(scenes).size, 2);
  assert.ok(scenes[1].includes('second'));
});

test('franchise doorways prefer their own games over crossovers and suppress nested aliases', () => {
  const mario = { id: 845, name: 'Mario' }, pokemon = { id: 60, name: 'Pokémon' };
  const games = [
    parseAtlasGame({ id: 1, name: 'Super Smash Bros.', franchises: [mario, pokemon] }),
    parseAtlasGame({ id: 2, name: 'Super Mario 64', franchises: [mario, { id: 100, name: 'Mario Bros.' }] }),
    parseAtlasGame({ id: 3, name: 'Pokémon Stadium', franchises: [pokemon] }),
  ];
  const groups = romCollections(games);
  assert.deepEqual(groups.map(group => group.id), [60, 845]);
  assert.equal(groups[0].games[0].name, 'Pokémon Stadium');
  assert.equal(groups[1].games[0].name, 'Super Mario 64');
});

test("ROM collections lead with actual Pokémon, Zelda and Mario relations and retain their namespaces", () => {
  const games = [
    parseAtlasGame({ id: 1070, name: "Super Mario World", franchises: [{ id: 845, name: "Mario" }], collections: [{ id: 240, name: "Super Mario" }] }),
    parseAtlasGame({ id: 1517, name: "Pokémon Emerald", franchises: [{ id: 60, name: "Pokémon" }], collections: [{ id: 314, name: "Pokémon" }] }),
    parseAtlasGame({ id: 1029, name: "Ocarina of Time", franchises: [{ id: 596, name: "Zelda" }] }),
  ];
  const groups = romCollections([...games, games[0]]);
  assert.deepEqual(groups.map(group => [group.kind, group.id]), [["franchise", 60], ["franchise", 596], ["franchise", 845]]);
  assert.equal(groups[0].games.length, 1);
  assert.deepEqual(romCollections([parseAtlasGame({ id: 1, name: "Pokémon fan tribute" })]), []);
});

test("ROM platform captions prefer actual original release systems over later virtual-console ports", () => {
  const game = parseAtlasGame({ id: 1070, name: "Super Mario World", platforms: [{ id: 5, name: "Wii" }, { id: 19, name: "SNES" }, { id: 41, name: "Wii U" }], release_dates: [{ id: 1, date: 658022400, platform: { id: 19, name: "SNES" } }, { id: 2, date: 1167609600, platform: { id: 5, name: "Wii" } }] });
  assert.deepEqual(romConsoleNames(game), ["SNES"]);
  assert.deepEqual(romConsoleNames(game, 5), ["Wii"]);
});

test("Video previews use the exact game's gameplay entry and never invent an unavailable video", () => {
  const game = parseAtlasGame({ id: 1070, name: "Super Mario World", videos: [{ video_id: "LFxKo6xZv3M", name: "Trailer" }, { video_id: "Vxg5eOPmzHI", name: "Gameplay Video" }] });
  assert.deepEqual(romPreview(game), { id: "Vxg5eOPmzHI", title: "Gameplay Video", gameName: "Super Mario World", gameId: 1070 });
  assert.equal(romPreview({ ...game, videos: [] }), undefined);
  assert.equal(romPreview({ ...game, videos: game.videos?.slice(0, 1) })?.title, "Trailer");
});
