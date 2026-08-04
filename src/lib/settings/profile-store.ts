import { loadStoredSettings } from "./load";
import { setItemWithRecovery } from "@/lib/storage-recovery";
import type { Settings } from "./types";

export const MIRROR_KEY = "harbor.settings";
export const SHARED_KEY = "harbor.settings.shared";

export function profileKey(id: string): string {
  return `harbor.settings.${id}`;
}

export function sourceKeyFor(profileId: string, linked: boolean): string {
  return linked ? SHARED_KEY : profileKey(profileId);
}

export function serializeSettings(settings: Settings): string {
  const { backgroundImage: _drop, ...themeRest } = settings.theme;
  void _drop;
  return JSON.stringify({ ...settings, theme: themeRest });
}

export function seedSharedFromLegacy(): void {
  try {
    if (localStorage.getItem(SHARED_KEY) != null) return;
    const legacy = localStorage.getItem(MIRROR_KEY);
    if (legacy != null) localStorage.setItem(SHARED_KEY, legacy);
  } catch {
    return;
  }
}

export function loadEffective(profileId: string, linked: boolean): Settings {
  const key = sourceKeyFor(profileId, linked);
  if (localStorage.getItem(key) != null) return loadStoredSettings(key);
  if (localStorage.getItem(SHARED_KEY) != null) return loadStoredSettings(SHARED_KEY);
  if (localStorage.getItem(MIRROR_KEY) != null) return loadStoredSettings(MIRROR_KEY);
  return loadStoredSettings(key);
}

export function recoverableLegacyBlob(): string | null {
  return localStorage.getItem(SHARED_KEY) ?? localStorage.getItem(MIRROR_KEY);
}

function readActiveSourceForRecovery(): { profileId: string; linked: boolean } {
  try {
    const raw = localStorage.getItem("harbor.profiles.v1");
    if (!raw) return { profileId: "default", linked: true };
    const s = JSON.parse(raw) as {
      profiles?: Array<{ id: string; settingsLinked?: boolean }>;
      activeId?: string | null;
    };
    const id = s.activeId || "default";
    const p = s.profiles?.find((x) => x.id === id);
    return { profileId: id, linked: p?.settingsLinked !== false };
  } catch {
    return { profileId: "default", linked: true };
  }
}

export function applyLegacyToActive(): boolean {
  const blob = recoverableLegacyBlob();
  if (blob == null) return false;
  const { profileId, linked } = readActiveSourceForRecovery();
  const ok = setItemWithRecovery(sourceKeyFor(profileId, linked), blob);
  setItemWithRecovery(MIRROR_KEY, blob);
  return ok;
}

export function persistEffective(settings: Settings, profileId: string, linked: boolean): string {
  const json = serializeSettings(settings);
  setItemWithRecovery(sourceKeyFor(profileId, linked), json);
  setItemWithRecovery(MIRROR_KEY, json);
  return json;
}

export function forkToProfile(profileId: string): void {
  const shared = localStorage.getItem(SHARED_KEY) ?? localStorage.getItem(MIRROR_KEY);
  if (shared != null) setItemWithRecovery(profileKey(profileId), shared);
}

export function dropProfileBlob(profileId: string): void {
  try {
    localStorage.removeItem(profileKey(profileId));
  } catch {
    return;
  }
}
