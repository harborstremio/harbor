import type { LocalProfileLike, RosterPlan, RosterValue, WireProfile } from "./types";

/**
 * Must keep the shape newId() produces in profiles.tsx (p_<base36>_<rand>), because a
 * profile id is a localStorage namespace and a hand rolled id that looks different is
 * the kind of thing a future grep for "p_" quietly misses.
 */
function newLocalId(): string {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * The spec calls syncId server issued. It is minted here instead, once, and then shared
 * through the roster document, which satisfies the actual requirement (one id every
 * device agrees on) without a create round trip per profile. Two devices seeding a fresh
 * account at the same moment still cannot diverge: the roster is an ordinary section, so
 * the second push loses on baseRev and re-plans against the winner.
 */
export function newSyncId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `s_${crypto.randomUUID()}`;
    }
  } catch {
    /* fall through */
  }
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * /avatars/<id>.webp and /kids/avatars/kid-N.webp are portable identifiers. A data: URL
 * is a multi megabyte blob that would blow localStorage on receipt, and an https: avatar
 * from Trakt or AniList is a URL on somebody else's CDN that a TV may not be able to
 * reach. Anything not portable transmits as null and the receiver renders initials.
 */
export function portableAvatar(avatar: string | null | undefined): string | null {
  if (typeof avatar !== "string" || !avatar) return null;
  if (avatar.startsWith("/avatars/")) return avatar;
  if (avatar.startsWith("/kids/avatars/")) return avatar;
  return null;
}

/**
 * EXPLICIT FLAG ONLY. This used to fall back to `rosterSize === 1 && isPrimary &&
 * isPlaceholderName(name)`, and a bootstrap profile is DELETED on first pull, which
 * purges sixteen namespaced localStorage keys including continue watching, favorites and
 * every tracker session. Profiles are auto-named "Guest 4821" by generateGuestName, so a
 * single-profile user who never renamed theirs matched that regex with months of real
 * history behind it. A name is not evidence of emptiness. Nothing sets `bootstrap` today,
 * so nothing is auto-dropped, and the worst case is the duplicate the doctrine already
 * accepts. That regex also imported @/lib/profiles, closing a cycle back into the React
 * provider that must import this module; dropping it removes the cycle too.
 */
export function isBootstrapProfile(p: LocalProfileLike): boolean {
  return p.bootstrap === true;
}

export function toWire(local: LocalProfileLike, syncId: string, updatedAt: number): WireProfile {
  return {
    syncId,
    name: local.name,
    avatar: portableAvatar(local.avatar),
    color: local.color,
    isPrimary: local.isPrimary,
    kid: local.kid ? { age: local.kid.age, curfewMinutes: local.kid.curfewMinutes } : null,
    hideContent: local.hideContent ?? null,
    lockedTabs: local.lockedTabs ?? null,
    settingsLinked: local.settingsLinked !== false,
    createdAt: local.createdAt,
    updatedAt,
    deletedAt: null,
  };
}

/**
 * `existing` is the local profile this wire record is replacing, and it is what carries
 * the device-local secrets across. The wire deliberately has no passwordHash and no
 * kid.parentPinHash, so without this the adopted profile comes back unlocked and
 * refuseProfileSelect stops refusing.
 */
export function fromWire(
  wire: WireProfile,
  localId: string,
  existing?: LocalProfileLike,
): LocalProfileLike {
  return {
    id: localId,
    name: wire.name,
    avatar: portableAvatar(wire.avatar) ?? existing?.avatar ?? null,
    // An adopted profile with no colour must not render colourless. parseRoster cannot
    // invent one without importing the palette from profiles.tsx and reopening the
    // cycle, so an empty colour is handed to the store, whose apply assigns one.
    color: wire.color || existing?.color || "",
    isPrimary: wire.isPrimary,
    kid: wire.kid
      ? {
          age: wire.kid.age,
          curfewMinutes: wire.kid.curfewMinutes,
          parentPinHash: existing?.kid?.parentPinHash ?? null,
        }
      : null,
    hideContent: wire.hideContent ?? null,
    lockedTabs: wire.lockedTabs ?? null,
    settingsLinked: wire.settingsLinked !== false,
    createdAt: wire.createdAt,
    bootstrap: false,
    passwordHash: existing?.passwordHash ?? null,
  };
}

export function parseRoster(value: unknown): WireProfile[] {
  const list = (value as Partial<RosterValue> | null)?.profiles;
  if (!Array.isArray(list)) return [];
  const out: WireProfile[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const w = raw as Record<string, unknown>;
    if (typeof w.syncId !== "string" || !w.syncId) continue;
    if (typeof w.name !== "string") continue;
    out.push({
      syncId: w.syncId,
      name: w.name,
      avatar: portableAvatar(typeof w.avatar === "string" ? w.avatar : null),
      color: typeof w.color === "string" ? w.color : "",
      isPrimary: w.isPrimary === true,
      kid: parseKid(w.kid),
      hideContent: w.hideContent ?? null,
      lockedTabs: w.lockedTabs ?? null,
      settingsLinked: w.settingsLinked !== false,
      createdAt: typeof w.createdAt === "number" ? w.createdAt : 0,
      updatedAt: typeof w.updatedAt === "number" ? w.updatedAt : 0,
      deletedAt: typeof w.deletedAt === "number" ? w.deletedAt : null,
    });
  }
  return out;
}

function parseKid(raw: unknown): WireProfile["kid"] {
  if (!raw || typeof raw !== "object") return null;
  const k = raw as Record<string, unknown>;
  return {
    age: typeof k.age === "number" ? k.age : 7,
    curfewMinutes: typeof k.curfewMinutes === "number" ? k.curfewMinutes : null,
  };
}

/** Everything except updatedAt, which is the field being decided. */
function sameWire(a: WireProfile, b: WireProfile): boolean {
  return (
    a.name === b.name &&
    a.avatar === b.avatar &&
    a.color === b.color &&
    a.isPrimary === b.isPrimary &&
    a.settingsLinked === b.settingsLinked &&
    a.createdAt === b.createdAt &&
    a.deletedAt === b.deletedAt &&
    JSON.stringify(a.kid) === JSON.stringify(b.kid) &&
    JSON.stringify(a.hideContent) === JSON.stringify(b.hideContent) &&
    JSON.stringify(a.lockedTabs) === JSON.stringify(b.lockedTabs)
  );
}

/**
 * `known` is the last roster this device built or adopted, and it exists to keep
 * updatedAt STABLE. Stamping Date.now() on every profile at read time made the
 * serialization differ on every single read, so the engine's sent-hash could never
 * match: the roster was re-pushed after every pull, on every device, forever, each push
 * bumping rev and forcing every other device through the full adopt path. Two devices
 * inside one window then traded rejections until nginx returned 429.
 */
export function buildRosterValue(
  locals: LocalProfileLike[],
  syncIdByLocalId: Record<string, string>,
  tombstones: WireProfile[],
  known: WireProfile[] = [],
): RosterValue {
  const now = Date.now();
  const prev = new Map(known.map((p) => [p.syncId, p]));
  const live: WireProfile[] = [];
  for (const p of locals) {
    const syncId = syncIdByLocalId[p.id];
    if (!syncId) continue;
    const wire = toWire(p, syncId, now);
    const before = prev.get(syncId);
    live.push(before && sameWire(before, wire) ? { ...wire, updatedAt: before.updatedAt } : wire);
  }
  const liveIds = new Set(live.map((p) => p.syncId));
  const kept = tombstones.filter((t) => t.deletedAt != null && !liveIds.has(t.syncId));
  return { profiles: [...live, ...kept] };
}

export type PlanInput = {
  local: LocalProfileLike[];
  server: WireProfile[];
  firstPull: boolean;
  mapping: Record<string, string>;
};

/**
 * A5. ADOPT, NEVER MERGE, ON FIRST PULL. The fabricated Guest primary has no content by
 * definition, so merging it plants a phantom "Guest 4821" on every device in the
 * household forever. A profile the user actually made before signing in is pushed up as
 * a new profile instead, so the worst case is a duplicate they can delete.
 */
export function planRoster(input: PlanInput): RosterPlan {
  const { local, server, firstPull, mapping } = input;
  const live = server.filter((p) => p.deletedAt == null);
  const deleted = new Set(server.filter((p) => p.deletedAt != null).map((p) => p.syncId));

  if (live.length === 0 && deleted.size === 0) {
    return local.length > 0 ? { kind: "seed", push: local } : { kind: "none" };
  }

  const localBySyncId = new Map<string, LocalProfileLike>();
  for (const p of local) {
    const sid = mapping[p.id];
    if (sid) localBySyncId.set(sid, p);
  }

  const replaceWith: LocalProfileLike[] = [];
  const syncIdByLocalId: Record<string, string> = {};
  for (const wire of live) {
    const existing = localBySyncId.get(wire.syncId);
    const localId = existing ? existing.id : newLocalId();
    replaceWith.push(fromWire(wire, localId, existing));
    syncIdByLocalId[localId] = wire.syncId;
  }

  // DELETION REQUIRES A TOMBSTONE. dropLocalIds used to be "every local profile the
  // server did not mention", which made absence destructive: parseRoster skips any row
  // with a non-string name or syncId, so one malformed field, one truncated array or one
  // stale `current` echoed inside a push rejection would purge that profile's entire
  // local data set on every device that pulled it. The server has never been observed
  // answering once. Absence now means "the server's view is incomplete", and the profile
  // is kept and pushed back.
  const kept = new Set(replaceWith.map((p) => p.id));
  const push: LocalProfileLike[] = [];
  const dropLocalIds: string[] = [];
  for (const p of local) {
    if (kept.has(p.id)) continue;
    const sid = mapping[p.id];
    if (sid && deleted.has(sid)) {
      dropLocalIds.push(p.id);
      continue;
    }
    if (sid) {
      replaceWith.push(p);
      syncIdByLocalId[p.id] = sid;
      push.push(p);
      continue;
    }
    if (firstPull && isBootstrapProfile(p)) {
      dropLocalIds.push(p.id);
      continue;
    }
    // The server roster already names a primary. Uploading a second one makes two devices
    // disagree about which profile owns the shared Stremio session.
    replaceWith.push({ ...p, isPrimary: false });
    push.push(p);
  }

  return {
    kind: "adopt",
    apply: { replaceWith, dropLocalIds, syncIdByLocalId },
    push,
  };
}
