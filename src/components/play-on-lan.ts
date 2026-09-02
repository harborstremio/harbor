import { invoke } from "@tauri-apps/api/core";
import { REMOTE_PROTO, REMOTE_WS_PATH, WEB_PORT } from "@/lib/remote/protocol";
import { getThemeById } from "@/lib/theme";

export type HarborIdentity = {
  id: string;
  name: string;
  platform: string;
  version: string;
};

export type HarborInstance = {
  id: string;
  name: string;
  host: string;
  port: number;
  platform: string;
  version: string;
  commandable: boolean;
  theme: string | null;
  isSelf: boolean;
};

export type HarborTrust = "unknown" | "paired" | "pairable";

export type HarborReach = "unknown" | "checking" | "reachable" | "unreachable";

export type HarborDeviceState =
  | "self"
  | "paired"
  | "pairable"
  | "ready"
  | "checking"
  | "remote-off"
  | "unreachable";

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const PLATFORM_LABEL: Record<string, string> = {
  windows: "Windows",
  macos: "Mac",
  linux: "Linux",
  android: "Android TV",
  ios: "iOS",
};

export function platformLabel(platform: string): string {
  return PLATFORM_LABEL[platform] ?? (platform ? platform : "Harbor");
}

export function describeInstance(instance: HarborInstance): string {
  const bits = [platformLabel(instance.platform)];
  if (instance.version) bits.push(`Harbor ${instance.version}`);
  const theme = themeLabel(instance.theme ?? "");
  if (theme) bits.push(theme);
  return bits.join(" / ");
}

function titleCase(id: string): string {
  return id
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function themeLabel(id: string): string {
  const clean = id.trim();
  if (!clean) return "";
  const known = getThemeById(clean);
  if (known?.name) return known.name;
  return titleCase(clean.startsWith("user:") ? clean.slice(5) : clean);
}

export type ThemeSwatch = readonly [string, string, string];

export function themeSwatch(id: string | null | undefined): ThemeSwatch | null {
  const clean = (id ?? "").trim();
  if (!clean) return null;
  const known = getThemeById(clean);
  const raw = known?.swatch;
  if (!Array.isArray(raw) || raw.length !== 3) return null;
  if (!raw.every((entry) => typeof entry === "string" && entry.length > 0)) return null;
  return [raw[0], raw[1], raw[2]] as const;
}

export function deviceStateOf(
  instance: HarborInstance,
  trust: HarborTrust,
  reach: HarborReach,
): HarborDeviceState {
  if (instance.isSelf) return "self";
  if (!instance.commandable) return "remote-off";
  if (reach === "unreachable") return "unreachable";
  if (reach === "checking") return "checking";
  if (trust === "paired") return "paired";
  if (trust === "pairable") return "pairable";
  return "ready";
}

let identityCache: HarborIdentity | null = null;

export async function harborIdentity(): Promise<HarborIdentity | null> {
  if (!isTauri) return null;
  if (identityCache) return identityCache;
  try {
    identityCache = await invoke<HarborIdentity>("harbor_lan_identity");
    return identityCache;
  } catch {
    return null;
  }
}

export async function advertiseHarbor(opts: {
  commandable: boolean;
  theme?: string | null;
  port?: number;
}): Promise<boolean> {
  if (!isTauri) return false;
  try {
    await invoke<string>("harbor_lan_advertise", {
      port: opts.port ?? WEB_PORT,
      commandable: opts.commandable,
      theme: opts.theme ?? null,
    });
    return true;
  } catch {
    return false;
  }
}

export async function stopAdvertisingHarbor(): Promise<void> {
  if (!isTauri) return;
  try {
    await invoke("harbor_lan_stop_advertise");
  } catch {
    return;
  }
}

export async function discoverHarborInstances(timeoutMs?: number): Promise<HarborInstance[]> {
  if (!isTauri) return [];
  try {
    const found = await invoke<HarborInstance[]>("harbor_lan_discover", {
      timeoutMs: timeoutMs ?? null,
    });
    return Array.isArray(found) ? found : [];
  } catch {
    return [];
  }
}

const PROBE_MS = 2400;

export function probeInstance(instance: HarborInstance, timeoutMs = PROBE_MS): Promise<boolean> {
  if (!instance.commandable) return Promise.resolve(false);
  return new Promise<boolean>((resolve) => {
    let socket: WebSocket;
    try {
      socket = new WebSocket(`ws://${instance.host}:${instance.port}${REMOTE_WS_PATH}`);
    } catch {
      resolve(false);
      return;
    }
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(guard);
      try {
        socket.close();
      } catch {
        void 0;
      }
      resolve(ok);
    };
    const guard = window.setTimeout(() => finish(false), timeoutMs);
    socket.onopen = () => {
      socket.send(JSON.stringify({ t: "hello", client: "harbor-remote", proto: REMOTE_PROTO }));
    };
    socket.onmessage = (event) => {
      if (typeof event.data !== "string") return;
      try {
        const parsed = JSON.parse(event.data) as { t?: unknown };
        if (parsed && parsed.t === "hello") finish(true);
      } catch {
        void 0;
      }
    };
    socket.onerror = () => finish(false);
    socket.onclose = () => finish(false);
  });
}

export type SweepHandle = { cancel: () => void };

const SWEEP_WINDOWS = [800, 900, 1500];

function changedFrom(prev: HarborInstance | undefined, next: HarborInstance): boolean {
  if (!prev) return true;
  return (
    prev.commandable !== next.commandable ||
    prev.theme !== next.theme ||
    prev.host !== next.host ||
    prev.port !== next.port ||
    prev.name !== next.name ||
    prev.version !== next.version
  );
}

export function sweepHarborInstances(
  onPeers: (peers: HarborInstance[], settled: boolean) => void,
): SweepHandle {
  let cancelled = false;
  const seen = new Map<string, HarborInstance>();

  const run = async () => {
    if (!isTauri) {
      if (!cancelled) onPeers([], true);
      return;
    }
    for (const span of SWEEP_WINDOWS) {
      const found = await discoverHarborInstances(span);
      if (cancelled) return;
      let changed = false;
      for (const instance of found) {
        if (instance.isSelf) continue;
        if (!changedFrom(seen.get(instance.id), instance)) continue;
        seen.set(instance.id, instance);
        changed = true;
      }
      if (changed) onPeers([...seen.values()], false);
    }
    if (cancelled) return;
    onPeers([...seen.values()], true);
  };

  void run();
  return {
    cancel: () => {
      cancelled = true;
    },
  };
}
