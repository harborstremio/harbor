export const PROFILE_SECTIONS = [
  "home",
  "anime",
  "nav",
  "catalogs",
  "pinned",
  "collrows",
  "services",
  "manga",
  "detail",
  "lists",
  "page.movies",
  "page.shows",
  "page.kids",
  "page.discover",
  "settings",
  "theme",
  "playerlayout",
] as const;

export const ACCOUNT_SECTIONS = ["profiles", "watchedby"] as const;

export type ProfileSectionKey = (typeof PROFILE_SECTIONS)[number];
export type AccountSectionKey = (typeof ACCOUNT_SECTIONS)[number];
export type SectionKey = ProfileSectionKey | AccountSectionKey;

export const ACCOUNT_SCOPE = "account";

/**
 * rev is the ONLY ordering authority. It is server-assigned, monotonic, per section.
 * `at` is a server-stamped display string for "changed 2 minutes ago" and nothing else.
 * Never sort, compare or merge on a client clock: an Android TV with a dead RTC would
 * then win every merge forever, invisibly, with no way for the user to recover.
 */
export type SyncDoc = {
  key: string;
  rev: number;
  at: string;
  value: unknown;
};

export type SyncStateResponse = {
  rev: number;
  serverTime: string;
  docs: SyncDoc[];
};

export type PushWrite =
  | { key: string; baseRev: number; value: unknown }
  | { key: string; baseRev: number; clear: true };

export type PushAccepted = { key?: string; ok: true; rev: number };
export type PushRejected = { key?: string; ok: false; current: SyncDoc };
export type PushResult = PushAccepted | PushRejected;

export type PushResponse = {
  serverTime: string;
  results: PushResult[];
};

/**
 * A section without `merge` is replaced whole on pull. That is deliberate for every
 * layout section: two row orderings cannot be merged into a third ordering that either
 * person chose, so a positional merge is strictly worse than losing one edit.
 * `merge` exists for `watchedby` alone, where per-key last-writer-wins is the correct
 * semantics rather than a compromise. Do not unify the two rules for tidiness.
 */
export type SectionAdapter = {
  /** Account sections (profiles, watchedby) are handed an empty profileId. */
  read: (profileId: string) => unknown;
  /** Return false to say the value could not be applied, which withholds its rev so the next pull retries. */
  write: (profileId: string, value: unknown) => void | boolean;
  merge?: (local: unknown, incoming: unknown) => unknown;
};

export type SyncPhase =
  | "off"
  | "signed-out"
  | "no-refresh"
  | "first-pull"
  | "first-pull-failed"
  | "idle"
  | "pulling"
  | "pushing";

export type SyncErrorKind = "network" | "auth" | "rate-limited" | "server" | null;

export type SyncStatus = {
  phase: SyncPhase;
  armed: boolean;
  rosterWired: boolean;
  everPulled: boolean;
  queued: number;
  queuedSince: number | null;
  lastPullAt: number;
  lastPushAt: number;
  lastError: SyncErrorKind;
};

/**
 * The wire profile carries no passwordHash and no kid.parentPinHash by construction.
 * hashProfilePassword is unsalted SHA-256 over a constant string (profile-password.ts),
 * so a 4 digit PIN is a 10000 entry rainbow table computed once for the whole fleet.
 * Consequence, and it is intended until the KDF is replaced: a profile PIN is per device.
 */
export type WireProfile = {
  syncId: string;
  name: string;
  avatar: string | null;
  color: string;
  isPrimary: boolean;
  kid: { age: number; curfewMinutes: number | null } | null;
  hideContent: unknown;
  lockedTabs: unknown;
  settingsLinked: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
};

export type RosterValue = { profiles: WireProfile[] };

export type LocalProfileLike = {
  id: string;
  name: string;
  avatar: string | null;
  color: string;
  isPrimary: boolean;
  kid: { age: number; curfewMinutes: number | null; parentPinHash: string | null } | null;
  hideContent: unknown;
  lockedTabs: unknown;
  settingsLinked?: boolean;
  createdAt: number;
  bootstrap?: boolean;
  /**
   * Local only, never serialised onto the wire. It is present here so that adopting a
   * server roster can carry the existing device's credential across instead of dropping
   * it: replaceWith is the whole new profile list, so a field absent from this type is a
   * field the apply path silently deletes. Losing it disarms isProfileLocked, and the
   * package that ships the PIN gate would be the package that removes the PIN.
   */
  passwordHash?: string | null;
};

export type RosterStore = {
  read: () => LocalProfileLike[];
  apply: (plan: RosterApply) => void;
};

export type RosterApply = {
  replaceWith: LocalProfileLike[];
  dropLocalIds: string[];
  syncIdByLocalId: Record<string, string>;
};

export type RosterPlan =
  | { kind: "none" }
  | { kind: "seed"; push: LocalProfileLike[] }
  | { kind: "adopt"; apply: RosterApply; push: LocalProfileLike[] };
