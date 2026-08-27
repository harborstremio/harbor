// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const at = (path: string) => new URL(`../${path}`, import.meta.url);
const read = (path: string) => readFileSync(at(path), "utf8");

const resolve = read("src/lib/streams/resolve.ts");
const preflight = read("src/lib/streams/preflight.ts");
const picker = read("src/views/play-picker/use-pick-handler.ts");
const bridgeLoad = read("src/views/player/hooks/use-bridge-load.ts");
const mpv = read("src/lib/player/mpv.ts");
const nativeMpv = read("src-tauri/src/mpv.rs");
const trace = read("src/lib/perf/playback-trace.ts");
const preparation = read("src/lib/debrid/playback-preparation.ts");
const settingsDefaults = read("src/lib/settings/defaults.ts");
const playModeSettings = read("src/views/settings/player-panel/play-mode-section.tsx");
const streamProxy = read("src-tauri/src/stream_proxy.rs");
const proxyClient = read("src/lib/stream-proxy.ts");
const startupProfile = read("src/lib/player/startup-profile.ts");

test("debrid resolution exposes exact-URL size evidence instead of issuing a duplicate HEAD", () => {
  const validation = resolve.slice(
    resolve.indexOf("function validateLink"),
    resolve.indexOf("function sortDebridsForStream"),
  );
  assert.match(resolve, /exactUrlValidated: true/);
  assert.match(resolve, /method: "provider-size"/);
  assert.doesNotMatch(validation, /method: "HEAD"/);
  assert.doesNotMatch(validation, /fetch\(|setTimeout/);
  assert.match(picker, /r\.readiness\?\.exactUrlValidated === true/);
});

test("unknown debrid links receive one short probe and transient failures are not memoized", () => {
  assert.match(preflight, /PREFLIGHT_TIMEOUT_MS = 1200/);
  assert.doesNotMatch(preflight, /PROBE_ATTEMPTS|PROBE_RETRY_MS|function sleep/);
  assert.match(preflight, /if \(r\.ok \|\| r\.reason === "stub"\) memo\.set/);
});

test("warm resume lookup overlaps loading while uncached deep links remain gated", () => {
  const resumeStart = bridgeLoad.indexOf("const resumePromise");
  const mediaStart = bridgeLoad.indexOf("const loadMedia = () =>");
  const join = bridgeLoad.indexOf("Promise.all([resumePromise, loadMedia()])");
  assert.ok(resumeStart >= 0 && mediaStart > resumeStart && join > mediaStart);
  assert.match(bridgeLoad, /!isResumeStartReady\(resumeIdentity\)/);
  assert.match(bridgeLoad, /if \(waitBeforeLoad\)/);
});

test("Windows embedded mpv is retained across compatible VOD bitrate profiles", () => {
  assert.match(mpv, /invoke<boolean>\("mpv_release_media"\)/);
  assert.match(mpv, /retainedMpv\?\.configKey === reuseConfigKey/);
  assert.match(mpv, /retainedMpv\.isLive === nextIsLive/);
  assert.doesNotMatch(mpv, /retainedMpv\.startupProfile === nextStartupProfile/);
  assert.doesNotMatch(
    mpv,
    /currentStartupProfile != null && currentStartupProfile !== nextStartupProfile/,
  );
  assert.match(mpv, /invoke\("mpv_restore_media_surface"\)/);
  assert.match(mpv, /await ensureGeometryTracking\(opts\);/);
  assert.match(mpv, /A retained Windows mpv child was hidden/);
  assert.match(nativeMpv, /pub async fn mpv_release_media/);
  assert.match(nativeMpv, /pub async fn mpv_restore_media_surface/);
  assert.match(nativeMpv, /mpv\.command\("stop", &\[\]\)/);
  assert.match(nativeMpv, /set_embedded_mpv_children_visible\(&app, false\)/);
});

test("playback timing is local-only and contains no media URLs or account identifiers", () => {
  assert.match(trace, /performance\?\.mark/);
  assert.match(trace, /\[perf\]\[playback\]/);
  assert.doesNotMatch(trace, /url|token|authorization|metaId|imdb/i);
});

test("early debrid preparation is explicit, bounded, verified, and memory-only", () => {
  assert.match(settingsDefaults, /instantPlaybackPreparation: false/);
  assert.match(playModeSettings, /may create or update transfers on your debrid account/i);
  assert.match(preparation, /MAX_PREPARES_PER_MINUTE = 6/);
  assert.match(preparation, /MAX_PREPARES_PER_HOUR = 30/);
  assert.match(preparation, /PREPARED_LINK_TTL_MS = 2 \* 60 \* 1000/);
  assert.match(preparation, /stream\.cacheVerified\?\.\[debrid\.slug\] === true/);
  assert.match(preparation, /const clientIds = new WeakMap/);
  assert.match(preparation, /invalidatePreparedDebridLink/);
  assert.match(preparation, /if \(signal\.aborted \|\| stream\.url \|\| !isVerifiedFor/);
  assert.doesNotMatch(preparation, /localStorage|sessionStorage|indexedDB|writeFile|console\./);
});

test("committed debrid playback bypasses the local proxy unless request headers require it", () => {
  assert.match(picker, /intent !== "download" && hasProxyHeaders/);
  assert.doesNotMatch(picker, /remoteDebridPlayback|prebufferBytes/);
  assert.match(proxyClient, /args\.prebufferBytes = opts\.prebufferBytes/);
  assert.match(resolve, /if \(!userCommitted && !stream\.infoHash/);
});

test("proxy prebuffering never blocks the real player request", () => {
  assert.match(streamProxy, /PREBUFFER_MAX_BYTES: usize = 2 \* 1024 \* 1024/);
  assert.match(streamProxy, /status != StatusCode::PARTIAL_CONTENT/);
  assert.match(streamProxy, /PrebufferState::Loading \| PrebufferState::Failed => return None/);
  assert.doesNotMatch(streamProxy, /receiver\.changed\(\)\.await/);
  assert.match(streamProxy, /served playback prefix id=\{id\}/);
  assert.doesNotMatch(streamProxy, /playback prefix.*url|url=.*playback prefix/i);
});

test("startup buffering is staged and adapts without lowering media quality", () => {
  assert.match(startupProfile, /HIGH_BITRATE_MIN_BYTES = 12 \* 1024 \* 1024 \* 1024/);
  assert.match(startupProfile, /2160p\?|4320p\?|4k\|8k\|uhd\|remux/);
  assert.match(nativeMpv, /startup_profile: Option<String>/);
  assert.match(nativeMpv, /if high_bitrate \{ "32MiB" \} else \{ "16MiB" \}/);
  assert.match(mpv, /phase === "startup"/);
  assert.match(mpv, /\["demuxer-max-bytes", highBitrate \? "256MiB" : "128MiB"\]/);
  assert.match(mpv, /\["demuxer-max-bytes", highBitrate \? "768MiB" : "512MiB"\]/);
  assert.match(mpv, /steadyBufferLoadId !== mediaLoadId/);
  assert.match(nativeMpv, /"cache-pause-initial", "no"/);
  assert.doesNotMatch(startupProfile, /resolution.*replace|transcode|downscale/i);
});
