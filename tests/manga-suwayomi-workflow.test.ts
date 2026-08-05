// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("extension changes invalidate tags and refresh installed sources", () => {
  const api = source("../src/lib/manga/sources/suwayomi/api.ts");
  const graphql = source("../src/lib/manga/sources/suwayomi/graphql.ts");
  const tags = source("../src/lib/manga/api.ts");
  const picker = source("../src/views/manga/manga-sources-panel/suwayomi/source-picker.tsx");
  assert.match(api, /notifySuwayomiSourcesChanged\(client\.server\.base\)/);
  assert.match(api, /withTransportFallback\(client, async \(transport\)/);
  assert.match(graphql, /patch === "uninstall" \? extension\.isInstalled === false/);
  assert.match(tags, /suwayomiSourcesRevision\(\)/);
  assert.match(picker, /subscribeSuwayomiSourcesChanged/);
});

test("manga phone joystick uses direct horizontal and vertical pan directions", () => {
  const joystick = source("../src/views/mobile/manga-remote/zoom-joystick.tsx");
  assert.match(joystick, /panRemXRef\.current \+= px \* PAN_SPEED \* dt/);
  assert.match(joystick, /panRemYRef\.current \+= py \* PAN_SPEED \* dt/);
  assert.doesNotMatch(joystick, /rl \? -1 : 1/);
});

test("available extensions are collapsed until opened or searched", () => {
  const manager = source("../src/views/manga/manga-sources-panel/suwayomi/extensions-manager.tsx");
  assert.match(manager, /useState\(false\)/);
  assert.match(manager, /aria-expanded=\{expanded\}/);
  assert.match(manager, /hidden=\{collapsible && !expanded\}/);
  assert.match(manager, /if \(e\.target\.value\.trim\(\)\) setAvailableExpanded\(true\)/);
});

test("universe matching searches installed sources instead of only the library", () => {
  const provider = source("../src/lib/manga/sources/suwayomi/provider.ts");
  const aggregate = source("../src/lib/manga/sources/aggregate.ts");
  const universes = source("../src/views/manga/manga-universes.tsx");
  assert.match(provider, /SEARCH_ALL_CONCURRENCY = 4/);
  assert.match(provider, /makeClient\(server, 0\)/);
  assert.match(provider, /Promise\.race\(\[all, exact\]\)/);
  assert.match(aggregate, /searchAll: mergeSearchLists/);
  assert.match(universes, /searchMangaEverywhere\(u\.query\)/);
});

test("Harbor favorites mirror the Suwayomi library state", () => {
  const favorites = source("../src/lib/manga-favorites.tsx");
  const rest = source("../src/lib/manga/sources/suwayomi/rest.ts");
  const graphql = source("../src/lib/manga/sources/suwayomi/graphql.ts");
  assert.match(favorites, /syncLibrary\(input\.id, true\)/);
  assert.match(rest, /\/api\/v1\/manga\/\$\{mangaId\}\/library/);
  assert.match(
    graphql,
    /updateManga\(input: \{ id: \$id, patch: \{ inLibrary: \$inLibrary \} \}\)/,
  );
});

test("chapter batches expose pause and resume controls", () => {
  const downloads = source("../src/lib/manga-downloads.ts");
  const chapters = source("../src/views/manga/manga-detail/chapter-list.tsx");
  assert.match(downloads, /export function pauseMangaDownloadBatch/);
  assert.match(downloads, /await waitForBatch\(batchControl\)/);
  assert.match(chapters, /t\("Pause downloads"\)/);
  assert.match(chapters, /t\("Resume downloads"\)/);
});

test("Suwayomi browse results include alphabetical ordering", () => {
  const browse = source("../src/views/manga/manga-sources-panel/suwayomi/browse-results.tsx");
  assert.match(browse, /type BrowseSort = "popular" \| "latest" \| "alphabetical"/);
  assert.match(browse, /a\.title\.localeCompare\(b\.title\)/);
});
