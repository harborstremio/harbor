import { setItemWithRecovery } from "@/lib/storage-recovery";
import { readJson, removeKey } from "./keys";
import { clearIdMap, dropLocalMapping, readIdMap, setMappings } from "./id-map";
import { applyRoster, readLocalRoster, rosterWired } from "./roster-store";
import { buildRosterValue, newSyncId, parseRoster, planRoster, toWire } from "./roster";
import { registerSection } from "./sections";
import type { RosterValue, WireProfile } from "./types";

const TOMBSTONE_KEY = "harbor.sync.tombstones";
// The last roster this device built or adopted. buildRosterValue reuses its updatedAt
// stamps for unchanged profiles, which is what keeps the section's serialization stable
// between reads and lets the engine's sent-hash suppress the re-push loop.
const KNOWN_KEY = "harbor.sync.roster.known";

function knownRoster(): WireProfile[] {
  return readJson<WireProfile[]>(KNOWN_KEY, []);
}

function rememberRoster(list: WireProfile[]): void {
  const next = JSON.stringify(list);
  if (next === JSON.stringify(knownRoster())) return;
  setItemWithRecovery(KNOWN_KEY, next);
}

function tombstones(): WireProfile[] {
  return readJson<WireProfile[]>(TOMBSTONE_KEY, []).filter((t) => t && t.deletedAt != null);
}

function writeTombstones(list: WireProfile[]): void {
  if (list.length === 0) {
    removeKey(TOMBSTONE_KEY);
    return;
  }
  setItemWithRecovery(TOMBSTONE_KEY, JSON.stringify(list.slice(-64)));
}

/**
 * Call from deleteProfile. Without a tombstone a delete never reaches a third device:
 * that device still holds the profile, pushes it back up, and it reappears on the two
 * devices that deleted it.
 */
export function noteProfileDeleted(localId: string): void {
  const syncId = readIdMap()[localId];
  dropLocalMapping(localId);
  if (!syncId) return;
  const existing = tombstones().filter((t) => t.syncId !== syncId);
  const local = readLocalRoster().find((p) => p.id === localId);
  const stone = local
    ? { ...toWire(local, syncId, Date.now()), deletedAt: Date.now() }
    : {
        syncId,
        name: "",
        avatar: null,
        color: "",
        isPrimary: false,
        kid: null,
        hideContent: null,
        lockedTabs: null,
        settingsLinked: true,
        createdAt: 0,
        updatedAt: Date.now(),
        deletedAt: Date.now(),
      };
  writeTombstones([...existing, stone]);
}

export function clearRosterSectionState(): void {
  removeKey(TOMBSTONE_KEY);
  removeKey(KNOWN_KEY);
  clearIdMap();
}

let firstPullPending = true;

export function setRosterFirstPull(pending: boolean): void {
  firstPullPending = pending;
}

function readRosterValue(): RosterValue {
  const value = buildRosterValue(readLocalRoster(), readIdMap(), tombstones(), knownRoster());
  rememberRoster(value.profiles);
  return value;
}

/**
 * A5 step 3, the adoption path. When the account holds no roster at all this device is
 * the first one on it, so its profiles are issued syncIds locally and go up as the
 * household. This runs even while the apply path is unwired, because seeding needs no
 * apply: nothing local changes, only the id map gains entries.
 */
export function seedRosterFromLocal(): void {
  const plan = planRoster({
    local: readLocalRoster(),
    server: [],
    firstPull: firstPullPending,
    mapping: readIdMap(),
  });
  if (plan.kind !== "seed") return;
  mintMissingSyncIds(plan.push.map((p) => p.id));
}

/**
 * Only ever mint for a local id that has none. Re-minting over an existing mapping
 * orphans every layout section that profile already owns on the server, and the symptom
 * would be a household silently reverting to default rows on one device.
 */
function mintMissingSyncIds(localIds: string[]): void {
  const mapping = readIdMap();
  const minted: Record<string, string> = {};
  for (const id of localIds) {
    if (!mapping[id]) minted[id] = newSyncId();
  }
  if (Object.keys(minted).length > 0) setMappings(minted);
}

/**
 * Returns false when the apply path has not been wired into ProfilesProvider yet, which
 * withholds the rev so the next pull tries again rather than leaving this device
 * believing it is in step with a roster it never adopted.
 */
function writeRosterValue(_profileId: string, value: unknown): boolean {
  const server = parseRoster(value);
  writeTombstones(server.filter((p) => p.deletedAt != null));
  // Adopt their stamps as well as their content, so the next read does not decide every
  // profile changed and push the whole roster straight back at them.
  rememberRoster(server);
  const plan = planRoster({
    local: readLocalRoster(),
    server,
    firstPull: firstPullPending,
    mapping: readIdMap(),
  });
  if (plan.kind === "none") return true;
  if (plan.kind === "seed") {
    mintMissingSyncIds(plan.push.map((p) => p.id));
    return true;
  }
  if (!rosterWired()) return false;
  const existing = readIdMap();
  const withNew = { ...plan.apply.syncIdByLocalId };
  for (const p of plan.push) {
    if (!withNew[p.id]) withNew[p.id] = existing[p.id] ?? newSyncId();
  }
  const applied = applyRoster({ ...plan.apply, syncIdByLocalId: withNew });
  if (!applied) return false;
  setMappings(withNew);
  firstPullPending = false;
  return true;
}

/**
 * The roster travels as an ordinary section so it inherits baseRev conflict handling for
 * free. Its ONE divergence is the rejection path, handled in the engine: a losing roster
 * write re-plans against the winner instead of parking, because two rosters do converge
 * (adopt theirs, push the profiles they do not have) where two row orderings do not.
 */
export function registerRosterSection(): void {
  registerSection("profiles", { read: readRosterValue, write: writeRosterValue });
}
