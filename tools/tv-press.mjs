import { execSync } from "node:child_process";

const PKG = "app.harbor";
const KEYS = { right: 22, left: 21, up: 19, down: 20, ok: 23 };

const argv = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  }),
);

const PRESSES = Math.max(1, Number(argv.presses || 5));
const GAP = Math.max(1, Number(argv.gap || 3.7));
const KEYNAME = String(argv.key || "right");
const KEY = Object.hasOwn(KEYS, KEYNAME) ? KEYS[KEYNAME] : KEYS.right;
const BACK = KEY === KEYS.right ? KEYS.left : KEY === KEYS.left ? KEYS.right : 0;
const LABEL = typeof argv.label === "string" ? argv.label : "unlabelled";
const QUIET_TRIES = 6;
const QUIET_SECS = 6;

const sh = (c) =>
  execSync(c, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 32 * 1024 * 1024 });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const say = (s) => process.stdout.write(s + "\n");

function power() {
  let out;
  try {
    out = sh("adb shell dumpsys power");
  } catch (e) {
    return { reachable: false, on: false, why: String(e && e.message ? e.message : e).split("\n")[0] };
  }
  return { reachable: true, on: /mWakefulness=Awake/.test(out), why: "" };
}

function foreground() {
  try {
    const m = sh("adb shell dumpsys activity activities").match(/ResumedActivity.*?([\w.]+)\//);
    return m ? m[1] : "?";
  } catch {
    return "?";
  }
}

function reset() {
  try {
    sh(`adb shell dumpsys gfxinfo ${PKG} reset`);
  } catch {}
}

function read() {
  let o;
  try {
    o = sh(`adb shell dumpsys gfxinfo ${PKG}`);
  } catch {
    return null;
  }
  const n = (re) => {
    const m = o.match(re);
    return m ? Number(m[1]) : NaN;
  };
  return {
    frames: n(/Total frames rendered: (\d+)/),
    janky: n(/Janky frames: (\d+)/),
    p50: n(/50th percentile: (\d+)ms/),
    p90: n(/90th percentile: (\d+)ms/),
    p95: n(/95th percentile: (\d+)ms/),
    p99: n(/99th percentile: (\d+)ms/),
  };
}

async function requireQuiet() {
  for (let i = 1; i <= QUIET_TRIES; i += 1) {
    reset();
    await wait(QUIET_SECS * 1000);
    const s = read();
    if (s && s.frames === 0) return true;
    say(`  baseline not quiet (${s ? s.frames : "?"} frames in ${QUIET_SECS}s), settling ${i}/${QUIET_TRIES}`);
    await wait(6000);
  }
  return false;
}

const pwr = power();
if (!pwr.reachable) {
  say("could not reach the device with adb, so nothing below would be a measurement.");
  say("  " + pwr.why);
  say("  adb on PATH? device listed in `adb devices`? this is NOT a screen-off report.");
  process.exit(1);
}
if (!pwr.on) {
  say("screen is OFF. Every number from a dark panel is fiction. Turn the TV on and rerun.");
  process.exit(1);
}
const app = foreground();
if (app !== PKG) {
  say(`${app} is in the foreground, not ${PKG}. Open Harbor and rerun.`);
  process.exit(1);
}

say(`tv-press: ${PRESSES} isolated presses, ${GAP}s apart, key=${argv.key || "right"}, label="${LABEL}"`);
say("");
say(`waiting for a verified-quiet baseline (0 frames in ${QUIET_SECS}s)...`);

if (!(await requireQuiet())) {
  say("");
  say("never reached 0 frames at rest. Something is rendering with no input, which makes every");
  say("per-press number below meaningless. Find that first: it is the highest-value bug on the");
  say("board and it has happened before (a 14s drift, and before that an infinite one).");
  process.exit(2);
}
say("  baseline quiet at 0 frames.");
say("");

async function drain(limit = 5) {
  for (let i = 0; i < limit; i += 1) {
    reset();
    await wait(2500);
    const q = read();
    if (q && q.frames === 0) return true;
  }
  return false;
}

const each = [];
const dirty = [];
for (let i = 0; i < PRESSES; i += 1) {
  const clean = await drain();
  if (!clean) dirty.push(i + 1);
  reset();
  try {
    sh(`adb shell input keyevent ${KEY}`);
  } catch {}
  await wait(GAP * 1000);
  const one = read();
  each.push(one ? { frames: one.frames, p50: one.p50, p99: one.p99 } : null);
}

if (each.some(Boolean)) {
  say("=== " + LABEL + ", per press ===");
  say("  press   frames   p50    p99    est ms");
  each.forEach((e, i) => {
    if (!e) return;
    const f = Number.isFinite(e.p50) && e.p50 > 0 ? e.p50 : 16.67;
    say(
      `  ${String(i + 1).padStart(5)}   ${String(e.frames).padStart(6)}   ${String(e.p50).padStart(3)}  ${String(e.p99).padStart(5)}   ${(e.frames * f).toFixed(0).padStart(6)}`,
    );
  });
  const fr = each.filter(Boolean).map((e) => e.frames);
  say(`  spread: ${Math.min(...fr)} to ${Math.max(...fr)} frames`);
  if (dirty.length) {
    say(`  NOT ISOLATED: press ${dirty.join(", ")} started before the previous one went quiet.`);
    say(`  Those rows carry the tail of the press before them. Treat them as upper bounds.`);
  } else {
    say(`  every press started from a verified 0-frame baseline, so these are independent.`);
  }
  say("");
}

const s = read();
if (!s) {
  say("could not read gfxinfo after the run.");
  process.exit(3);
}

const perPress = s.frames / PRESSES;
say("=== " + LABEL + " ===");
say(`  frames           ${s.frames}`);
const frameMs = Number.isFinite(s.p50) && s.p50 > 0 ? s.p50 : 16.67;
const renderMs = perPress * frameMs;
const vsyncMs = perPress * 16.67;
say(`  per press        ${perPress.toFixed(1)}`);
say(`  ms per press     ${renderMs.toFixed(0)}   (frames x p50 frame time ${frameMs}ms)`);
if (frameMs > 20) {
  say(`  NOTE             frames average ${frameMs}ms, well over one 16.7ms vsync.`);
  say(`                   frames x 16.67 would have said ${vsyncMs.toFixed(0)}ms and understated`);
  say(`                   this by ${(renderMs / Math.max(1, vsyncMs)).toFixed(1)}x. That bug is why this line exists.`);
}
say(`  janky            ${s.janky} (${((s.janky / Math.max(1, s.frames)) * 100).toFixed(0)}%)`);
say(`  p50 p90 p95 p99  ${s.p50} ${s.p90} ${s.p95} ${s.p99}`);
say("");
say("  ms per press tracks the LONGEST transition the press starts. Compare it against the");
say("  longest duration-[Nms] on that surface; they should agree within a frame or two.");
say("  Frame COUNT is the stable number (0.78% across 7 identical runs). ms is derived, so");
say("  only compare ms between runs whose p50 is similar.");

if (BACK) {
  for (let i = 0; i < PRESSES; i += 1) {
    try {
      sh(`adb shell input keyevent ${BACK}`);
    } catch {}
    await wait(400);
  }
}
