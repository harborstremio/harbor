#!/usr/bin/env node
/**
 * Harbor television benchmark.
 *
 * Drives the running Android build over the Chrome DevTools Protocol and prints
 * the numbers that decide whether Big Picture feels fast: how long a cold start
 * takes to show art, how long a D-pad press takes to move the ring, and what a
 * held direction key does to the frame budget.
 *
 * Everything here is measured inside the page. Do not time a boot with
 * screencap: a 4K screenshot takes about three seconds to come back over adb
 * and loads the device while it does, so it perturbs the thing it measures.
 *
 *   node tools/tv-bench.mjs              full suite
 *   node tools/tv-bench.mjs --quick      skip the cold start
 *   node tools/tv-bench.mjs --json       machine readable, for diffing runs
 *
 * Requires adb on PATH and a device with the debug build installed.
 */
import { execFileSync } from "node:child_process";
import http from "node:http";
import net from "node:net";
import crypto from "node:crypto";

const PKG = "app.harbor";
const ACTIVITY = `${PKG}/.MainActivity`;
const PORT = 9333;
const JSON_OUT = process.argv.includes("--json");
const QUICK = process.argv.includes("--quick");

const adb = (...args) => execFileSync("adb", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function pct(xs, p) {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]);
}

function forward() {
  const pid = adb("shell", "pidof", PKG).trim();
  if (!pid) throw new Error("Harbor is not running");
  try {
    adb("forward", "--remove-all");
  } catch {}
  adb("forward", `tcp:${PORT}`, `localabstract:webview_devtools_remote_${pid}`);
  return pid;
}

function target() {
  return new Promise((resolve, reject) => {
    http
      .get(`http://127.0.0.1:${PORT}/json`, (r) => {
        let d = "";
        r.on("data", (c) => (d += c));
        r.on("end", () => {
          try {
            const page = JSON.parse(d).find((x) => x.type === "page");
            page ? resolve(page.webSocketDebuggerUrl) : reject(new Error("no page target"));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

function open(wsUrl) {
  return new Promise((resolve, reject) => {
    const u = new URL(wsUrl);
    const key = crypto.randomBytes(16).toString("base64");
    const sock = net.connect(Number(u.port), u.hostname, () => {
      sock.write(
        `GET ${u.pathname} HTTP/1.1\r\nHost: ${u.host}\r\nUpgrade: websocket\r\n` +
          `Connection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`,
      );
    });
    let hs = false;
    let buf = Buffer.alloc(0);
    let id = 0;
    const waiting = new Map();
    const frame = (payload) => {
      const b = Buffer.from(payload);
      const mask = crypto.randomBytes(4);
      const len = b.length;
      let head;
      if (len < 126) head = Buffer.from([0x81, 0x80 | len]);
      else if (len < 65536) {
        head = Buffer.alloc(4);
        head[0] = 0x81;
        head[1] = 0xfe;
        head.writeUInt16BE(len, 2);
      } else {
        head = Buffer.alloc(10);
        head[0] = 0x81;
        head[1] = 0xff;
        head.writeBigUInt64BE(BigInt(len), 2);
      }
      const m = Buffer.alloc(len);
      for (let i = 0; i < len; i++) m[i] = b[i] ^ mask[i % 4];
      return Buffer.concat([head, mask, m]);
    };
    sock.on("data", (c) => {
      buf = Buffer.concat([buf, c]);
      if (!hs) {
        const e = buf.indexOf("\r\n\r\n");
        if (e === -1) return;
        hs = true;
        buf = buf.subarray(e + 4);
        resolve({
          send: (method, params) =>
            new Promise((res) => {
              id += 1;
              waiting.set(id, res);
              sock.write(frame(JSON.stringify({ id, method, params: params || {} })));
            }),
          close: () => sock.destroy(),
        });
        return;
      }
      while (buf.length >= 2) {
        let len = buf[1] & 0x7f;
        let off = 2;
        if (len === 126) {
          if (buf.length < 4) return;
          len = buf.readUInt16BE(2);
          off = 4;
        } else if (len === 127) {
          if (buf.length < 10) return;
          len = Number(buf.readBigUInt64BE(2));
          off = 10;
        }
        if (buf.length < off + len) return;
        const p = buf.subarray(off, off + len).toString();
        buf = buf.subarray(off + len);
        let o;
        try {
          o = JSON.parse(p);
        } catch {
          continue;
        }
        if (o.id && waiting.has(o.id)) {
          waiting.get(o.id)(o.result);
          waiting.delete(o.id);
        }
      }
    });
    sock.on("error", reject);
  });
}

async function evaluate(cdp, expression) {
  const r = await cdp.send("Runtime.evaluate", { expression, returnByValue: true });
  return r?.result?.value;
}

const BOOT = `(() => {
  const nav = performance.getEntriesByType("navigation")[0] || {};
  const paint = Object.fromEntries(performance.getEntriesByType("paint").map(p => [p.name, Math.round(p.startTime)]));
  const res = performance.getEntriesByType("resource");
  const art = res
    .filter(r => r.initiatorType === "img" && /metahub|tmdb|image/i.test(r.name))
    .map(r => r.startTime)
    .sort((a, b) => a - b);
  const js = res.filter(r => /assets\\/.*\\.js$/.test(r.name));
  return JSON.stringify({
    domContentLoaded: Math.round(nav.domContentLoadedEventEnd || 0),
    firstPaint: paint["first-paint"] ?? null,
    firstContentfulPaint: paint["first-contentful-paint"] ?? null,
    firstArt: art.length ? Math.round(art[0]) : null,
    artBy40: art.length > 39 ? Math.round(art[39]) : null,
    bootChunks: js.filter(r => r.startTime < 6000).length,
    bootChunkBytes: js.filter(r => r.startTime < 6000).reduce((a, r) => a + (r.encodedBodySize || 0), 0),
  });
})()`;

// A focus move is only this keypress's if it lands inside the window. Rows
// hydrate asynchronously and can move the ring on their own, and without the
// bound those arrivals were attributed to whatever key was pressed last: one
// run reported a p95 of 59,366ms, which is not a latency, it is the probe
// catching an unrelated focusin a minute later. Anything past the bound is
// counted as a miss and reported, never averaged in.
const LAT_WINDOW_MS = 1500;

// Per-host request census. The bench counted zero network until this existed,
// which is how "78 to 86 requests on a Discover mount" got repeated as fact
// when the traceable number was about forty. Any claim about request counts
// should quote this, not an estimate.
const CENSUS = `(() => {
  const res = performance.getEntriesByType("resource");
  const by = {};
  for (const r of res) {
    let host;
    try { host = new URL(r.name).host; } catch { host = "?"; }
    if (host === "tauri.localhost" || host === "ipc.localhost") host = "local";
    const k = host + " " + r.initiatorType;
    by[k] = by[k] || { n: 0, kb: 0, cached: 0 };
    by[k].n += 1;
    by[k].kb += (r.transferSize || 0) / 1024;
    if (r.transferSize === 0 && r.decodedBodySize > 0) by[k].cached += 1;
  }
  const rows = Object.entries(by)
    .map(([k, v]) => ({ k, n: v.n, kb: Math.round(v.kb), cached: v.cached }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 14);
  return JSON.stringify({ total: res.length, rows });
})()`;

const ARM_LATENCY = `(() => {
  window.__L = [];
  window.__LMiss = 0;
  if (!window.__latArmed) {
    addEventListener("keydown", (e) => {
      if (!/^Arrow/.test(e.key)) return;
      window.__t0 = performance.now();
      window.__from = document.activeElement;
    }, true);
    addEventListener("focusin", () => {
      if (!window.__t0) return;
      const moved = performance.now() - window.__t0;
      const start = window.__t0;
      window.__t0 = 0;
      // The ring has to have actually changed element, or this is a refocus of
      // the same node and tells us nothing about how fast a move is.
      if (document.activeElement === window.__from) return;
      if (moved > ${"$"}{LAT_WINDOW_MS}) { window.__LMiss++; return; }
      requestAnimationFrame(() => requestAnimationFrame(() => {
        window.__L.push([Math.round(moved), Math.round(performance.now() - start)]);
      }));
    }, true);
    window.__latArmed = 1;
  }
  return 1;
})()`;

const ARM_FRAMES = `(() => {
  window.__F = { frames: 0, blocked: 0, worst: 0, t0: performance.now() };
  window.__LT = [];
  let last = performance.now();
  const tick = () => {
    const now = performance.now();
    const gap = now - last;
    last = now;
    window.__F.frames++;
    if (gap > 20) { window.__F.blocked += gap - 16; if (gap > window.__F.worst) window.__F.worst = gap; }
    if (window.__F.running !== false) requestAnimationFrame(tick);
  };
  window.__F.running = true;
  requestAnimationFrame(tick);
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__LT.push(Math.round(e.duration)); })
      .observe({ entryTypes: ["longtask"] });
  } catch {}
  return 1;
})()`;

const READ_FRAMES = `(() => {
  window.__F.running = false;
  const el = performance.now() - window.__F.t0;
  return JSON.stringify({
    windowMs: Math.round(el),
    fps: Math.round((window.__F.frames / el) * 1000 * 10) / 10,
    blockedPct: Math.round((window.__F.blocked / el) * 100),
    worstFrame: Math.round(window.__F.worst),
    longTasks: window.__LT.length,
    longTaskMs: window.__LT.reduce((a, b) => a + b, 0),
  });
})()`;

async function coldStart() {
  adb("shell", "am", "force-stop", PKG);
  await sleep(2500);
  const out = adb("shell", "am", "start", "-W", "-n", ACTIVITY);
  const native = Number(/TotalTime:\s*(\d+)/.exec(out)?.[1] ?? 0);
  await sleep(30000);
  forward();
  const cdp = await open(await target());
  const boot = JSON.parse(await evaluate(cdp, BOOT));
  cdp.close();
  return { nativeFirstFrameMs: native, ...boot };
}

// Keys go over the protocol, never through `adb shell input`. That command
// starts a JVM on the device for every press: measured against CDP dispatch on
// the same build it added about 2.8s to a press that really took 0.9s, so every
// latency number taken with it was the benchmark measuring itself.
const VK = { ArrowRight: 39, ArrowLeft: 37, ArrowDown: 40, ArrowUp: 38 };

async function tap(cdp, key) {
  const base = {
    windowsVirtualKeyCode: VK[key],
    nativeVirtualKeyCode: VK[key],
    key,
    code: key,
  };
  await cdp.send("Input.dispatchKeyEvent", { ...base, type: "rawKeyDown" });
  await cdp.send("Input.dispatchKeyEvent", { ...base, type: "keyUp" });
}

const OPPOSITE = {
  ArrowRight: "ArrowLeft",
  ArrowLeft: "ArrowRight",
  ArrowDown: "ArrowUp",
  ArrowUp: "ArrowDown",
};

async function latency(cdp, key, presses, gapMs) {
  // Walk the ring back the other way first, so the presses being timed always
  // have somewhere to go. Without this the run reports 0 of 13 samples whenever
  // focus happens to be sitting at the end of a row, which looks like a stall
  // and is really the bench measuring nothing. Done before arming so the
  // seek presses are not timed.
  for (let i = 0; i < presses + 2; i++) {
    await tap(cdp, OPPOSITE[key]);
    await sleep(70);
  }
  await sleep(500);
  await evaluate(cdp, ARM_LATENCY);
  await sleep(600);
  for (let i = 0; i < presses; i++) {
    await tap(cdp, key);
    await sleep(gapMs);
  }
  await sleep(700);
  const rows = (await evaluate(cdp, "JSON.stringify(window.__L)")) || "[]";
  const missed = (await evaluate(cdp, "window.__LMiss|0")) || 0;
  const parsed = JSON.parse(rows);
  const move = parsed.map((r) => r[0]);
  const paint = parsed.map((r) => r[1]);
  return {
    presses,
    missed,
    samples: move.length,
    moveP50: pct(move, 50),
    moveP95: pct(move, 95),
    paintP50: pct(paint, 50),
    paintP95: pct(paint, 95),
  };
}

// A real hold is autorepeat, so autoRepeat is set and the presses come at the
// rate Android delivers them rather than at the rate a shell can spawn.
async function held(cdp, key, count, gapMs) {
  await evaluate(cdp, ARM_FRAMES);
  const base = {
    windowsVirtualKeyCode: VK[key],
    nativeVirtualKeyCode: VK[key],
    key,
    code: key,
    autoRepeat: true,
  };
  for (let i = 0; i < count; i++) {
    await cdp.send("Input.dispatchKeyEvent", { ...base, type: "rawKeyDown" });
    await sleep(gapMs);
  }
  await cdp.send("Input.dispatchKeyEvent", { ...base, type: "keyUp", autoRepeat: false });
  await sleep(1500);
  return JSON.parse(await evaluate(cdp, READ_FRAMES));
}

async function idle(cdp, ms) {
  await evaluate(cdp, ARM_FRAMES);
  await sleep(ms);
  return JSON.parse(await evaluate(cdp, READ_FRAMES));
}

function table(title, rows) {
  const w = Math.max(...rows.map(([k]) => k.length));
  console.log(`\n${title}`);
  for (const [k, v, note] of rows) {
    console.log(`  ${k.padEnd(w)}  ${String(v ?? "-").padStart(8)}${note ? "  " + note : ""}`);
  }
}

const RIGHT = "ArrowRight";
const DOWN = "ArrowDown";

/**
 * Live feed. One line per window, forever, so it can be piped into anything
 * that treats a line as an event.
 *
 * This is the mode to leave running while somebody actually uses the remote:
 * the sampled suite below tells you what a synthetic press costs, this tells
 * you what the session is really doing. It reports frames and long tasks only,
 * because anything that dispatches input would stop being an observer.
 */
async function watch(everyMs) {
  forward();
  let cdp = await open(await target());
  console.log(`watching, one line per ${Math.round(everyMs / 1000)}s`);
  for (;;) {
    try {
      await evaluate(cdp, ARM_FRAMES);
      await sleep(everyMs);
      const raw = await evaluate(cdp, READ_FRAMES);
      const f = JSON.parse(raw);
      const bad = f.fps < 50 || f.blockedPct > 15 || f.longTasks > 0;
      console.log(
        `${bad ? "SLOW" : "ok  "} fps=${String(f.fps).padStart(5)} blocked=${String(f.blockedPct).padStart(3)}% ` +
          `longTasks=${String(f.longTasks).padStart(3)} longMs=${String(f.longTaskMs).padStart(6)} worst=${f.worstFrame}ms`,
      );
    } catch {
      // The webview goes away on a relaunch. Reattach rather than exit, so the
      // feed survives an install and keeps reporting across builds.
      console.log("reattaching");
      await sleep(3000);
      try {
        forward();
        cdp = await open(await target());
      } catch {
        /* device not ready yet, try again next window */
      }
    }
  }
}

async function main() {
  const watchArg = process.argv.find((a) => a.startsWith("--watch"));
  if (watchArg) {
    const secs = Number(watchArg.split("=")[1] || 10);
    await watch(Math.max(3, secs) * 1000);
    return;
  }
  const out = {};

  if (!QUICK) {
    if (!JSON_OUT) console.log("cold start, about 35s...");
    out.coldStart = await coldStart();
  } else {
    forward();
  }

  const cdp = await open(await target());
  if (!JSON_OUT) console.log("idle...");
  out.idle = await idle(cdp, 6000);
  if (!JSON_OUT) console.log("right presses...");
  out.pressRight = await latency(cdp, RIGHT, 8, 1100);
  if (!JSON_OUT) console.log("down presses...");
  out.pressDown = await latency(cdp, DOWN, 5, 1400);
  if (!JSON_OUT) console.log("held right...");
  // 90ms, matching what Android autorepeat actually delivers and what
  // REPEAT_MIN_MS in use-bp-focus.ts lets through. At the old 55ms roughly half
  // the dispatched presses were dropped by our own gate, so the held test was
  // measuring the throttle as much as the app.
  out.heldRight = await held(cdp, RIGHT, 22, 90);
  try {
    out.census = JSON.parse(await evaluate(cdp, CENSUS));
  } catch {
    out.census = null;
  }
  cdp.close();

  if (JSON_OUT) {
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  if (out.coldStart) {
    const c = out.coldStart;
    table("COLD START (ms from navigation, native from am start -W)", [
      ["android first frame", c.nativeFirstFrameMs],
      ["domContentLoaded", c.domContentLoaded],
      ["first paint", c.firstPaint, "branded splash"],
      ["first contentful paint", c.firstContentfulPaint],
      ["first poster requested", c.firstArt, "home is up"],
      ["40 posters requested", c.artBy40],
      ["chunks before 6s", c.bootChunks],
      ["bytes before 6s", `${Math.round(c.bootChunkBytes / 1024)}KB`],
    ]);
  }
  table("D-PAD LATENCY (ms, keydown to ring moved / to painted)", [
    ["right, move p50", out.pressRight.moveP50],
    ["right, move p95", out.pressRight.moveP95],
    ["right, painted p50", out.pressRight.paintP50],
    ["down, move p50", out.pressDown.moveP50],
    ["down, move p95", out.pressDown.moveP95],
    ["down, painted p50", out.pressDown.paintP50],
    ["samples / pressed", `${out.pressRight.samples + out.pressDown.samples}/${out.pressRight.presses + out.pressDown.presses}`],
    ["over 1.5s, dropped", out.pressRight.missed + out.pressDown.missed],
  ]);
  table("HELD DIRECTION KEY (the freeze test)", [
    ["fps", out.heldRight.fps],
    ["main thread blocked", `${out.heldRight.blockedPct}%`],
    ["worst frame", `${out.heldRight.worstFrame}ms`],
    ["long tasks", out.heldRight.longTasks],
    ["long task total", `${out.heldRight.longTaskMs}ms`],
  ]);
  if (out.census) {
    console.log("");
    console.log("NETWORK CENSUS (whole session so far, " + out.census.total + " resources)");
    console.log("  " + "host / kind".padEnd(34) + "count".padStart(6) + "KB".padStart(9) + "cached".padStart(8));
    for (const r of out.census.rows) {
      console.log("  " + r.k.slice(0, 33).padEnd(34) + String(r.n).padStart(6) + String(r.kb).padStart(9) + String(r.cached).padStart(8));
    }
  }
  table("IDLE (6s, nothing touched)", [
    ["fps", out.idle.fps],
    ["main thread blocked", `${out.idle.blockedPct}%`],
    ["long tasks", out.idle.longTasks],
  ]);
}

main().catch((e) => {
  console.error(String(e.message || e));
  process.exit(1);
});
