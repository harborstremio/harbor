import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import ts from "typescript";

function api() {
  const file = new URL("../src/lib/continue-card-actions.ts", import.meta.url);
  assert.ok(existsSync(file), "Continue Watching must expose a shared per-entry action source");
  const mod = { exports: {} as any };
  const output = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("module", "exports", output)(mod, mod.exports);
  return mod.exports;
}

const item = (id: string, upNext = false) => ({
  _id: id,
  type: "series",
  name: id,
  upNext,
  state: {
    video_id: `${id}:2:3`,
    season: 2,
    episode: 3,
    timeOffset: upNext ? 0 : 90000,
    duration: 600000,
  },
});

test("older and Up Next entries each expose contextual continuation and removal independently from latest playback", async () => {
  const { createContinueCardActions } = api();
  let globalLatest = "newest-a";
  const continued: any[] = [];
  const removed: string[] = [];
  for (const entry of [item("older-b"), item("up-next-c", true)]) {
    const commands = createContinueCardActions({
      item: entry,
      getItem: () => entry,
      isCurrent: () => true,
      isAvailable: () => true,
      t: (key: string) => key,
      play: async (assertCurrent: () => void) => {
        assertCurrent();
        continued.push(entry);
      },
      chooseSource: async () => {},
      dismiss: async () => {
        removed.push(entry._id);
      },
    });
    const actions = commands.primary.actions();
    assert.equal(actions[0].label, "Continue watching");
    assert.equal(actions.length, 2, "primary continuation and alternate sources remain distinct");
    await actions[0].run();
    const remove = commands.extra.actions()[0];
    assert.equal(remove.label, "Remove from Continue Watching");
    await remove.run();
    assert.equal(commands.isValid(), false);
    await assert.rejects(commands.play(), /no longer available/);
  }
  assert.deepEqual(
    continued.map((i) => [i._id, i.upNext, i.state.video_id, i.state.timeOffset]),
    [
      ["older-b", false, "older-b:2:3", 90000],
      ["up-next-c", true, "up-next-c:2:3", 0],
    ],
  );
  assert.deepEqual(removed, ["older-b", "up-next-c"]);
  assert.equal(globalLatest, "newest-a");
});

test("a pending primary operation blocks original controls and menu commands; actor change stops asynchronous continuation", async () => {
  const { createContinueCardActions } = api();
  const entry = item("older-b");
  let current = true;
  let finish!: () => void;
  let starts = 0;
  const commands = createContinueCardActions({
    item: entry,
    getItem: () => entry,
    isCurrent: () => current,
    isAvailable: () => true,
    t: (key: string) => key,
    play: async (assertCurrent: () => void) => {
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      assertCurrent();
      starts++;
    },
    chooseSource: async () => {
      starts++;
    },
    dismiss: async () => {
      starts++;
    },
  });
  const pending = commands.primary.actions()[0].run();
  assert.equal(commands.primary.actions()[0].disabled, true);
  await assert.rejects(commands.play(), /already running/);
  await assert.rejects(commands.extra.actions()[0].run(), /already running/);
  current = false;
  finish();
  await assert.rejects(pending, /no longer available/);
  assert.equal(starts, 0);
});

test("harmless metadata rerender preserves a menu but replacement entry invalidates its captured command", async () => {
  const { createContinueCardActions } = api();
  const entry = item("older-b");
  let current = entry;
  let starts = 0;
  const commands = createContinueCardActions({
    item: entry,
    getItem: () => current,
    isCurrent: () => true,
    isAvailable: () => true,
    t: (key: string) => key,
    play: async () => {
      starts++;
    },
    chooseSource: async () => {},
  });
  current = { ...entry, name: "Hydrated title" };
  assert.equal(commands.isValid(), true);
  await commands.play();
  current = { ...entry, state: { ...entry.state, episode: 4, video_id: "older-b:2:4" } };
  assert.equal(commands.isValid(), false);
  await assert.rejects(commands.play(), /no longer available/);
  assert.equal(starts, 1);
  assert.deepEqual(commands.extra.actions(), [], "no unsupported removal is invented");
});

test("removal failure remains retryable while unavailable cards cannot continue or use another source", async () => {
  const { createContinueCardActions } = api();
  const entry = { ...item("future"), waitingForAir: true };
  let fails = true;
  const commands = createContinueCardActions({
    item: entry,
    getItem: () => entry,
    isCurrent: () => true,
    isAvailable: () => true,
    t: (key: string) => key,
    play: async () => assert.fail("Future episode played"),
    chooseSource: async () => assert.fail("Future episode selected"),
    dismiss: async () => {
      if (fails) throw new Error("Storage unavailable");
    },
  });
  assert.ok(commands.primary.actions().every((action: any) => action.disabled));
  await assert.rejects(commands.play());
  await assert.rejects(commands.dismiss(), /Storage/);
  assert.equal(commands.isValid(), true);
  fails = false;
  await commands.dismiss();
  assert.equal(commands.isValid(), false);
});
