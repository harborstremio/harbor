import assert from "node:assert/strict";
import test from "node:test";
import { createMusicPlaylist } from "../src/lib/music/library";

test("playlist creation preserves names and resolves collisions without hiding other failures", async () => {
  const previousWindow = globalThis.window;
  const names = new Set(["Like Charlie dance mix", "Like Charlie dance mix (1)"]);
  const attempts: string[] = [];
  let fail: string | null = null;
  let race = false;
  let reads = 0;
  Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: {
    __TAURI_INTERNALS__: { invoke: async (command: string, args: { name: string }) => {
      if (command === "music_list_playlists") {
        reads += 1;
        const snapshot = [...names].map((name) => ({ name }));
        if (race) { names.add("Like Charlie dance mix (3)"); race = false; }
        return snapshot;
      }
      assert.equal(command, "music_create_playlist");
      attempts.push(args.name);
      if (fail) throw fail;
      if ([...names].some((name) => name.toLowerCase() === args.name.toLowerCase())) {
        throw "UNIQUE constraint failed: playlists.name";
      }
      names.add(args.name);
      return { id: args.name, name: args.name, tracks: [] };
    } },
  } });
  try {
    assert.equal((await createMusicPlaylist("  New mix  ")).name, "New mix");
    assert.equal(reads, 0, "a unique name needs no library fetch");
    assert.equal((await createMusicPlaylist("like charlie dance mix")).name, "like charlie dance mix (2)");
    race = true;
    assert.equal((await createMusicPlaylist("Like Charlie dance mix")).name, "Like Charlie dance mix (4)");
    assert.ok(attempts.includes("Like Charlie dance mix (3)"), "retry when another creation wins the name");
    const readsBefore = reads;
    fail = "database is locked";
    await assert.rejects(createMusicPlaylist("Failure"), (error) => error === fail);
    assert.equal(reads, readsBefore, "do not retry unrelated database failures");
    fail = "UNIQUE constraint failed: playlists.name";
    const before = attempts.length;
    await assert.rejects(createMusicPlaylist("Persistent collision"));
    assert.equal(attempts.length - before, 5, "bound collision retries");
  } finally {
    if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
    else globalThis.window = previousWindow;
  }
});
