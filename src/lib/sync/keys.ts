// Device-local caches and derived data never sync: they are rebuildable from
// upstream APIs, can grow past the server's 400k-char per-doc limit (413),
// and waste the account's doc quota. Only user state (settings, profiles,
// auth, library, progress) belongs in the sync set. Keep this aligned with
// the prunable-cache registry in src/lib/storage-recovery.ts.
const EXCLUDED_PREFIXES = [
  // Anime metadata caches
  "harbor.animefillercache",
  "harbor.anime_awards.metas.",
  "harbor.anime.hero.",
  "harbor.anime.herologos",
  "harbor.anime.toppicks.",
  "harbor.anime.recs_by_mal.",
  "harbor.anime.mal_id_by_franchise.",
  "harbor.anime.detected.",
  "harbor.anilist.collection.",
  "harbor.jikancatalog",
  "harbor.malscorecache",
  // Cross-service ID mapping caches
  "harbor.armcache",
  "harbor.armkitsucache",
  "harbor.armsrcmalcache",
  "harbor.extkitsucache",
  "harbor.anidbtvdbcache",
  "harbor.tmdb.imdb.",
  "harbor.tmdb.personName.",
  "harbor.imdb.tmdb.",
  // Provider/API response caches
  "harbor.omdb.",
  "harbor.awards.wikidata",
  "harbor.mdblist.cards",
  "harbor.snap.",
  "harbor.picker-cache.",
  // Feed and hero curation caches
  "harbor.discover.",
  "harbor.shows.hero.pool.",
  "harbor.lastseason.",
  "harbor.surprise.recent.",
  "harbor.build.rating.",
  "harbor.stremio-addons.velocity.",
  // Device-local operational state
  "harbor.dead-streams",
  "harbor.calendar.webhook.last",
  "harbor.webhook.lastTick",
  "harbor.scroll.",
  "harbor.iptv.hydration.",
  "harbor.iptv.epgmap.",
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
