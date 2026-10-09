import test from "node:test";
import assert from "node:assert/strict";
import { mergeSetupJob, setupDetectedExecutable, setupExecutable, setupInstalledExecutable, setupInstallFolder, setupJobForSource, setupLibraryGame, setupPath, type SetupJob, type SetupPlan } from "../src/lib/games/setup.ts";
import { registeredSetupGame, rememberSetupContext } from "../src/lib/games/setup-context.ts";
import { customLinkedGame, emptyCustomLibrary, parseCustomLibrary, upsertCustomGame } from "../src/lib/games/custom-library.ts";

const source = { source: "W:\\Downloads\\Example", name: "Example game — installer", game: { id: "steam:123", name: "Example game", artwork: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/123/library_hero.jpg" } };
const running: SetupJob = { id: "job-1", profile: "one", source: source.source, installer: "setup.exe", startedAt: 100, updatedAt: 100, status: "running", exitCode: null, error: null };

test("torrent wrappers need download review and never become an installed-game candidate", () => {
  const torrent = { id: "torrent", path: "W:/Downloads/release.torrent", relativePath: "release.torrent", bytes: 12771, kind: "torrent" as const };
  const game = { id: "game", path: "W:/Downloads/Game.exe", relativePath: "Game.exe", bytes: 1024, kind: "game" as const };
  const plan: SetupPlan = { token: "review", root: "W:/Downloads", truncated: false, entries: [torrent] };
  assert.equal(setupDetectedExecutable(plan, "Game"), undefined);
  assert.equal(setupDetectedExecutable({ ...plan, entries: [game, torrent] }, "Game"), undefined);
  assert.equal(setupDetectedExecutable({ ...plan, entries: [game] }, "Game"), game.path);
});

test("setup paths retain Unix case and match canonical Windows paths", () => {
  assert.equal(setupPath("\\\\?\\UNC\\Server\\Games\\Homebrew.gba"), setupPath("\\\\server\\games\\homebrew.gba"));
  assert.equal(setupPath("\\\\?\\W:\\Downloads\\Example\\"), setupPath("w:/downloads/example"));
  assert.notEqual(setupPath("/games/Example"), setupPath("/games/example"));
});

test("late running events and stale snapshots cannot regress finished installer jobs", () => {
  const finished = { ...running, status: "finished" as const, updatedAt: 102, exitCode: 0 };
  const result = mergeSetupJob([running], finished, "one");
  assert.deepEqual(mergeSetupJob(result, running, "one"), result);
  assert.deepEqual(mergeSetupJob(result, { ...running, updatedAt: 102 }, "one"), result);
  assert.deepEqual(mergeSetupJob(result, { ...running, profile: "two", updatedAt: 200 }, "one"), result);
  assert.equal(result[0].status, "finished");
  assert.equal("installed" in result[0], false);
});

test("setup chooses latest attempt for exact destination without overlapping folder matches", () => {
  const newer = { ...running, id: "job-2", startedAt: 200 };
  const other = { ...newer, id: "job-3", source: `${source.source} sequel`, startedAt: 300 };
  assert.equal(setupJobForSource([running, newer, other], "w:/downloads/example")?.id, newer.id);
  assert.equal(setupJobForSource([running], "W:\\Downloads"), undefined);
});

test("only a fresh native reconnect can resume an interrupted installer in the UI", () => {
  const interrupted: SetupJob = { ...running, status: "interrupted", updatedAt: 200 };
  const recovered: SetupJob = { ...running, updatedAt: 202, reconnectedAt: 201 };
  assert.equal(mergeSetupJob([interrupted], recovered, "one")[0].status, "running");
  for (const reconnectedAt of [null, undefined, 200, 203, NaN, Infinity]) {
    assert.deepEqual(mergeSetupJob([interrupted], { ...recovered, reconnectedAt }, "one"), [interrupted]);
  }
  const finished: SetupJob = { ...interrupted, status: "finished" };
  assert.deepEqual(mergeSetupJob([finished], recovered, "one"), [finished]);
  assert.deepEqual(mergeSetupJob([interrupted], { ...recovered, profile: "two" }, "one"), [interrupted]);
});

test("a Steam-only verified download retains its identity and original art in local library storage", () => {
  const game = setupLibraryGame(source, "W:\\Games\\example.exe", "Example game", [], 1000);
  const parsed = parseCustomLibrary(JSON.stringify(upsertCustomGame(emptyCustomLibrary(), game))).games[0];
  assert.equal(parsed.linked?.id, "steam:123");
  assert.equal(parsed.linked?.steamId, 123);
  assert.equal(parsed.linked?.igdbId, undefined);
  assert.equal(parsed.linked?.capsule, source.game.artwork);
  assert.equal(parsed.measuredSeconds, 0);
  assert.equal(parsed.lastPlayed, 0);
  assert.equal(parsed.config.arguments.length, 0);
});

test("adding the same executable preserves existing identity, launch settings, and history", () => {
  const previous = { ...setupLibraryGame(source, "W:\\Games\\example.exe", "My name", [], 1000), pinned: true, measuredSeconds: 125, lastPlayed: 2000 };
  previous.config.arguments = ["--windowed"];
  const result = setupLibraryGame(source, "\\\\?\\w:\\games\\EXAMPLE.exe", "Different title", [previous], 3000);
  assert.equal(result, previous);
  assert.equal(result.name, "My name");
});

test("unknown download metadata stays unlinked while explicit IGDB identity is preserved", () => {
  assert.equal(setupLibraryGame({ source: "W:/file", name: "Unknown" }, "W:/game.exe", "Unknown", []).linked, null);
  assert.equal(setupLibraryGame({ ...source, game: { id: "igdb:456", name: "Exact" } }, "W:/game.exe", "Exact", []).linked?.igdbId, 456);
  assert.equal(customLinkedGame({ steamId: 0, name: "Unknown" }), null);
  assert.equal(customLinkedGame({ igdbId: -1, name: "Unknown" }), null);
});

test("setup job history stays bounded without mixing profiles", () => {
  let jobs: SetupJob[] = [];
  for (let index = 0; index < 240; index++) jobs = mergeSetupJob(jobs, { ...running, id: String(index), startedAt: index }, "one");
  assert.equal(jobs.length, 200);
  assert.equal(jobs[0].id, "239");
  assert.equal(jobs.at(-1)?.id, "40");
});

test("automatic executable choice excludes helpers and never ranks unrelated programs by size", () => {
  assert.equal(setupExecutable(["W:/Games/Test/setup.exe", "W:/Games/Test/Engine/Binaries/CrashReportClient.exe", "W:/Games/Test/Game.exe"], "Test"), "W:/Games/Test/Game.exe");
  assert.equal(setupExecutable(["W:/Games/Test/Client.exe", "W:/Games/Test/Server.exe"], "Test"), undefined);
  assert.equal(setupExecutable(["W:/Games/Test/setup.exe", "W:/Games/Test/unins000.exe"], "Test"), undefined);
  assert.equal(setupExecutable(["W:/Games/Test/Game.exe", "w:\\games\\test\\game.EXE"], "Game"), "w:\\games\\test\\game.EXE");
});

test("exact game title prefers its bootstrap but ambiguous editions still need a choice", () => {
  const bootstrap = "W:/Games/Nivalis Nights/NivalisNights.exe";
  assert.equal(setupExecutable(["W:/Games/Nivalis Nights/Binaries/Win64/NivalisNights-Win64-Shipping.exe", bootstrap], "Nivalis Nights"), bootstrap);
  assert.equal(setupExecutable(["W:/Games/edition-a/Game.exe", "W:/Games/edition-b/Game.exe"], "Game"), undefined);
  assert.equal(setupExecutable(["/games/游戏/游戏.exe", "/games/游戏/Server.exe"], "游戏"), "/games/游戏/游戏.exe");
});

test("portable detection cannot bypass an installer, archive, or incomplete scan", () => {
  const plan: SetupPlan = { token: "one", root: "W:/Game", truncated: false, entries: [{ id: "game", path: "W:/Game/Game.exe", relativePath: "Game.exe", kind: "game", bytes: 500 }] };
  assert.equal(setupDetectedExecutable(plan, "Game"), "W:/Game/Game.exe");
  assert.equal(setupDetectedExecutable({ ...plan, truncated: true }, "Game"), undefined);
  assert.equal(setupDetectedExecutable({ ...plan, entries: [...plan.entries, { id: "setup", path: "W:/Game/setup.exe", relativePath: "setup.exe", kind: "installer", bytes: 50 }] }, "Game"), undefined);
});

test("install destination makes a named child and rejects reserved device names", () => {
  assert.equal(setupInstallFolder("W:\\Games\\", "Game: One"), "W:\\Games\\Game_ One");
  assert.equal(setupInstallFolder("/games/", "Test"), "/games/Test");
  assert.equal(setupInstallFolder("W:/Games", "CON"), "");
  assert.equal(setupInstallFolder("W:/Games", "..."), "");
});

test("deep data truncation only allows an exact launcher from a proven complete root scan", () => {
  const main = "D:\\Nivalis Nights\\Nivalis Nights.exe";
  const job: SetupJob = { ...running, status: "finished", exitCode: 0, destination: "D:\\Nivalis Nights", gameCandidates: [main, "D:\\Nivalis Nights\\_Redist\\QuickSFV.EXE"], scanTruncated: true };
  assert.equal(setupInstalledExecutable(job, "Nivalis Nights"), undefined);
  assert.equal(setupInstalledExecutable({ ...job, rootCandidatesComplete: true, rootGameCandidates: [main] }, "Nivalis Nights"), main);
  assert.equal(setupInstalledExecutable({ ...job, rootCandidatesComplete: true, rootGameCandidates: [main] }, "Other Game"), undefined);
  assert.equal(setupInstalledExecutable({ ...job, rootCandidatesComplete: false, rootGameCandidates: [main] }, "Nivalis Nights"), undefined);
  assert.equal(setupInstalledExecutable({ ...job, rootCandidatesComplete: true, rootGameCandidates: ["D:\\Other\\Nivalis Nights.exe"] }, "Nivalis Nights"), undefined);
  assert.equal(setupInstalledExecutable({ ...job, rootCandidatesComplete: true, rootGameCandidates: [main, "D:\\Nivalis Nights\\NivalisNights.exe"] }, "Nivalis Nights"), undefined);
});

test("manual recovery remembers the exact registered game, never just an installer outcome", () => {
  const job: SetupJob = { ...running, id: "manual-recovery", status: "finished", exitCode: 0, scanTruncated: true };
  const game = setupLibraryGame(source, "D:\\Games\\Example\\Game.exe", "Example", []);
  rememberSetupContext("one", job.id, source, game.config.executable);
  assert.equal(registeredSetupGame(job, "Example", [game]), game);
  assert.equal(registeredSetupGame(job, "Example", []), undefined);
  assert.equal(registeredSetupGame({ ...job, profile: "other" }, "Example", [game]), undefined);
  assert.equal(registeredSetupGame({ ...job, source: source.source + "2" }, "Example", [game]), undefined);
  assert.equal(registeredSetupGame({ ...job, status: "running" }, "Example", [game]), undefined);
  assert.equal(registeredSetupGame({ ...job, error: "setup_verification_unknown" }, "Example", [game]), undefined);
  assert.equal(registeredSetupGame({ ...job, error: "setup_review" }, "Example", [game]), game, "explicit validated selection completes a restart review");
  assert.equal(registeredSetupGame({ ...job, error: "setup_review", progress: { observedAt: 1, stage: "checking", verification: { checkedFiles: 2, totalFiles: 2, badFiles: 1 } } }, "Example", [game]), undefined, "review never clears a failed verification");
  rememberSetupContext("one", job.id, source);
  assert.equal(registeredSetupGame(job, "Example", [game]), game, "new events retain a confirmed selection");
});
