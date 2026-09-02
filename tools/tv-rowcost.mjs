// Frame cost on the home screen varies about 3x by which row focus is in, which
// is larger than any property-level effect measured in tv-bench-history.md.
// This surveys every rail row: park focus in it, run an identical horizontal
// press protocol, and record cost alongside what the row actually contains, so
// the expensive rows can be diffed against the cheap ones.
//
// Usage from D:\harbor-beta, needs a DEBUG build (release exposes no CDP):
//   node tools/tv-rowcost.mjs
//   node tools/tv-rowcost.mjs --presses=20 --repeats=2

import http from "node:http";
import { execSync } from "node:child_process";

const PKG = "app.harbor";
const argv = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  }),
);
const PRESSES = Number(argv.presses || 20);
const REPEATS = Number(argv.repeats || 2);

const sh = (c) => execSync(c, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const get = (p) =>
  new Promise((res, rej) =>
    http.get({ host: "127.0.0.1", port: 9333, path: p }, (s) => {
      let d = "";
      s.on("data", (c) => (d += c));
      s.on("end", () => res(d));
    }).on("error", rej),
  );

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
  if (rows.length < 30) return null;
  const ms = (a, b) => (b - a) / 1e6;
  const tot = rows.map((r) => ms(r[COL.IntendedVsync], r[COL.FrameCompleted])).sort((a, b) => a - b);
  const iss = rows.map((r) => ms(r[COL.IssueDrawCommandsStart], r[COL.SwapBuffers])).sort((a, b) => a - b);
  const del = rows.map((r) => ms(r[COL.IntendedVsync], r[COL.HandleInputStart])).sort((a, b) => a - b);
  const q = (a, f) => a[Math.min(a.length - 1, Math.floor(a.length * f))];
  return { p50: q(tot, 0.5), p90: q(tot, 0.9), issue50: q(iss, 0.5), delay50: q(del, 0.5) };
}

const main = async () => {
  const fgm = sh(`adb shell dumpsys activity activities`).match(/ResumedActivity.*?([\w.]+)\//);
  if ((fgm ? fgm[1] : "?") !== PKG) throw new Error("app is not foreground");

  const pg = JSON.parse(await get("/json/list")).find((t) => t.type === "page" && t.webSocketDebuggerUrl);
  if (!pg) throw new Error("no CDP page; release builds expose no socket");
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
  const press = async (k) => {
    const c = { right: 39, left: 37, down: 40, up: 38 }[k];
    const n = { right: "ArrowRight", left: "ArrowLeft", down: "ArrowDown", up: "ArrowUp" }[k];
    for (const t of ["keyDown", "keyUp"])
      await send("Input.dispatchKeyEvent", { type: t, windowsVirtualKeyCode: c, nativeVirtualKeyCode: c, key: n });
  };

  // Describe the row focus is currently in: what it holds, not just its name.
  const DESCRIBE = `
    const el=document.activeElement, row=el&&el.closest("[data-bp-rail-row]");
    if(!row) return null;
    const cells=[...row.querySelectorAll("[data-bp-focusable]")];
    const vh=innerHeight,vw=innerWidth;
    const onScreen=(e)=>{const r=e.getBoundingClientRect();return r.bottom>0&&r.top<vh&&r.right>0&&r.left<vw;};
    const vis=cells.filter(onScreen);
    const imgs=[...row.querySelectorAll("img")];
    const visImgs=imgs.filter(onScreen);
    const c0=vis[0]||cells[0];
    const r0=c0?c0.getBoundingClientRect():{width:0,height:0};
    const area=vis.reduce((s,c)=>{const r=c.getBoundingClientRect();return s+r.width*r.height;},0);
    let blurred=0, shadowed=0;
    for(const c of vis){const cs=getComputedStyle(c);
      const bf=cs.backdropFilter||cs.webkitBackdropFilter;
      if(bf&&bf!=="none")blurred++;
      if(cs.boxShadow&&cs.boxShadow!=="none")shadowed++;}
    return JSON.stringify({
      idx:row.getAttribute("data-bp-rail-row"),
      label:(row.textContent||"").trim().slice(0,26),
      cells:cells.length, visible:vis.length,
      imgs:imgs.length, visImgs:visImgs.length,
      cellW:Math.round(r0.width), cellH:Math.round(r0.height),
      visAreaMpx:+((area)/1e6).toFixed(3),
      nodes:row.querySelectorAll("*").length,
      blurred, shadowed
    });`;

  async function runOnce() {
    sh(`adb shell dumpsys gfxinfo ${PKG} reset`);
    for (let i = 0; i < PRESSES; i++) {
      await press(i % 10 < 5 ? "right" : "left");
      await wait(200);
    }
    await wait(300);
    return readFrames();
  }

  // Climb to the top so the survey starts from a known place.
  for (let i = 0; i < 16; i++) {
    await press("up");
    await wait(180);
  }
  await wait(900);

  console.log(`per-row cost survey: ${PRESSES} presses x ${REPEATS} repeats each\n`);
  console.log(
    "idx".padEnd(4) + "p50".padStart(7) + "p90".padStart(8) + "iss50".padStart(7) + "dly".padStart(6) +
    "cells".padStart(7) + "vis".padStart(5) + "imgs".padStart(6) + "nodes".padStart(7) + "cell".padStart(10) + "  label",
  );
  console.log("-".repeat(96));

  const seen = new Set();
  const out = [];
  for (let step = 0; step < 12; step++) {
    const dRaw = await ev(DESCRIBE);
    if (dRaw) {
      const d = JSON.parse(dRaw);
      if (!seen.has(d.idx)) {
        seen.add(d.idx);
        const runs = [];
        for (let r = 0; r < REPEATS; r++) {
          const m = await runOnce();
          if (m) runs.push(m);
        }
        if (runs.length) {
          const med = (k) => runs.map((r) => r[k]).sort((a, b) => a - b)[Math.floor(runs.length / 2)];
          const rec = { ...d, p50: med("p50"), p90: med("p90"), issue50: med("issue50"), delay50: med("delay50") };
          out.push(rec);
          console.log(
            String(d.idx).padEnd(4) +
              rec.p50.toFixed(1).padStart(7) + rec.p90.toFixed(1).padStart(8) +
              rec.issue50.toFixed(1).padStart(7) + rec.delay50.toFixed(1).padStart(6) +
              String(d.cells).padStart(7) + String(d.visible).padStart(5) +
              String(d.visImgs).padStart(6) + String(d.nodes).padStart(7) +
              `${d.cellW}x${d.cellH}`.padStart(10) + "  " + d.label,
          );
        }
      }
    }
    await press("down");
    await wait(600);
  }

  if (out.length >= 4) {
    const sorted = [...out].sort((a, b) => a.p50 - b.p50);
    const cheap = sorted[0], dear = sorted[sorted.length - 1];
    console.log(`\ncheapest row ${cheap.idx} at p50 ${cheap.p50.toFixed(1)}ms  "${cheap.label}"`);
    console.log(`dearest  row ${dear.idx} at p50 ${dear.p50.toFixed(1)}ms  "${dear.label}"`);
    console.log(`spread ${(dear.p50 / cheap.p50).toFixed(1)}x\n`);
    console.log("what differs between them:");
    for (const k of ["cells", "visible", "visImgs", "nodes", "cellW", "cellH", "visAreaMpx", "blurred", "shadowed"])
      console.log(`  ${k.padEnd(11)} cheap=${String(cheap[k]).padStart(8)}   dear=${String(dear[k]).padStart(8)}`);

    // Correlate each structural property against p50 across all rows, so the
    // answer is not just a two-row anecdote.
    const pear = (xs, ys) => {
      const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
      let num = 0, dx = 0, dy = 0;
      for (let i = 0; i < n; i++) { const a = xs[i] - mx, b = ys[i] - my; num += a * b; dx += a * a; dy += b * b; }
      return dx && dy ? num / Math.sqrt(dx * dy) : NaN;
    };
    const p50s = out.map((r) => r.p50);
    console.log(`\ncorrelation with p50 across ${out.length} rows:`);
    for (const k of ["cells", "visible", "visImgs", "nodes", "cellW", "visAreaMpx"])
      console.log(`  ${k.padEnd(11)} r=${pear(out.map((r) => Number(r[k]) || 0), p50s).toFixed(3)}`);
  }
  ws.close();
};

main().catch((e) => {
  console.log("ERR", e.message);
  process.exit(1);
});
