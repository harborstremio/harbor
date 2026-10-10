import assert from "node:assert/strict";
import test from "node:test";
import { hookHarness } from "./helpers/hook-harness.ts";

const item = (id: string, external?: string) => ({
  _id: id, type: "series", name: id, isAnime: true, external, removed: false,
  _mtime: "2026-10-01T00:00:00Z",
  state: { timeOffset: 100000, duration: 1000000, season: 1, episode: 1 },
});
function harness(bigPicture: boolean, sources: any, privateProfile = false) {
  const settings = { cwSources: sources, cwPerProfile: privateProfile };
  let enabled = false;
  const masks: any[] = [];
  let trackerItems = [item("kitsu:100", "simkl"), item("kitsu:200", "trakt")];
  const local = ["library", "local"].map((source, n) => ({
    id: `kitsu:${300 + n}`, type: "series", name: source, isAnime: true, source,
    positionMs: 100000, durationMs: 1000000, season: 1, episode: 1, t: Date.now(),
  }));
  const noop = () => {};
  const mocks = {
    "@/lib/auth": { useAuth: () => ({ authKey: null }) },
    "@/lib/profiles": { useProfiles: () => ({ activeProfile: { id: "test" }, profiles: [] }), anyProfileSharesStremioWith: () => true },
    "@/lib/settings": { useSettings: () => ({ settings }) },
    "@/lib/local-cw": { listLocalCw: () => local, subscribeLocalCw: () => noop, localCwVersion: () => 0 },
    "@/lib/feed/external-cw": { setExternalCwSources: (mask: any) => masks.push(mask), useExternalCw: (active: boolean) => { enabled = active; return trackerItems; } },
    "@/lib/stremio": { ANIME_CLOUD_ID: /^(kitsu|mal):/, isCwMember: () => true, cwMemberViaResume: () => false,
      cwSortKey: () => 1, episodeFromVideoId: () => null, library: async () => [], isAnimeCwItem: () => true },
    "@/lib/addons-anime-filter": { loadAnimeAddonRows: () => noop },
    "@/lib/anime-cw-absorb": { absorbCloudAnimeCw: noop },
    "@/lib/anime-detect": { detectAnimeForCw: noop, useDetectedAnimeVersion: () => 0 },
    "@/lib/cw-dismiss": { isCwDismissed: () => false, useCwDismissVersion: () => 0 },
    "@/lib/providers/anime-franchise-root": { franchiseRootSync: (id: string) => id },
    "@/lib/hover-preview/store": { publishResumeStates: noop },
    "@/lib/run-lanes": {},
    "@/lib/manual-watched": { manualWatchedLibraryItems: () => [], subscribeManualWatched: () => noop, manualWatchedVersion: () => 0 },
  };
  const h = hookHarness(bigPicture ? "src/views/big-picture/use-bp-anime-cw.ts" : "src/lib/continue-watching.ts",
    bigPicture ? "useBpAnimeCwBase" : "useContinueWatching", mocks,
    { window: { setTimeout: () => 1, clearTimeout: noop, addEventListener: noop, removeEventListener: noop }, document: { visibilityState: "visible", addEventListener: noop, removeEventListener: noop } });
  return { settings, masks, publishTrackerItems(next: typeof trackerItems) { trackerItems = next; }, get enabled() { return enabled; },
    ids() { const result = h.render(); return (bigPicture ? result.raw : result).map((i: any) => i._id ?? i.id); } };
}

for (const bigPicture of [false, true]) {
  test(`${bigPicture ? "Big Picture anime" : "shared CW"}: library fallback follows the library toggle`, () => {
    const h = harness(bigPicture, { library: true, local: false, simkl: false, trakt: false });
    assert.deepEqual(h.ids(), ["kitsu:300"]);
    h.settings.cwSources = { library: false, local: true, simkl: false, trakt: false };
    assert.deepEqual(h.ids(), ["kitsu:301"]);
  });
  test(`${bigPicture ? "Big Picture anime" : "shared CW"}: Simkl refresh does not require Trakt`, () => {
    const h = harness(bigPicture, { library: false, local: false, simkl: true, trakt: false });
    assert.deepEqual(h.ids(), ["kitsu:100"]); assert.equal(h.enabled, true);
    h.publishTrackerItems([item("kitsu:101", "simkl"), item("kitsu:200", "trakt")]);
    assert.deepEqual(h.ids(), ["kitsu:101"]);
    h.settings.cwSources = { ...h.settings.cwSources, simkl: false };
    assert.deepEqual(h.ids(), []); assert.equal(h.enabled, false);
    assert.deepEqual(h.masks.at(-1), { trakt: false, simkl: false });
  });
  test(`${bigPicture ? "Big Picture anime" : "shared CW"}: private profile excludes shared trackers`, () => {
    const h = harness(bigPicture, { library: false, local: true, simkl: true, trakt: true }, true);
    assert.deepEqual(h.ids(), ["kitsu:301"]); assert.equal(h.enabled, false);
  });
}
