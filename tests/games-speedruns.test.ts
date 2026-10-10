import assert from "node:assert/strict";
import test from "node:test";
import { parseSpeedrunBoard, parseSpeedrunGame, speedrunSearch, speedrunTime } from "../src/lib/games/speedrun-data";
import { parseSpeedrunVideo, speedrunVideoEmbed } from "../src/lib/games/speedrun-videos";
const raw = { id: "3dxy5vv6", names: { international: "Hades 2" }, weblink: "https://www.speedrun.com/hades2", categories: { data: [{ id: "wk6yjved", name: "Any Fear", type: "per-game" }, { id: "11111111", name: "Level", type: "per-level" }] }, variables: { data: [{ id: "onv5935l", name: "Version", scope: { type: "global" }, "is-subcategory": true, values: { default: "lr3pxxml", values: { lr3pxxml: { label: "Current" } } } }] } };
test("speedrun identity accepts numeral equivalence but rejects fuzzy games and category extensions", () => {
  const game = parseSpeedrunGame({ data: [{ ...raw, names: { international: "Hades 2 Category Extensions" } }, raw] }, "Hades II");
  assert.equal(game?.id, "3dxy5vv6"); assert.equal(game?.categories.length, 1); assert.deepEqual(game?.categories[0].filters, { onv5935l: "lr3pxxml" });
  assert.equal(speedrunSearch("Hades II"), "Hades"); assert.equal(parseSpeedrunGame({ data: [raw] }, "Hades"), null);
  assert.equal(parseSpeedrunGame({ data: [raw, raw] }, "Hades II"), null);
  assert.throws(() => parseSpeedrunGame({ error: "unavailable" }, "Hades II"));
});
const game = parseSpeedrunGame({ data: [raw] }, "Hades II")!;
const run = { id: "z5g373dm", game: game.id, category: "wk6yjved", level: null, weblink: "https://www.speedrun.com/hades2/runs/z5g373dm", status: { status: "verified" }, times: { ingame_t: 191.82 }, values: { onv5935l: "lr3pxxml" }, players: [{ id: "8dwqvy9j" }], system: { platform: "8gej2n93" }, date: "2026-09-01" };
const board = { data: { game: game.id, category: "wk6yjved", level: null, weblink: raw.weblink, timing: "ingame", runs: [{ place: 1, run }], players: { data: [{ id: "8dwqvy9j", names: { international: "Runner" }, weblink: "https://www.speedrun.com/users/runner", location: { country: { code: "gb" } } }] }, variables: raw.variables, platforms: { data: [{ id: "8gej2n93", name: "PC" }] } } };
test("A Short Hike full-game record survives unrelated individual-level default rules", () => {
  // Reduced from the live API: category-null variables can still be restricted to a single level.
  const variable = (id: string, category: string | null, type: string, choice: string, label: string) => ({
    id, category, name: "Version", scope: { type, ...(type === "single-level" ? { level: "y9myqk59" } : {}) },
    "is-subcategory": true, values: { default: choice, values: { [choice]: { label } } },
  });
  const ash = { ...raw, id: "pdvzpo46", names: { international: "A Short Hike" }, weblink: "https://www.speedrun.com/ash",
    categories: { data: [{ id: "7dg4xwgd", name: "Any%", type: "per-game" }] },
    variables: { data: [
      variable("dloo4zdl", "7dg4xwgd", "global", "1gno9nxl", "No OoB"),
      variable("rn106oo8", "7dg4xwgd", "full-game", "81pwrdkl", "1.8+"),
      variable("p8540o7l", "rklv68qd", "full-game", "jqz7oxml", "1.8+"),
      variable("ylqmdjwn", null, "single-level", "81ww6ro1", "1.7+"),
      variable("gnxvmexl", null, "single-level", "013ez4dq", "1.7+"),
      variable("dloyxj58", null, "single-level", "5legpv51", "1.7+"),
      variable("yn25kxgn", null, "single-level", "p12eg471", "1.7+"),
    ] },
  };
  const parsed = parseSpeedrunGame({ data: [ash] }, "A Short Hike")!, selected = parsed.categories[0]!;
  assert.deepEqual(selected.filters, { dloo4zdl: "1gno9nxl", rn106oo8: "81pwrdkl" });
  const record = { ...run, id: "zngwj2vm", game: ash.id, category: selected.id, weblink: "https://www.speedrun.com/ash/runs/zngwj2vm",
    times: { realtime_t: 152.869 }, values: { dloo4zdl: "1gno9nxl", rn106oo8: "81pwrdkl" } };
  const result = parseSpeedrunBoard({ data: { ...board.data, game: ash.id, category: selected.id, weblink: ash.weblink, timing: "realtime", variables: ash.variables, runs: [{ place: 1, run: record }] } }, parsed, selected);
  assert.equal(result.records[0]?.id, "zngwj2vm");
  assert.equal(speedrunTime(result.records[0]!.seconds), "2:32.869");
});

test("full-game filters honor variable scope, category, subcategory and valid defaults together", () => {
  const base = raw.variables.data[0]!;
  for (const scope of ["global", "full-game", "all-levels", "single-level", "unknown", undefined]) {
    for (const category of [null, "wk6yjved", "11111111"]) {
      const parsed = parseSpeedrunGame({ data: [{ ...raw, variables: { data: [{ ...base, scope: scope ? { type: scope } : undefined, category }] } }] }, "Hades II")!;
      assert.deepEqual(parsed.categories[0]!.filters, ["global", "full-game"].includes(scope!) && category !== "11111111" ? { onv5935l: "lr3pxxml" } : {}, `${scope}/${category}`);
    }
  }
  for (const change of [{ "is-subcategory": false }, { values: { ...base.values, default: null } }, { values: { ...base.values, default: "11111111" } }]) {
    const parsed = parseSpeedrunGame({ data: [{ ...raw, variables: { data: [{ ...base, ...change }] } }] }, "Hades II")!;
    assert.deepEqual(parsed.categories[0]!.filters, {});
  }
});

test("records require exact identity, verified status, selected rules and resolved runners", () => {
  const result = parseSpeedrunBoard(board, game, game.categories[0]!, 123);
  assert.equal(result.records[0].runners[0].name, "Runner"); assert.equal(result.records[0].runners[0].country, "GB"); assert.equal(result.at, 123); assert.equal(result.records[0].seconds, 191.82);
  assert.throws(() => parseSpeedrunBoard({ data: { ...board.data, game: "11111111" } }, game, game.categories[0]!));
  for (const changed of [{ status: { status: "new" } }, { values: { onv5935l: "oldpatch" } }, { times: { ingame_t: NaN } }, { players: [] }, { weblink: "javascript:alert(1)" }]) {
    assert.equal(parseSpeedrunBoard({ data: { ...board.data, runs: [{ place: 1, run: { ...run, ...changed } }] } }, game, game.categories[0]!).records.length, 0);
  }
});
test("duration formatting preserves precise milliseconds and hour boundaries", () => {
  assert.equal(speedrunTime(191.82), "3:11.820"); assert.equal(speedrunTime(3601), "1:00:01"); assert.equal(speedrunTime(59.9999), "1:00");
});

test("verified records retain deduplicated video links and still work without videos", () => {
  const videos = { links: [{ uri: "https://youtu.be/e-3AMKuHX94" }, { uri: "https://www.youtube.com/watch?v=e-3AMKuHX94" }, { uri: "https://www.twitch.tv/videos/123456789?t=1h2m3s" }, { uri: "javascript:alert(1)" }] };
  const result = parseSpeedrunBoard({ data: { ...board.data, runs: [{ place: 1, run: { ...run, videos } }] } }, game, game.categories[0]!);
  assert.equal(result.records[0].videos.length, 2);
  assert.equal(result.records[0].videos[1].start, 3723);
  assert.deepEqual(parseSpeedrunBoard(board, game, game.categories[0]!).records[0].videos, []);
});

test("YouTube and Twitch video URLs preserve timestamps and create only trusted embeds", () => {
  const youtube = parseSpeedrunVideo("http://youtu.be/e-3AMKuHX94?t=2m4s")!;
  assert.equal(youtube.url, "https://www.youtube.com/watch?v=e-3AMKuHX94&t=124s");
  assert.equal(speedrunVideoEmbed(youtube, "tauri.localhost"), "https://www.youtube-nocookie.com/embed/e-3AMKuHX94?autoplay=1&rel=0&playsinline=1&start=124");
  for (const path of ["embed", "shorts", "live"]) assert.equal(parseSpeedrunVideo(`https://www.youtube.com/${path}/e-3AMKuHX94`)?.id, youtube.id);
  const twitch = parseSpeedrunVideo("https://www.twitch.tv/videos/123456789?t=1h2m3s")!;
  const embed = new URL(speedrunVideoEmbed(twitch, "tauri.localhost")!);
  assert.equal(embed.hostname, "player.twitch.tv"); assert.equal(embed.searchParams.get("video"), "v123456789"); assert.equal(embed.searchParams.get("parent"), "tauri.localhost"); assert.equal(embed.searchParams.get("time"), "3723s");
  assert.equal(parseSpeedrunVideo("https://clips.twitch.tv/Example-Clip")?.kind, "twitch-clip");
  assert.equal(parseSpeedrunVideo("https://www.twitch.tv/runner/clip/Example-Clip")?.kind, "twitch-clip");
  assert.equal(speedrunVideoEmbed(parseSpeedrunVideo("https://vimeo.com/12345")!, "localhost"), null);
});

test("video parsing rejects unsafe, malformed and lookalike links", () => {
  for (const uri of ["javascript:alert(1)", "data:text/html,hello", "file:///run.mp4", "https://youtube.com.evil.test/watch?v=e-3AMKuHX94", "https://user:secret@youtube.com/watch?v=e-3AMKuHX94", "https://youtube.com:444/watch?v=e-3AMKuHX94", "https://youtube.com/watch?v=bad", "https://www.twitch.tv/runner", "https://example.org/run.mp4", "https://vimeo.com/"]) assert.equal(parseSpeedrunVideo(uri), null, uri);
  assert.equal(parseSpeedrunVideo("https://youtu.be/e-3AMKuHX94?t=99999999999999")?.start, 0);
  assert.equal(speedrunVideoEmbed(parseSpeedrunVideo("https://twitch.tv/videos/123")!, "bad&parent=other.example"), null);
});
