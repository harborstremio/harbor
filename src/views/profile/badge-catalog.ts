import { HARBOR_API_BASE } from "@/lib/config/endpoints";

export const BADGE_ICON_BASE = `${HARBOR_API_BASE}/themes/api/images/badges`;

export const BADGE_NAMES = [
  "addon_developer_v2",
  "admin",
  "beta",
  "community_manager",
  "content_creator",
  "contri",
  "dev",
  "donator",
  "moderator",
  "og",
  "stremio_supporter",
  "tester",
  "theme_creator",
  "top_donator",
  "top_theme_creator",
  "translator",
  "verified",
  "vip",
] as const;

export type BadgeName = (typeof BADGE_NAMES)[number];

const KNOWN = new Set<string>(BADGE_NAMES);

export function badgeIconUrl(key?: string): string | undefined {
  if (!key) return undefined;
  const name = key.trim().toLowerCase();
  if (KNOWN.has(name)) return `${BADGE_ICON_BASE}/${name}.webp`;
  if (/^https?:\/\//i.test(key.trim())) return key.trim();
  return undefined;
}

export const SHOWN_BADGE_KEY_RE = /^[a-z0-9_-]{1,40}$/;

export function badgeKey(name?: string): string {
  return (name ?? "").trim().toLowerCase();
}

export function orderShownBadges<T extends { name: string }>(badges: T[], shown?: string[]): T[] {
  const rest = badges.filter((b) => badgeKey(b.name) !== "verified");
  if (!shown || shown.length === 0) return rest;
  const byKey = new Map<string, T>();
  for (const b of rest) {
    const k = badgeKey(b.name);
    if (!byKey.has(k)) byKey.set(k, b);
  }
  const out: T[] = [];
  const used = new Set<string>();
  for (const s of shown) {
    const k = badgeKey(s);
    if (used.has(k)) continue;
    const b = byKey.get(k);
    if (b) {
      out.push(b);
      used.add(k);
    }
  }
  return out;
}
