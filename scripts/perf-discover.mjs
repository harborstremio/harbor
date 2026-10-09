#!/usr/bin/env node
// Repeatable Discover performance harness for the Tauri/WebView2 build.
// Every number carries a unit, a sample count and a run stamp. Nothing is reported
// that the preflight gate could not vouch for.
//
//   node scripts/perf-discover.mjs census            passive, safe while someone is using the app
//   node scripts/perf-discover.mjs run               full gated run, drives the app
//   node scripts/perf-discover.mjs run --repeats 5 --reload
//   node scripts/perf-discover.mjs compare <a> <b>

import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";
import { Cdp, rss } from "./harbor-diag.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, ".diag", "perf");

const args = process.argv.slice(3);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const next = args[i + 1];
  return next && !next.startsWith("--") ? next : true;
};
const REPEATS = Number(flag("repeats", 5));
const RELOAD = !!flag("reload", false);
const PROFILE = !!flag("profile", false);

// ---------------------------------------------------------------- page-side

// The only DOM entry point that is guaranteed to be the visible Discover surface.
// document.querySelector("main") returns the PARKED layer: App.tsx parkLayer() hides
// a background view with `invisible absolute inset-0 [content-visibility:hidden]`,
// which keeps its layout boxes, so it answers getClientRects() and querySelector alike.
const TARGET = `(() => {
  const active = document.querySelector(".harbor-layer-active");
  if (!active) return null;
  const main = active.querySelector("main") || active.closest("main");
  if (!main || main.closest("[inert]")) return null;
  return main;
})()`;

const CENSUS = `(() => {
  const main = ${TARGET};
  const stack = document.querySelector(".harbor-layer-active")?.parentElement;
  const decode = (el) => [...el.querySelectorAll("img")]
    .filter((i) => i.currentSrc && i.naturalWidth > 0)
    .reduce((s, i) => s + i.naturalWidth * i.naturalHeight * 4, 0) / 1048576;
  const layers = stack ? [...stack.children].map((c, i) => {
    const cs = getComputedStyle(c);
    return {
      i,
      active: c.classList.contains("harbor-layer-active"),
      parked: c.hasAttribute("inert"),
      visibility: cs.visibility,
      contentVisibility: cs.contentVisibility,
      nodes: c.querySelectorAll("*").length,
      imgs: c.querySelectorAll("img").length,
      imgsLoaded: [...c.querySelectorAll("img")].filter((x) => x.currentSrc && x.naturalWidth > 0).length,
      decodedMB: +decode(c).toFixed(1),
      hint: (c.querySelector("h1,h2,h3")?.textContent ?? "").trim().slice(0, 28),
    };
  }) : [];
  const waste = [];
  if (main) for (const img of main.querySelectorAll("img")) {
    if (!img.currentSrc || !img.naturalWidth) continue;
    const box = img.getBoundingClientRect();
    const needPx = Math.ceil(box.width * devicePixelRatio) * Math.ceil(box.height * devicePixelRatio);
    const havePx = img.naturalWidth * img.naturalHeight;
    if (!needPx) continue;
    let host = "?"; try { host = new URL(img.currentSrc).hostname; } catch {}
    waste.push({ host, wastedMB: ((havePx - needPx) * 4) / 1048576, ratio: havePx / needPx });
  }
  const byHost = {};
  for (const w of waste) {
    const b = byHost[w.host] ?? (byHost[w.host] = { imgs: 0, wastedMB: 0, worstRatio: 0 });
    b.imgs++; b.wastedMB += Math.max(0, w.wastedMB); b.worstRatio = Math.max(b.worstRatio, w.ratio);
  }
  for (const k of Object.keys(byHost)) {
    byHost[k].wastedMB = +byHost[k].wastedMB.toFixed(1);
    byHost[k].worstRatio = +byHost[k].worstRatio.toFixed(1);
  }
  const res = performance.getEntriesByType("resource");
  const lanes = { ipc: 0, img: 0, remoteFetch: 0, local: 0 };
  const ipcByCommand = {};
  for (const e of res) {
    if (e.name.startsWith("http://ipc.localhost")) {
      lanes.ipc++;
      const cmd = decodeURIComponent(e.name.slice("http://ipc.localhost/".length));
      const b = ipcByCommand[cmd] ?? (ipcByCommand[cmd] = { n: 0, ms: [] });
      b.n++; b.ms.push(e.duration);
    } else if (e.initiatorType === "img") lanes.img++;
    else if (e.name.startsWith("http://tauri.localhost")) lanes.local++;
    else if (e.initiatorType === "fetch" || e.initiatorType === "xmlhttprequest") lanes.remoteFetch++;
  }
  const ipcTop = Object.entries(ipcByCommand).map(([cmd, b]) => {
    const s = b.ms.slice().sort((x, y) => x - y);
    return { cmd, n: b.n, p50Ms: Math.round(s[Math.floor(s.length * 0.5)] ?? 0), maxMs: Math.round(s[s.length - 1] ?? 0) };
  }).sort((a, b) => b.maxMs - a.maxMs).slice(0, 10);
  let lsBytes = 0, lsKeys = 0;
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); lsKeys++; lsBytes += (k.length + (localStorage.getItem(k) ?? "").length) * 2; } } catch {}
  return {
    target: main ? { rows: main.querySelectorAll(".harbor-row-shell").length, nodes: main.querySelectorAll("*").length, imgs: main.querySelectorAll("img").length, imgsLoaded: [...main.querySelectorAll("img")].filter((x) => x.currentSrc && x.naturalWidth > 0).length, decodedMB: +decode(main).toFixed(1), scrollTop: Math.round(main.scrollTop), scrollHeight: main.scrollHeight } : null,
    layers,
    imageWasteByHost: Object.fromEntries(Object.entries(byHost).sort((a, b) => b[1].wastedMB - a[1].wastedMB).slice(0, 8)),
    fetchCounts: window.__harborFetchCounts ? JSON.parse(JSON.stringify(window.__harborFetchCounts.total)) : null,
    bridgeTop: (window.__harborBridges?.() ?? []).slice(0, 8),
    resourceLanes: lanes,
    resourceEntries: res.length,
    resourceBufferFull: res.length >= 250,
    ipcTop,
    caches: (window.__harborProfiler?.getCacheReports?.() ?? []).filter((c) => c.size > 0),
    storage: { localStorageKeys: lsKeys, localStorageMB: +(lsBytes / 1048576).toFixed(2) },
    jsHeapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
  };
})()`;

const PREFLIGHT = `(() => {
  const mains = [...document.querySelectorAll("main")];
  const target = ${TARGET};
  const nav = document.querySelector('[data-harbor-nav="discover"]');
  const r = nav?.getBoundingClientRect();
  return {
    focus: document.hasFocus(),
    visibility: document.visibilityState,
    dpr: devicePixelRatio,
    viewport: [innerWidth, innerHeight],
    mainsInDocument: mains.length,
    targetIsFirstMain: !!target && mains[0] === target,
    targetFound: !!target,
    pageAgeSec: Math.round(performance.now() / 1000),
    devServer: location.port === "1420" || !!document.querySelector('script[src*="/@vite/client"]'),
    bundle: [...document.querySelectorAll("script[src]")].map((s) => s.src.split("/").pop()).filter((n) => /^index-/.test(n))[0] ?? null,
    profilerRunning: (window.__harborProfiler?.getSamples?.().length ?? 0) > 8,
    screensaverVisible: !!document.querySelector('[class*="screensaver"],[data-screensaver],[class*="ambient-overlay"]'),
    discoverNav: r ? { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) } : null,
    discoverActive: !!nav?.hasAttribute("data-active"),
    loafSupported: PerformanceObserver.supportedEntryTypes.includes("long-animation-frame"),
  };
})()`;

// Keeps useIdleScreensaver from firing mid run. ACTIVITY in
// src/lib/screensaver/use-idle-screensaver.ts:3 listens for pointermove on window,
// so a bare synthetic event resets its clock without moving the real cursor.
const KEEPALIVE_ON = `(() => {
  if (window.__perfKeepAlive) return "already";
  window.__perfKeepAlive = setInterval(() => window.dispatchEvent(new Event("pointermove")), 30000);
  performance.setResourceTimingBufferSize(5000);
  return "armed";
})()`;
const KEEPALIVE_OFF = `(() => { clearInterval(window.__perfKeepAlive); delete window.__perfKeepAlive; return "off"; })()`;

// One page-side task arms the observers, runs the gesture and closes the window.
// Node never sleeps inside a measurement window, so the frame clock can never
// start before a sleep and bank an idle delta as frame one.
const WINDOW = (bodySrc, settleSrc) => `new Promise(async (done) => {
  const main = ${TARGET};
  if (!main) return done({ error: "no visible Discover main" });
  performance.clearResourceTimings();
  const loaf = [], shifts = [], events = [];
  const o1 = new PerformanceObserver((l) => { for (const e of l.getEntries()) loaf.push({
    durationMs: Math.round(e.duration),
    blockingMs: Math.round(e.blockingDuration ?? 0),
    styleLayoutMs: Math.round(e.styleAndLayoutDuration ?? 0),
    scripts: (e.scripts ?? []).map((s) => ({ invoker: s.invoker, source: s.sourceURL, fn: s.sourceFunctionName, charPos: s.sourceCharPosition, durationMs: Math.round(s.duration), forcedStyleLayoutMs: Math.round(s.forcedStyleAndLayoutDuration ?? 0) })),
  }); });
  const o2 = new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) shifts.push(e.value); });
  const o3 = new PerformanceObserver((l) => { for (const e of l.getEntries()) events.push({ name: e.name, delayMs: Math.round(e.processingStart - e.startTime), handlerMs: Math.round(e.processingEnd - e.processingStart), toPaintMs: Math.round(e.duration) }); });
  try { o1.observe({ type: "long-animation-frame", buffered: false }); } catch {}
  try { o2.observe({ type: "layout-shift", buffered: false }); } catch {}
  try { o3.observe({ type: "event", durationThreshold: 16 }); } catch {}

  const stamps = [];
  let running = true;
  const tick = (t) => { stamps.push(t); if (running) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);

  const body = ${bodySrc};
  const settle = ${settleSrc};
  const t0 = performance.now();
  const detail = await body(main);
  const settledMs = await settle(main, t0);
  running = false;

  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  o1.disconnect(); o2.disconnect(); o3.disconnect();

  // Drop the arming frames: the first deltas straddle the moment the loop was
  // installed and describe the scheduler, not the gesture.
  const d = [];
  for (let i = 4; i < stamps.length; i++) d.push(stamps[i] - stamps[i - 1]);
  const sorted = d.slice().sort((a, b) => a - b);
  const q = (f) => sorted.length ? +sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * f))].toFixed(2) : null;
  let worstRun = 0, cur = 0;
  const budget = sorted.length ? sorted[Math.floor(sorted.length * 0.5)] : 16.7;
  for (const x of d) { if (x > budget * 2) { cur++; worstRun = Math.max(worstRun, cur); } else cur = 0; }
  const res = performance.getEntriesByType("resource");
  const lanes = { ipc: 0, img: 0, remoteFetch: 0, local: 0 };
  for (const e of res) {
    if (e.name.startsWith("http://ipc.localhost")) lanes.ipc++;
    else if (e.initiatorType === "img") lanes.img++;
    else if (e.name.startsWith("http://tauri.localhost")) lanes.local++;
    else if (e.initiatorType === "fetch" || e.initiatorType === "xmlhttprequest") lanes.remoteFetch++;
  }
  done({
    detail, settledMs,
    frames: { n: d.length, p50Ms: q(0.5), p95Ms: q(0.95), p99Ms: q(0.99), maxMs: sorted.length ? +sorted[sorted.length - 1].toFixed(2) : null,
      overBudgetx2: d.filter((x) => x > budget * 2).length, over24ms: d.filter((x) => x > 24).length, worstConsecutiveBad: worstRun },
    loaf: { n: loaf.length, totalBlockingMs: loaf.reduce((s, e) => s + e.blockingMs, 0), worstMs: loaf.reduce((s, e) => Math.max(s, e.durationMs), 0), top: loaf.slice().sort((a, b) => b.durationMs - a.durationMs).slice(0, 4) },
    quality: { layoutShifts: shifts.length, cls: +shifts.reduce((a, b) => a + b, 0).toFixed(4) },
    input: { n: events.length, worstDelayMs: events.reduce((s, e) => Math.max(s, e.delayMs), 0), worstToPaintMs: events.reduce((s, e) => Math.max(s, e.toPaintMs), 0) },
    requestsDuringPhase: lanes,
    screensaverFired: !!document.querySelector('[class*="screensaver"],[class*="ambient-overlay"]'),
  });
})`;

const SETTLE_ROWS = `(async (main, t0) => {
  const read = () => ({ rows: main.querySelectorAll(".harbor-row-shell").length, imgs: [...main.querySelectorAll("img")].filter((i) => i.currentSrc && i.naturalWidth > 0).length });
  let last = read(), stable = 0;
  for (let i = 0; i < 80; i++) {
    await new Promise((r) => setTimeout(r, 250));
    const now = read();
    stable = now.rows === last.rows && now.imgs === last.imgs ? stable + 1 : 0;
    last = now;
    if (stable >= 3) break;
  }
  return Math.round(performance.now() - t0);
})`;
const SETTLE_NONE = `(async (_m, t0) => { await new Promise((r) => requestAnimationFrame(r)); return Math.round(performance.now() - t0); })`;

// Every repeat must traverse the SAME pixel range, or run 1 measures cold rows and
// runs 2..n measure warm ones and the spread is mistaken for noise. The sweep seeks
// to a fixed origin, waits for the seek to settle OUTSIDE the measured window, then
// advances a fixed number of frames by a fixed number of pixels.
const sweepBody = (pxPerFrame, frames, fromPx) => `(async (main) => {
  main.scrollTop = ${fromPx};
  await new Promise((r) => setTimeout(r, 350));
  const start = main.scrollTop;
  const reach = start + ${pxPerFrame} * ${frames};
  if (reach + main.clientHeight > main.scrollHeight) return { error: "range exceeds scrollHeight", need: reach + main.clientHeight, have: main.scrollHeight };
  let n = 0;
  await new Promise((done) => {
    const step = () => { main.scrollTop += ${pxPerFrame}; if (++n >= ${frames}) return done(); requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
  return { pxPerFrame: ${pxPerFrame}, fromPx: ${fromPx}, framesRun: n, pxTravelled: Math.round(main.scrollTop - start) };
})`;
const idleBody = (ms) => `(async () => { await new Promise((r) => setTimeout(r, ${ms})); return { idleMs: ${ms} }; })`;


// ---------------------------------------------------------------- node side

async function evalOn(cdp, expr) {
  const r = await cdp.send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "eval failed");
  return r.result.value;
}

function metricsMap(res) {
  return Object.fromEntries(res.metrics.map((m) => [m.name, m.value]));
}

function metricsDelta(a, b) {
  const keep = ["LayoutCount", "RecalcStyleCount", "LayoutDuration", "RecalcStyleDuration", "ScriptDuration", "TaskDuration", "ThreadTime", "Nodes", "LayoutObjects", "JSEventListeners", "Resources", "DetachedScriptStates"];
  const out = {};
  for (const k of keep) if (typeof b[k] === "number") out[k] = +(b[k] - (a[k] ?? 0)).toFixed(3);
  for (const k of ["LayoutDuration", "RecalcStyleDuration", "ScriptDuration", "TaskDuration", "ThreadTime"]) {
    if (out[k] != null) { out[k.replace("Duration", "Ms").replace("ThreadTime", "ThreadMs")] = Math.round(out[k] * 1000); delete out[k]; }
  }
  return out;
}

function netCollector(cdp) {
  const reqs = new Map();
  const done = [];
  cdp.on("Network.requestWillBeSent", (p) => reqs.set(p.requestId, { url: p.request.url, type: p.type }));
  cdp.on("Network.loadingFinished", (p) => { const r = reqs.get(p.requestId); if (r) done.push({ ...r, bytes: p.encodedDataLength }); });
  return {
    reset: () => { done.length = 0; },
    harvest: () => {
      const lane = (u, t) => u.startsWith("http://ipc.localhost") ? "ipc" : t === "Image" ? "image" : u.startsWith("http://tauri.localhost") ? "local" : "data";
      const out = {};
      for (const d of done) {
        const k = lane(d.url, d.type);
        const b = out[k] ?? (out[k] = { requests: 0, kb: 0 });
        b.requests++; b.kb += d.bytes / 1024;
      }
      for (const k of Object.keys(out)) out[k].kb = Math.round(out[k].kb);
      const hosts = {};
      for (const d of done) { let h = "ipc"; try { h = new URL(d.url).hostname; } catch {} hosts[h] = (hosts[h] ?? 0) + d.bytes / 1024; }
      const topHosts = Object.entries(hosts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([h, kb]) => ({ host: h, kb: Math.round(kb) }));
      return { byLane: out, topHosts, totalKB: Math.round(done.reduce((s, d) => s + d.bytes, 0) / 1024) };
    },
  };
}

function boxState() {
  const ps = [
    "$b = Get-CimInstance Win32_Battery | Select-Object -First 1;",
    "$c = (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average;",
    "$noisy = @(Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -match '^(java|gradle|node|cargo|rustc|MsMpEng|vite|esbuild)$' -and $_.CPU -gt 5 } | Select-Object -ExpandProperty ProcessName -Unique);",
    "[PSCustomObject]@{ cpuLoadPct = $c; onBattery = [bool]($b -and $b.BatteryStatus -eq 1); noisy = $noisy } | ConvertTo-Json -Compress",
  ].join(" ");
  const out = spawnSync("powershell", ["-NoProfile", "-Command", ps], { encoding: "utf8" });
  try { return JSON.parse(out.stdout || "{}"); } catch { return { error: "box state unavailable" }; }
}

function gitStamp() {
  try {
    return {
      commit: execFileSync("git", ["-C", ROOT, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim(),
      dirty: execFileSync("git", ["-C", ROOT, "status", "--porcelain"], { encoding: "utf8" }).trim().length > 0,
    };
  } catch { return { commit: null, dirty: null }; }
}

const FATAL = [];
const WARN = [];

function gate(pre, box, version) {
  if (!pre.targetFound) FATAL.push("no visible Discover main: open Discover before running");
  if (!pre.focus) FATAL.push("window is not focused: WebView2 throttles rAF and swallows real input when it is not");
  if (pre.visibility !== "visible") FATAL.push(`document.visibilityState is ${pre.visibility}`);
  if (pre.screensaverVisible) FATAL.push("screensaver overlay is up: dismiss it, then rerun");
  if (!pre.loafSupported) FATAL.push("long-animation-frame unsupported in this WebView2");
  if (pre.devServer) WARN.push("DEV build: StrictMode double effects and unminified React. Numbers are not comparable to a shipped build");
  if (pre.mainsInDocument > 1 && pre.targetIsFirstMain === false) WARN.push(`${pre.mainsInDocument} <main> elements present, ${pre.mainsInDocument - 1} parked: using .harbor-layer-active main, not querySelector("main")`);
  if (pre.profilerRunning) WARN.push("memory profiler is running: it patches window.fetch and ticks every 1s (src/lib/memory-profiler.ts:247,380). Stop it for frame phases");
  if (box.onBattery) WARN.push("on battery: clock throttling will widen every distribution");
  if (typeof box.cpuLoadPct === "number" && box.cpuLoadPct > 25) WARN.push(`box is busy at ${box.cpuLoadPct}% CPU before the run`);
  if (Array.isArray(box.noisy) && box.noisy.length) WARN.push(`noisy processes: ${box.noisy.join(", ")}`);
  if (!RELOAD && pre.pageAgeSec > 1800) WARN.push(`page has been alive ${Math.round(pre.pageAgeSec / 60)} min. :has() invalidation flags are sticky for an element's lifetime, so style fixes need --reload to be visible`);
  return { fatal: FATAL, warn: WARN, version };
}

async function phase(cdp, net, name, bodySrc, settleSrc) {
  net.reset();
  const a = metricsMap(await cdp.send("Performance.getMetrics"));
  const page = await evalOn(cdp, WINDOW(bodySrc, settleSrc) + "()");
  const b = metricsMap(await cdp.send("Performance.getMetrics"));
  return { phase: name, ...page, engine: metricsDelta(a, b), bytes: net.harvest() };
}

function summarise(runs) {
  const pick = (f) => runs.map(f).filter((x) => typeof x === "number").sort((a, b) => a - b);
  const med = (xs) => xs.length ? xs[Math.floor(xs.length / 2)] : null;
  const p95 = pick((r) => r.frames?.p95Ms);
  return {
    repeats: runs.length,
    framesP50Ms: med(pick((r) => r.frames?.p50Ms)),
    framesP95Ms: med(p95),
    framesP95BandMs: p95.length > 1 ? +(p95[p95.length - 1] - p95[0]).toFixed(2) : 0,
    framesMaxMs: Math.max(...pick((r) => r.frames?.maxMs), 0),
    worstConsecutiveBad: Math.max(...pick((r) => r.frames?.worstConsecutiveBad), 0),
    loafBlockingMs: med(pick((r) => r.loaf?.totalBlockingMs)),
    clsMed: med(pick((r) => r.quality?.cls)),
    settledMsMed: med(pick((r) => r.settledMs)),
    recalcStyleCountMed: med(pick((r) => r.engine?.RecalcStyleCount)),
    recalcStyleMsMed: med(pick((r) => r.engine?.RecalcStyleMs)),
    scriptMsMed: med(pick((r) => r.engine?.ScriptMs)),
    bytesKBMed: med(pick((r) => r.bytes?.totalKB)),
  };
}

async function waitReady(cdp, ms = 25000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const ok = await evalOn(cdp, `!!document.querySelector('[data-harbor-nav="discover"]')`).catch(() => false);
    if (ok) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error("app never became ready after reload");
}

async function clickDiscover(cdp, pre) {
  if (!pre.discoverNav) throw new Error("discover nav item not found");
  const { x, y } = pre.discoverNav;
  for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) {
    await cdp.send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: type === "mouseMoved" ? 0 : 1, buttons: type === "mousePressed" ? 1 : 0 });
  }
}

async function main() {
  const cmd = process.argv[2] ?? "census";
  mkdirSync(OUT, { recursive: true });
  const cdp = await Cdp.connect();
  try {
    await cdp.send("Runtime.enable");
    await cdp.send("Performance.enable");
    await cdp.send("Network.enable");
    await cdp.send("Page.enable");
    const net = netCollector(cdp);
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    const pre = await evalOn(cdp, PREFLIGHT);
    const box = boxState();
    const runId = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);

    if (cmd === "census") {
      const census = await evalOn(cdp, CENSUS);
      const a = metricsMap(await cdp.send("Performance.getMetrics"));
      net.reset();
      await new Promise((r) => setTimeout(r, 5000));
      const b = metricsMap(await cdp.send("Performance.getMetrics"));
      const out = { runId, mode: "census", stamp: { version: pkg.version, ...gitStamp(), bundle: pre.bundle, dpr: pre.dpr, viewport: pre.viewport, devServer: pre.devServer, box }, preflight: pre, census, idle5s: { engine: metricsDelta(a, b), bytes: net.harvest() }, os: rss() };
      writeFileSync(join(OUT, `${runId}-census.json`), JSON.stringify(out, null, 2));
      return console.log(JSON.stringify(out, null, 2));
    }

    if (cmd === "compare") {
      const [x, y] = process.argv.slice(3);
      const A = JSON.parse(readFileSync(join(OUT, `${x}.json`), "utf8"));
      const B = JSON.parse(readFileSync(join(OUT, `${y}.json`), "utf8"));
      const rows = [];
      for (const key of Object.keys(A.phases)) {
        const a = A.phases[key].summary, b = B.phases[key]?.summary;
        if (!b) continue;
        for (const m of ["framesP95Ms", "loafBlockingMs", "settledMsMed", "recalcStyleCountMed", "bytesKBMed", "clsMed"]) {
          const band = Math.max(a.framesP95BandMs ?? 0, b.framesP95BandMs ?? 0);
          const d = (b[m] ?? 0) - (a[m] ?? 0);
          const verdict = m === "framesP95Ms" && Math.abs(d) <= band ? "indistinguishable (inside measured noise band)" : d === 0 ? "same" : d < 0 ? "better" : "worse";
          rows.push({ phase: key, metric: m, a: a[m], b: b[m], delta: +d.toFixed(2), verdict });
        }
      }
      return console.log(JSON.stringify({ a: x, b: y, noteBandFrom: "per-phase spread of the repeats, not a guessed percentage", rows }, null, 2));
    }

    const g = gate(pre, box, pkg.version);
    if (g.fatal.length) {
      console.error(JSON.stringify({ refused: true, reason: g.fatal, warn: g.warn }, null, 2));
      process.exit(2);
    }
    await evalOn(cdp, KEEPALIVE_ON);

    const phases = {};
    const record = async (name, bodySrc, settleSrc, times = REPEATS) => {
      const runs = [];
      for (let i = 0; i < times; i++) runs.push(await phase(cdp, net, name, bodySrc, settleSrc));
      phases[name] = { runs, summary: summarise(runs) };
      const s = phases[name].summary;
      console.error(`  ${name.padEnd(14)} p50 ${s.framesP50Ms}ms  p95 ${s.framesP95Ms}ms (band ${s.framesP95BandMs})  block ${s.loafBlockingMs}ms  cls ${s.clsMed}  ${s.bytesKBMed}KB`);
    };

    console.error(`run ${runId}  harbor ${pkg.version}  ${pre.devServer ? "DEV" : "prod bundle"} ${pre.bundle ?? ""}`);
    if (g.warn.length) for (const w of g.warn) console.error(`  warn: ${w}`);

    await record("idle", idleBody(5000), SETTLE_NONE, Math.min(2, REPEATS));
    const idleP50 = phases.idle.summary.framesP50Ms;
    if (idleP50 != null && phases.idle.summary.framesP95Ms > idleP50 * 3) {
      console.error("  ABORT: idle itself is not clean. Nothing measured after this would be interpretable.");
      process.exit(3);
    }

    if (RELOAD) {
      await cdp.send("Page.reload", { ignoreCache: false });
      await waitReady(cdp);
      await evalOn(cdp, KEEPALIVE_ON);
      const pre2 = await evalOn(cdp, PREFLIGHT);
      net.reset();
      const a = metricsMap(await cdp.send("Performance.getMetrics"));
      const t0 = Date.now();
      await clickDiscover(cdp, pre2);
      const open = await evalOn(cdp, WINDOW(idleBody(50), SETTLE_ROWS) + "()");
      const b = metricsMap(await cdp.send("Performance.getMetrics"));
      phases.coldOpen = { runs: [{ ...open, wallMs: Date.now() - t0, engine: metricsDelta(a, b), bytes: net.harvest() }], summary: summarise([open]) };
      console.error(`  coldOpen       settle ${open.settledMs}ms  block ${open.loaf.totalBlockingMs}ms  worst LoAF ${open.loaf.worstMs}ms`);
    }

    // scrollCold is a single sample by construction: rows can only be cold once.
    // Repeating it would average one cold pass with n-1 warm ones and call the
    // result a p95. scrollWarm repeats over the identical range it just warmed.
    await record("scrollCold", sweepBody(8, 220, 0), SETTLE_NONE, 1);
    await record("scrollWarm", sweepBody(8, 220, 0), SETTLE_NONE);
    await record("scrollFlick", sweepBody(28, 120, 0), SETTLE_NONE);
    await record("dwell60s", idleBody(60000), SETTLE_NONE, 1);

    const census = await evalOn(cdp, CENSUS);
    await evalOn(cdp, KEEPALIVE_OFF);
    const out = { runId, mode: "run", stamp: { version: pkg.version, ...gitStamp(), bundle: pre.bundle, dpr: pre.dpr, viewport: pre.viewport, devServer: pre.devServer, frameBudgetMs: phases.idle.summary.framesP50Ms, repeats: REPEATS, reload: RELOAD, box }, gate: g, phases, censusAtEnd: census, os: rss() };
    writeFileSync(join(OUT, `${runId}.json`), JSON.stringify(out, null, 2));
    appendFileSync(join(OUT, "index.log"), `${runId} v${pkg.version} ${gitStamp().commit} scrollFlickP95=${phases.scrollFlick.summary.framesP95Ms}ms band=${phases.scrollFlick.summary.framesP95BandMs} cls=${phases.scrollFlick.summary.clsMed}\n`);
    console.error(`\nwrote ${join(OUT, `${runId}.json`)}`);
    if (PROFILE) console.error("profile flag set: rerun the worst phase alone with --profile to keep the sampled CPU profile");
  } finally {
    cdp.close();
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
