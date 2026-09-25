import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import type { DownloadItem } from "../src/lib/download/downloads-store";
import type { PlayEpisode } from "../src/lib/view";

type SeasonModule = typeof import("../src/lib/download/season-download");
const meta = { id: "fixture:parent", type: "series", name: "Controlled title" } as const;
const episode = (n: number, sourceMetaId?: string): PlayEpisode => ({
  season: 1,
  episode: n,
  sourceMetaId,
});
const task = (n: number, status: DownloadItem["status"], source = meta.id, id = `task-${n}`) =>
  ({ id, metaId: source, season: 1, episode: n, status }) as DownloadItem;

function harness(initial: DownloadItem[] = []) {
  const items = [...initial];
  const existing = new Set<string>();
  const checks: string[] = [];
  const queued: Array<{ meta: { id: string }; episode: PlayEpisode }> = [];
  const mocks: Record<string, unknown> = {
    "@/lib/auto-download/resolve": {
      resolveBestDownload: async () => ({
        url: "https://fixture.invalid/video",
        label: "Controlled",
      }),
    },
    "@/lib/debrid/types": {},
    "@/lib/streams/resolve": {
      resolveStream: async () => ({ ok: true, data: { url: "https://fixture.invalid/video" } }),
    },
    "@/lib/streams/episode-file": {},
    "@/lib/local-library": {},
    "@/lib/torrent/stremio-stream": { localTorrentAllowed: () => false },
    "@/lib/torrent/local-engine": {},
    "@/lib/download/downloads-store": {
      activeDownloadFor: (id: string, s: number, e: number) =>
        items.find((item) => item.metaId === id && item.season === s && item.episode === e),
      downloadsSnapshot: () => items,
      completedDownloadFor: async (id: string, s: number, e: number) => {
        const key = `${id}:${s}:${e}`;
        checks.push(key);
        return existing.has(key) ? {} : null;
      },
      enqueueDownload: async (args: (typeof queued)[number]) => {
        queued.push(args);
        return "queued";
      },
    },
    "./season-pack": {
      streamForSeasonPackEpisode: (stream: unknown) => stream,
      seasonPackFileMatchesEpisode: () => true,
    },
  };
  const output = ts.transpileModule(
    readFileSync(new URL("../src/lib/download/season-download.ts", import.meta.url), "utf8"),
    {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    },
  ).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", output)(
    (id: string) => {
      assert.ok(id in mocks, id);
      return mocks[id];
    },
    module,
    module.exports,
  );
  return { api: module.exports as SeasonModule, items, existing, checks, queued };
}

test("season eligibility retries canceled tasks and resolves the episode source, without duplicating a newer active task", () => {
  const h = harness([
    task(1, "canceled"),
    task(2, "downloading", "fixture:child"),
    task(3, "canceled"),
    task(3, "downloading", meta.id, "new-3"),
  ]);
  assert.deepEqual(
    h.api.pendingSeasonEpisodes(meta.id, [episode(1), episode(2, "fixture:child"), episode(3)]),
    [episode(1)],
  );
});

test("a panel's verified missing file permits a destination without treating other completed records as missing", () => {
  const h = harness([task(1, "done"), task(2, "done")]);
  assert.deepEqual(
    h.api.pendingSeasonEpisodes(meta.id, [episode(1), episode(2)], new Set(["task-1"])),
    [episode(1)],
  );
});

for (const mode of ["pack", "episodes"] as const) {
  test(`${mode} execution rechecks completed files and preserves the source title before queueing`, async () => {
    const h = harness([task(1, "done"), task(2, "done"), task(3, "canceled", "fixture:child")]);
    h.existing.add(`${meta.id}:1:2`);
    const shared = {
      meta,
      episodes: [episode(1), episode(2), episode(3, "fixture:child")],
      debrids: [],
      signal: new AbortController().signal,
    };
    const result =
      mode === "pack"
        ? await h.api.downloadSeasonFromPack({ ...shared, stream: {} as never, streamLabel: null })
        : await h.api.downloadSeasonPerEpisode({ ...shared, addons: [], allowP2p: false });
    assert.deepEqual(result, { total: 2, queued: 2, failed: 0 });
    assert.deepEqual(h.checks, [`${meta.id}:1:1`, `${meta.id}:1:2`]);
    assert.deepEqual(
      h.queued.map((args) => [args.meta.id, args.episode.episode]),
      [
        [meta.id, 1],
        ["fixture:child", 3],
      ],
    );
  });
}

test("an already canceled season operation performs no file check or transfer", async () => {
  const h = harness([task(1, "done")]);
  const controller = new AbortController();
  controller.abort();
  const result = await h.api.downloadSeasonPerEpisode({
    meta,
    episodes: [episode(1)],
    addons: [],
    debrids: [],
    allowP2p: false,
    signal: controller.signal,
  });
  assert.deepEqual(result, { total: 0, queued: 0, failed: 0 });
  assert.equal(h.checks.length, 0);
  assert.equal(h.queued.length, 0);
});
