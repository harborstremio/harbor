import { invoke } from "@tauri-apps/api/core";

export const DEFAULT_BUNDLED_PORT = 11470;
const PROBE_TIMEOUT_MS = 1500;
const PROBE_TTL_MS = 30_000;
const READY_WAIT_POLL_MS = 250;

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

let bundledPort = DEFAULT_BUNDLED_PORT;

export function bundledServerPort(): number {
  return bundledPort;
}

export function bundledServerUrl(): string {
  return `http://127.0.0.1:${bundledPort}`;
}

export function remoteStreamServerUrl(): string {
  try {
    const raw = localStorage.getItem("harbor.settings");
    if (!raw) return "";
    const url = (JSON.parse(raw) as { remoteStreamServerUrl?: string }).remoteStreamServerUrl;
    return typeof url === "string" ? url.trim().replace(/\/+$/, "") : "";
  } catch {
    return "";
  }
}

export function remoteStreamServerStrict(): boolean {
  if (!remoteStreamServerUrl()) return false;
  try {
    const raw = localStorage.getItem("harbor.settings");
    if (!raw) return false;
    return (JSON.parse(raw) as { remoteStreamServerStrict?: boolean }).remoteStreamServerStrict === true;
  } catch {
    return false;
  }
}

export function isBundledEngineUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  const loopback = /^https?:\/\/(?:127\.0\.0\.1|localhost):(\d+)\//i.exec(url);
  if (loopback) {
    const port = Number(loopback[1]);
    if (port === bundledPort || port === DEFAULT_BUNDLED_PORT) return true;
  }
  const remote = remoteStreamServerUrl();
  return !!remote && url.startsWith(`${remote}/`);
}

export function isLocalEngineUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  return /^https?:\/\/(127\.0\.0\.1|localhost):\d+\/stream\//i.test(url);
}

let probeCache: { ok: boolean; at: number; base: string } | null = null;

export type CastServerStatus = {
  bundled: boolean;
  running: boolean;
  ready: boolean;
  port: number | null;
  last_error: string | null;
  restart_count: number;
};

export async function getCastServerStatus(): Promise<CastServerStatus | null> {
  if (!isTauri) return null;
  try {
    const status = await invoke<CastServerStatus>("cast_server_status");
    if (typeof status.port === "number" && status.port > 0 && status.port !== bundledPort) {
      bundledPort = status.port;
      probeCache = null;
    }
    return status;
  } catch {
    return null;
  }
}

export async function restartCastServer(): Promise<string | null> {
  if (!isTauri) return "Harbor's streaming server only runs in the desktop app.";
  try {
    await invoke("cast_server_restart");
    probeCache = null;
    return null;
  } catch (e) {
    probeCache = null;
    return String(e);
  }
}

export async function awaitCastServerReady(timeoutMs = 5000): Promise<boolean> {
  const remote = remoteStreamServerUrl();
  if (remote) {
    if (await probeStremioServer(true)) return true;
    if (remoteStreamServerStrict()) return false;
  }
  if (!isTauri) return probeStremioServer(!!remote, bundledServerUrl());
  const status = await getCastServerStatus();
  if (!status?.bundled) return false;
  if (status.ready) return true;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => window.setTimeout(r, READY_WAIT_POLL_MS));
    const s = await getCastServerStatus();
    if (s?.ready) return true;
    if (await httpProbe(true, bundledServerUrl())) return true;
    if (s && !s.running && s.restart_count >= 3) return false;
  }
  return false;
}

export async function probeStremioServer(force = false, base?: string): Promise<boolean> {
  const target = base ?? getStremioServerUrl();
  if (target !== bundledServerUrl()) return httpProbe(force, target);
  if (isTauri) {
    const status = await getCastServerStatus();
    if (status) {
      if (status.ready) return true;
      return httpProbe(force, bundledServerUrl());
    }
  }
  return httpProbe(force, bundledServerUrl());
}

async function httpProbe(force: boolean, base: string): Promise<boolean> {
  if (!force && probeCache && probeCache.base === base && Date.now() - probeCache.at < PROBE_TTL_MS) {
    return probeCache.ok;
  }
  try {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
    const res = await fetch(`${base}/settings`, {
      method: "GET",
      signal: ctrl.signal,
    });
    window.clearTimeout(timer);
    const ok = res.ok;
    if (ok) probeCache = { ok, at: Date.now(), base };
    else probeCache = null;
    return ok;
  } catch {
    probeCache = null;
    return false;
  }
}

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function buildTranscodedUrl(sourceUrl: string): string {
  const id = randomId();
  const params = new URLSearchParams();
  params.set("mediaURL", sourceUrl);
  params.set("videoCodecs", "h264");
  params.set("audioCodecs", "aac");
  params.set("audioChannels", "2");
  return `${engineBaseFor(sourceUrl)}/hlsv2/${id}/master.m3u8?${params.toString()}`;
}

export function engineBaseFor(url: string): string {
  const bundled = bundledServerUrl();
  if (url.startsWith(`${bundled}/`)) return bundled;
  const remote = remoteStreamServerUrl();
  if (remote && url.startsWith(`${remote}/`)) return remote;
  return getStremioServerUrl();
}

export function getStremioServerUrl(): string {
  const remote = remoteStreamServerUrl();
  if (remote) return remote;
  if (!isTauri && typeof window !== "undefined" && window.location.port === "11471") {
    return `http://${window.location.hostname}:${DEFAULT_BUNDLED_PORT}`;
  }
  return bundledServerUrl();
}
