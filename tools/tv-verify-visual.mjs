// One command to verify everything that is currently BUILT BUT NEVER SEEN.
//
// Four fixes shipped without anyone looking at them, because the device went
// into first-run onboarding mid-session. This runs the whole check in one pass
// so it costs one command instead of twenty, and writes its findings out so they
// can be pasted into tv-bench-history.md.
//
// Usage from D:\harbor-beta, needs the app past onboarding and on home:
//   node tools/tv-verify-visual.mjs
//   node tools/tv-verify-visual.mjs --shots=C:/some/dir
//
// Needs a DEBUG build for the CDP checks. The framestats section works on
// release too and will say so if CDP is absent.

import http from "node:http";
import { execSync } from "node:child_process";
import fs from "node:fs";

const PKG = "app.harbor";
const argv = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  }),
);
const SHOTS = typeof argv.shots === "string" ? argv.shots : "./.diag/verify";
const sh = (c) => execSync(c, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(SHOTS, { recursive: true });

function shot(name) {
  const out = `${SHOTS}/${name}.png`;
  try {
    fs.writeFileSync(out, execSync(`adb exec-out screencap -p`, { maxBuffer: 64 * 1024 * 1024, encoding: "buffer" }));
    return out;
  } catch {
    return null;
  }
}

// A dark panel flatters every number on this device and reports a placeholder
// 4950ms percentile that reads like real data. js caught a whole measurement
// this way once. Refuse to run rather than produce it.
function preflight() {
  const scr = sh(`adb shell dumpsys display`);
  if (!/mScreenState=ON/.test(scr)) throw new Error("screen is OFF. Turn the television on; a dark panel fakes good numbers.");
  const fg = sh(`adb shell dumpsys activity activities`).match(/ResumedActivity.*?([\w.]+)\//);
  if ((fg ? fg[1] : "?") !== PKG) throw new Error(`${fg ? fg[1] : "?"} is foreground, not ${PKG}`);
}

const get = (p) =>
  new Promise((res, rej) =>
    http.get({ host: "127.0.0.1", port: 9333, path: p }, (s) => {
      let d = "";
      s.on("data", (c) => (d += c));
      s.on("end", () => res(d));
    }).on("error", rej),
  );

async function cdp() {
  try {
    const pg = JSON.parse(await get("/json/list")).find((t) => t.type === "page" && t.webSocketDebuggerUrl);
    if (!pg) return null;
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
    await new Promise((r, j) => {
      ws.addEventListener("open", r);
      ws.addEventListener("error", j);
    });
    const send = (m, p) =>
      new Promise((r) => {
        const i = ++id;
        pend.set(i, r);
        ws.send(JSON.stringify({ id: i, method: m, params: p || {} }));
      });
    return {
      ws,
      ev: async (e) => (await send("Runtime.evaluate", { expression: `(()=>{${e}})()`, returnByValue: true }))?.result?.value,
      key: async (k) => {
        const c = { right: 39, left: 37, down: 40, up: 38 }[k];
        const n = { right: "ArrowRight", left: "ArrowLeft", down: "ArrowDown", up: "ArrowUp" }[k];
        for (const t of ["keyDown", "keyUp"])
          await send("Input.dispatchKeyEvent", { type: t, windowsVirtualKeyCode: c, nativeVirtualKeyCode: c, key: n });
      },
    };
  } catch {
    return null;
  }
}

const results = [];
const say = (label, verdict, detail) => {
  results.push({ label, verdict, detail });
  console.log(`${verdict.padEnd(10)} ${label}${detail ? "  -- " + detail : ""}`);
};

preflight();
console.log("preflight ok: screen ON, harbor foreground\n");

const c = await cdp();
if (!c) {
  console.log("NO CDP. This is a release build. Only the framestats section will run.");
  console.log("Install a debug build to check the visual items.\n");
} else {
  // 1. Ring clip. RING_ROOM was an empty string; it should now be padding.
  const ring = await c.ev(`
    const el=document.querySelector("[data-bp-focus=true]");
    if(!el) return "no focused element";
    let a=el.parentElement, clipped=null;
    while(a&&a!==document.body){const cs=getComputedStyle(a);
      if(cs.overflowX!=="visible"){clipped=a;break;} a=a.parentElement;}
    if(!clipped) return "no clipping ancestor";
    const pad=parseFloat(getComputedStyle(clipped).paddingLeft)||0;
    const r=el.getBoundingClientRect(), cr=clipped.getBoundingClientRect();
    return JSON.stringify({padLeft:pad, gapToClip:+(r.left-cr.left).toFixed(1)});`);
  say("ring clip room", typeof ring === "string" && ring.startsWith("{") ? "READ" : "SKIP", String(ring));

  // 2. Shimmer: how many animated bands, and are they per CARD or per ROW.
  const shim = await c.ev(`
    const s=[...document.querySelectorAll("[data-bp-shimmer]")];
    if(!s.length) return "none on screen (not loading)";
    const w=s.map(x=>Math.round(x.getBoundingClientRect().width));
    return JSON.stringify({count:s.length, widths:w.slice(0,8), viewport:innerWidth});`);
  say("shimmer bands", "READ", String(shim));

  // 3. Hero logo: is the halo present, and what is the rendered box.
  const logo = await c.ev(`
    const imgs=[...document.querySelectorAll("img")];
    const l=imgs.find(el=>{const r=el.getBoundingClientRect();
      return r.width>innerWidth*0.12 && r.width<innerWidth*0.75 && r.height<innerHeight*0.3 && r.top<innerHeight*0.5;});
    if(!l) return "no hero logo found";
    const cs=getComputedStyle(l), r=l.getBoundingClientRect();
    return JSON.stringify({filter:(cs.filter||"").slice(0,90),
      wPct:+((r.width/innerWidth)*100).toFixed(1), hPct:+((r.height/innerHeight)*100).toFixed(1)});`);
  say("hero logo halo + size", "READ", String(logo));

  // 4. Top 10: ribbon vs numeral, on whatever row is focused.
  const top10 = await c.ev(`
    const row=document.activeElement&&document.activeElement.closest("[data-bp-rail-row]");
    if(!row) return "not in a row";
    const rib=row.querySelectorAll('img[src*="toptab"]').length;
    const num=row.querySelectorAll("svg text, [data-bp-rank]").length;
    return JSON.stringify({rowLabel:(row.textContent||"").trim().slice(0,24), ribbons:rib, numerals:num});`);
  say("top10 ribbon vs numeral", "READ", String(top10));

  // 5. The Left-at-row-start tab bug. Reads the row's declared tab, presses Left
  //    to the row start and again into chrome, then reads where focus landed.
  //    This is the measurement that two source-reading guesses failed to replace.
  const before = await c.ev(`
    const row=document.activeElement&&document.activeElement.closest("[data-bp-row]");
    return JSON.stringify({rowTab:row?row.getAttribute("data-bp-row-tab"):null,
      rowKey:row?row.getAttribute("data-bp-row-key"):null});`);
  for (let i = 0; i < 12; i++) await c.key("left");
  await wait(900);
  const after = await c.ev(`
    const el=document.activeElement;
    return JSON.stringify({tag:el?el.tagName.toLowerCase():null,
      tab:el?el.getAttribute("data-bp-tab"):null,
      label:(el?el.textContent:"").trim().slice(0,20)});`);
  say("left-at-row-start", "READ", `row said ${before} -> landed on ${after}`);
  shot("left-landing");

  c.ws.close();
}

// framestats works with or without CDP
console.log("");
for (let r = 0; r < 3; r++) {
  sh(`adb shell dumpsys gfxinfo ${PKG} reset`);
  for (let i = 0; i < 24; i++) sh(`adb shell input keyevent ${Math.floor(i / 6) % 2 === 0 ? 22 : 21}`);
  await wait(900);
  const o = sh(`adb shell dumpsys gfxinfo ${PKG}`);
  const n = (re) => {
    const m = o.match(re);
    return m ? m[1] : "?";
  };
  console.log(
    `  run ${r + 1}: frames=${n(/Total frames rendered: (\d+)/)} p50=${n(/50th percentile: (\d+)ms/)} ` +
      `p90=${n(/90th percentile: (\d+)ms/)} slowDraw=${n(/Number Slow issue draw commands: (\d+)/)}`,
  );
}
shot("final");
console.log(`\nscreenshots in ${SHOTS}`);
console.log("Paste the readings above into tools/tv-bench-history.md. Nothing here is a");
console.log("verdict on its own: the ring, shimmer, logo and numeral lines need a human to");
console.log("look at the screenshots and say whether they LOOK right.");
