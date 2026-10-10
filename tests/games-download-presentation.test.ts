import assert from "node:assert/strict";
import test from "node:test";
import { appendDownloadSample, downloadGroup, downloadProgress, downloadRemaining, downloadSummary, featuredDownload, type DownloadItem } from "../src/lib/games/download-presentation.ts";

test("navigation counts unfinished transfers without treating paused or failed downloads as active", () => {
  const item = (kind: DownloadItem["kind"], status: string) => ({ kind, record: { status } }) as DownloadItem;
  assert.deepEqual(downloadSummary([]), { total: 0, active: 0, queued: 0, paused: 0, failed: 0 });
  assert.deepEqual(downloadSummary([
    item("direct", "complete"), item("direct", "canceled"), item("torrent", "complete"),
    item("direct", "connecting"), item("torrent", "checking"), item("torrent", "downloading"),
    item("direct", "retrying"), item("direct", "pausing"), item("direct", "canceling"),
    item("direct", "queued"), item("torrent", "queued"), item("torrent", "paused"), item("direct", "failed"),
  ]), { total: 10, active: 6, queued: 2, paused: 1, failed: 1 });
  assert.deepEqual(downloadSummary([item("torrent", "paused"), item("direct", "failed")]), { total: 2, active: 0, queued: 0, paused: 1, failed: 1 });
});

test("the activity band survives completion and prefers known game artwork while idle", () => {
  const item = (id: string, status: string, updatedAt: number, artwork?: string) => ({ kind: "direct", record: { id, status, updatedAt, createdAt: updatedAt, ...(artwork ? { game: { id, name: id, artwork } } : {}) } }) as DownloadItem;
  const finished = item("finished", "complete", 100, "https://example.org/art.jpg"), legacy = item("legacy", "complete", 200), running = item("running", "downloading", 10);
  assert.equal(featuredDownload([finished, legacy, running]), running);
  assert.equal(featuredDownload([finished, legacy]), finished);
  assert.equal(featuredDownload([legacy]), legacy);
  assert.equal(featuredDownload([]), undefined);
  assert.equal(featuredDownload([finished, item("newer", "complete", 300, "https://example.org/new.jpg")])?.record.id, "newer");
});

test("download groups distinguish waiting, failures and files ready for installation", () => {
  const item = (kind: DownloadItem["kind"], status: string) => ({ kind, record: { status } }) as DownloadItem;
  for (const kind of ["torrent", "direct"] as const) {
    assert.equal(downloadGroup(item(kind, "queued")), "queue");
    assert.equal(downloadGroup(item(kind, "paused")), "queue");
    assert.equal(downloadGroup(item(kind, "failed")), "attention");
    assert.equal(downloadGroup(item(kind, "checking")), "active");
    assert.equal(downloadGroup(item(kind, "complete")), "complete");
  }
  assert.equal(downloadGroup(item("direct", "canceled")), "canceled");
});

test("chart history is bounded in elapsed time and does not invent missing seeders values", () => {
  let history = [] as Parameters<typeof appendDownloadSample>[0];
  for (let i = 0; i < 400; i++) history = appendDownloadSample(history, { time: i * 1000, network: i, ...(i % 2 ? { seeders: i * 2 } : {}) });
  assert.equal(history.length, 120);
  assert.equal(history[0].time, 280000);
  assert.equal(history[0].seeders, undefined);
  assert.equal(history[1].seeders, 562);
  assert.equal(appendDownloadSample(history, { time: 1000000, network: 10 }).length, 1);
  assert.deepEqual(appendDownloadSample([], { time: 1, network: NaN, seeders: -3 }), [{ time: 1, network: 0, seeders: undefined }]);
});

test("unknown size and stopped transfer do not display fabricated progress or ETA", () => {
  assert.equal(downloadProgress(50, 0), undefined);
  assert.equal(downloadProgress(50, null), undefined);
  assert.equal(downloadProgress(120, 100), 100);
  assert.equal(downloadProgress(-1, 100), 0);
  assert.equal(downloadRemaining(20, 100, 0), undefined);
  assert.equal(downloadRemaining(20, null, 1), undefined);
  assert.equal(downloadRemaining(100, 100, 1), undefined);
  assert.equal(downloadRemaining(20, 100, 2), "0:40");
  assert.equal(downloadRemaining(0, 3661, 1), "1:01:01");
});
