export {
  ACCOUNT_SECTIONS,
  ACCOUNT_SCOPE,
  PROFILE_SECTIONS,
  type AccountSectionKey,
  type LocalProfileLike,
  type ProfileSectionKey,
  type RosterApply,
  type RosterStore,
  type SectionAdapter,
  type SectionKey,
  type SyncDoc,
  type SyncErrorKind,
  type SyncPhase,
  type SyncStatus,
  type WireProfile,
} from "./types";

export {
  docKey,
  isAccountSection,
  isProfileSection,
  isSectionKey,
  isStructurallyEmpty,
  parseDocKey,
  registerSection,
  registerSections,
} from "./sections";

export {
  flushSyncNow,
  markSectionCleared,
  markSectionDirty,
  requestSyncPull,
  restoreParkedSection,
  startProfileSync,
  stopProfileSync,
} from "./scheduler";

export { ProfileSyncRunner } from "./sync-runner";

export {
  QUEUE_STALE_MS,
  getSyncStatus,
  isQueueStale,
  rosterWritable,
  subscribeSyncStatus,
} from "./status";

export { useSyncQueueStale, useSyncStatus } from "./use-sync-status";

export { parkedForSection, readParked, type ParkedWrite } from "./parked";

export { configureRosterStore, rosterWired } from "./roster-store";
export { noteProfileDeleted } from "./roster-section";
export { newSyncId, portableAvatar } from "./roster";
export { syncIdFor } from "./id-map";

export { isProfileLocked, refuseProfileSelect, type LockableProfile } from "./profile-lock";

export { buildSyncBackup, type SyncBackup } from "./backup-payload";

export {
  capWatchedBy,
  mergeWatchedBy,
  normalizeWatchedBy,
  WATCHED_BY_MAX,
  type WatchedByEntry,
  type WatchedByMap,
} from "./watched-by-merge";

export { syncArm, type SyncArm } from "./client";
