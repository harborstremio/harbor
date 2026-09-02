// Drift-controlled ablation harness for Big Picture on Android TV.
//
// Why this exists. Every sequential ablation in tv-bench-history.md measured a
// baseline once at the start of a run and compared each arm against it. That is
// only valid if the baseline holds still and it does not: it moved 39.2/82.8 to
// 28.1/53.5 over one session with no code change, which is the same size as the
// effects being chased. A "-60% p90" finding was produced that way and was pure
// drift; the interleaved retest came back 19/36 pairs, a coin flip.
//
// So this harness never compares an arm to a remembered number. It interleaves
// control and arm A/B/A/B, pairs them, and rank-tests the pairs, so any drift
// that is slower than one pair cancels.
//
// Usage from D:\harbor-beta:
//   node tools/tv-ablate.mjs --list
//   node tools/tv-ablate.mjs --arm=heroImg --pairs=6
//   node tools/tv-ablate.mjs --arm=heroImg --pairs=6 --drive=vertical
//   node tools/tv-ablate.mjs --css="[data-bp-rail-row]{transition:none!important}" --pairs=5
//
// Requires a DEBUG build: release exposes no webview_devtools_remote socket.

import http from "node:http";
import { execSync } from "node:child_process";

const PKG = "app.harbor";
const PORT = 9333;

const argv = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  }),
);

const sh = (c) => execSync(c, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Named arms. Each is a pair of JS expressions: apply and undo. Undo must fully
// restore, because the control run immediately follows it.
const ARMS = {
  heroImg: {
    what: "hide the full-bleed hero backdrop image",
    setup: `window.__t=[...document.querySelectorAll("img")].find(el=>{const r=el.getBoundingClientRect();
      return r.width>=innerWidth*0.6&&r.height>=innerHeight*0.6;}); !!window.__t`,
    on: `window.__t.style.display="none"`,
    off: `window.__t.style.display=""`,
  },
  ambient: {
    what: "hide the whole ambient stack",
    setup: `window.__t=document.querySelector("[data-bp-ambient],.bp-ambient"); !!window.__t`,
    on: `window.__t.style.display="none"`,
    off: `window.__t.style.display=""`,
  },
  railFade: {
    what: "zero the rail row transition",
    setup: `true`,
    on: `(()=>{let s=document.getElementById("__ab");if(!s){s=document.createElement("style");s.id="__ab";document.head.appendChild(s);}
      s.textContent="[data-bp-rail-row]{transition-duration:0ms!important}";})()`,
    off: `(()=>{const s=document.getElementById("__ab");if(s)s.remove();})()`,
  },
  tileFades: {
    what: "zero the per-tile scrim/title/marks transitions (the reverted change)",
    setup: `true`,
    on: `(()=>{let s=document.getElementById("__ab");if(!s){s=document.createElement("style");s.id="__ab";document.head.appendChild(s);}
      s.textContent="[data-bp-root]{--bp-focus-fade:0ms!important}";})()`,
    off: `(()=>{const s=document.getElementById("__ab");if(s)s.remove();})()`,
  },
  // The row-windowing question, done properly. The first attempt at this was
  // sequential (no drift control) and drove ONLY left/right, which never
  // translates the rail, so it tested a vertical mechanism with a horizontal
  // workload and "refuted" windowing on both counts. Run it with --drive=vertical
  // as well as horizontal before concluding anything.
  rowWindow: {
    what: "display:none every rail row further than 2 from the focused one",
    setup: `window.__rw=()=>[...document.querySelectorAll("[data-bp-rail-row]")]; window.__rw().length>4`,
    on: `const rows=window.__rw();
      const cur=document.activeElement&&document.activeElement.closest("[data-bp-rail-row]");
      const at=cur?rows.indexOf(cur):0;
      rows.forEach((r,i)=>{ if(Math.abs(i-at)>2) r.style.setProperty("display","none","important"); });`,
    off: `window.__rw().forEach(r=>r.style.removeProperty("display"));`,
  },
  // Tests the same idea one level down: keep every row, drop the tiles beyond
  // the first few in each row. Separates "fewer rows" from "fewer tiles".
  tileWindow: {
    what: "display:none all but the first 6 tiles of every row",
    setup: `document.querySelectorAll("[data-bp-focusable]").length>20`,
    on: `document.querySelectorAll("[data-bp-rail-row]").forEach(row=>{
      const cells=[...row.querySelectorAll("[data-bp-focusable]")];
      cells.forEach((c,i)=>{ if(i>=6) c.style.setProperty("display","none","important"); });});`,
    off: `document.querySelectorAll("[data-bp-focusable]").forEach(c=>c.style.removeProperty("display"));`,
  },
  // After the fit fix a SECOND row became visible on home, and p90 went 34ms to
  // 53ms with slowDraw 61-75 to ~215 in the same change. The claim "that is just
  // the extra row painting" is an interpretation, not a measurement. This tests
  // it: hide every rail row except the focused one and see if the tail returns.
  secondRow: {
    what: "hide all rail rows except the focused one",
    setup: `window.__rw=()=>[...document.querySelectorAll("[data-bp-rail-row]")]; window.__rw().length>1`,
    on: `const rows=window.__rw();
      const cur=document.activeElement&&document.activeElement.closest("[data-bp-rail-row]");
      const at=cur?rows.indexOf(cur):0;
      rows.forEach((r,i)=>{ if(i!==at) r.style.setProperty("visibility","hidden","important"); });`,
    off: `window.__rw().forEach(r=>r.style.removeProperty("visibility"));`,
  },
  shimmer: {
    what: "disable the restored skeleton shimmer animation",
    setup: `true`,
    on: `let s=document.getElementById("__ab");if(!s){s=document.createElement("style");s.id="__ab";document.head.appendChild(s);}
      s.textContent="[class*=shimmer],[data-bp-shimmer],[data-bp-shimmer] *{animation:none!important}";`,
    off: `const s=document.getElementById("__ab");if(s)s.remove();`,
  },
  scrims: {
    what: "remove the ambient gradient scrims",
    setup: `window.__t=document.querySelector("[data-bp-ambient],.bp-ambient"); !!window.__t`,
    on: `(()=>{let s=document.getElementById("__ab");if(!s){s=document.createElement("style");s.id="__ab";document.head.appendChild(s);}
      s.textContent="[data-bp-ambient] div,.bp-ambient div{background-image:none!important}";})()`,
    off: `(()=>{const s=document.getElementById("__ab");if(s)s.remove();})()`,
  },
};

if (argv.list) {
  console.log("arms:");
  for (const [k, v] of Object.entries(ARMS)) console.log(`  ${k.padEnd(12)} ${v.what}`);
  process.exit(0);
}

const get = (p) =>
  new Promise((res, rej) =>
    http.get({ host: "127.0.0.1", port: PORT, path: p }, (s) => {
      let d = "";
      s.on("data", (c) => (d += c));
      s.on("end", () => res(d));
    }).on("error", rej),
  );

// The Fire TV ambient screensaver steals the foreground; after that gfxinfo
// reports 0 frames and a placeholder 4950ms percentile that reads like data.
function assertForeground() {
  const m = sh(`adb shell dumpsys activity activities`).match(/ResumedActivity.*?([\w.]+)\//);
  const fg = m ? m[1] : "?";
  if (fg !== PKG) throw new Error(`${fg} is foreground, not ${PKG}. Screensaver? try: adb shell settings put secure screensaver_enabled 0`);
}

const COL = { Flags: 0, IntendedVsync: 1, HandleInputStart: 5, IssueDrawCommandsStart: 11, SwapBuffers: 12, FrameCompleted: 13 };

function readFrames() {
  const out = sh(`adb shell dumpsys gfxinfo ${PKG} framestats`);
  const rows = [];
  for (const l of out.split(/\r?\n/)) {
    if (!/^\d/.test(l)) continue;
    const p = l.trim().split(",").map(Number);
    if (p.length < 14 || p[COL.Flags] !== 0 || p[COL.FrameCompleted] <= 0) continue;
    rows.push(p);
  }
  // framestats is a 120-frame RING BUFFER, not a time window. Too few rows means
  // the window did not fill with comparable frames, which is an absent
  // measurement rather than a fast one.
  if (rows.length < 30) return null;
  const ms = (a, b) => (b - a) / 1e6;
  const tot = rows.map((r) => ms(r[COL.IntendedVsync], r[COL.FrameCompleted])).sort((a, b) => a - b);
  const iss = rows.map((r) => ms(r[COL.IssueDrawCommandsStart], r[COL.SwapBuffers])).sort((a, b) => a - b);
  const del = rows.map((r) => ms(r[COL.IntendedVsync], r[COL.HandleInputStart])).sort((a, b) => a - b);
  const q = (a, f) => a[Math.min(a.length - 1, Math.floor(a.length * f))];
  return { n: rows.length, p50: q(tot, 0.5), p90: q(tot, 0.9), issue50: q(iss, 0.5), delay50: q(del, 0.5) };
}

// Exact two-sided Mann-Whitney by enumeration for small n, normal approximation
// above n=8 per group where enumeration gets expensive.
function mannWhitney(a, b) {
  let U = 0;
  for (const x of a) for (const y of b) U += x > y ? 1 : x === y ? 0.5 : 0;
  const n1 = a.length,
    n2 = b.length,
    N = n1 * n2;
  if (n1 <= 8 && n2 <= 8) {
    const all = [...a.map((v) => [v, 0]), ...b.map((v) => [v, 1])];
    const idx = [...all.keys()];
    let count = 0,
      total = 0;
    const rec = (start, cur) => {
      if (cur.length === n1) {
        const g1 = idx.filter((i) => !cur.includes(i));
        let u = 0;
        for (const i of cur) for (const j of g1) u += all[i][0] > all[j][0] ? 1 : all[i][0] === all[j][0] ? 0.5 : 0;
        total++;
        if (u >= U || u <= N - U) count++;
        return;
      }
      for (let i = start; i < idx.length; i++) rec(i + 1, [...cur, idx[i]]);
    };
    rec(0, []);
    return { U, N, p: count / total };
  }
  const mu = N / 2,
    sd = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12);
  const z = (Math.abs(U - mu) - 0.5) / sd;
  return { U, N, p: 2 * (1 - 0.5 * (1 + erf(z / Math.SQRT2))) };
}
function erf(x) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}

const main = async () => {
  assertForeground();
  const listing = JSON.parse(await get("/json/list"));
  const pg = listing.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
  if (!pg) throw new Error("no CDP page. release builds expose no socket, use a debug build");
  const ws = new WebSocket(pg.webSocketDebuggerUrl);
  let id = 0;
  const pend = new Map();
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) {
      pend.get(m.id)(m.result);
      pend.delete(m.id);
    }
  });
  await new Promise((r) => ws.addEventListener("open", r));
  const send = (m, p) =>
    new Promise((r) => {
      const i = ++id;
      pend.set(i, r);
      ws.send(JSON.stringify({ id: i, method: m, params: p || {} }));
    });
  const ev = async (e) => (await send("Runtime.evaluate", { expression: `(()=>{${e}})()`, returnByValue: true }))?.result?.value;
  // Input over CDP, not adb: adb input was measured at +2.8s per press and would
  // dominate the sampled window.
  const press = async (k) => {
    const c = { right: 39, left: 37, down: 40, up: 38 }[k];
    const n = { right: "ArrowRight", left: "ArrowLeft", down: "ArrowDown", up: "ArrowUp" }[k];
    for (const t of ["keyDown", "keyUp"])
      await send("Input.dispatchKeyEvent", { type: t, windowsVirtualKeyCode: c, nativeVirtualKeyCode: c, key: n });
  };

  const vertical = argv.drive === "vertical";
  const presses = Number(argv.presses || 24);
  const pairs = Number(argv.pairs || 5);

  async function oneRun() {
    sh(`adb shell dumpsys gfxinfo ${PKG} reset`);
    for (let i = 0; i < presses; i++) {
      await press(vertical ? (i % 8 < 4 ? "down" : "up") : i % 12 < 6 ? "right" : "left");
      await wait(vertical ? 230 : 200);
    }
    await wait(300);
    return readFrames();
  }

  let arm;
  if (argv.css) {
    arm = {
      what: `custom css: ${String(argv.css).slice(0, 60)}`,
      setup: `return true`,
      on: `let s=document.getElementById("__ab");if(!s){s=document.createElement("style");s.id="__ab";document.head.appendChild(s);}
        s.textContent=${JSON.stringify(String(argv.css))};`,
      off: `const s=document.getElementById("__ab");if(s)s.remove();`,
    };
  } else {
    arm = ARMS[argv.arm];
    if (!arm) throw new Error(`unknown arm ${argv.arm}. try --list`);
  }

  const ok = await ev(`return (${arm.setup})`);
  if (ok === false) throw new Error("arm setup failed: target element not found on this screen");

  console.log(`arm: ${arm.what}`);
  console.log(`drive: ${vertical ? "vertical" : "horizontal"}, ${presses} presses, ${pairs} interleaved pairs\n`);
  console.log("pair    control p50   arm p50    control p90   arm p90");

  const A = [], B = [];
  for (let i = 0; i < pairs; i++) {
    await ev(arm.off);
    await wait(700);
    const a = await oneRun();
    await ev(arm.on);
    await wait(700);
    const b = await oneRun();
    if (!a || !b) {
      console.log(`  ${i + 1}     (skipped, too few frames)`);
      continue;
    }
    A.push(a);
    B.push(b);
    console.log(
      `  ${String(i + 1).padEnd(6)}${a.p50.toFixed(1).padStart(9)}${b.p50.toFixed(1).padStart(11)}${a.p90.toFixed(1).padStart(15)}${b.p90.toFixed(1).padStart(10)}`,
    );
  }
  await ev(arm.off);

  if (A.length < 3) {
    console.log("\nnot enough pairs to conclude");
    ws.close();
    return;
  }
  const med = (rs, k) => rs.map((r) => r[k]).sort((x, y) => x - y)[Math.floor(rs.length / 2)];
  console.log(`\n            p50      p90    issue50   delay50`);
  console.log(`control  ${med(A, "p50").toFixed(1).padStart(6)}  ${med(A, "p90").toFixed(1).padStart(7)}  ${med(A, "issue50").toFixed(1).padStart(7)}  ${med(A, "delay50").toFixed(1).padStart(7)}`);
  console.log(`arm      ${med(B, "p50").toFixed(1).padStart(6)}  ${med(B, "p90").toFixed(1).padStart(7)}  ${med(B, "issue50").toFixed(1).padStart(7)}  ${med(B, "delay50").toFixed(1).padStart(7)}`);

  for (const metric of ["p50", "p90"]) {
    const { U, N, p } = mannWhitney(A.map((r) => r[metric]), B.map((r) => r[metric]));
    const better = U / N;
    const verdict = p < 0.05 ? (better > 0.5 ? "ARM IS FASTER" : "ARM IS SLOWER") : "no effect";
    console.log(
      `\n${metric}: control > arm in ${U}/${N} pairs (${(better * 100).toFixed(0)}%), two-sided p=${p.toFixed(4)}  -> ${verdict}`,
    );
  }
  console.log(`\nremember: drift is controlled by interleaving, but a null here is still only`);
  console.log(`a null for THIS workload. Record it in tools/tv-bench-history.md either way.`);
  ws.close();
};

main().catch((e) => {
  console.log("ERR", e.message);
  process.exit(1);
});
