// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  enterMusicVideoFullscreen,
  exitMusicVideoFullscreen,
  getMusicVideoFullscreen,
  musicVideoFullscreenActive,
  resetMusicVideoFullscreen,
  setMusicVideoFullscreenStage,
  subscribeMusicVideoFullscreen,
  toggleMusicVideoFullscreen,
} from "../src/lib/music/video-fullscreen.ts";

const stage = { tagName: "DIV" } as unknown as HTMLElement;
const other = { tagName: "SECTION" } as unknown as HTMLElement;

function fresh() {
  resetMusicVideoFullscreen();
}

test("the store starts closed with no stage", () => {
  fresh();
  assert.equal(musicVideoFullscreenActive(), false);
  assert.deepEqual(getMusicVideoFullscreen(), { active: false, stage: null });
});

test("enter, exit and toggle move the flag and notify once each", () => {
  fresh();
  let notifications = 0;
  subscribeMusicVideoFullscreen(() => {
    notifications += 1;
  });

  enterMusicVideoFullscreen();
  assert.equal(musicVideoFullscreenActive(), true);
  assert.equal(notifications, 1);

  enterMusicVideoFullscreen();
  assert.equal(notifications, 1, "an unchanged state must not wake subscribers");

  toggleMusicVideoFullscreen();
  assert.equal(musicVideoFullscreenActive(), false);
  assert.equal(notifications, 2);

  toggleMusicVideoFullscreen();
  assert.equal(musicVideoFullscreenActive(), true);
  assert.equal(notifications, 3);

  exitMusicVideoFullscreen();
  assert.equal(musicVideoFullscreenActive(), false);
  assert.equal(notifications, 4);

  exitMusicVideoFullscreen();
  assert.equal(notifications, 4);
});

test("unsubscribing stops notifications", () => {
  fresh();
  let notifications = 0;
  const stop = subscribeMusicVideoFullscreen(() => {
    notifications += 1;
  });
  enterMusicVideoFullscreen();
  stop();
  exitMusicVideoFullscreen();
  assert.equal(notifications, 1);
});

test("the snapshot is stable between changes so useSyncExternalStore cannot loop", () => {
  fresh();
  const first = getMusicVideoFullscreen();
  assert.equal(getMusicVideoFullscreen(), first);
  enterMusicVideoFullscreen();
  const second = getMusicVideoFullscreen();
  assert.notEqual(second, first);
  assert.equal(getMusicVideoFullscreen(), second);
  enterMusicVideoFullscreen();
  assert.equal(getMusicVideoFullscreen(), second);
});

test("a stage is only held while fullscreen and is dropped on exit", () => {
  fresh();
  setMusicVideoFullscreenStage(stage);
  assert.equal(getMusicVideoFullscreen().stage, null, "a windowed stage offer is refused");

  enterMusicVideoFullscreen();
  setMusicVideoFullscreenStage(stage);
  assert.equal(getMusicVideoFullscreen().stage, stage);

  setMusicVideoFullscreenStage(other);
  assert.equal(getMusicVideoFullscreen().stage, other);

  exitMusicVideoFullscreen();
  assert.deepEqual(getMusicVideoFullscreen(), { active: false, stage: null });
});

test("a stage swap notifies subscribers", () => {
  fresh();
  let notifications = 0;
  enterMusicVideoFullscreen();
  subscribeMusicVideoFullscreen(() => {
    notifications += 1;
  });
  setMusicVideoFullscreenStage(stage);
  assert.equal(notifications, 1);
  setMusicVideoFullscreenStage(stage);
  assert.equal(notifications, 1);
  setMusicVideoFullscreenStage(null);
  assert.equal(notifications, 2);
});
