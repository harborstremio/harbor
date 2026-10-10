import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import type { MusicTrack } from "../src/lib/music/types.ts";

type Library = typeof import("../src/lib/music/spotify-library.ts");
const track = (number: number): MusicTrack => ({
  id: `spotify:track:${String(number).padStart(22, "0")}`,
  connectorId: "spotify",
  title: `Song ${number}`,
  artist: "Artist",
  durationSeconds: 180,
  durationLabel: "3:00",
});
const page = (tracks = [track(1)], nextOffset: number | null = null) => ({
  tracks,
  playlists: [],
  nextOffset,
  total: tracks.length,
  skipped: 0,
  canCreate: true,
  writePermission: true,
});
function fixture(respond: (command: string, args: any) => unknown = () => undefined) {
  const calls: { command: string; args: any }[] = [];
  const events: string[] = [];
  const invoke = async (command: string, args?: any) => {
    calls.push({ command, args });
    const result = respond(command, args);
    if (result !== undefined) return result;
    if (command === "music_spotify_library_page") return page();
    if (command === "create") return { id: "new-import-only", name: args.name, tracks: [] };
    if (command === "add") return { id: args.playlistId, name: "Import", tracks: args.tracks };
    return null;
  };
  const source = readFileSync(
    new URL("../src/lib/music/spotify-library.ts", import.meta.url),
    "utf8",
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", "window", outputText)(
    (name: string) => {
      if (name === "@tauri-apps/api/core") return { invoke };
      assert.equal(name, "./library");
      return {
        createMusicPlaylist: (name: string) => invoke("create", { name }),
        addTracksToMusicPlaylist: (playlistId: string, tracks: MusicTrack[]) =>
          invoke("add", { playlistId, tracks }),
        deleteMusicPlaylist: (playlistId: string) => invoke("delete", { playlistId }),
      };
    },
    module,
    module.exports,
    { dispatchEvent: (event: Event) => events.push(event.type) },
  );
  return { library: module.exports as Library, calls, events };
}

test("loading the helper performs no account reads or mutations", () => {
  const { calls, events } = fixture();
  assert.deepEqual(calls, []);
  assert.deepEqual(events, []);
});

test("import reads every page before creating one Harbor copy, preserving real track IDs", async () => {
  const { library, calls, events } = fixture((command, args) =>
    command === "music_spotify_library_page"
      ? args.offset === 0
        ? { ...page([track(1)], 50), skipped: 1 }
        : page([track(2)])
      : undefined,
  );
  const progress: number[] = [];
  const result = await library.importSpotifyCollection({
    kind: "playlist",
    playlistId: "spotify:playlist:0000000000000000000001",
    name: "My copy",
    onProgress: (count) => progress.push(count),
  });
  assert.deepEqual(
    calls.map((call) => call.command),
    ["music_spotify_library_page", "music_spotify_library_page", "create", "add"],
  );
  assert.deepEqual(
    calls.slice(0, 2).map((call) => call.args.offset),
    [0, 50],
  );
  assert.deepEqual(
    result.playlist.tracks.map((item) => item.id),
    [track(1).id, track(2).id],
  );
  assert.deepEqual(progress, [1, 2]);
  assert.equal(result.skipped, 1);
  assert.deepEqual(events, ["harbor:music-library-changed"]);
});

test("a later-page failure or invalid cursor leaves Harbor untouched", async () => {
  for (const failure of ["page-error", "repeated", "overflow"]) {
    const { library, calls, events } = fixture((command, args) => {
      if (command !== "music_spotify_library_page") return undefined;
      if (!args.offset) return page([track(1)], 50);
      if (failure === "page-error") throw new Error("Network unavailable");
      return page([track(2)], failure === "repeated" ? 50 : 100_001);
    });
    await assert.rejects(library.importSpotifyCollection({ kind: "liked", name: "Copy" }));
    assert.equal(
      calls.every((call) => call.command === "music_spotify_library_page"),
      true,
    );
    assert.deepEqual(events, []);
  }
});

test("cancellation after a read never creates a partial import", async () => {
  const controller = new AbortController();
  const { library, calls } = fixture((command) => {
    if (command === "music_spotify_library_page") {
      controller.abort();
      return page();
    }
  });
  await assert.rejects(
    library.importSpotifyCollection({ kind: "liked", name: "Copy", signal: controller.signal }),
    { name: "AbortError" },
  );
  assert.deepEqual(
    calls.map((call) => call.command),
    ["music_spotify_library_page"],
  );
});

test("failed local insertion removes only this operation's newly created playlist", async () => {
  const { library, calls, events } = fixture((command) => {
    if (command === "add") throw new Error("Database full");
  });
  await assert.rejects(
    library.importSpotifyCollection({ kind: "liked", name: "Copy" }),
    /Database full/,
  );
  assert.deepEqual(calls.at(-1), { command: "delete", args: { playlistId: "new-import-only" } });
  assert.deepEqual(events, []);
});

test("cancellation while creating cleans up only the new empty import", async () => {
  const controller = new AbortController();
  const { library, calls } = fixture((command) => {
    if (command === "create") {
      controller.abort();
      return { id: "new-empty", name: "Copy", tracks: [] };
    }
  });
  await assert.rejects(
    library.importSpotifyCollection({ kind: "liked", name: "Copy", signal: controller.signal }),
    { name: "AbortError" },
  );
  assert.equal(
    calls.some((call) => call.command === "add"),
    false,
  );
  assert.deepEqual(calls.at(-1), { command: "delete", args: { playlistId: "new-empty" } });
});

test("Spotify writes require explicit calls and a real Spotify track URI", async () => {
  const { library, calls, events } = fixture();
  await assert.rejects(
    library.addTrackToSpotifyPlaylist("playlist", { ...track(1), id: "youtube:1", sourceId: "1" }),
    /Only Spotify tracks/,
  );
  assert.equal(calls.length, 0);
  await library.createSpotifyPlaylist("  Private mix  ");
  await library.addTrackToSpotifyPlaylist("spotify:playlist:0000000000000000000002", track(1));
  assert.deepEqual(calls, [
    { command: "music_spotify_create_playlist", args: { name: "Private mix" } },
    {
      command: "music_spotify_add_to_playlist",
      args: { playlistId: "spotify:playlist:0000000000000000000002", trackUri: track(1).id },
    },
  ]);
  assert.deepEqual(events, ["harbor:spotify-library-changed"]);
});

test("unconfirmed Spotify writes do not retry or announce success", async () => {
  const { library, calls, events } = fixture(() => {
    throw new Error("Spotify did not confirm the change");
  });
  await assert.rejects(library.addTrackToSpotifyPlaylist("playlist", track(1)), /did not confirm/);
  assert.equal(calls.length, 1);
  assert.deepEqual(events, []);
  assert.equal(
    library.spotifyLibraryErrorKey("Spotify playlist permission is missing"),
    "music.spotifyLibrary.permission",
  );
  assert.equal(
    library.spotifyLibraryErrorKey("Spotify did not confirm the change"),
    "music.spotifyLibrary.unconfirmed",
  );
});
