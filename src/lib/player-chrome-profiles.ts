import {
  CONTROL_META,
  CONTROL_STATES,
  DEFAULT_DEFAULT_CONFIG,
  DEFAULT_STREMIO_CONFIG,
  PANELS,
  PANEL_CORNERS,
  PANEL_META,
  type CustomIconMap,
  type PanelConfig,
  type PanelCorner,
  type PanelId,
  type PlayerChromeConfig,
  type PlayerControlConfig,
  type PlayerControlId,
  type ThemeId,
} from "./player-chrome";
import { t } from "@/lib/i18n";

export type LayoutProfile = {
  id: string;
  name: string;
  themeId: ThemeId;
  config: PlayerChromeConfig;
  createdAt: number;
  modifiedAt: number;
};

export type ProfileDb = {
  profiles: LayoutProfile[];
  active: Partial<Record<ThemeId, string>>;
};

export const PROFILE_DB_KEY = "harbor.player.chrome.profiles.v1";
const LEGACY_KEY_DEFAULT = "harbor.player.chrome.default.v1";
const LEGACY_KEY_STREMIO = "harbor.player.chrome.stremio.v1";

const ASSUMED_QUOTA_BYTES = 5 * 1024 * 1024;
const SAFE_PAYLOAD_BYTES = 4_800_000;

export type SaveResult = { ok: true } | { ok: false; error: string };

let migratedThisSession = false;

function emptyDb(): ProfileDb {
  return { profiles: [], active: {} };
}

function isValidIconDataUrl(s: unknown): s is string {
  return (
    typeof s === "string" &&
    /^data:image\/(png|jpe?g|webp|gif|svg\+xml);(?:base64,|[^,]*,)/i.test(s)
  );
}

function baselineFor(theme: ThemeId): PlayerChromeConfig {
  return theme === "stremio" ? DEFAULT_STREMIO_CONFIG : DEFAULT_DEFAULT_CONFIG;
}

function newId(): string {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function sanitizeConfig(input: unknown, theme: ThemeId): PlayerChromeConfig {
  const baseline = baselineFor(theme);
  if (!input || typeof input !== "object") return baseline;
  const partial = input as Partial<PlayerChromeConfig>;
  const incoming = (partial.controls ?? []).filter(
    (c): c is PlayerControlConfig => !!c && typeof c.id === "string" && c.id in CONTROL_META,
  );
  const present = new Set(incoming.map((c) => c.id));
  const merged: PlayerControlConfig[] = [...incoming];
  for (const base of baseline.controls) {
    if (!present.has(base.id)) merged.push(base);
  }
  const customIcons: CustomIconMap = {};
  if (partial.customIcons && typeof partial.customIcons === "object") {
    for (const [k, v] of Object.entries(partial.customIcons)) {
      if (!isValidIconDataUrl(v)) continue;
      const [controlId, state] = k.split(":");
      if (!controlId || !(controlId in CONTROL_META)) continue;
      if (state) {
        const validStates = CONTROL_STATES[controlId as PlayerControlId] ?? [];
        if (!validStates.includes(state)) continue;
      }
      customIcons[k] = v;
    }
  }
  const panels: Partial<Record<PanelId, PanelConfig>> = {};
  for (const pid of PANELS) {
    const stored = partial.panels?.[pid];
    const corner: PanelCorner =
      stored && PANEL_CORNERS.includes(stored.corner)
        ? stored.corner
        : PANEL_META[pid].defaultCorner;
    panels[pid] = { corner, hidden: !!stored?.hidden };
  }
  return {
    controls: merged,
    customIcons,
    panels,
    options: {
      volumeStyle: partial.options?.volumeStyle ?? baseline.options.volumeStyle,
      timeFormat: partial.options?.timeFormat ?? baseline.options.timeFormat,
    },
  };
}

function readDbRaw(): ProfileDb {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(PROFILE_DB_KEY) : null;
    if (!raw) return emptyDb();
    const parsed = JSON.parse(raw) as ProfileDb;
    if (!parsed || !Array.isArray(parsed.profiles)) return emptyDb();
    parsed.profiles = parsed.profiles
      .filter(
        (p): p is LayoutProfile => !!p && typeof p.id === "string" && typeof p.name === "string",
      )
      .map((p) => ({
        ...p,
        themeId: p.themeId === "stremio" ? "stremio" : "default",
        config: sanitizeConfig(p.config, p.themeId === "stremio" ? "stremio" : "default"),
      }));
    parsed.active = parsed.active ?? {};
    return parsed;
  } catch {
    return emptyDb();
  }
}

function estimateStorageBytes(): number {
  try {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const v = localStorage.getItem(k) ?? "";
      total += (k.length + v.length) * 2;
    }
    return total;
  } catch {
    return 0;
  }
}

function writeDb(db: ProfileDb): SaveResult {
  let json: string;
  try {
    json = JSON.stringify(db);
  } catch (err) {
    return { ok: false, error: t("Could not serialize profile (a value may be circular).") };
  }
  const bytes = json.length * 2;
  if (bytes > SAFE_PAYLOAD_BYTES) {
    const mb = (bytes / 1024 / 1024).toFixed(2);
    return {
      ok: false,
      error: t(
        "Profile data is too large ({mb} MB). Remove unused custom icons or delete an old profile, then try again.",
        { mb },
      ),
    };
  }
  try {
    localStorage.setItem(PROFILE_DB_KEY, json);
    return { ok: true };
  } catch (err) {
    const name = err instanceof DOMException ? err.name : "";
    if (name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED") {
      return {
        ok: false,
        error: t(
          "Your browser's storage is full. Remove custom icons or delete profiles to free up space, then try again.",
        ),
      };
    }
    return {
      ok: false,
      error:
        err instanceof Error
          ? t("Save failed: {error}", { error: err.message })
          : t("Save failed for an unknown reason."),
    };
  }
}

function migrateLegacyOnce(db: ProfileDb): ProfileDb {
  if (migratedThisSession) return db;
  migratedThisSession = true;
  const now = Date.now();
  let changed = false;
  for (const [legacyKey, themeId] of [
    [LEGACY_KEY_DEFAULT, "default" as const],
    [LEGACY_KEY_STREMIO, "stremio" as const],
  ] as const) {
    try {
      const raw = localStorage.getItem(legacyKey);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const cfg = sanitizeConfig(parsed, themeId);
      const profile: LayoutProfile = {
        id: newId(),
        name: t("My layout"),
        themeId,
        config: cfg,
        createdAt: now,
        modifiedAt: now,
      };
      db.profiles.push(profile);
      db.active[themeId] = profile.id;
      localStorage.removeItem(legacyKey);
      changed = true;
    } catch {}
  }
  if (changed) writeDb(db);
  return db;
}

export function readProfileDb(): ProfileDb {
  return migrateLegacyOnce(readDbRaw());
}

export function listProfiles(theme: ThemeId): LayoutProfile[] {
  return readProfileDb().profiles.filter((p) => p.themeId === theme);
}

export function getActiveProfile(theme: ThemeId): LayoutProfile | null {
  const db = readProfileDb();
  const id = db.active[theme];
  if (!id) return null;
  return db.profiles.find((p) => p.id === id) ?? null;
}

export function setActiveProfile(theme: ThemeId, profileId: string): SaveResult {
  const db = readProfileDb();
  const exists = db.profiles.some((p) => p.id === profileId && p.themeId === theme);
  if (!exists) return { ok: false, error: t("Profile not found.") };
  db.active[theme] = profileId;
  return writeDb(db);
}

function dedupeProfileName(
  db: ProfileDb,
  theme: ThemeId,
  baseName: string,
  excludeId?: string,
): string {
  const trimmed = baseName.trim() || t("Untitled");
  const existing = new Set(
    db.profiles
      .filter((p) => p.themeId === theme && p.id !== excludeId)
      .map((p) => p.name.toLowerCase()),
  );
  if (!existing.has(trimmed.toLowerCase())) return trimmed;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${trimmed} (${i})`;
    if (!existing.has(candidate.toLowerCase())) return candidate;
  }
  return `${trimmed} ${Date.now()}`;
}

export function createProfile(
  theme: ThemeId,
  name: string,
  config: PlayerChromeConfig,
): { ok: true; profile: LayoutProfile } | { ok: false; error: string } {
  const db = readProfileDb();
  const now = Date.now();
  const profile: LayoutProfile = {
    id: newId(),
    name: dedupeProfileName(db, theme, name),
    themeId: theme,
    config: sanitizeConfig(config, theme),
    createdAt: now,
    modifiedAt: now,
  };
  db.profiles.push(profile);
  db.active[theme] = profile.id;
  const res = writeDb(db);
  return res.ok ? { ok: true, profile } : res;
}

export function updateActiveProfileConfig(
  theme: ThemeId,
  config: PlayerChromeConfig,
): { ok: true; profile: LayoutProfile } | { ok: false; error: string } {
  const db = readProfileDb();
  const id = db.active[theme];
  const existing = id ? db.profiles.find((p) => p.id === id) : null;
  if (!existing) {
    return createProfile(theme, t("My layout"), config);
  }
  const prevConfig = existing.config;
  const prevModified = existing.modifiedAt;
  existing.config = sanitizeConfig(config, theme);
  existing.modifiedAt = Date.now();
  const res = writeDb(db);
  if (!res.ok) {
    existing.config = prevConfig;
    existing.modifiedAt = prevModified;
    return res;
  }
  return { ok: true, profile: existing };
}

export function renameProfile(profileId: string, newName: string): SaveResult {
  const db = readProfileDb();
  const p = db.profiles.find((x) => x.id === profileId);
  if (!p) return { ok: false, error: t("Profile not found.") };
  p.name = dedupeProfileName(db, p.themeId, newName, p.id);
  p.modifiedAt = Date.now();
  return writeDb(db);
}

export function deleteProfile(profileId: string): SaveResult {
  const db = readProfileDb();
  const idx = db.profiles.findIndex((p) => p.id === profileId);
  if (idx < 0) return { ok: false, error: t("Profile not found.") };
  const removed = db.profiles[idx];
  db.profiles.splice(idx, 1);
  if (db.active[removed.themeId] === profileId) {
    const next = db.profiles.find((p) => p.themeId === removed.themeId);
    if (next) db.active[removed.themeId] = next.id;
    else delete db.active[removed.themeId];
  }
  return writeDb(db);
}

export function storageUsageBytes(): { used: number; quota: number; pct: number } {
  const used = estimateStorageBytes();
  return { used, quota: ASSUMED_QUOTA_BYTES, pct: Math.min(1, used / ASSUMED_QUOTA_BYTES) };
}

export function exportProfileJson(profileId: string): string | null {
  const db = readProfileDb();
  const p = db.profiles.find((x) => x.id === profileId);
  if (!p) return null;
  return JSON.stringify(
    { harborProfileVersion: 1, name: p.name, themeId: p.themeId, config: p.config },
    null,
    2,
  );
}

export function importProfileJson(
  text: string,
): { ok: true; profile: LayoutProfile } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: t("Not valid JSON. The file may be corrupted.") };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: t("File is not a Harbor layout profile.") };
  }
  const obj = parsed as Record<string, unknown>;
  if (obj.harborProfileVersion !== undefined && obj.harborProfileVersion !== 1) {
    return {
      ok: false,
      error: t("Unsupported profile version ({version}). Update Harbor or use an older profile.", {
        version: String(obj.harborProfileVersion),
      }),
    };
  }
  if (!obj.config || typeof obj.config !== "object") {
    return { ok: false, error: t("Profile file has no chrome config.") };
  }
  const theme: ThemeId = obj.themeId === "stremio" ? "stremio" : "default";
  const name = typeof obj.name === "string" && obj.name.trim() ? obj.name : t("Imported");
  const config = sanitizeConfig(obj.config, theme);
  return createProfile(theme, name, config);
}
