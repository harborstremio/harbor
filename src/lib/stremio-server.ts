import { invoke } from "@tauri-apps/api/core";

export const BUNDLED_SERVER_URL = "http://127.0.0.1:11470";
const PROBE_TIMEOUT_MS = 1500;
const PROBE_TTL_MS = 30_000;
const READY_WAIT_POLL_MS = 250;

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

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
    return (
      (JSON.parse(raw) as { remoteStreamServerStrict?: boolean }).remoteStreamServerStrict === true
    );
  } catch {
    return false;
  }
}

export function isBundledEngineUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  if (/^https?:\/\/(127\.0\.0\.1|localhost):11470\//i.test(url)) return true;
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
  last_error: string | null;
  restart_count: number;
};

export async function getCastServerStatus(): Promise<CastServerStatus | null> {
  if (!isTauri) return null;
  try {
    return await invoke<CastServerStatus>("cast_server_status");
  } catch {
    return null;
  }
}

export async function restartCastServer(): Promise<boolean> {
  if (!isTauri) return false;
  try {
    await invoke("cast_server_restart");
    probeCache = null;
    return true;
  } catch {
    return false;
  }
}

export async function awaitCastServerReady(timeoutMs = 5000): Promise<boolean> {
  const remote = remoteStreamServerUrl();
  if (remote) {
    if (await probeStremioServer(true)) return true;
    if (remoteStreamServerStrict()) return false;
  }
  if (!isTauri) return probeStremioServer(!!remote, BUNDLED_SERVER_URL);
  const status = await getCastServerStatus();
  if (!status?.bundled) return false;
  if (status.ready) return true;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => window.setTimeout(r, READY_WAIT_POLL_MS));
    const s = await getCastServerStatus();
    if (s?.ready) return true;
    if (await httpProbe(true, BUNDLED_SERVER_URL)) return true;
    if (s && !s.running && s.restart_count >= 3) return false;
  }
  return false;
}

export async function probeStremioServer(force = false, base?: string): Promise<boolean> {
  const target = base ?? getStremioServerUrl();
  if (target !== BUNDLED_SERVER_URL) return httpProbe(force, target);
  if (isTauri) {
    const status = await getCastServerStatus();
    if (status) {
      if (status.ready) return true;
      return httpProbe(force, target);
    }
  }
  return httpProbe(force, target);
}

async function httpProbe(force: boolean, base: string): Promise<boolean> {
  if (
    !force &&
    probeCache &&
    probeCache.base === base &&
    Date.now() - probeCache.at < PROBE_TTL_MS
  ) {
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
  if (url.startsWith(`${BUNDLED_SERVER_URL}/`)) return BUNDLED_SERVER_URL;
  const remote = remoteStreamServerUrl();
  if (remote && url.startsWith(`${remote}/`)) return remote;
  return getStremioServerUrl();
}

export function getStremioServerUrl(): string {
  const remote = remoteStreamServerUrl();
  if (remote) return remote;
  if (!isTauri && typeof window !== "undefined" && window.location.port === "11471") {
    return `http://${window.location.hostname}:11470`;
  }
  return BUNDLED_SERVER_URL;
}
