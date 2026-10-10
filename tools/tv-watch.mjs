// Watches a REAL session and reports the stalls a person actually feels.
//
// Everything else in tools/ drives synthetic input and reads a 120-frame
// window. That rig said p50 21ms while js was watching the app freeze. Two
// reasons it could not see the problem:
//   framestats keeps only the last 120 frames, so a 2 second stall every minute
//   falls outside the window entirely;
//   CDP input at a fixed 200ms cadence is nothing like a held remote, so
//   "high input latency", which was 70% of frames in js's session, never
//   appeared at all.
// So this samples continuously, keeps the WORST frames rather than the median,
// and never touches the device except to read counters.
//
//   node tools/tv-watch.mjs
//   node tools/tv-watch.mjs --every=5 --stall=250

import { execSync } from "node:child_process";
import fs from "node:fs";

const PKG = "app.harbor";
const argv = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  }),
);
const EVERY = Math.max(2, Number(argv.every || 4));
const STALL = Math.max(50, Number(argv.stall || 200));
const LOG = typeof argv.log === "string" ? argv.log : "./.diag/tv-watch.log";

const sh = (c) => execSync(c, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(LOG.replace(/[^/\\]+$/, "") || ".", { recursive: true });

const COL = { Flags: 0, IntendedVsync: 1, HandleInputStart: 5, PerformTraversalsStart: 7, DrawStart: 8, SyncStart: 10, IssueDrawCommandsStart: 11, SwapBuffers: 12, FrameCompleted: 13 };

function frames() {
  let out;
  try {
    out = sh(`adb shell dumpsys gfxinfo ${PKG} framestats`);
  } catch {
    return [];
  }
  const rows = [];
  for (const l of out.split(/\r?\n/)) {
    if (!/^\d/.test(l)) continue;
    const p = l.trim().split(",").map(Number);
    if (p.length < 14 || p[COL.Flags] !== 0 || p[COL.FrameCompleted] <= 0) continue;
    rows.push(p);
  }
  return rows;
}

function summary() {
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
    total: n(/Total frames rendered: (\d+)/),
    janky: n(/Janky frames: (\d+)/),
    p90: n(/90th percentile: (\d+)ms/),
    p95: n(/95th percentile: (\d+)ms/),
    p99: n(/99th percentile: (\d+)ms/),
    inputLat: n(/Number High input latency: (\d+)/),
    slowUi: n(/Number Slow UI thread: (\d+)/),
    missedVsync: n(/Number Missed Vsync: (\d+)/),
  };
}

const fg = () => {
  try {
    const m = sh(`adb shell dumpsys activity activities`).match(/ResumedActivity.*?([\w.]+)\//);
    return m ? m[1] : "?";
  } catch {
    return "?";
  }
};

const ms = (a, b) => (b - a) / 1e6;
const seen = new Set();
let worst = [];
let last = null;

const line = (s) => {
  process.stdout.write(s + "\n");
  try {
    fs.appendFileSync(LOG, s + "\n");
  } catch {}
};

line(`watching ${PKG}. sampling every ${EVERY}s, flagging frames over ${STALL}ms.`);
line(`use the app normally. ctrl-c to stop. log: ${LOG}\n`);

process.on("SIGINT", () => {
  line("\n=== worst frames this session ===");
  worst.sort((a, b) => b.total - a.total);
  for (const w of worst.slice(0, 15))
    line(
      `  ${String(Math.round(w.total)).padStart(5)}ms total   ` +
        `wait-to-start ${String(Math.round(w.delay)).padStart(4)}  ` +
        `layout ${String(Math.round(w.layout)).padStart(3)}  ` +
        `draw ${String(Math.round(w.draw)).padStart(3)}  ` +
        `issue ${String(Math.round(w.issue)).padStart(4)}  ` +
        `swap ${String(Math.round(w.swap)).padStart(3)}`,
    );
  if (worst.length) {
    const avg = (k) => worst.reduce((s, w) => s + w[k], 0) / worst.length;
    line(`\nacross ${worst.length} stalls, where the time went on average:`);
    for (const k of ["delay", "layout", "draw", "issue", "swap"])
      line(`  ${k.padEnd(6)} ${avg(k).toFixed(0)}ms`);
    line(`\nwait-to-start is vsync to the UI thread picking the frame up. If that`);
    line(`dominates, the thread was busy or blocked and the fix is upstream of render.`);
  }
  process.exit(0);
});

for (;;) {
  const app = fg();
  if (app !== PKG) {
    line(`[${new Date().toTimeString().slice(0, 8)}] ${app} in foreground, waiting`);
    await wait(EVERY * 1000);
    continue;
  }

  for (const f of frames()) {
    const key = f[COL.IntendedVsync];
    if (seen.has(key)) continue;
    seen.add(key);
    const total = ms(f[COL.IntendedVsync], f[COL.FrameCompleted]);
    if (total < STALL) continue;
    const rec = {
      total,
      delay: ms(f[COL.IntendedVsync], f[COL.HandleInputStart]),
      layout: ms(f[COL.PerformTraversalsStart], f[COL.DrawStart]),
      draw: ms(f[COL.DrawStart], f[COL.SyncStart]),
      issue: ms(f[COL.IssueDrawCommandsStart], f[COL.SwapBuffers]),
      swap: ms(f[COL.SwapBuffers], f[COL.FrameCompleted]),
    };
    worst.push(rec);
    line(
      `[${new Date().toTimeString().slice(0, 8)}] STALL ${Math.round(total)}ms  ` +
        `wait ${Math.round(rec.delay)} layout ${Math.round(rec.layout)} draw ${Math.round(rec.draw)} ` +
        `issue ${Math.round(rec.issue)} swap ${Math.round(rec.swap)}`,
    );
  }
  if (seen.size > 20000) seen.clear();

  const s = summary();
  if (s && last && s.total > last.total) {
    const d = (k) => s[k] - last[k];
    const nf = d("total");
    if (nf > 0) {
      const pct = (x) => ((x / nf) * 100).toFixed(0);
      line(
        `[${new Date().toTimeString().slice(0, 8)}] +${nf} frames  ` +
          `janky ${pct(d("janky"))}%  inputLat ${pct(d("inputLat"))}%  ` +
          `slowUI ${pct(d("slowUi"))}%  missedVsync ${pct(d("missedVsync"))}%  ` +
          `p95 ${s.p95}ms p99 ${s.p99}ms`,
      );
    }
  }
  if (s) last = s;
  await wait(EVERY * 1000);
}
