import {
  ACCOUNT_SCOPE,
  ACCOUNT_SECTIONS,
  PROFILE_SECTIONS,
  type AccountSectionKey,
  type ProfileSectionKey,
  type SectionAdapter,
  type SectionKey,
} from "./types";

const PROFILE_SET = new Set<string>(PROFILE_SECTIONS);
const ACCOUNT_SET = new Set<string>(ACCOUNT_SECTIONS);

/**
 * This registry is the ALLOWLIST, and it is a mechanism rather than an aspiration.
 * Settings is 600+ lines of types and grows weekly, so a denylist silently leaks the
 * next field somebody adds. Nothing reaches the wire unless its section name appears in
 * PROFILE_SECTIONS or ACCOUNT_SECTIONS and an adapter has been registered for it.
 *
 * Adapters register into sync rather than sync importing them. The layout builder owns
 * lib/layout-sync/*, which lands separately, and an import of a module that does not
 * exist yet would take this whole layer red. An unregistered section is simply never
 * transmitted and never applied, which is the correct fail-safe direction.
 */
const registry = new Map<SectionKey, SectionAdapter>();

export function isProfileSection(key: string): key is ProfileSectionKey {
  return PROFILE_SET.has(key);
}

export function isAccountSection(key: string): key is AccountSectionKey {
  return ACCOUNT_SET.has(key);
}

export function isSectionKey(key: string): key is SectionKey {
  return isProfileSection(key) || isAccountSection(key);
}

export function registerSection(key: string, adapter: SectionAdapter): boolean {
  if (!isSectionKey(key)) return false;
  registry.set(key, adapter);
  return true;
}

export function registerSections(entries: Record<string, SectionAdapter>): string[] {
  const rejected: string[] = [];
  for (const [key, adapter] of Object.entries(entries)) {
    if (!registerSection(key, adapter)) rejected.push(key);
  }
  return rejected;
}

export function unregisterSection(key: SectionKey): void {
  registry.delete(key);
}

export function sectionAdapter(key: SectionKey): SectionAdapter | null {
  return registry.get(key) ?? null;
}

export function registeredProfileSections(): ProfileSectionKey[] {
  return PROFILE_SECTIONS.filter((k) => registry.has(k));
}

export function registeredAccountSections(): AccountSectionKey[] {
  return ACCOUNT_SECTIONS.filter((k) => registry.has(k));
}

/**
 * lists and collrows must be applied before home, because home.listRows holds ids that
 * resolve against those two stores. Applying home first leaves a row pointing at nothing
 * on a device that has not received the lists yet.
 */
const APPLY_ORDER: SectionKey[] = [
  "profiles",
  "lists",
  "collrows",
  "pinned",
  "catalogs",
  "services",
  "nav",
  "home",
  "anime",
  "manga",
  "detail",
  "page.movies",
  "page.shows",
  "page.kids",
  "page.discover",
  "watchedby",
];

export function applyRank(key: SectionKey): number {
  const i = APPLY_ORDER.indexOf(key);
  return i < 0 ? APPLY_ORDER.length : i;
}

export function docKey(section: SectionKey, syncId: string): string {
  return `${isAccountSection(section) ? ACCOUNT_SCOPE : syncId}:${section}`;
}

export function parseDocKey(key: string): { scope: string; section: SectionKey } | null {
  const cut = key.lastIndexOf(":");
  if (cut <= 0 || cut === key.length - 1) return null;
  const scope = key.slice(0, cut);
  const section = key.slice(cut + 1);
  if (!isSectionKey(section)) return null;
  if (isAccountSection(section) !== (scope === ACCOUNT_SCOPE)) return null;
  return { scope, section };
}

/**
 * EMPTY IS NEVER A VALUE. A section whose payload is structurally empty is omitted from
 * the push entirely; clearing a section takes an explicit { clear: true } write. This is
 * the rule that stops a TV which has never been customised from authoring an empty
 * layout onto the account, which is the exact class that ate featuredLists.
 */
export function isStructurallyEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.length === 0;
  if (typeof value === "number" || typeof value === "boolean") return false;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value !== "object") return false;
  const entries = Object.values(value as Record<string, unknown>);
  if (entries.length === 0) return true;
  return entries.every((v) => isStructurallyEmpty(v));
}
