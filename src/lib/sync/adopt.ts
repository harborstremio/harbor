// First-sign-in adoption planning: when a device that already has local data
// signs into a Harbor Sync account that also has data, the user chooses how
// the two datasets combine. This module is pure and import-free so it can be
// unit-tested under `node --test` alongside the other sync primitives.
//
// Storage model recap (see profile-scope.ts / profiles.tsx):
// - `harbor.profiles.v1` holds `{ profiles, activeId }`.
// - The PRIMARY profile owns the legacy bare keys (e.g. `harbor.localcw.v1`);
//   every other profile stores aspect data at `<base>.<profileId>`.
// - Some keys are per-profile-id even for the primary (e.g. `harbor.auth.<id>`).

export type SnapshotMap = Record<string, string>;

export type AdoptionProfileInfo = {
  id: string;
  name: string;
  avatar: string | null;
  color: string | null;
  isPrimary: boolean;
  kid: boolean;
};

export type AdoptionSummary = {
  localProfiles: AdoptionProfileInfo[];
  cloudProfiles: AdoptionProfileInfo[];
  /** Overlapping syncable keys whose values differ. */
  conflictingKeys: number;
};

export type AdoptionPlan =
  | { kind: "merge" }
  | { kind: "bring-profiles" }
  | { kind: "merge-into-profile"; targetProfileId: string }
  | { kind: "cloud" }
  | { kind: "local" };

export type AdoptionResult = {
  /** Final local values. `null` removes the key locally. */
  writes: Record<string, string | null>;
  /** Keys whose final value differs from the cloud and must be pushed. */
  push: string[];
};

/** `mergeDoc` from ./merge, injected to keep this module import-free. */
export type DocMerge = (
  key: string,
  localValue: string | null,
  remoteValue: string | null,
  localNewer: boolean,
) => string | null;

const PROFILES_KEY = "harbor.profiles.v1";
const SETTINGS_KEY = "harbor.settings";
const SHARED_SETTINGS_KEY = "harbor.settings.shared";
const LEGACY_AUTH_KEY = "harbor.auth";

/** Bases owned by the primary profile as bare keys; other profiles use `<base>.<id>`. */
const ASPECT_BASES = [
  "harbor.resume",
  "harbor.localcw.v1",
  "harbor.cw.dismissed.simkl",
  "harbor.manualwatched.v1",
  "harbor.manualunwatched.v1",
  "harbor.manualwatched.meta.v1",
  "harbor.manualwatched.dismissed.v1",
  "harbor.watchlist.v1",
  "harbor.watchlist.aggregate.v1",
  "harbor.installed-addons",
  "harbor.addons.disabled",
  "harbor.curated-collections",
] as const;

/** Array-valued keys unioned by an identity field instead of last-write-wins. */
const UNION_BY_FIELD: Array<{ base: string; field: string }> = [
  { base: "harbor.installed-addons", field: "transportUrl" },
  { base: "harbor.watchlist.v1", field: "id" },
  { base: "harbor.curated-collections", field: "id" },
];

/** String-array keys merged as sets. */
const UNION_AS_SET: readonly string[] = [
  "harbor.addons.disabled",
  "harbor.watchlist.aggregate.v1",
  "harbor.manualwatched.v1",
  "harbor.manualunwatched.v1",
  "harbor.manualwatched.dismissed.v1",
];

type RawProfile = Record<string, unknown> & { id: string };

type ProfilesDoc = { profiles: RawProfile[]; activeId: string | null };

function parseProfilesDoc(raw: string | undefined | null): ProfilesDoc | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const profilesRaw = "profiles" in parsed ? parsed.profiles : null;
    if (!Array.isArray(profilesRaw)) return null;
    const profiles = profilesRaw.filter(
      (p): p is RawProfile => !!p && typeof p === "object" && "id" in p && typeof p.id === "string",
    );
    const activeRaw = "activeId" in parsed ? parsed.activeId : null;
    return { profiles, activeId: typeof activeRaw === "string" ? activeRaw : null };
  } catch {
    return null;
  }
}

function toProfileInfo(p: RawProfile): AdoptionProfileInfo {
  return {
    id: p.id,
    name: typeof p.name === "string" ? p.name : p.id,
    avatar: typeof p.avatar === "string" ? p.avatar : null,
    color: typeof p.color === "string" ? p.color : null,
    isPrimary: p.isPrimary === true,
    kid: !!p.kid,
  };
}

export function profilesInSnapshot(snapshot: SnapshotMap): AdoptionProfileInfo[] {
  return (parseProfilesDoc(snapshot[PROFILES_KEY])?.profiles ?? []).map(toProfileInfo);
}

/**
 * A local install is "pristine" when nothing worth preserving exists: at most
 * one auto-created profile and no accounts, addons, playback, or list data.
 */
function localIsPristine(local: SnapshotMap): boolean {
  const doc = parseProfilesDoc(local[PROFILES_KEY]);
  if (doc && doc.profiles.length > 1) return false;

  const dataPrefixes = [
    "harbor.auth",
    "harbor.installed-addons",
    "harbor.localcw.v1",
    "harbor.resume",
    "harbor.watchlist.v1",
    "harbor.localwatchlist.v1",
    "harbor.curated-collections",
    "harbor.downloads.catalog.v1",
    "harbor.trakt.session.v1",
    "harbor.simkl.session.v1",
    "harbor.anilist.session.v1",
    "harbor.mal.session.v1",
  ];
  return !Object.keys(local).some((key) =>
    dataPrefixes.some((prefix) => key === prefix || key.startsWith(`${prefix}.`)),
  );
}

export function buildAdoptionSummary(local: SnapshotMap, remote: SnapshotMap): AdoptionSummary {
  let conflicting = 0;
  for (const [key, value] of Object.entries(local)) {
    if (key in remote && remote[key] !== value) conflicting += 1;
  }
  return {
    localProfiles: profilesInSnapshot(local),
    cloudProfiles: profilesInSnapshot(remote),
    conflictingKeys: conflicting,
  };
}

/** Prompt only when both sides carry real data AND they actually differ. */
export function needsAdoptionPrompt(local: SnapshotMap, remote: SnapshotMap): boolean {
  if (Object.keys(remote).length === 0) return false;
  if (localIsPristine(local)) return false;

  for (const [key, value] of Object.entries(local)) {
    if (!(key in remote)) return true;
    if (remote[key] !== value) return true;
  }
  return Object.keys(remote).some((key) => !(key in local));
}

function parseArray(raw: string | null | undefined): unknown[] | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function baseOf(key: string): string {
  // `<base>.<profileId>` → base; profile ids never contain dots we care about,
  // so strip at most one trailing `.segment` when it matches a known base.
  for (const base of [...ASPECT_BASES, "harbor.favorites.v1", "harbor.localwatchlist.v1"]) {
    if (key === base || key.startsWith(`${base}.`)) return base;
  }
  return key;
}

/** Union two serialized values when a union rule exists; otherwise null. */
function unionValues(key: string, winner: string | null, loser: string | null): string | null {
  const base = baseOf(key);

  const byField = UNION_BY_FIELD.find((rule) => rule.base === base);
  if (byField) {
    const a = parseArray(winner);
    const b = parseArray(loser);
    if (!a || !b) return null;
    const seen = new Set<string>();
    const out: unknown[] = [];
    for (const entry of [...a, ...b]) {
      if (!entry || typeof entry !== "object") continue;
      const id: unknown = Reflect.get(entry, byField.field);
      if (typeof id !== "string") continue;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(entry);
    }
    return JSON.stringify(out);
  }

  if (UNION_AS_SET.includes(base)) {
    const a = parseArray(winner);
    const b = parseArray(loser);
    if (!a || !b) return null;
    const out = [...new Set([...a, ...b].filter((v): v is string => typeof v === "string"))];
    return JSON.stringify(out);
  }

  return null;
}

/** Merge one key with union/entry-merge rules, falling back to winner-wins. */
function combineValues(
  key: string,
  localValue: string | null,
  remoteValue: string | null,
  localWins: boolean,
  merge: DocMerge,
): string | null {
  if (localValue === null) return remoteValue;
  if (remoteValue === null) return localValue;
  const unioned = unionValues(
    key,
    localWins ? localValue : remoteValue,
    localWins ? remoteValue : localValue,
  );
  if (unioned !== null) return unioned;
  // mergeDoc entry-merges the continue-watching / downloads-catalog families
  // and falls back to last-write-wins for everything else.
  return merge(key, localValue, remoteValue, localWins);
}

function suffixed(base: string, profileId: string): string {
  return `${base}.${profileId}`;
}

/**
 * Move the local primary profile's bare aspect data onto `<base>.<id>` keys so
 * it can live alongside the cloud's primary. Returns the re-keyed snapshot.
 */
function rekeyLocalPrimary(local: SnapshotMap, primaryId: string): SnapshotMap {
  const out: SnapshotMap = { ...local };
  for (const base of ASPECT_BASES) {
    const value = out[base];
    if (value === undefined) continue;
    delete out[base];
    if (out[suffixed(base, primaryId)] === undefined) out[suffixed(base, primaryId)] = value;
  }
  // Personal settings follow the profile; it becomes settings-unlinked below.
  const settings = out[SHARED_SETTINGS_KEY] ?? out[SETTINGS_KEY];
  if (settings !== undefined && out[suffixed(SETTINGS_KEY, primaryId)] === undefined) {
    out[suffixed(SETTINGS_KEY, primaryId)] = settings;
  }
  delete out[SHARED_SETTINGS_KEY];
  delete out[SETTINGS_KEY];
  // Legacy pre-profile installs kept the Stremio session on the bare key.
  const legacyAuth = out[LEGACY_AUTH_KEY];
  if (legacyAuth !== undefined) {
    delete out[LEGACY_AUTH_KEY];
    if (out[suffixed(LEGACY_AUTH_KEY, primaryId)] === undefined)
      out[suffixed(LEGACY_AUTH_KEY, primaryId)] = legacyAuth;
  }
  return out;
}

/**
 * Redirect the local primary's bare aspect data onto the keys owned by cloud
 * profile `targetId` (bare when the target is the cloud primary).
 */
function retargetLocalPrimary(
  local: SnapshotMap,
  targetId: string,
  targetIsPrimary: boolean,
): SnapshotMap {
  const out: SnapshotMap = { ...local };
  if (targetIsPrimary) return out; // bare keys already collide correctly

  for (const base of ASPECT_BASES) {
    const value = out[base];
    if (value === undefined) continue;
    delete out[base];
    out[suffixed(base, targetId)] = value;
  }
  const settings = out[SHARED_SETTINGS_KEY] ?? out[SETTINGS_KEY];
  if (settings !== undefined) out[suffixed(SETTINGS_KEY, targetId)] = settings;
  delete out[SHARED_SETTINGS_KEY];
  delete out[SETTINGS_KEY];
  return out;
}

type ProfileMergeMode =
  | { mode: "fuse"; targetId: string } // local primary's identity merges into a cloud profile
  | { mode: "keep" }; // local primary stays its own profile

function mergeProfileLists(
  local: ProfilesDoc | null,
  remote: ProfilesDoc | null,
  profileMode: ProfileMergeMode,
): string | null {
  if (!remote) return local ? JSON.stringify(local) : null;
  if (!local) return JSON.stringify(remote);

  const localPrimary = local.profiles.find((p) => p.isPrimary === true) ?? null;
  const cloudIds = new Set(remote.profiles.map((p) => p.id));
  const merged: RawProfile[] = [...remote.profiles];

  for (const profile of local.profiles) {
    if (cloudIds.has(profile.id)) continue; // same profile on both sides: cloud entry wins
    if (localPrimary && profile.id === localPrimary.id) {
      if (profileMode.mode === "fuse") continue; // identity absorbed by the target
      merged.push({ ...profile, isPrimary: false, settingsLinked: false });
      continue;
    }
    const entry = { ...profile };
    // Share links to the (now absorbed) local primary follow its new identity.
    if (profileMode.mode === "fuse" && localPrimary && entry.shareStremioWith === localPrimary.id) {
      entry.shareStremioWith = profileMode.targetId;
    }
    merged.push(entry);
  }

  const activeId =
    local.activeId && merged.some((p) => p.id === local.activeId)
      ? local.activeId
      : profileMode.mode === "fuse" && local.activeId === localPrimary?.id
        ? profileMode.targetId
        : (remote.activeId ?? merged[0]?.id ?? null);

  return JSON.stringify({ profiles: merged, activeId });
}

function finalize(final: SnapshotMap, remote: SnapshotMap, local: SnapshotMap): AdoptionResult {
  const writes: Record<string, string | null> = {};
  const push: string[] = [];

  const keys = new Set([...Object.keys(final), ...Object.keys(remote), ...Object.keys(local)]);
  for (const key of keys) {
    const value = final[key];
    if (value === undefined) {
      if (key in local) writes[key] = null;
      if (key in remote) push.push(key); // push a deletion
      continue;
    }
    if (local[key] !== value) writes[key] = value;
    if (remote[key] !== value) push.push(key);
  }
  return { writes, push };
}

export function planAdoption(
  plan: AdoptionPlan,
  local: SnapshotMap,
  remote: SnapshotMap,
  merge: DocMerge,
): AdoptionResult {
  if (plan.kind === "cloud") return finalize({ ...remote }, remote, local);
  if (plan.kind === "local") return finalize({ ...local }, remote, local);

  const localDoc = parseProfilesDoc(local[PROFILES_KEY]);
  const remoteDoc = parseProfilesDoc(remote[PROFILES_KEY]);
  const localPrimary = localDoc?.profiles.find((p) => p.isPrimary === true) ?? null;
  const cloudPrimary = remoteDoc?.profiles.find((p) => p.isPrimary === true) ?? null;

  // Same primary profile on both sides (device was synced before): fusing is a
  // plain per-key merge, no re-keying needed.
  const samePrimary = !!localPrimary && !!cloudPrimary && localPrimary.id === cloudPrimary.id;

  let effectiveLocal: SnapshotMap;
  let profileMode: ProfileMergeMode;
  let localWins: boolean;

  if (plan.kind === "bring-profiles" && !samePrimary && localPrimary) {
    effectiveLocal = rekeyLocalPrimary(local, localPrimary.id);
    profileMode = { mode: "keep" };
    localWins = false;
  } else if (plan.kind === "merge-into-profile" && !samePrimary && localPrimary) {
    const target = remoteDoc?.profiles.find((p) => p.id === plan.targetProfileId) ?? null;
    effectiveLocal = retargetLocalPrimary(
      local,
      plan.targetProfileId,
      target ? target.isPrimary === true : true,
    );
    profileMode = { mode: "fuse", targetId: plan.targetProfileId };
    localWins = true; // the user explicitly moves their data into that profile
  } else {
    // "merge": the two primaries become one; cloud wins scalar conflicts.
    effectiveLocal = { ...local };
    profileMode = {
      mode: "fuse",
      targetId: cloudPrimary?.id ?? localPrimary?.id ?? "",
    };
    localWins = false;
  }

  const final: SnapshotMap = {};
  const keys = new Set([...Object.keys(effectiveLocal), ...Object.keys(remote)]);
  keys.delete(PROFILES_KEY);
  for (const key of keys) {
    const combined = combineValues(
      key,
      effectiveLocal[key] ?? null,
      remote[key] ?? null,
      localWins,
      merge,
    );
    if (combined !== null) final[key] = combined;
  }

  const profilesValue = mergeProfileLists(
    localDoc && plan.kind === "bring-profiles" && !samePrimary && localPrimary
      ? {
          ...localDoc,
          profiles: localDoc.profiles.map((p) =>
            p.id === localPrimary.id ? { ...p, isPrimary: false, settingsLinked: false } : p,
          ),
        }
      : localDoc,
    remoteDoc,
    profileMode,
  );
  if (profilesValue !== null) final[PROFILES_KEY] = profilesValue;

  return finalize(final, remote, local);
}
