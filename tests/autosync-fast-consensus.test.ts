// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const context = read("src/lib/subtitles/autosync/context.ts");
const pipeline = read("src/lib/subtitles/autosync/pipeline.ts");
const smart = read("src/lib/subtitles/autosync/smart-layer.ts");

test("every audio and network port is timeout-bounded", () => {
  assert.match(context, /function bounded<T>\(p: Promise<T>, ms: number, fallback: T\)/);
  assert.match(context, /async function boundedMeasurement\(/);
  for (const c of [
    "SCORE_TIMEOUT_MS",
    "VAD_TIMEOUT_MS",
    "TORRENT_SCORE_TIMEOUT_MS",
    "TORRENT_VAD_TIMEOUT_MS",
    "HASH_TIMEOUT_MS",
    "CROWD_TIMEOUT_MS",
  ]) {
    assert.match(context, new RegExp(`const ${c} = \\d+;`));
  }
  assert.match(context, /boundedMeasurement\(\s*routeTorrent\s*\? torrentScore/);
  assert.match(context, /bounded\(\s*routeTorrent\s*\? torrentVad/);
  assert.match(context, /bounded\(rawHash\(hctx\), HASH_TIMEOUT_MS, null\)/);
  assert.match(context, /bounded\(crowdPort\(cctx\), CROWD_TIMEOUT_MS, null\)/);
});

test("pipeline starts consensus and quality probe in parallel, before hash", () => {
  const qStart = pipeline.indexOf(
    "const qualityBeforeP = measureQuality(ctx, IDENTITY, validationRequest);",
  );
  const cStart = pipeline.indexOf("const consensusP: Promise<ConsensusResult | null>");
  const hashStart = pipeline.indexOf("if (ports.hashExact) {");
  assert.ok(qStart >= 0 && cStart >= 0 && hashStart >= 0);
  assert.ok(qStart < hashStart && cStart < hashStart, "parallel starts must precede the hash tier");
  assert.ok(
    !/const qualityBefore = await ports\.measureQuality/.test(pipeline),
    "no eager blocking quality probe",
  );
});

test("consensus anchors produce a primary fast-apply transform", () => {
  assert.match(smart, /export function consensusAnchorFit\(\s*res: ConsensusResult,?\s*\)/);
  assert.match(smart, /const FAST_MIN_ANCHORS = 8;/);
  assert.match(smart, /const FAST_MAX_RESIDUAL = 0\.6;/);
  assert.match(pipeline, /const fastFit = consensusAnchorFit\(consensusRes\);/);
  assert.match(pipeline, /bestEffort = true;/);
  const fastTier = pipeline.indexOf("consensusAnchorFit(consensusRes)");
  const vadTier = pipeline.indexOf("if (ports.vadAffine) {");
  assert.ok(fastTier >= 0 && vadTier > fastTier, "fast consensus tier must run before audio VAD");
});

test("fast tier keeps best-effort at offer when audio cannot confirm", () => {
  assert.match(pipeline, /const be = evaluateBestEffort\(\{/);
  assert.match(pipeline, /const fastBefore = await qualityBeforeP;/);
  assert.match(pipeline, /qualityBefore: fastBefore,/);
  assert.match(pipeline, /if \(be\.decision === "offer"/);
  assert.doesNotMatch(pipeline, /if \(be\.decision === "apply"/);
});

test("single-source subtitles can still vote on the offset", () => {
  const consensus = read("src/lib/subtitles/autosync/consensus.ts");
  assert.match(consensus, /single-source fallback/);
  assert.match(consensus, /soloPeers\.length >= 2/);
  assert.match(consensus, /corroboratedReference\(soloPeers, false\)/);
  assert.match(consensus, /corroboratedReference\(peers, true\)/);
  const fallback = consensus.indexOf("single-source fallback");
  const wrongVerdict = consensus.indexOf('verdict: "wrong"');
  assert.ok(
    fallback >= 0 && wrongVerdict > fallback,
    "wrong-content verdict stays multi-source only",
  );
});

test("auto-sync is a real toggle with a visible best-effort pill", () => {
  const hook = read("src/views/player/hooks/use-auto-sync.ts");
  assert.match(hook, /stop: \(\) => void;/);
  assert.match(
    hook,
    /const stop = useCallback\(\(\) => \{\s*activeDisposeRef\.current\?\.\(\);\s*revert\(\);/,
  );
  const popover = read("src/components/player/autosync/autosync-popover.tsx");
  assert.match(popover, /case "best-effort":\s*return "synced";/);
  const menu = read("src/components/player/subtitle-menu/sync-control.tsx");
  assert.match(menu, /autoSync\?\.stop\(\);/);
  assert.match(menu, /\{autoSyncOn \? tr\("Turn off auto-sync"\) : tr\("Auto sync"\)\}/);
  assert.match(menu, /aria-label=\{tr\("\{label\}, sync options", \{ label \}\)\}/);
});
