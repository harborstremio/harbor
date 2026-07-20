const EXCLUDED_PREFIXES = [
  "harbor.animefillercache",
  "harbor.anime.hero.hosted",
  "harbor.anime.toppicks.shown",
  "harbor.anilist.collection.",
  "harbor.dead-streams",
  "harbor.calendar.webhook.last",
  "harbor.addons.seeded",
  "harbor.scope.seeded",
] as const;

export function isSyncableKey(key: string): boolean {
  if (!key.startsWith("harbor.")) return false;
  if (key.startsWith("harbor.sync.")) return false;
  if (key === "harbor.together.clientId") return false;
  // The download registry holds device-local file paths and expiring stream
  // URLs; only the metadata catalog (harbor.downloads.catalog.v1) syncs.
  if (key === "harbor.downloads.v1") return false;
  return !EXCLUDED_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export function fnv1a64(s: string): string {
  let hash = 0xcbf29ce484222325n;
  const bytes = new TextEncoder().encode(s);

  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }

  return hash.toString(16).padStart(16, "0");
}
