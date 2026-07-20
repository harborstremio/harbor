// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  buildAdoptionSummary,
  needsAdoptionPrompt,
  planAdoption,
  type SnapshotMap,
} from "../src/lib/sync/adopt.ts";
import { mergeDoc } from "../src/lib/sync/merge.ts";

const PROFILES = "harbor.profiles.v1";

function profilesDoc(
  profiles: Array<Record<string, unknown> & { id: string }>,
  activeId: string | null,
): string {
  return JSON.stringify({ profiles, activeId });
}

const cloudPrimary = { id: "cloud-a", name: "Alice", isPrimary: true };
const cloudSecond = { id: "cloud-b", name: "Ben", isPrimary: false };
const localPrimary = { id: "loc-1", name: "Dana", isPrimary: true };
const localKid = {
  id: "loc-2",
  name: "Kiddo",
  isPrimary: false,
  shareStremioWith: "loc-1",
  kid: { age: 7 },
};

function cloudSnapshot(): SnapshotMap {
  return {
    [PROFILES]: profilesDoc([cloudPrimary, cloudSecond], "cloud-a"),
    "harbor.settings.shared": JSON.stringify({ theme: "royal" }),
    "harbor.localcw.v1": JSON.stringify({ tt1: { id: "tt1", t: 100 } }),
    "harbor.installed-addons": JSON.stringify([
      { id: "cinemeta", transportUrl: "https://cloud/one" },
    ]),
    "harbor.auth.cloud-a": JSON.stringify({ authKey: "cloud-stremio" }),
  };
}

function localSnapshot(): SnapshotMap {
  return {
    [PROFILES]: profilesDoc([localPrimary, localKid], "loc-1"),
    "harbor.settings.shared": JSON.stringify({ theme: "forest" }),
    "harbor.localcw.v1": JSON.stringify({
      tt1: { id: "tt1", t: 50 },
      tt2: { id: "tt2", t: 200 },
    }),
    "harbor.installed-addons": JSON.stringify([
      { id: "torrentio", transportUrl: "https://local/two" },
    ]),
    "harbor.auth.loc-1": JSON.stringify({ authKey: "local-stremio" }),
    "harbor.settings.loc-2": JSON.stringify({ theme: "kids" }),
  };
}

test("prompts only when both sides carry data that differs", () => {
  assert.equal(needsAdoptionPrompt(localSnapshot(), {}), false);
  assert.equal(
    needsAdoptionPrompt({ [PROFILES]: profilesDoc([localPrimary], "loc-1") }, cloudSnapshot()),
    false, // pristine local: single profile, no accounts/addons/playback
  );
  assert.equal(needsAdoptionPrompt(localSnapshot(), cloudSnapshot()), true);
  const same = cloudSnapshot();
  assert.equal(needsAdoptionPrompt({ ...same }, same), false);

  const summary = buildAdoptionSummary(localSnapshot(), cloudSnapshot());
  assert.deepEqual(
    summary.localProfiles.map((p) => p.id),
    ["loc-1", "loc-2"],
  );
  assert.deepEqual(
    summary.cloudProfiles.map((p) => p.id),
    ["cloud-a", "cloud-b"],
  );
  assert.ok(summary.conflictingKeys >= 3);
});

test("merge fuses primaries: entry-merged CW, unioned addons, cloud-wins scalars", () => {
  const { writes, push } = planAdoption(
    { kind: "merge" },
    localSnapshot(),
    cloudSnapshot(),
    mergeDoc,
  );

  const cw = JSON.parse(writes["harbor.localcw.v1"]!) as Record<string, { t: number }>;
  assert.equal(cw.tt1.t, 100); // newest wins per entry
  assert.equal(cw.tt2.t, 200); // local-only entry survives

  const addons = JSON.parse(writes["harbor.installed-addons"]!) as Array<{
    transportUrl: string;
  }>;
  assert.deepEqual(addons.map((a) => a.transportUrl).sort(), [
    "https://cloud/one",
    "https://local/two",
  ]);

  // Cloud wins the scalar settings conflict; the local write reflects that.
  assert.equal(writes["harbor.settings.shared"], JSON.stringify({ theme: "royal" }));

  const profiles = JSON.parse(writes[PROFILES]!) as {
    profiles: Array<Record<string, unknown> & { id: string }>;
    activeId: string;
  };
  const ids = profiles.profiles.map((p) => p.id);
  assert.deepEqual(ids.sort(), ["cloud-a", "cloud-b", "loc-2"]); // loc-1 fused into cloud-a
  const kid = profiles.profiles.find((p) => p.id === "loc-2")!;
  assert.equal(kid.shareStremioWith, "cloud-a"); // share link follows the fusion
  assert.equal(profiles.activeId, "cloud-a"); // active local primary maps to its new identity

  // Merged CW and unioned addons differ from the cloud copy, so they push.
  assert.ok(push.includes("harbor.localcw.v1"));
  assert.ok(push.includes("harbor.installed-addons"));
  assert.ok(push.includes(PROFILES));
  // Per-profile keys from both sides survive untouched.
  assert.ok(push.includes("harbor.auth.loc-1"));
  assert.equal(writes["harbor.auth.cloud-a"], JSON.stringify({ authKey: "cloud-stremio" }));
});

test("bring-profiles keeps the local primary as its own profile with re-keyed data", () => {
  const { writes, push } = planAdoption(
    { kind: "bring-profiles" },
    localSnapshot(),
    cloudSnapshot(),
    mergeDoc,
  );

  // Bare aspect data moved onto the demoted profile's suffixed keys.
  assert.equal(
    writes["harbor.localcw.v1.loc-1"],
    JSON.stringify({ tt1: { id: "tt1", t: 50 }, tt2: { id: "tt2", t: 200 } }),
  );
  assert.equal(
    writes["harbor.installed-addons.loc-1"],
    JSON.stringify([{ id: "torrentio", transportUrl: "https://local/two" }]),
  );
  // Personal settings travel with the profile, which becomes settings-unlinked.
  assert.equal(writes["harbor.settings.loc-1"], JSON.stringify({ theme: "forest" }));
  // The cloud's bare keys replace the local ones.
  assert.equal(writes["harbor.localcw.v1"], JSON.stringify({ tt1: { id: "tt1", t: 100 } }));
  assert.equal(writes["harbor.settings.shared"], JSON.stringify({ theme: "royal" }));

  const profiles = JSON.parse(writes[PROFILES]!) as {
    profiles: Array<Record<string, unknown> & { id: string }>;
    activeId: string;
  };
  const brought = profiles.profiles.find((p) => p.id === "loc-1")!;
  assert.equal(brought.isPrimary, false);
  assert.equal(brought.settingsLinked, false);
  const kid = profiles.profiles.find((p) => p.id === "loc-2")!;
  assert.equal(kid.shareStremioWith, "loc-1"); // still points at the kept profile
  assert.equal(profiles.activeId, "loc-1");

  assert.ok(push.includes("harbor.localcw.v1.loc-1"));
  assert.ok(push.includes("harbor.settings.loc-1"));
});

test("merge-into-profile retargets local primary data onto the chosen profile", () => {
  const { writes } = planAdoption(
    { kind: "merge-into-profile", targetProfileId: "cloud-b" },
    localSnapshot(),
    cloudSnapshot(),
    mergeDoc,
  );

  // Local bare data lands on cloud-b's suffixed keys.
  assert.equal(
    writes["harbor.localcw.v1.cloud-b"],
    JSON.stringify({ tt1: { id: "tt1", t: 50 }, tt2: { id: "tt2", t: 200 } }),
  );
  assert.equal(writes["harbor.settings.cloud-b"], JSON.stringify({ theme: "forest" }));

  const profiles = JSON.parse(writes[PROFILES]!) as {
    profiles: Array<Record<string, unknown> & { id: string }>;
    activeId: string;
  };
  assert.deepEqual(profiles.profiles.map((p) => p.id).sort(), ["cloud-a", "cloud-b", "loc-2"]);
  const kid = profiles.profiles.find((p) => p.id === "loc-2")!;
  assert.equal(kid.shareStremioWith, "cloud-b");
  assert.equal(profiles.activeId, "cloud-b");
});

test("cloud strategy mirrors the account; local strategy replaces it", () => {
  const cloudPick = planAdoption({ kind: "cloud" }, localSnapshot(), cloudSnapshot(), mergeDoc);
  assert.equal(cloudPick.writes["harbor.auth.loc-1"], null); // local-only key removed
  assert.equal(cloudPick.writes["harbor.settings.shared"], JSON.stringify({ theme: "royal" }));
  assert.deepEqual(cloudPick.push, []);

  const localPick = planAdoption({ kind: "local" }, localSnapshot(), cloudSnapshot(), mergeDoc);
  assert.equal(localPick.writes["harbor.auth.cloud-a"], undefined); // never written locally
  assert.ok(localPick.push.includes("harbor.auth.cloud-a")); // pushed as a deletion
  assert.ok(localPick.push.includes("harbor.settings.shared"));
});

test("same primary on both sides merges in place without re-keying", () => {
  const local = {
    ...localSnapshot(),
    [PROFILES]: profilesDoc([{ ...localPrimary, id: "cloud-a" }], "cloud-a"),
  };
  const { writes } = planAdoption({ kind: "bring-profiles" }, local, cloudSnapshot(), mergeDoc);
  assert.equal(writes["harbor.localcw.v1.cloud-a"], undefined);
  const cw = JSON.parse(writes["harbor.localcw.v1"]!) as Record<string, { t: number }>;
  assert.equal(cw.tt1.t, 100);
  assert.equal(cw.tt2.t, 200);
});

test("downloads catalog documents entry-merge by newest timestamp", () => {
  const local = JSON.stringify({
    "tt1||": { t: 10, title: "Old", metaId: "tt1", season: null, episode: null },
    "tt2|1|2": { t: 30, title: "Kept", metaId: "tt2", season: 1, episode: 2 },
  });
  const remote = JSON.stringify({
    "tt1||": { t: 20, deleted: 1, metaId: "tt1", season: null, episode: null },
  });
  const merged = JSON.parse(
    mergeDoc("harbor.downloads.catalog.v1", local, remote, false)!,
  ) as Record<string, { t: number; deleted?: number }>;
  assert.equal(merged["tt1||"].deleted, 1); // newer tombstone wins
  assert.equal(merged["tt2|1|2"].t, 30); // local-only entry survives
});
