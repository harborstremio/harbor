import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { genreIdMatchesTags } from "../src/lib/music/genre-membership";
import * as genreMembership from "../src/lib/music/genre-membership";
import * as genres from "../src/lib/music/genre-catalog";
import { backingTrackVersion } from "../src/lib/music/source-version";
import { mixArtistKey } from "../src/lib/music/daily-mixes";
import type { MusicTrack } from "../src/lib/music/types";

const track = (id: string, artist: string, title = id): MusicTrack => ({
  id, title, artist, connectorId: "catalog", artwork: "album.jpg", durationSeconds: 180, durationLabel: "3:00",
});
const rap = [track("rap1", "Rap Artist"), track("rap2", "Rap Artist")];
const pop = [track("pop1", "Pop Artist"), track("pop2", "Pop Artist")];
function api(roster: string[] = ["Rap Artist"]) {
  const source = readFileSync(new URL("../src/lib/music/personal-mixes.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mocks: Record<string, unknown> = {
    "./source-version": { backingTrackVersion },
    "./artist-authority": { resolveArtist: async (name: string) => ({ canonical: { id: name, name, artwork: "artist.jpg" } }) },
    "./artist-profile": { loadArtistProfile: async ({ name }: { name: string }) => ({ genres: name === "Rap Artist" ? ["southern hip hop"] : ["pop"] }) },
    "./catalog": { artistTop: async () => [...rap, ...pop, track("instrumental", "Rap Artist", "Song (Instrumental)")] },
    "./discovery": { loadMusicGenreSelection: async () => ({ tracks: [...pop, ...rap], artists: [{ name: "Pop Artist", artwork: "pop-portrait.jpg" }, { name: "Rap Artist", artwork: "rap-portrait.jpg" }] }) },
    "./genre-page": { genreArtistNames: async () => roster },
    "./genre-membership": genreMembership,
    "./genre-catalog": genres,
    "./artist-blocks": { filterBlockedTracks: (tracks: MusicTrack[]) => tracks },
    "./search-artists": { artistCreditParts: (name: string) => name.split(",").map(part => part.trim()) },
    "./daily-mixes": { mixArtistKey },
    "./track-identity": { musicTrackIdentity: (entry: MusicTrack) => entry.id },
  };
  const mod = { exports: {} };
  new Function("require", "module", "exports", code)((id: string) => { if (!(id in mocks)) throw Error(id); return mocks[id]; }, mod, mod.exports);
  return mod.exports as typeof import("../src/lib/music/personal-mixes");
}
test("genre membership recognizes actual substyles without treating all popular or electronic music as equivalent", () => {
  assert.equal(genreIdMatchesTags(116, ["southern hip hop"]), true);
  assert.equal(genreIdMatchesTags(116, ["pop", "dance"]), false);
  const trap = genres.MUSIC_GENRES.find(genre => genre.slug === "trap")!;
  assert.equal(genreIdMatchesTags(trap.id, ["hip hop"]), false, "broad rap evidence cannot prove trap");
  assert.equal(genreIdMatchesTags(trap.id, ["trap"]), true);
});
test("a genre-labelled provider pool cannot admit unrelated artists or backing tracks", async () => {
  const mixes = await api().loadPersonalMixes([...pop, ...rap], [116]);
  const mix = mixes.find(mix => mix.id === "mix:genre:116")!;
  assert.ok(mix);
  assert.deepEqual(mix.tracks.map(track => track.id), ["rap1", "rap2"]);
  assert.deepEqual(mix.artwork, ["rap-portrait.jpg"]);
  assert.ok(mixes.filter(mix => mix.kind === "artist").every(mix => mix.tracks.every(track => track.artist === mix.name)));
});
test("genre reopening and old cached queues enforce the same membership rule", async () => {
  const music = api();
  assert.deepEqual((await music.reloadPersonalMix("mix:genre:116", pop[0])).map(track => track.id), ["rap1", "rap2"]);
  assert.deepEqual((await music.filterGenreMixTracks(116, [...pop, ...rap])).map(track => track.id), ["rap1", "rap2"]);
});
test("unknown membership never falls back to unrelated genre filler", async () => {
  assert.deepEqual(await api([]).reloadPersonalMix("mix:genre:116", pop[0]), []);
});
