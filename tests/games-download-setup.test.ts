import test from "node:test";
import assert from "node:assert/strict";
import { downloadSetup, downloadSetupGroup, downloadSetupSummary, downloadSetupLabel } from "../src/lib/games/download-setup";
import { setupDuration, setupProgress, setupVerificationFailed } from "../src/lib/games/setup-progress";
import type { DownloadItem } from "../src/lib/games/download-presentation";
import type { SetupJob } from "../src/lib/games/setup";
import type { CustomGame } from "../src/lib/games/custom-library";

const item = { kind: "torrent", record: { profile: "one", status: "complete", destination: "D:\\Downloads\\Game", name: "Game" } } as DownloadItem;
const job: SetupJob = { id: "setup", profile: "one", source: "d:/Downloads/Game", installer: "setup.exe", destination: "D:\\Games\\Game", status: "running", startedAt: 1, updatedAt: 1, error: null, exitCode: null };

test("a running installer overrides completed transfer and is isolated by exact source/profile", () => {
  const state = downloadSetup(item, "one", [job], [], [], {});
  assert.equal(state?.phase, "installing");
  assert.equal(downloadSetupGroup(item, state), "active");
  assert.equal(downloadSetup(item, "two", [job], [], [], {}), undefined);
  assert.equal(downloadSetup(item, "one", [{ ...job, source: job.source + "2" }], [], [], {}), undefined);
  assert.equal(downloadSetup({ ...item, record: { ...item.record, status: "downloading" } } as DownloadItem, "one", [job], [], [], {}), undefined);
});
test("installer exit does not become ready until the exact game is registered", () => {
  const finished = { ...job, status: "finished" as const, exitCode: 0, gameCandidates: ["D:\\Games\\Game\\game.exe"] };
  const state = downloadSetup(item, "one", [finished], [], [], {});
  assert.equal(state?.phase, "attention");
  assert.equal(downloadSetupGroup(item, state), "attention");
  assert.equal(downloadSetup(item, "one", [finished], [], [job.id], {})?.phase, "registering");
  const game = { config: { executable: "d:/Games/Game/game.exe" } } as CustomGame;
  assert.equal(downloadSetup(item, "one", [finished], [game], [], {})?.phase, "ready");
  assert.equal(downloadSetup(item, "one", [{ ...finished, exitCode: 1 }], [game], [], {})?.phase, "attention");
  assert.equal(downloadSetup(item, "one", [{ ...finished, scanTruncated: true }], [game], [], {})?.phase, "attention");
  assert.equal(downloadSetup(item, "one", [finished], [], [], { setup: "games.custom.launch_failed" })?.error, "games.custom.launch_failed");
});
test("the most recent attempt supersedes an old completed installation", () => {
  const old = { ...job, id: "old", status: "finished" as const, exitCode: 0 };
  assert.equal(downloadSetup(item, "one", [old, { ...job, startedAt: 2 }], [], [], {})?.job.id, job.id);
});
test("navigation count covers installation without counting downloaded files twice", () => {
  const active = { ...item, record: { ...item.record, status: "downloading" } } as DownloadItem;
  const summary = downloadSetupSummary([item, active], value => downloadSetup(value, "one", [job], [], [], {}));
  assert.deepEqual(summary, { total: 2, active: 2, queued: 0, paused: 0, failed: 0 });
  assert.deepEqual(downloadSetupSummary([item], () => undefined), { total: 0, active: 0, queued: 0, paused: 0, failed: 0 });
});
test("only fresh explicit installer telemetry supplies percentages, files, timers or I/O", () => {
  assert.equal(setupProgress(job, 1000), undefined);
  const progress = { percent: 30.7, phase: "Unpacking...", currentFile: "28.fgpack", elapsedSeconds: 636, remainingSeconds: 1393, ioBytesPerSecond: 500, observedAt: 1000 };
  assert.equal(setupProgress({ ...job, progress }, 1000)?.percent, 30.7);
  assert.equal(setupProgress({ ...job, progress }, 11001), undefined);
  assert.equal(setupProgress({ ...job, status: "finished", progress }, 1000), undefined);
  assert.equal(setupProgress({ ...job, progress: { observedAt: 1000 } }, 1000)?.remainingSeconds, undefined);
  const invalid = setupProgress({ ...job, progress: { ...progress, percent: 101, elapsedSeconds: -1, ioBytesPerSecond: NaN } }, 1000);
  assert.equal(invalid?.percent, undefined); assert.equal(invalid?.elapsedSeconds, undefined); assert.equal(invalid?.ioBytesPerSecond, undefined);
  assert.equal(setupDuration(636), "10:36"); assert.equal(setupDuration(1393), "23:13"); assert.equal(setupDuration(3600), "1:00:00");
});

test("checking remains active and uses overall file counts, never a single-file percentage", () => {
  const checking: SetupJob = { ...job, progress: { observedAt: 1000, stage: "checking", percent: 7, verification: { checkedFiles: 36, totalFiles: 303, badFiles: 0, missingFiles: 0 } } };
  const state = downloadSetup(item, "one", [checking], [], [], {})!;
  assert.equal(state.phase, "checking");
  assert.equal(downloadSetupLabel(state), "games.setup.state.checking");
  assert.equal(downloadSetupGroup(item, state), "active");
  assert.equal(downloadSetupSummary([item], () => state).active, 1);
  assert.equal(setupProgress(checking, 1000)?.percent, 36 / 303 * 100);
  assert.equal(setupProgress({ ...checking, progress: { ...checking.progress!, verification: undefined } }, 1000)?.percent, undefined);
  for (const counts of [{ checkedFiles: 304, totalFiles: 303 }, { checkedFiles: 0, totalFiles: 0 }, { checkedFiles: 3.5, totalFiles: 303 }, { checkedFiles: NaN, totalFiles: 303 }]) {
    assert.equal(setupProgress({ ...checking, progress: { ...checking.progress!, verification: counts } }, 1000)?.percent, undefined);
  }
  assert.equal(setupProgress(checking, 11001), undefined);
  // Losing a live reading doesn't regress the known phase to Installing or claim Ready.
  assert.equal(state.phase, "checking");
});

test("failed or unconfirmed checks never become ready just because setup exited zero", () => {
  const finished: SetupJob = { ...job, status: "finished", exitCode: 0, gameCandidates: ["D:\\Games\\Game\\game.exe"], progress: { observedAt: 1, stage: "checking", verification: { checkedFiles: 303, totalFiles: 303, badFiles: 1, missingFiles: 0 } } };
  const game = { config: { executable: "D:\\Games\\Game\\game.exe" } } as CustomGame;
  assert.equal(setupVerificationFailed(finished), true);
  const failed = downloadSetup(item, "one", [finished], [game], [], {})!;
  assert.equal(failed.phase, "attention");
  assert.equal(downloadSetupLabel(failed), "games.setup.state.verificationFailed");
  const unknown = downloadSetup(item, "one", [{ ...finished, status: "external", error: "setup_verification_unknown", progress: undefined }], [game], [], {})!;
  assert.equal(unknown.phase, "attention");
  assert.equal(downloadSetupLabel(unknown), "games.setup.state.verificationUnknown");
});

test("restart review never hides a failed file check or claims an unreviewed candidate is ready", () => {
  const recovered: SetupJob = { ...job, status: "external", error: "setup_review", exitCode: 0, gameCandidates: ["D:/Games/Game/game.exe"] };
  const game = { config: { executable: "D:/Games/Game/game.exe" } } as CustomGame;
  const review = downloadSetup(item, "one", [recovered], [game], [], {})!;
  assert.equal(review.phase, "attention");
  assert.equal(downloadSetupLabel(review), "games.setup.review");
  const failed = { ...recovered, progress: { observedAt: 1, stage: "checking" as const, verification: { checkedFiles: 10, totalFiles: 10, badFiles: 1, missingFiles: 0 } } };
  assert.equal(downloadSetupLabel(downloadSetup(item, "one", [failed], [game], [], {})!), "games.setup.state.verificationFailed");
});
