#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.HARBOR_CDP_PORT || 9333);
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export async function listTargets() {
  const res = await fetch(`${BASE}/json/list`).catch(() => null);
  if (!res || !res.ok) throw new Error(`no CDP endpoint on :${PORT} (launch Harbor via scripts/dev-diag.ps1 or with WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=${PORT})`);
  const all = await res.json();
  return all.filter((t) => t.type === "page" && !t.url.startsWith("devtools://"));
}

function pickTarget(targets) {
  return targets.find((t) => /tauri\.localhost|tauri:\/\/|localhost:1420/.test(t.url)) ?? targets[0];
}

export class Cdp {
  constructor(ws, target) {
    this.ws = ws;
    this.target = target;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
  }
  static async connect() {
    const target = pickTarget(await listTargets());
    if (!target) throw new Error("no page target found");
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((ok, no) => {
      ws.addEventListener("open", ok, { once: true });
      ws.addEventListener("error", () => no(new Error("ws connect failed")), { once: true });
    });
    const cdp = new Cdp(ws, target);
    ws.addEventListener("message", (e) => cdp.onMessage(String(e.data)));
    return cdp;
  }
  onMessage(raw) {
    const msg = JSON.parse(raw);
    if (msg.id != null) {
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      if (msg.error) p.no(new Error(msg.error.message));
      else p.ok(msg.result);
      return;
    }
    (this.listeners.get(msg.method) ?? []).forEach((fn) => fn(msg.params));
  }
  on(method, fn) {
    const arr = this.listeners.get(method) ?? [];
    arr.push(fn);
    this.listeners.set(method, arr);
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((ok, no) => this.pending.set(id, { ok, no }));
  }
  close() {
    this.ws.close();
  }
}

export async function evalInPage(expr) {
  const cdp = await Cdp.connect();
  try {
    const r = await cdp.send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "eval failed");
    return r.result.value;
  } finally {
    cdp.close();
  }
}

export const COUNTS_EXPR = `(() => {
  const imgs = [...document.images];
  const loaded = imgs.filter((i) => i.currentSrc && i.naturalWidth > 0);
  const est = loaded.reduce((s, i) => s + i.naturalWidth * i.naturalHeight * 4, 0);
  const canv = [...document.querySelectorAll("canvas")];
  const canvPx = canv.reduce((s, c) => s + c.width * c.height * 4, 0);
  const m = performance.memory;
  return {
    nodes: document.querySelectorAll("*").length,
    imgs: imgs.length,
    imgsLoaded: loaded.length,
    estImgDecodeMB: +(est / 1048576).toFixed(1),
    videos: document.querySelectorAll("video").length,
    canvases: canv.length,
    estCanvasMB: +(canvPx / 1048576).toFixed(1),
    jsHeapMB: m ? +(m.usedJSHeapSize / 1048576).toFixed(1) : null,
  };
})()`;

export const LAYERS_EXPR = `(() => {
  const active = document.querySelector(".harbor-layer-active");
  const stack = active ? active.parentElement : null;
  if (!stack) return { error: "layer stack not found" };
  const rows = [...stack.children].map((c, i) => {
    const cs = getComputedStyle(c);
    const imgs = [...c.querySelectorAll("img")];
    const loaded = imgs.filter((x) => x.currentSrc && x.naturalWidth > 0);
    const est = loaded.reduce((s, x) => s + x.naturalWidth * x.naturalHeight * 4, 0);
    return {
      i,
      active: c.classList.contains("harbor-layer-active"),
      display: cs.display,
      visibility: cs.visibility,
      contentVisibility: cs.contentVisibility ?? "",
      nodes: c.querySelectorAll("*").length,
      imgs: imgs.length,
      loaded: loaded.length,
      estMB: +(est / 1048576).toFixed(1),
      videos: c.querySelectorAll("video").length,
      hint: (c.querySelector("h1,h2")?.textContent ?? "").trim().slice(0, 28),
    };
  });
  const inStack = rows.reduce((s, r) => s + r.imgs, 0);
  return { rows, imgsOutsideStack: document.images.length - inStack };
})()`;

export const BIGIMGS_EXPR = `(() =>
  [...document.images]
    .filter((i) => i.currentSrc && i.naturalWidth > 0)
    .map((i) => ({
      mb: +((i.naturalWidth * i.naturalHeight * 4) / 1048576).toFixed(2),
      px: i.naturalWidth + "x" + i.naturalHeight,
      url: i.currentSrc.slice(-72),
    }))
    .sort((a, b) => b.mb - a.mb)
    .slice(0, 25))()`;

export function rss() {
  const ps = [
    "$procs = Get-CimInstance Win32_Process -Filter \"Name='msedgewebview2.exe' or Name='Harbor.exe'\";",
    "$rows = foreach ($w in $procs) {",
    "  if ($w.Name -eq 'msedgewebview2.exe' -and $w.CommandLine -notmatch 'Harbor') { continue }",
    "  $p = Get-Process -Id $w.ProcessId -ErrorAction SilentlyContinue; if (-not $p) { continue }",
    "  $type = 'browser'; if ($w.CommandLine -match '--type=([a-z-]+)') { $type = $Matches[1] }",
    "  if ($w.Name -eq 'Harbor.exe') { $type = 'harbor-exe' }",
    "  [PSCustomObject]@{ pid = $w.ProcessId; type = $type; wsMB = [math]::Round($p.WorkingSet64 / 1MB); privMB = [math]::Round($p.PrivateMemorySize64 / 1MB) }",
    "}",
    "@($rows) | ConvertTo-Json -Depth 3",
  ].join(" ");
  const out = spawnSync("powershell", ["-NoProfile", "-Command", ps], { encoding: "utf8" });
  let rows = [];
  try {
    rows = JSON.parse(out.stdout || "[]");
  } catch {
    return { error: out.stderr || "rss parse failed" };
  }
  if (!Array.isArray(rows)) rows = [rows];
  const byType = {};
  for (const r of rows) {
    byType[r.type] = byType[r.type] ?? { count: 0, wsMB: 0, privMB: 0 };
    byType[r.type].count++;
    byType[r.type].wsMB += r.wsMB;
    byType[r.type].privMB += r.privMB;
  }
  const totalMB = rows.reduce((s, r) => s + r.wsMB, 0);
  return { totalMB, byType, procs: rows.sort((a, b) => b.wsMB - a.wsMB) };
}

export async function counts() {
  return evalInPage(COUNTS_EXPR);
}

export async function layers() {
  return evalInPage(LAYERS_EXPR);
}

export async function bigimgs() {
  return evalInPage(BIGIMGS_EXPR);
}

export async function watch(seconds = 30, intervalSec = 5) {
  const ticks = Math.max(1, Math.floor(seconds / intervalSec));
  const samples = [];
  for (let i = 0; i <= ticks; i++) {
    const c = await counts().catch((e) => ({ error: e.message }));
    const r = rss();
    samples.push({ t: i * intervalSec, jsHeapMB: c.jsHeapMB ?? null, nodes: c.nodes, imgsLoaded: c.imgsLoaded, estImgDecodeMB: c.estImgDecodeMB, rssTotalMB: r.totalMB ?? null });
    if (i < ticks) await new Promise((res) => setTimeout(res, intervalSec * 1000));
  }
  const first = samples[0];
  const last = samples[samples.length - 1];
  const delta = {};
  for (const k of ["jsHeapMB", "nodes", "imgsLoaded", "estImgDecodeMB", "rssTotalMB"]) {
    if (first[k] != null && last[k] != null) delta[k] = +(last[k] - first[k]).toFixed(1);
  }
  return { samples, delta };
}

export async function snapshot() {
  const cdp = await Cdp.connect();
  const dir = join(ROOT, ".diag");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `heap-${Date.now()}.heapsnapshot`);
  writeFileSync(file, "");
  let bytes = 0;
  let detachedRefs = 0;
  cdp.on("HeapProfiler.addHeapSnapshotChunk", ({ chunk }) => {
    bytes += chunk.length;
    detachedRefs += (chunk.match(/Detached /g) ?? []).length;
    appendFileSync(file, chunk);
  });
  try {
    await cdp.send("HeapProfiler.enable");
    await cdp.send("HeapProfiler.collectGarbage");
    await cdp.send("HeapProfiler.takeHeapSnapshot", { reportProgress: false });
    await new Promise((r) => setTimeout(r, 600));
  } finally {
    cdp.close();
  }
  return { file, sizeMB: +(bytes / 1048576).toFixed(1), detachedRefs };
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  const print = (v) => console.log(typeof v === "string" ? v : JSON.stringify(v, null, 2));
  switch (cmd) {
    case "pages":
      return print((await listTargets()).map((t) => ({ title: t.title, url: t.url })));
    case "eval":
      return print(await evalInPage(args.join(" ")));
    case "counts":
      return print(await counts());
    case "layers":
      return print(await layers());
    case "bigimgs":
      return print(await bigimgs());
    case "rss":
      return print(rss());
    case "watch":
      return print(await watch(Number(args[0] ?? 30), Number(args[1] ?? 5)));
    case "snapshot":
      return print(await snapshot());
    default:
      return print("usage: harbor-diag <pages|eval <js>|counts|layers|bigimgs|rss|watch [sec] [interval]|snapshot>");
  }
}

if (process.argv[1] && /harbor-diag\.mjs$/.test(process.argv[1])) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
