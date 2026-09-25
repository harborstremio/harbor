import assert from "node:assert/strict";
import test from "node:test";
import {
  downloadRequestVisibility,
  contextDownloadTask,
  selectedDownloadEpisode,
} from "../src/lib/download/contextual-preparation";
import { episodeSpoilerMasks } from "../src/lib/spoilers";
import type { DownloadItem } from "../src/lib/download/downloads-store";

test("an older canceled or completed copy cannot shadow an active exact-episode transfer", () => {
  const task = (id: string, status: DownloadItem["status"], season = 1, episode = 2) =>
    ({ id, status, metaId: "fixture", season, episode, startedAt: 1 }) as DownloadItem;
  const active = task("current", "paused");
  const items = [
    task("old-canceled", "canceled"),
    task("old-done", "done"),
    active,
    task("other", "downloading", 2, 2),
  ];
  assert.equal(contextDownloadTask(items, "fixture", { season: 1, episode: 2 }), active);
  assert.equal(contextDownloadTask(items, "fixture"), null);
  assert.equal(contextDownloadTask(items, "another", { season: 1, episode: 2 }), null);
  assert.equal(items[0].id, "old-canceled", "the shared snapshot order is not mutated");
});

test("download preparation retains only its own picker and original page", () => {
  const request = { actorKey: "a", path: "/home", token: "download:1" };
  assert.equal(downloadRequestVisibility(request, { actorKey: "a", path: "/home" }), "panel");
  assert.equal(
    downloadRequestVisibility(request, {
      actorKey: "a",
      path: "/picker",
      pickerToken: "download:1",
    }),
    "picker",
  );
  assert.equal(downloadRequestVisibility(request, { actorKey: "b", path: "/home" }), "invalid");
  assert.equal(
    downloadRequestVisibility(request, {
      actorKey: "a",
      path: "/picker",
      pickerToken: "download:2",
    }),
    "invalid",
  );
  assert.equal(downloadRequestVisibility(request, { actorKey: "a", path: "/detail" }), "invalid");
});

test("episode selection retains provider identities and explicit requested episode", () => {
  const requested = {
    season: 2,
    episode: 3,
    sourceMetaId: "kitsu:7",
    videoId: "provider-7",
    imdbSeason: 1,
    imdbEpisode: 15,
  };
  const loaded = { season: 2, episode: 3, name: "Localized", still: "still" };
  assert.deepEqual(selectedDownloadEpisode(loaded, requested), { ...loaded, ...requested });
  assert.deepEqual(selectedDownloadEpisode({ season: 1, episode: 3 }, requested), {
    season: 1,
    episode: 3,
  });
});

test("shared episode spoiler sequence preserves watched and next-up exceptions without loading flash", () => {
  const settings = {
    hideSpoilers: true,
    spoilerHideThumbnails: true,
    spoilerHideTitles: true,
    spoilerHideDescriptions: true,
    spoilerSkipNext: true,
  };
  const eps = [1, 2, 3];
  const pending = episodeSpoilerMasks(settings, eps, (ep) => ep === 1, true);
  assert.equal(pending.get(1)?.thumb, false);
  assert.equal(pending.get(2)?.thumb, true);
  const ready = episodeSpoilerMasks(settings, eps, (ep) => ep === 1);
  assert.equal(ready.get(2)?.thumb, false);
  assert.equal(ready.get(3)?.thumb, true);
  const custom = episodeSpoilerMasks(
    { ...settings, spoilerSkipNext: false, spoilerHideTitles: false },
    eps,
    () => false,
  );
  assert.deepEqual(custom.get(1), { thumb: true, title: false, desc: true });
});
