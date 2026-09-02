// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const at = (path: string) => new URL(`../${path}`, import.meta.url);
const read = (path: string) => readFileSync(at(path), "utf8");

const engine = read("src-tauri/src/torrent_engine.rs");
const streamRoute = read("src-tauri/src/torrent_engine/stream_route.rs");
const resolve = read("src/lib/streams/resolve.ts");
const usage = read("src/lib/torrent/local-engine.ts");
const playerMedia = read("src/views/player/hooks/use-player-media.ts");
const pickHandler = read("src/views/play-picker/use-pick-handler.ts");
const picker = read("src/views/play-picker.tsx");
const pickerUtils = read("src/views/play-picker/picker-utils.ts");
const autoPlayTransition = read("src/views/play-picker/auto-play-transition.tsx");
const episodePanel = read("src/components/player/episode-panel/index.tsx");
const autoDownload = read("src/lib/auto-download/resolve.ts");
const seasonDownload = read("src/lib/download/season-download.ts");
const castResolve = read("src/views/player/cast-resolve.ts");
const downloads = read("src/lib/download/downloads-store.ts");
const playerDownload = read("src/views/player/hooks/use-video-download.ts");
const magnetCard = read("src/components/search/magnet-card.tsx");
const app = read("src/App.tsx");
const dhtBoot = read("src-tauri/src/torrent_engine/dht_boot.rs");
const autoRetry = read("src/views/player/hooks/use-auto-retry.ts");

test("selecting a torrent file does not start peer transfer", () => {
  const start = engine.indexOf("pub async fn torrent_engine_select");
  const end = engine.indexOf("pub async fn torrent_engine_stats", start);
  assert.ok(start >= 0 && end > start, "torrent_engine_select block is missing");
  const select = engine.slice(start, end);
  assert.match(select, /update_only_files_bounded\(&session, &handle, &only\)/);
  assert.doesNotMatch(select, /session\.unpause\(/);
});

test("the local HTTP stream request starts a paused torrent on demand", () => {
  assert.match(streamRoute, /if handle\.is_paused\(\)/);
  assert.match(streamRoute, /session\.unpause\(&handle\)\.await/);
});

test("persisted torrents are paused at startup and before a clean shutdown", () => {
  const prePause = engine.indexOf("mark_persisted_torrents_paused(&dir)");
  const restore = engine.indexOf("new_session(&dir, true, true, true)");
  assert.ok(prePause >= 0 && restore > prePause, "session JSON must be paused before restore");
  assert.match(
    engine,
    /record\.insert\("is_paused"\.to_string\(\), serde_json::Value::Bool\(true\)\)/,
  );
  assert.match(engine, /pause_all_torrents\(&session\)\.await;/);
  const shutdown = engine.slice(
    engine.indexOf("async fn finish_session_stop"),
    engine.indexOf("pub async fn stop_async"),
  );
  assert.match(shutdown, /pause_all_torrents\(&session\)\.await;/);
  assert.match(shutdown, /session\.stop\(\)\.await;/);
});

test("a canceled P2P resolve cleans up only a torrent created by that resolve", () => {
  assert.match(resolve, /registerAbortCleanup\(added, signal\)/);
  assert.match(resolve, /if \(added\.already_managed === true\) return \(\) => \{\};/);
  assert.match(resolve, /if \(handedOff\) beginTorrentPlaybackHandoff\(added\.info_hash\)/);
  assert.match(resolve, /else scheduleAbandonedTorrentRemoval\(added\.info_hash, 0\)/);
  assert.match(resolve, /signal\.addEventListener\("abort", cleanup, \{ once: true \}\)/);
  assert.match(resolve, /signal\.removeEventListener\("abort", cleanup\)/);
  assert.match(resolve, /if \(added\.already_managed !== true\)/);
  assert.match(usage, /export function scheduleAbandonedTorrentRemoval/);
  assert.match(usage, /if \(\(torrentUsage\.get\(key\)\?\.owners\.size \?\? 0\) > 0\) return;/);
  assert.match(usage, /void removeUnusedTorrentWithRetry\(key, true\)/);
  assert.doesNotMatch(resolve, /startFullDownload/);
});

test("players and downloads explicitly own local-engine torrents", () => {
  assert.match(usage, /export function retainTorrentUsage/);
  assert.match(usage, /export function releaseTorrentUsage/);
  assert.match(usage, /pausedOwners/);
  assert.match(
    playerMedia,
    /retainTorrentUsage\(hash, ownerId, \{ preservePendingDelete: true \}\)/,
  );
  assert.match(playerMedia, /releaseTorrentUsage\(hash, ownerId/);
  assert.match(downloads, /retainDownloadTorrent\(item\)/);
  assert.match(downloads, /pauseTorrentUsage\(engine\.infoHash, torrentOwnerId\(id\)\)/);
  assert.match(
    downloads,
    /releaseTorrentUsage\(engine\.infoHash, torrentOwnerId\(item\.id\), \{ deleteFiles: true \}\)/,
  );
});

test("the player download button uses the persistent Downloads store", () => {
  assert.match(playerDownload, /enqueueDownload/);
  assert.match(playerDownload, /useDownloads/);
  assert.match(playerDownload, /cancelDownload/);
  assert.match(playerDownload, /revealDownload/);
  assert.match(playerDownload, /destinationPath: path/);
  assert.match(playerDownload, /headers,/);
  assert.doesNotMatch(playerDownload, /startDownload/);
  assert.doesNotMatch(playerDownload, /handleRef\.current\?\.abort/);
  assert.match(downloads, /destinationPath\?: string \| null/);
  assert.match(downloads, /if \(existing\) return existing\.id/);
});

test("a P2P stream that never reaches a frame deletes its temporary cache", () => {
  assert.match(playerMedia, /torrentPlaybackStartedRef/);
  assert.match(playerMedia, /torrentPlaybackArmedRef/);
  assert.match(playerMedia, /const ready = snap\.firstFrameReady \|\| snap\.positionSec > 0\.3/);
  assert.match(playerMedia, /if \(!ready\)/);
  assert.match(
    playerMedia,
    /torrentPlaybackArmedRef\.current && !torrentPlaybackStartedRef\.current/,
  );
  assert.match(playerMedia, /!torrentPlaybackStartedRef\.current \|\|/);
  assert.match(playerMedia, /deleteFiles: purge\(\)/);
  assert.match(playerMedia, /preservePendingDelete: true/);
  assert.match(playerMedia, /confirmTorrentUsage\(engineRef\.infoHash\)/);
  assert.match(usage, /PENDING_DELETE_KEY/);
  assert.match(usage, /markPendingDelete\(key\)/);
  assert.match(usage, /export function reconcilePendingTorrentRemovals/);
  assert.match(app, /void reconcilePendingTorrentRemovals\(\)/);
  assert.match(app, /flushPendingTorrentRemovals\(\)\.catch/);
});

test("slow player startup keeps explicit ownership of a prepared P2P torrent", () => {
  assert.match(usage, /export function beginTorrentPlaybackHandoff/);
  assert.match(usage, /player-handoff:/);
  assert.match(usage, /export function claimTorrentPlaybackHandoff/);
  assert.match(resolve, /if \(handedOff\) beginTorrentPlaybackHandoff\(added\.info_hash\)/);
  assert.doesNotMatch(resolve, /handedOff \? 5000 : 0/);
  assert.match(
    playerMedia,
    /retainTorrentUsage\(hash, ownerId, \{ preservePendingDelete: true \}\)/,
  );
  assert.match(playerMedia, /claimTorrentPlaybackHandoff\(hash\)/);
});

test("failed P2P preparation is discarded and remains retryable", () => {
  assert.match(engine, /async fn wait_for_torrent_initialization/);
  assert.match(engine, /discard_on_failure/);
  assert.match(
    engine,
    /session\s+\.delete\(TorrentIdOrHash::Hash\(handle\.info_hash\(\)\), true\)/,
  );
  assert.match(engine, /wait_for_torrent_initialization\(session, &handle, !already_managed\)/);
  assert.match(engine, /wait_for_torrent_initialization\(&session, &h, !already_managed\)/);
  assert.match(pickHandler, /RETRYABLE_ENGINE_FAILURES/);
  assert.match(
    pickHandler,
    /if \(!RETRYABLE_ENGINE_FAILURES\.has\(r\.code\)\) \{\s+setFailedStreams/,
  );
});

test("existing torrent preparation is reused without repeating magnet discovery", () => {
  const addStart = engine.indexOf("pub async fn torrent_engine_add");
  const seedStart = engine.indexOf("dht_boot::seed_peers", addStart);
  const existingLookup = engine.indexOf("session.get(TorrentIdOrHash::Hash(info_hash))", addStart);
  assert.ok(existingLookup > addStart && existingLookup < seedStart);
  assert.match(dhtBoot, /pub\(crate\) fn info_hash_from_magnet/);
});

test("P2P season packs use one atomic torrent before concurrent debrid fallback", () => {
  assert.match(seasonDownload, /if \(stream\.infoHash && localTorrentAllowed\(\)\)/);
  assert.match(seasonDownload, /downloadPackViaEngine/);
  assert.match(seasonDownload, /const limit = limiter\(MAX_CONCURRENT\)/);
  assert.doesNotMatch(seasonDownload, /p2pSetupFailed/);
});

test("torrent file selection has a bounded recoverable wait", () => {
  assert.match(engine, /const FILE_SELECTION_TIMEOUT_SECS: u64 = 12/);
  assert.match(engine, /async fn update_only_files_bounded/);
  assert.match(engine, /"torrent file selection timed out"/);
  assert.match(
    resolve,
    /if \(!\(await torrentEngineSelect\(added\.info_hash, chosenIdx\)\)\) return null/,
  );
});

test("local P2P streaming supports media-player byte ranges and completed-file recovery", () => {
  assert.match(streamRoute, /parse_range\(value, len\)/);
  assert.match(streamRoute, /len\.saturating_sub\(suffix_len\)/);
  assert.match(streamRoute, /inclusive_end\.saturating_add\(1\)\.min\(len\)/);
  assert.match(streamRoute, /bytes \*\/\{len\}/);
  assert.match(autoRetry, /completed P2P file produced no frame — reloading local stream/);
  assert.match(autoRetry, /completed P2P file produced no video frame/);
});

test("unused torrent cleanup retries after the player releases its local stream", () => {
  assert.match(usage, /UNUSED_REMOVE_RETRY_MS = \[0, 750, 2_000\]/);
  assert.match(usage, /async function removeUnusedTorrentWithRetry/);
  assert.match(usage, /if \(await tryTorrentEngineRemove\(key, deleteFiles\)\) return/);
  assert.match(usage, /if \(\(torrentUsage\.get\(key\)\?\.owners\.size \?\? 0\) > 0\) return/);
});

test("slow P2P discovery reports its real phase and a recoverable failure", () => {
  assert.match(autoPlayTransition, /P2P_SEARCHING_DELAY_MS = 6000/);
  assert.match(autoPlayTransition, /P2P_SLOW_DELAY_MS = 25000/);
  assert.match(autoPlayTransition, /P2P · \$\{t\("Searching sources…"\)\}/);
  assert.match(autoPlayTransition, /P2P · \$\{t\("Stream is taking a while"\)\}/);
  assert.match(autoPlayTransition, /t\("Choose another source"\)/);
  assert.match(autoPlayTransition, /t\("This source is slow\. Try another\."\)/);
  assert.match(
    pickHandler,
    /export type ResolvingSelection = \{ stream: ScoredStream; p2p: boolean \}/,
  );
  assert.match(pickHandler, /setResolving\(\{ stream, p2p \}\)/);
  assert.match(picker, /p2p=\{resolving\?\.p2p === true\}/);
  assert.match(pickerUtils, /It may not have reachable peers/);
});

test("raw torrent downloads use the same P2P classification as the picker", () => {
  assert.match(
    resolve,
    /export function shouldPreferP2pDownload[\s\S]*isP2pStream\(stream\) && engineP2pEligible\(stream\)/,
  );
  assert.match(
    pickHandler,
    /const effectiveForceP2p =\s*forceP2p \|\| \(intent === "download" && shouldPreferP2pDownload\(stream\)\)/,
  );
  assert.match(seasonDownload, /downloadPackViaEngine/);
  assert.match(seasonDownload, /resolveStream\([\s\S]*?true,\s*false,\s*\{ season:/);
});

test("completed P2P downloads are reused by exact torrent identity", () => {
  assert.match(downloads, /torrentInfoHash\?: string \| null/);
  assert.match(downloads, /torrentFileIdx\?: number \| null/);
  assert.match(downloads, /export async function completedTorrentDownloadFor/);
  assert.match(downloads, /ref\?\.infoHash === key/);
  assert.match(downloads, /fileIdx == null \|\| ref\.fileIdx === fileIdx/);
  assert.match(downloads, /fileIdx != null\s+\? \(candidates\[0\] \?\? null\)/);
  assert.match(downloads, /hint\?\.season != null && hint\.episode != null/);
  assert.match(downloads, /await exists\(match\.path\)/);
  assert.match(resolve, /allowCompletedDownload = true/);
  assert.match(resolve, /if \(allowCompletedDownload && stream\.infoHash\)/);
  const lookup = resolve.indexOf("completedTorrentDownloadFor(stream.infoHash");
  const add = resolve.indexOf("torrentEngineAdd(");
  assert.ok(lookup >= 0 && add > lookup, "completed download lookup must run before torrent add");
  assert.match(resolve, /via: "local-download"/);
  assert.match(resolve, /subtitles: stream\.subtitles\?\.map/);
  assert.match(pickHandler, /r\.via === "local-download"/);
  assert.match(pickHandler, /intent !== "download"/);
  assert.match(episodePanel, /r\.via === "local-download"/);
  assert.match(autoDownload, /hint, true, false\)/);
  assert.match(seasonDownload, /resolveStream\([\s\S]*?true,\s*false,[\s\S]*?true,\s*\)\.catch/);
  assert.match(castResolve, /undefined, true, false\)/);
});

test("full-file P2P downloading starts only after the player owns the torrent", () => {
  const retain = playerMedia.indexOf("retainTorrentUsage(hash, ownerId,");
  const full = playerMedia.indexOf("startFullDownload(hash, src.url)");
  assert.ok(retain >= 0 && full > retain);
});

test("closing magnet setup removes a newly-created torrent before player handoff", () => {
  assert.match(magnetCard, /pendingEngineRef/);
  assert.match(magnetCard, /scheduleAbandonedTorrentRemoval\(infoHash, 0\)/);
  assert.match(magnetCard, /if \(added\.already_managed !== true\)/);
  assert.match(magnetCard, /startPlay\(videos\[0\]\.idx, videos\[0\]\.name, added\)/);
});
