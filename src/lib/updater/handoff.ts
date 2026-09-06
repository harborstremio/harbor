import { Channel, invoke } from "@tauri-apps/api/core";
import { HARBOR_API_BASE } from "@/lib/config/endpoints";
import { safeFetch } from "@/lib/safe-fetch";

export type HandoffProbe = {
  supported: boolean;
  managed: boolean;
  installDir: string;
  payloadVersion: number;
  platformKey: string;
};

export type HandoffPlan = {
  version: string;
  notes: string | null;
  url: string;
  signature: string;
  size: number | null;
  payloadVersion: number;
  verifiable: boolean;
  recoveryProtocol?: 1;
};

type ManifestEntry = {
  url?: string;
  signature?: string;
  size?: number;
  payloadVersion?: number;
};

type Manifest = {
  version?: string;
  notes?: string;
  installer?: Record<string, ManifestEntry>;
};

type StageEvent =
  | { kind: "started"; total: number | null }
  | { kind: "progress"; received: number; total: number | null }
  | { kind: "verifying" }
  | { kind: "ready" };

export type StageProgress = {
  received: number;
  total: number | null;
  verifying: boolean;
};

export async function probeHandoff(): Promise<HandoffProbe | null> {
  try {
    return await invoke<HandoffProbe>("handoff_probe");
  } catch {
    return null;
  }
}

export async function readHandoffPlan(init?: RequestInit): Promise<HandoffPlan | null> {
  const probe = await probeHandoff();
  if (!probe?.supported || !probe.managed) return null;
  const res = await safeFetch(`${HARBOR_API_BASE}/updates/latest.json`, {
    cache: "no-store",
    ...init,
  });
  if (!res.ok) return null;
  const manifest = (await res.json()) as Manifest;
  const entry = manifest.installer?.[probe.platformKey];
  if (!entry?.url) return null;
  const payloadVersion = Number(entry.payloadVersion ?? 0);
  const { getVersion } = await import("@tauri-apps/api/app");
  const running = await getVersion().catch(() => "");
  const [major = 0, minor = 0, patch = 0] = running
    .split(/[.\-+]/)
    .map((n) => parseInt(n, 10) || 0);
  const runningPayload = major * 1_000_000 + minor * 1_000 + patch;
  const floor = Math.max(probe.payloadVersion, runningPayload);
  if (!Number.isFinite(payloadVersion) || payloadVersion <= floor) return null;
  const signature = typeof entry.signature === "string" ? entry.signature.trim() : "";
  return {
    version: manifest.version ?? "",
    notes: manifest.notes ?? null,
    url: entry.url,
    signature,
    size: typeof entry.size === "number" && entry.size > 0 ? entry.size : null,
    payloadVersion,
    verifiable: signature.length > 0,
  };
}

export function stageHandoff(
  plan: HandoffPlan,
  onProgress: (p: StageProgress) => void,
): Promise<void> {
  const channel = new Channel<StageEvent>();
  channel.onmessage = (ev) => {
    if (ev.kind === "started") {
      onProgress({ received: 0, total: ev.total ?? plan.size, verifying: false });
    } else if (ev.kind === "progress") {
      onProgress({ received: ev.received, total: ev.total ?? plan.size, verifying: false });
    } else if (ev.kind === "verifying") {
      onProgress({ received: plan.size ?? 0, total: plan.size, verifying: true });
    }
  };
  return invoke<void>("handoff_stage", {
    url: plan.url,
    signature: plan.signature,
    version: plan.version,
    recoverable: plan.recoveryProtocol === 1,
    onEvent: channel,
  });
}

export function launchHandoff(): Promise<void> {
  return invoke<void>("handoff_launch");
}
