// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const stremio = read("src/lib/stremio.ts");
const sync = read("src/views/player/hooks/use-stremio-sync.ts");
const autosave = read("src/views/player/hooks/use-resume-autosave.ts");
const home = read("src/views/home.tsx");
const cwHook = read("src/lib/continue-watching.ts");
const mobileRow = read("src/views/mobile/mobile-cw-row.tsx");
const shows = read("src/views/shows.tsx");
const anime = read("src/views/anime.tsx");
const advance = read("src/views/home/hooks/use-cw-advance.ts");
const resurface = read("src/lib/cw-resurface.ts");
const anilistSync = read("src/lib/anilist/sync.ts");
const malSync = read("src/lib/mal/sync.ts");

test("cloudWriteId never yields a cloud id for anime-scheme metas", () => {
  const fn = stremio.match(/export function cloudWriteId\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn, "cloudWriteId must exist in stremio.ts");
  const animeReturn = fn.indexOf("if (ANIME_CLOUD_ID.test(metaId)) return null;");
  const resolvedReturn = fn.indexOf(
    'if (verified && resolved && resolved.startsWith("tt")) return resolved;',
  );
  assert.ok(animeReturn >= 0, "anime-scheme ids must return null");
  assert.ok(resolvedReturn > animeReturn, "anime null must win over resolved-tt fallback");
  assert.match(stremio, /export const ANIME_CLOUD_ID = \/\^\(kitsu\|mal\|anilist\|anidb\):\//);
});

test("cloudWriteId keeps non-anime behavior intact", () => {
  const fn = stremio.match(/export function cloudWriteId\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn, "cloudWriteId must exist in stremio.ts");
  const ttReturn = fn.indexOf('if (metaId.startsWith("tt")) return metaId;');
  const animeReturn = fn.indexOf("if (ANIME_CLOUD_ID.test(metaId)) return null;");
  assert.ok(ttReturn >= 0 && ttReturn < animeReturn, "tt passthrough stays first");
  assert.match(fn, /return CLOUD_OK\.test\(metaId\) \? metaId : null;/);
});

test("libraryPut refuses anime-scheme writes unless they are removals", () => {
  const fn = stremio.match(/export async function libraryPut\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn, "libraryPut must exist");
  const gateIdx = fn.indexOf("ANIME_CLOUD_ID.test(item._id)");
  const putIdx = fn.indexOf("datastorePut");
  assert.ok(gateIdx >= 0, "libraryPut must gate anime ids");
  assert.ok(putIdx > gateIdx, "anime gate must run before datastorePut");
  assert.match(fn, /item\.removed !== true\) return;/);
});

test("player sync clears a stale finished flag on a real resume", () => {
  assert.match(sync, /const meaningfulResume =/);
  assert.match(sync, /videoChanged \|\| meaningfulResume \? 0 : prevFlagged/);
  assert.match(sync, /offsetMs >= 45000/);
});

test("videoIdFor still refuses cross-scheme threaded video ids", () => {
  assert.match(sync, /threaded\.split\(":"\)\[0\] === cid\.split\(":"\)\[0\]/);
});

test("tt-detected anime without imdb mapping never stamps kitsu numbering on tt items", () => {
  assert.match(
    sync,
    /cid\.startsWith\("tt"\) && threaded && ANIME_SCHEME\.test\(threaded\)\) return null;/,
  );
  const imdbBranch = sync.indexOf("s.episode.imdbSeason != null && s.episode.imdbEpisode != null");
  const animeRefusal = sync.indexOf(
    'cid.startsWith("tt") && threaded && ANIME_SCHEME.test(threaded)) return null;',
  );
  assert.ok(
    imdbBranch >= 0 && imdbBranch < animeRefusal,
    "imdb-numbered branch must win when mapping exists",
  );
  assert.match(sync, /if \(isSeries && src\.episode && !derivedVid\) return null;/);
  assert.match(autosave, /const ttAnimeUnmapped =/);
  assert.match(autosave, /\|\| animeLocal \|\| ttAnimeUnmapped/);
});

test("terminal flush still races a strict GET before merging the bitfield", () => {
  assert.match(sync, /isTerminal\s*\? await Promise\.race\(\[\s*strictGet,/);
});

test("anime playback lands in local CW", () => {
  assert.match(autosave, /const animeLocal = ANIME_CLOUD_ID\.test\(id\);/);
  assert.match(autosave, /\|\| isLocalUrl\(s\.url\) \|\| animeLocal/);
  assert.match(autosave, /type: s\.meta\.type === "movie" \? "movie" : "series"/);
});

test("every CW rail excludes cloud anime items", () => {
  assert.match(home, /items\.filter\(\(i\) => !ANIME_CLOUD_ID\.test\(i\._id\)\)/);
  assert.match(cwHook, /items\.filter\(\(i\) => !ANIME_CLOUD_ID\.test\(i\._id\)\)/);
  assert.match(mobileRow, /items\.filter\(\(i\) => !ANIME_CLOUD_ID\.test\(i\._id\)\)/);
  assert.match(shows, /!ANIME_CLOUD_ID\.test\(i\._id\) && isCwMember/);
  assert.match(anime, /libItems\.filter\(\(i\) => !ANIME_CLOUD_ID\.test\(i\._id\)\)/);
});

test("anime room sources local CW entries", () => {
  assert.match(anime, /const localAnimeCw = useMemo<LibraryItem\[\]>/);
  assert.match(anime, /listLocalCw\(\)\s*\.filter\(\(e\) => ANIME_CLOUD_ID\.test\(e\.id\)\)/);
  assert.match(anime, /\[\.\.\.localAnimeCw, \.\.\.libItems\.filter/);
});

test("home and anime room absorb legacy cloud anime items into local CW", () => {
  assert.match(home, /if \(!settings\.cwPerProfile\) absorbCloudAnimeCw\(view\);/);
  assert.match(anime, /if \(!settings\.cwPerProfile\) absorbCloudAnimeCw\(li\);/);
  const absorb = read("src/lib/anime-cw-absorb.ts");
  assert.match(absorb, /if \(existing && existing\.t >= t\) continue;/);
  assert.match(absorb, /if \(i\.removed && !i\.temp\) continue;/);
});

test("absorb cannot resurrect dismissed or ancient entries", () => {
  const absorb = read("src/lib/anime-cw-absorb.ts");
  assert.match(absorb, /if \(isCwDismissed\(i\)\) continue;/);
  assert.match(absorb, /Date\.now\(\) - t > ABSORB_RECENT_MS\) continue;/);
});

test("dismissing a local anime entry persists past re-absorb", () => {
  const homeDismiss = home.match(
    /const onDismissCw = useCallback\([\s\S]*?\[authKey\],\s*\);/,
  )?.[0];
  assert.ok(homeDismiss, "home onDismissCw must exist");
  assert.match(homeDismiss, /clearLocalCw\(item\._id\);\s*dismissCw\(item, authKey\);/);
  const animeDismiss = anime.match(/onDismiss=\{\(it\) => \{[\s\S]*?\}\}/)?.[0];
  assert.ok(animeDismiss, "anime room onDismiss must exist");
  assert.match(
    animeDismiss,
    /if \(it\.local\) clearLocalCw\(it\._id\);\s*dismissCw\(it, authKey\);/,
  );
});

test("library repair cannot rewrite live anime-scheme items", () => {
  const repair = read("src/lib/stremio-library-repair.ts");
  assert.match(
    repair,
    /ANIME_CLOUD_ID\.test\(nid\) && \(normalized as \{ removed\?: unknown \}\)\.removed !== true\) continue;/,
  );
});

test("anime episode lists carry absolute numbering for the phantom remap", () => {
  const se = read("src/lib/series-episodes.ts");
  assert.match(
    se,
    /ep\.absoluteNumber == null && m\.absoluteEpisodeNumber\)\s*ep\.absoluteNumber = m\.absoluteEpisodeNumber;/,
  );
});

test("phantom guard remaps absolute numbering instead of removing", () => {
  assert.match(advance, /list\.find\(\(e\) => e\.absoluteNumber === effCur\.episode\)/);
  assert.match(advance, /effCur = \{ season: abs\.season, episode: abs\.episode \};/);
});

test("resurface walks past watched adjacent episodes", () => {
  assert.match(resurface, /nextUnwatchedAfter\(list, cur, watchedFor\(i, cur\)\)/);
  assert.match(resurface, /fetchEpisodeList\(meta, \{ tmdbKey: opts\.tmdbKey \}\)/);
});

test("tracker sync cannot corrupt the wrong cour", () => {
  for (const src of [anilistSync, malSync]) {
    assert.match(src, /if \(target > total \+ 1\) return;/);
  }
  assert.match(anilistSync, /entry\.progress >= total\) return;/);
  assert.match(malSync, /num_episodes_watched >= total\) return;/);
});

test("home dedup prefers the twin that actually played most recently", () => {
  assert.match(home, /lastWatchedOf\(i\) > lastWatchedOf\(held\)/);
  assert.match(home, /byId\.delete\(held\._id\);/);
  const fn = home.match(/const lastWatchedOf = \(i: LibraryItem\) => \{[\s\S]*?\};/)?.[0];
  assert.ok(fn, "lastWatchedOf must exist");
  assert.match(fn, /i\._mtime/);
});
