const PRUNABLE_EXACT = new Set<string>([
  "harbor.omdb.v1",
  "harbor.omdb.misses",
  "harbor.omdb.budget",
  "harbor.iptv.hydration.v2",
  "harbor.iptv.epgmap.v1",
  "harbor.iptv.stats.v1",
  "harbor.dead-streams.v1",
  "harbor.discover.v1",
  "harbor.discover.events.v1",
  "harbor.discover.awards.v1",
  "harbor.discover.rows.v1",
  "harbor.scroll.v1",
  "harbor.webhook.lastTick",
  "harbor.calendar.webhook.last",
  "harbor.anidbtvdbcache",
  "harbor.armcache",
  "harbor.armkitsucache",
  "harbor.armsrcmalcache",
  "harbor.extkitsucache",
  "harbor.imdb.tmdb.v1",
  "harbor.tmdb.imdb.v1",
  "harbor.tmdb.personName.v1",
  "harbor.awards.wikidata.v8",
  "harbor.awards.wikidata.v9",
  "harbor.awards.wikidata.v10",
  "harbor.anime_awards.metas.v2",
  "harbor.animefillercache.v2",
  "harbor.jikancatalog",
  "harbor.malscorecache",
  "harbor.anime.recs_by_mal.v1",
  "harbor.anime.toppicks.cache.v1",
  "harbor.anime.toppicks.shown.v1",
  "harbor.anime.toppicks.visit.v1",
  "harbor.anime.mal_id_by_franchise.v1",
  "harbor.anime.detected.v1",
  "harbor.picker-cache.v4",
  "harbor.picker-cache.v5",
  "harbor.shows.hero.pool.v2",
  "harbor.mdblist.cards",
  "harbor.build.rating.v1",
  "harbor.parental",
  "harbor.lastseason.v1",
  "harbor.surprise.recent.v1",
  "harbor.stremio-addons.velocity.v1",
  "harbor.playback-history.v1",
]);

const PRUNABLE_PREFIXES = ["harbor.libraryNameRepair.v1.", "harbor.anilist.collection.v1."];

function isPrunable(key: string): boolean {
  if (PRUNABLE_EXACT.has(key)) return true;
  return PRUNABLE_PREFIXES.some((p) => key.startsWith(p));
}

function prunableEntries(): Array<{ key: string; size: number }> {
  const out: Array<{ key: string; size: number }> = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !isPrunable(key)) continue;
    const v = localStorage.getItem(key);
    if (v == null) continue;
    out.push({ key, size: v.length + key.length });
  }
  out.sort((a, b) => b.size - a.size);
  return out;
}

function isQuotaError(e: unknown): boolean {
  if (e instanceof DOMException) {
    if (e.name === "QuotaExceededError") return true;
    if (e.name === "NS_ERROR_DOM_QUOTA_REACHED") return true;
    if (e.code === 22) return true;
    if (e.code === 1014) return true;
  }
  return false;
}

function pruneOne(key: string): number {
  try {
    const cur = localStorage.getItem(key);
    if (cur == null) return 0;
    const freed = cur.length + key.length;
    localStorage.removeItem(key);
    console.info(`[storage] pruned "${key}" to free ${freed} chars`);
    return freed;
  } catch {
    return 0;
  }
}

export function setItemWithRecovery(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    if (!isQuotaError(e)) throw e;
  }
  for (const { key: candidate } of prunableEntries()) {
    if (candidate === key) continue;
    pruneOne(candidate);
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      if (!isQuotaError(e)) throw e;
    }
  }
  console.warn(`[storage] giving up on "${key}" after pruning every cache`);
  return false;
}

export function freeStorageSpace(): { freedBytes: number; pruned: string[] } {
  let freed = 0;
  const pruned: string[] = [];
  for (const { key } of prunableEntries()) {
    const n = pruneOne(key);
    if (n > 0) {
      freed += n;
      pruned.push(key);
    }
  }
  return { freedBytes: freed, pruned };
}

const PROACTIVE_PER_KEY_THRESHOLD = 256 * 1024;
const PROACTIVE_TOTAL_THRESHOLD = 3.5 * 1024 * 1024;

const DEAD_CACHE_PREFIXES = ["harbor.picker-cache."];
const VERSIONED_CACHE_PREFIXES = ["harbor.awards.wikidata"];

function purgeDeadCaches(): void {
  const kill: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && DEAD_CACHE_PREFIXES.some((p) => k.startsWith(p))) kill.push(k);
  }
  for (const k of kill) pruneOne(k);
}

function purgeOldCacheVersions(): void {
  for (const prefix of VERSIONED_CACHE_PREFIXES) {
    const re = new RegExp(`^${prefix.replace(/\./g, "\\.")}\\.v(\\d+)$`);
    const found: Array<{ key: string; v: number }> = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const m = re.exec(k);
      if (m) found.push({ key: k, v: Number(m[1]) });
    }
    if (found.length < 2) continue;
    const max = Math.max(...found.map((f) => f.v));
    for (const f of found) if (f.v < max) pruneOne(f.key);
  }
}

export function proactiveStorageCleanup(): void {
  if (typeof localStorage === "undefined") return;
  purgeDeadCaches();
  purgeOldCacheVersions();
  const entries = prunableEntries();
  let total = 0;
  for (const { key, size } of entries) {
    total += size;
    if (size > PROACTIVE_PER_KEY_THRESHOLD) pruneOne(key);
  }
  if (total > PROACTIVE_TOTAL_THRESHOLD) {
    const r = freeStorageSpace();
    console.info(
      `[storage] proactive total cleanup: ${r.pruned.length} caches, ${r.freedBytes} bytes`,
    );
  }
}
