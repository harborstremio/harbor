/**
 * Which settings follow the account between devices, and the three-way merge that decides what
 * moves where. Values are stored encrypted in the account (`media.secrets`); this module only sees
 * plain strings. Plain module, no I/O.
 */

/** Service keys plus the IPTV logins, so a new device is ready as soon as it signs in. */
export const SYNCED_SETTING_KEYS = [
  "rdKey",
  "tbKey",
  "adKey",
  "pmKey",
  "dlKey",
  "tmdbKey",
  "omdbKey",
  "rpdbKey",
  "fanartKey",
  "tvdbKey",
  "mdblistKey",
  "opensubtitlesApiKey",
  "iptvPlaylists",
] as const;

export type SyncedSettingKey = (typeof SYNCED_SETTING_KEYS)[number];
export type KeyValues = Partial<Record<SyncedSettingKey, string>>;
/** Hash of each value as last agreed with the account. */
export type KeyBase = Partial<Record<SyncedSettingKey, string>>;

export const secretName = (key: SyncedSettingKey) => `setting:${key}`;

export function settingKeyFromSecret(name: string): SyncedSettingKey | null {
  if (!name.startsWith("setting:")) return null;
  const key = name.slice("setting:".length);
  return (SYNCED_SETTING_KEYS as readonly string[]).includes(key) ? (key as SyncedSettingKey) : null;
}

/** FNV-1a; the base only needs to tell values apart, and keeps no secret on disk. */
export function hashValue(value: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${value.length}:${(h >>> 0).toString(16)}`;
}

/**
 * Three-way merge per key. A side that changed since the base wins; when both changed, the
 * account wins. An empty string means "not set".
 */
export function mergeKeys(
  base: KeyBase,
  local: KeyValues,
  remote: KeyValues,
): { apply: KeyValues; push: KeyValues; base: KeyBase } {
  const apply: KeyValues = {};
  const push: KeyValues = {};
  const next: KeyBase = {};
  for (const key of SYNCED_SETTING_KEYS) {
    const l = local[key] ?? "";
    const r = remote[key] ?? "";
    const b = base[key];
    if (l === r) {
      if (l) next[key] = hashValue(l);
      continue;
    }
    const localChanged = b === undefined ? !!l : hashValue(l) !== b;
    const remoteChanged = b === undefined ? !!r : hashValue(r) !== b;
    if (localChanged && !remoteChanged) {
      push[key] = l;
      if (l) next[key] = hashValue(l);
    } else {
      apply[key] = r;
      if (r) next[key] = hashValue(r);
    }
  }
  return { apply, push, base: next };
}
