import { sameValue, type SyncValues } from "./document-sync.ts";

export const PROFILE_PREFERENCES = [
  "uiLanguage",
  "region",
  "tmdbLanguage",
  "preferredLanguages",
  "requirePreferredLanguage",
  "homeLanguages",
  "preferredSubLangs",
  "preferredAudioLangs",
  "subtitlesOffByDefault",
  "subtitlePreselect",
  "autoPlayNextEpisode",
  "defaultPlaybackSpeed",
  "detailTrailerAutoplay",
  "streaming",
] as const;
type Port = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const STORES = [
  ["favorites", "harbor.favorites.v1.", "array"],
  ["watchlist", "harbor.watchlist.v1.", "array"],
  ["localWatchlist", "harbor.localwatchlist.v1.", "array"],
  ["progress", "harbor.localcw.v1.", "object"],
  ["privateProgress", "harbor.localcw.private.v1.", "object"],
  ["history", "harbor.watchevents.v1.", "array"],
  ["library", "harbor.jl.library.v1.", "array"],
] as const;
export const JL_PROFILE_DATA_PREFIXES = STORES.map(([, prefix]) => prefix);
const SAFE_FIELDS = [
  "id",
  "_id",
  "type",
  "name",
  "title",
  "addedAt",
  "season",
  "episode",
  "videoId",
  "positionMs",
  "durationMs",
  "t",
  "at",
  "removed",
  "temp",
  "_ctime",
  "_mtime",
  "lastWatched",
  "timeOffset",
  "timeWatched",
  "watched",
  "duration",
  "timesWatched",
  "flaggedWatched",
  "video_id",
  "isAnime",
  "upNext",
  "manualWatched",
];
function record(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
function sharedProfileId(storage: Port, localId: string): string {
  try {
    const roster = JSON.parse(storage.getItem("harbor.profiles.v1") ?? "null");
    const profiles = Array.isArray(roster?.profiles) ? roster.profiles : [];
    const profile = profiles.find((p: { id?: string }) => p.id === localId);
    const alias = profile?.shareStremioWith;
    return typeof alias === "string" && profiles.some((p: { id?: string }) => p.id === alias)
      ? alias
      : localId;
  } catch {
    return localId;
  }
}
function storeProfileId(storage: Port, localId: string, section: string): string {
  return ["watchlist", "progress", "history", "addon"].includes(section)
    ? sharedProfileId(storage, localId)
    : localId;
}
function parse(storage: Port, key: string): unknown {
  const raw = storage.getItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("JL local profile data is damaged; sync paused to preserve it.");
  }
}
function clean(value: unknown): Record<string, unknown> | null {
  if (!record(value)) return null;
  const out: Record<string, unknown> = {};
  for (const field of SAFE_FIELDS) {
    const v = value[field];
    if (typeof v === "string" && v.length <= 1000 && !/^(?:https?:|file:|magnet:)/i.test(v))
      out[field] = v;
    else if (typeof v === "number" && Number.isFinite(v)) out[field] = v;
    else if (typeof v === "boolean") out[field] = v;
  }
  // Stremio-compatible library state is nested; URLs, headers and auth never sync.
  if (record(value.state)) out.state = clean(value.state);
  return out;
}
function itemKey(value: unknown, index: string, section: string): string | null {
  if (!record(value)) return null;
  const id =
    typeof value.id === "string" ? value.id : typeof value._id === "string" ? value._id : index;
  if (!id || id.length > 512 || /^(?:https?:|file:|magnet:)/i.test(id)) return null;
  return section === "history" ? `${id}|s${value.season ?? ""}e${value.episode ?? ""}` : id;
}
function safePreference(key: string, value: unknown): boolean {
  if (key === "streaming")
    return (
      record(value) &&
      Object.entries(value).every(([k, v]) => /^[\w-]{1,64}$/.test(k) && typeof v === "boolean")
    );
  if (
    [
      "requirePreferredLanguage",
      "subtitlesOffByDefault",
      "subtitlePreselect",
      "autoPlayNextEpisode",
      "detailTrailerAutoplay",
    ].includes(key)
  )
    return typeof value === "boolean";
  if (key === "defaultPlaybackSpeed")
    return typeof value === "number" && Number.isFinite(value) && value >= 0.1 && value <= 8;
  if (
    ["preferredLanguages", "homeLanguages", "preferredSubLangs", "preferredAudioLangs"].includes(
      key,
    )
  )
    return (
      Array.isArray(value) &&
      value.length <= 30 &&
      value.every((v) => typeof v === "string" && /^[\w -]{0,64}$/.test(v))
    );
  return typeof value === "string" && /^[\w -]{1,64}$/.test(value);
}

/** A deliberately explicit data shape: credentials, URLs, headers, PINs and device paths stay local. */
export function readProfileData(
  storage: Port,
  localId: string,
  settings: Record<string, unknown>,
  metadata: Record<string, unknown> = {},
): SyncValues {
  const result: SyncValues = {};
  if (typeof metadata.name === "string" && metadata.name.trim() && metadata.name.length <= 40)
    result["profile:name"] = metadata.name;
  if (typeof metadata.color === "string" && /^#[a-f\d]{6}$/i.test(metadata.color))
    result["profile:color"] = metadata.color;
  for (const key of PROFILE_PREFERENCES)
    if (safePreference(key, settings[key])) result[`settings:${key}`] = settings[key];
  for (const [section, prefix, shape] of STORES) {
    const stored = parse(storage, prefix + storeProfileId(storage, localId, section));
    if (stored !== null && !(shape === "array" ? Array.isArray(stored) : record(stored)))
      throw new Error("Invalid JL local profile store");
    for (const [index, value] of Object.entries(stored ?? {})) {
      const id = itemKey(value, index, section);
      const safe = clean(value);
      if (id && safe) result[`${section}:${id}`] = safe;
    }
  }
  const addonProfileId = storeProfileId(storage, localId, "addon");
  const installed = parse(storage, "harbor.installed-addons." + addonProfileId);
  const disabled = parse(storage, "harbor.addons.disabled." + addonProfileId);
  const addonCounts = new Map<string, number>();
  if (Array.isArray(installed))
    for (const addon of installed)
      if (record(addon) && typeof addon.id === "string")
        addonCounts.set(addon.id, (addonCounts.get(addon.id) ?? 0) + 1);
  if (Array.isArray(installed))
    for (const addon of installed) {
      if (
        record(addon) &&
        typeof addon.id === "string" &&
        addonCounts.get(addon.id) === 1 &&
        /^[\w.-]{1,160}$/.test(addon.id)
      ) {
        // Selection is portable. Configured transport URLs may contain credentials and stay local.
        result[`addon:${addon.id}`] = {
          enabled: !Array.isArray(disabled) || !disabled.includes(addon.transportUrl),
        };
      }
    }
  return result;
}

export function validateProfileData(value: unknown): SyncValues {
  if (!record(value) || JSON.stringify(value).length > 500_000 || Object.keys(value).length > 5000)
    throw new Error("Invalid JL profile sync data");
  const result: SyncValues = {};
  for (const [key, entry] of Object.entries(value)) {
    const colon = key.indexOf(":");
    const section = key.slice(0, colon),
      id = key.slice(colon + 1);
    if (colon < 1 || !id || key.length > 700) throw new Error("Invalid JL profile sync record");
    if (key === "profile:name" && typeof entry === "string" && entry.trim() && entry.length <= 40)
      result[key] = entry;
    else if (key === "profile:color" && typeof entry === "string" && /^#[a-f\d]{6}$/i.test(entry))
      result[key] = entry;
    else if (
      section === "settings" &&
      (PROFILE_PREFERENCES as readonly string[]).includes(id) &&
      safePreference(id, entry)
    )
      result[key] = entry;
    else if (
      section === "addon" &&
      /^[\w.-]{1,160}$/.test(id) &&
      record(entry) &&
      typeof entry.enabled === "boolean"
    )
      result[key] = { enabled: entry.enabled };
    else if (STORES.some(([s]) => s === section) && record(entry)) {
      const safe = clean(entry);
      if (!sameValue(safe, entry) || itemKey(entry, id, section) !== id)
        throw new Error("Unsupported JL profile data fields");
      result[key] = safe;
    } else throw new Error("Unsupported JL profile sync record");
  }
  return result;
}

/** Preserve local edits made while the request was in flight, plus local-only metadata. */
export function applyProfileData(
  storage: Port,
  localId: string,
  values: SyncValues,
  expected: SyncValues,
  currentSettings: Record<string, unknown>,
  metadata: Record<string, unknown> = {},
): Record<string, unknown> {
  const current = readProfileData(storage, localId, currentSettings, metadata);
  const applicable: SyncValues = { ...values };
  for (const key of new Set([...Object.keys(current), ...Object.keys(expected)])) {
    if (!sameValue(current[key], expected[key])) {
      if (Object.prototype.hasOwnProperty.call(current, key)) applicable[key] = current[key];
      else delete applicable[key];
    }
  }
  const writes = new Map<string, string>();
  for (const [section, prefix, shape] of STORES) {
    const targetId = storeProfileId(storage, localId, section);
    const stored = parse(storage, prefix + targetId);
    const old = new Map(
      Object.entries(stored ?? {}).map(([index, value]) => [itemKey(value, index, section), value]),
    );
    const entries = Object.entries(applicable)
      .filter(([key]) => key.startsWith(section + ":"))
      .map(([key, value]) => {
        const id = key.slice(section.length + 1);
        return [id, { ...(old.get(id) as object), ...(value as object) }] as const;
      });
    if (section === "history")
      entries.sort(
        ([, a], [, b]) =>
          Number((b as Record<string, unknown>).at ?? 0) -
          Number((a as Record<string, unknown>).at ?? 0),
      );
    const localOnly = Object.entries(stored ?? {}).filter(
      ([index, value]) => itemKey(value, index, section) === null,
    );
    writes.set(
      prefix + targetId,
      JSON.stringify(
        shape === "array"
          ? [...entries.map(([, v]) => v), ...localOnly.map(([, v]) => v)]
          : Object.fromEntries([...entries, ...localOnly]),
      ),
    );
  }
  const addonProfileId = storeProfileId(storage, localId, "addon");
  const installed = parse(storage, "harbor.installed-addons." + addonProfileId);
  const disabled = parse(storage, "harbor.addons.disabled." + addonProfileId);
  const nextDisabled = new Set(Array.isArray(disabled) ? disabled : []);
  const addonCounts = new Map<string, number>();
  if (Array.isArray(installed))
    for (const addon of installed)
      if (record(addon) && typeof addon.id === "string")
        addonCounts.set(addon.id, (addonCounts.get(addon.id) ?? 0) + 1);
  if (Array.isArray(installed))
    for (const addon of installed) {
      if (
        !record(addon) ||
        typeof addon.id !== "string" ||
        addonCounts.get(addon.id) !== 1 ||
        typeof addon.transportUrl !== "string"
      )
        continue;
      const selection = applicable[`addon:${addon.id}`];
      if (record(selection)) {
        if (selection.enabled) nextDisabled.delete(addon.transportUrl);
        else nextDisabled.add(addon.transportUrl);
      }
    }
  writes.set("harbor.addons.disabled." + addonProfileId, JSON.stringify([...nextDisabled]));
  const previous = new Map([...writes.keys()].map((key) => [key, storage.getItem(key)]));
  try {
    for (const [key, value] of writes) storage.setItem(key, value);
  } catch (error) {
    for (const [key, value] of previous) {
      if (value !== null) storage.setItem(key, value);
      else storage.removeItem(key);
    }
    throw error;
  }
  return Object.fromEntries(
    Object.entries(applicable)
      .filter(([key]) => key.startsWith("settings:"))
      .map(([key, v]) => [key.slice(9), v]),
  );
}
