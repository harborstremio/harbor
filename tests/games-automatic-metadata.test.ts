import assert from "node:assert/strict";
import test from "node:test";
import { automaticMetadataQuery, chooseAutomaticMetadata, findAutomaticMetadata, metadataImportRows, metadataTitle, runMetadataImport, type AutomaticMetadataRequest, type MetadataImportTarget } from "../src/lib/games/automatic-metadata.ts";
import { parseAtlasGame } from "../src/lib/games/igdb-data.ts";
import { artworkImportPolicy } from "../src/lib/games/imported-artwork.ts";
import { importUnmatchedCustom, importUnmatchedRom, libraryMetadataTarget } from "../src/lib/games/library-metadata-import.ts";
import { emptyCustomLibrary, emptyLaunchConfig } from "../src/lib/games/custom-library.ts";
import { EMPTY_EMULATION, folderKey } from "../src/lib/games/emulation.ts";
import { changeLibraryMetadata, emptyLibraryPreferences, readLibraryPreferences } from "../src/lib/games/library-preferences.ts";
import { libraryMetadataMatch } from "../src/lib/games/library-metadata.ts";

const raw = (id = 1, extra = {}) => ({ id, name: "Garden", platforms: [{ id: 6, name: "Windows" }], cover: { image_id: "cover" }, artworks: [{ image_id: "first" }, { image_id: "last" }], ...extra });
const request: AutomaticMetadataRequest = { name: "Garden", platforms: [6] }, policy = artworkImportPolicy({});
const target = (id: string, matched = false): MetadataImportTarget => ({ id, request, matched });
const deps = () => ({ query: async () => [raw()], detail: async () => parseAtlasGame(raw()), save: async () => true, progress: () => {} });

test("matching normalizes punctuation, accents and trademark glyphs without erasing edition identity", () => {
  assert.equal(metadataTitle("Pokémon™: Let's Go!"), "pokemon lets go");
  for (const name of ["Garden II", "Garden 2", "Garden Legacy", "Garden Enhanced", "Garden Deluxe Edition", "Garden (Remastered)"]) assert.notEqual(metadataTitle(name), metadataTitle("Garden"));
  assert.match(automaticMetadataQuery({ name: "1984", platforms: [] }), /search "1984"/);
  assert.doesNotMatch(automaticMetadataQuery({ ...request, name: 'Garden" \\ next\n' }), /\\|\n/);
  for (const bad of [{ ...request, platforms: [-1] }, { ...request, year: NaN }, { ...request, igdbId: 0 }, { ...request, name: " " }, { ...request, external: { source: 1, uid: '4"; limit 1;' } }]) assert.throws(() => automaticMetadataQuery(bad));
  assert.throws(() => automaticMetadataQuery(request, 200));
});
test("exact external identities check both fields on the same record and retain editions", () => {
  const lookup = { ...request, external: { source: 1, uid: "42" } };
  const wrong = parseAtlasGame(raw(1, { external_games: [{ external_game_source: 1, uid: "9" }, { external_game_source: 5, uid: "42" }] }));
  assert.equal(chooseAutomaticMetadata(lookup, [wrong], true).game, undefined);
  const right = parseAtlasGame(raw(2, { name: "Different localized title", external_games: [{ external_game_source: 1, uid: "42" }] }));
  assert.equal(chooseAutomaticMetadata(lookup, [wrong, right], true).game?.igdbId, 2);
  assert.equal(chooseAutomaticMetadata(lookup, [right, { ...right, igdbId: 3 }], true).reason, "ambiguous");
  assert.equal(chooseAutomaticMetadata({ ...request, igdbId: 2 }, [wrong, right], true).game?.igdbId, 2);
});
test("title and aliases require a compatible platform and optional platform-specific release year", () => {
  const game = parseAtlasGame(raw(1, { alternative_names: [{ name: "Jardin" }], first_release_date: Date.UTC(1995, 0)/1000, release_dates: [{ id: 1, date: Date.UTC(1997, 0)/1000, platform: { id: 6, name: "Windows" } }] }));
  assert.equal(chooseAutomaticMetadata({ name: "Jardin", platforms: [6], year: 1997 }, [game], true).game?.igdbId, 1);
  assert.equal(chooseAutomaticMetadata({ ...request, year: 1995 }, [game], true).game, undefined);
  assert.equal(chooseAutomaticMetadata({ ...request, platforms: [24] }, [game], true).reason, "noMatch");
  assert.equal(chooseAutomaticMetadata({ ...request, platforms: [] }, [game], true).game, undefined);
  assert.equal(chooseAutomaticMetadata(request, [game, { ...game, igdbId: 2 }], true).reason, "ambiguous");
  assert.equal(chooseAutomaticMetadata(request, [game, game], true).game?.igdbId, 1);
  assert.equal(chooseAutomaticMetadata({ ...request, name: "Garde" }, [game], true).game, undefined);
});
test("all search pages are checked before accepting a title and bounded truncation requires review", async () => {
  let calls = 0;
  const result = await findAutomaticMetadata(request, async () => ++calls === 1 ? Array.from({ length: 50 }, (_, i) => raw(i+1, { name: i ? "Unrelated" : "Garden" })) : [raw(60)], new AbortController().signal);
  assert.equal(result.reason, "ambiguous"); assert.equal(calls, 2);
  calls = 0;
  const truncated = await findAutomaticMetadata(request, async () => { calls++; return Array.from({ length: 50 }, (_, i) => raw(i+1)); }, new AbortController().signal);
  assert.equal(truncated.reason, "incomplete"); assert.equal(calls, 4);
});
test("batch skips existing matches, continues after failures and retries only unfinished rows", async () => {
  const targets = [target("a"), target("b"), target("c", true)]; let attempts = 0, saved: string[] = [];
  const d = { ...deps(), save: async (id: string) => { attempts++; if (id === "b" && attempts === 2) return false; saved.push(id); return true; } };
  let rows = await runMetadataImport(targets, metadataImportRows(targets), policy, new AbortController().signal, d);
  assert.deepEqual(rows.map(row => row.state), ["saved", "failed", "skipped"]);
  const image = rows[1].game?.importedArtwork;
  rows = await runMetadataImport(targets, rows, { ...policy, selection: "random" }, new AbortController().signal, { ...d, query: async () => { throw Error("must reuse prepared import"); } });
  assert.deepEqual(saved, ["a", "b"]); assert.deepEqual(rows[1].game?.importedArtwork, image); assert.equal(rows[1].game?.steamId, undefined);
});
test("stop during lookup cannot save and continuation resumes pending rows", async () => {
  const targets = [target("a"), target("b")], controller = new AbortController(); let saved = 0;
  let rows = await runMetadataImport(targets, metadataImportRows(targets), policy, controller.signal, { ...deps(), query: async () => { controller.abort(); return [raw()]; }, save: async () => { saved++; return true; } });
  assert.deepEqual(rows.map(row => row.state), ["pending", "pending"]); assert.equal(saved, 0);
  rows = await runMetadataImport(targets, rows, policy, new AbortController().signal, deps());
  assert.deepEqual(rows.map(row => row.state), ["saved", "saved"]);
});
test("stop after a completed write keeps that success and does not start the next game", async () => {
  const targets = [target("a"), target("b")], controller = new AbortController();
  const rows = await runMetadataImport(targets, metadataImportRows(targets), policy, controller.signal, { ...deps(), save: async () => { controller.abort(); return true; } });
  assert.deepEqual(rows.map(row => row.state), ["saved", "pending"]);
});
test("canceling a queued store write returns it to pending instead of reporting a provider failure", async () => {
  const targets = [target("a")], controller = new AbortController();
  const rows = await runMetadataImport(targets, metadataImportRows(targets), policy, controller.signal, { ...deps(), save: async () => { controller.abort(); return false; } });
  assert.equal(rows[0].state, "pending"); assert.ok(rows[0].game?.importedArtwork);
});
test("manual artwork policy queues review; exact detail missing or changed never commits", async () => {
  const targets = [target("a")]; let saves = 0;
  const d = { ...deps(), save: async () => { saves++; return true; } };
  const manual = await runMetadataImport(targets, metadataImportRows(targets), { ...policy, selection: "manual" }, new AbortController().signal, d);
  assert.equal(manual[0].reason, "artwork"); assert.ok(manual[0].game?.importedArtwork); assert.equal(saves, 0);
  for (const detail of [null, parseAtlasGame(raw(9))]) {
    const result = await runMetadataImport(targets, metadataImportRows(targets), policy, new AbortController().signal, { ...d, detail: async () => detail });
    assert.equal(result[0].state, "failed"); assert.equal(saves, 0);
  }
});
test("unified targets preserve original titles, exact store identities and ROM platform", () => {
  const item = { id: "steam:42", name: "Personal label", originalName: "Garden Legacy", source: "steam" as const, favorite: false, hidden: false, lastPlayed: 0, state: "ready" as const, game: { id: "steam:42", steamId: 42, name: "Garden", capsule: "", platforms: [] } };
  const result = libraryMetadataTarget(item, emptyLibraryPreferences(), 6);
  assert.equal(result.request.name, "Garden Legacy"); assert.deepEqual(result.request.external, { source: 1, uid: "42" }); assert.deepEqual(result.request.platforms, []); assert.equal(result.matched, false);
  assert.equal(libraryMetadataTarget(item, { ...emptyLibraryPreferences(), entries: { [item.id]: { pinned: false, hidden: false, metadata: libraryMetadataMatch(parseAtlasGame(raw())) } } }, 6).matched, true);
});
test("custom import checks latest title and match while preserving launch configuration and personal artwork", () => {
  const local = { id: "11111111-1111-4111-8111-111111111111", name: "Garden", config: { ...emptyLaunchConfig(), executable: "D:/Games/game.exe", arguments: ["--offline"] }, linked: null, artwork: "D:/Art/mine.png", pinned: true, hidden: false, addedAt: 1, lastPlayed: 0, measuredSeconds: 0 };
  const store = { ...emptyCustomLibrary(), games: [local] }, metadata = parseAtlasGame(raw());
  const updated = importUnmatchedCustom(store, local.id, "Garden", metadata);
  assert.deepEqual(updated.games[0].config, local.config); assert.equal(updated.games[0].artwork, local.artwork); assert.equal(updated.games[0].linked?.igdbId, 1);
  assert.throws(() => importUnmatchedCustom(updated, local.id, "Garden", metadata));
  assert.throws(() => importUnmatchedCustom(store, local.id, "Old name", metadata));
  assert.throws(() => importUnmatchedCustom(emptyCustomLibrary(), local.id, "Garden", metadata));
});
test("ROM import preserves paths and profiles, rejects removed games and concurrent matches", () => {
  const game = { path: "D:/Games/Garden.gba", name: "Garden", sizeBytes: 1024, system: 24, format: "GBA", available: true, discs: 1 };
  const store = { ...EMPTY_EMULATION(), folders: [{ id: "folder", root: "D:/Games", games: [game], system: 24, scannedAt: 1, skipped: 0, limited: false }] };
  const metadata = parseAtlasGame(raw()), updated = importUnmatchedRom(store, game.path, 24, "Garden", metadata);
  assert.deepEqual(updated.folders, store.folders); assert.equal(updated.matches[folderKey(game.path, 24)].igdbId, 1); assert.equal(updated.matches[folderKey(game.path, 24)].steamId, undefined);
  assert.throws(() => importUnmatchedRom(updated, game.path, 24, "Garden", metadata));
  assert.throws(() => importUnmatchedRom(EMPTY_EMULATION(), game.path, 24, "Garden", metadata));
});
test("cancellation is checked inside the preferences write queue without leaving partial artwork", async () => {
  const memory = new Map<string,string>(); Object.defineProperty(globalThis, "localStorage", { configurable:true, value:{ getItem:(key:string)=>memory.get(key)??null,setItem:(key:string,value:string)=>memory.set(key,value) } });
  const controller = new AbortController();
  const pending = changeLibraryMetadata("batch-proof", "steam:42", libraryMetadataMatch(parseAtlasGame(raw())), undefined, controller.signal);
  controller.abort(); await assert.rejects(pending); assert.equal(readLibraryPreferences("batch-proof").entries["steam:42"], undefined);
});
