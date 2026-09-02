import { REMOTE_PROTO, REMOTE_WS_PATH, WEB_PORT } from "@/lib/remote/protocol";
import { pairedHarbors, readTrustFrame, speaksTrust, trustTokenFor } from "@/lib/lan-trust";
import { harborIdentity, isTauri, type HarborInstance } from "./play-on-lan";

export type PlayOnPayload = {
  metaId: string;
  metaType: string;
  name?: string;
  poster?: string;
  season?: number;
  episode?: number;
  resume?: boolean;
  fromInstance?: string;
  fromName?: string;
  theme?: string | null;
};

export type PlayOnAction = "playMeta" | "queueMeta" | "setTheme";

export type PlayOnResult = { ok: true } | { ok: false; reason: string };

export type PlayOnConfigValue = boolean | string | string[];

export type PlayOnConfigDoc = Record<string, PlayOnConfigValue>;

export type PlayOnConfigTheme = { id: string; name: string; tokens: Record<string, string> | null };

export type PlayOnConfig = {
  settings: PlayOnConfigDoc;
  playerlayout: PlayOnConfigDoc;
  theme: PlayOnConfigTheme | null;
};

export type PlayOnConfigResult =
  | { ok: true; applied: number; skipped: string[] }
  | { ok: false; reason: string };

export type PlayOnConfigReport = { peerId: string; name: string; result: PlayOnConfigResult };

const HANDSHAKE_MS = 3500;
const ACK_MS = 5000;
const FLUSH_MS = 250;
const CONFIG_COALESCE_MS = 220;

let sendSeq = 0;

function nextNonce(): string {
  sendSeq += 1;
  return `c${Date.now().toString(36)}${sendSeq.toString(36)}`;
}

function socketUrl(instance: HarborInstance): string {
  return `ws://${instance.host}:${instance.port}${REMOTE_WS_PATH}`;
}

type Dispatch = {
  build: (token: string | null, id: string) => Record<string, unknown>;
  onAck: (frame: Record<string, unknown>) => PlayOnResult | PlayOnConfigResult;
  onLegacy: () => PlayOnResult | PlayOnConfigResult | null;
};

function run(
  instance: HarborInstance,
  plan: Dispatch,
): Promise<PlayOnResult | PlayOnConfigResult> {
  return new Promise<PlayOnResult | PlayOnConfigResult>((resolve) => {
    let socket: WebSocket;
    try {
      socket = new WebSocket(socketUrl(instance));
    } catch {
      return resolve({ ok: false, reason: "unreachable" });
    }
    let settled = false;
    let guard = 0;
    let waitingFor = "";
    const finish = (result: PlayOnResult | PlayOnConfigResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(guard);
      window.setTimeout(
        () => {
          try {
            socket.close();
          } catch {
            void 0;
          }
        },
        result.ok ? FLUSH_MS : 0,
      );
      resolve(result);
    };
    const arm = (ms: number, reason: string) => {
      window.clearTimeout(guard);
      guard = window.setTimeout(() => finish({ ok: false, reason }), ms);
    };
    arm(HANDSHAKE_MS, "no-response");

    const dispatch = (token: string | null) => {
      const id = nextNonce();
      waitingFor = id;
      socket.send(JSON.stringify(plan.build(token, id)));
    };

    socket.onerror = () => finish({ ok: false, reason: "unreachable" });
    socket.onclose = () => finish({ ok: false, reason: "closed" });
    socket.onopen = () => {
      socket.send(JSON.stringify({ t: "hello", client: "harbor-remote", proto: REMOTE_PROTO }));
    };
    socket.onmessage = (event) => {
      if (settled) return;
      const frame = typeof event.data === "string" ? readTrustFrame(event.data) : null;
      if (!frame) return;
      if (frame.t === "ack") {
        if (frame.id !== waitingFor) return;
        return finish(plan.onAck(frame as unknown as Record<string, unknown>));
      }
      if (waitingFor) return;
      if (!speaksTrust(frame)) {
        dispatch(null);
        const early = plan.onLegacy();
        if (early) return finish(early);
        arm(ACK_MS, "no-ack");
        return;
      }
      const token = trustTokenFor(instance.id);
      if (!token) return finish({ ok: false, reason: "not-paired" });
      dispatch(token);
      arm(ACK_MS, "no-ack");
    };
  });
}

export function sendToInstance(
  instance: HarborInstance,
  action: PlayOnAction,
  payload: PlayOnPayload,
): Promise<PlayOnResult> {
  if (!instance.commandable) {
    return Promise.resolve({ ok: false, reason: "remote-off" });
  }
  return run(instance, {
    build: (token, id) => {
      const frame: Record<string, unknown> = { t: "cmd", id, command: { action, ...payload } };
      if (token) frame.token = token;
      return frame;
    },
    onAck: (frame) =>
      frame.ok ? { ok: true } : { ok: false, reason: String(frame.code || "refused") },
    onLegacy: () => ({ ok: true }),
  }) as Promise<PlayOnResult>;
}

function skipsOf(frame: Record<string, unknown>): string[] {
  const raw = frame.skipped;
  if (!Array.isArray(raw)) return [];
  return raw.filter((cell): cell is string => typeof cell === "string").slice(0, 24);
}

function appliedOf(frame: Record<string, unknown>): number {
  const raw = frame.applied;
  return typeof raw === "number" && Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 0;
}

export function sendConfigToInstance(
  instance: HarborInstance,
  config: PlayOnConfig,
  self?: { id?: string; name?: string } | null,
): Promise<PlayOnConfigResult> {
  return run(instance, {
    build: (token, id) => {
      const command: Record<string, unknown> = { action: "setConfig" };
      if (self?.id) command.fromInstance = self.id;
      if (self?.name) command.fromName = self.name;
      if (Object.keys(config.settings).length > 0) command.settings = config.settings;
      if (Object.keys(config.playerlayout).length > 0) command.playerlayout = config.playerlayout;
      if (config.theme) command.theme = config.theme;
      const frame: Record<string, unknown> = { t: "cmd", id, command };
      if (token) frame.token = token;
      return frame;
    },
    onAck: (frame) =>
      frame.ok
        ? { ok: true, applied: appliedOf(frame), skipped: skipsOf(frame) }
        : { ok: false, reason: String(frame.code || "refused") },
    onLegacy: () => null,
  }) as Promise<PlayOnConfigResult>;
}

function configEmpty(config: PlayOnConfig): boolean {
  if (config.theme) return false;
  if (Object.keys(config.settings).length > 0) return false;
  return Object.keys(config.playerlayout).length === 0;
}

let identity: { id?: string; name?: string } | null = null;
let identityAsked = false;

async function selfIdentity(): Promise<{ id?: string; name?: string } | null> {
  if (identity || identityAsked || !isTauri) return identity;
  identityAsked = true;
  try {
    identity = await harborIdentity();
  } catch {
    identity = null;
  }
  return identity;
}

let pendingConfig: PlayOnConfig | null = null;
let coalesceTimer = 0;
let inFlight = false;
let waiters: ((reports: PlayOnConfigReport[]) => void)[] = [];

async function flushConfig(): Promise<PlayOnConfigReport[]> {
  const config = pendingConfig;
  pendingConfig = null;
  if (!config) return [];
  const peers = pairedHarbors();
  if (peers.length === 0) return [];
  const self = await selfIdentity();
  const jobs = peers.map(async (peer): Promise<PlayOnConfigReport> => {
    const target: HarborInstance = {
      id: peer.peerId,
      name: peer.name,
      host: peer.host,
      port: WEB_PORT,
      platform: peer.platform,
      version: peer.version,
      commandable: true,
      theme: null,
      isSelf: false,
    };
    const result = await sendConfigToInstance(target, config, self);
    return { peerId: peer.peerId, name: peer.name, result };
  });
  return Promise.all(jobs);
}

function armConfigFlush(): void {
  window.clearTimeout(coalesceTimer);
  coalesceTimer = window.setTimeout(() => {
    if (inFlight) return;
    inFlight = true;
    const mine = waiters;
    waiters = [];
    void flushConfig()
      .then((reports) => {
        inFlight = false;
        for (const fn of mine) fn(reports);
        if (pendingConfig || waiters.length > 0) armConfigFlush();
      })
      .catch(() => {
        inFlight = false;
        for (const fn of mine) fn([]);
      });
  }, CONFIG_COALESCE_MS);
}

export function pushConfigToPairedHarbors(config: PlayOnConfig): Promise<PlayOnConfigReport[]> {
  if (typeof window === "undefined" || configEmpty(config)) return Promise.resolve([]);
  if (pairedHarbors().length === 0) return Promise.resolve([]);
  pendingConfig = config;
  const done = new Promise<PlayOnConfigReport[]>((resolve) => {
    waiters.push(resolve);
  });
  armConfigFlush();
  return done;
}

export function failureText(reason: string): string {
  if (reason === "remote-off") return "Remote control is off on that Harbor";
  if (reason === "off") return "Remote control is switched off on that Harbor";
  if (reason === "not-paired") return "Pair with that Harbor before you can drive it";
  if (reason === "untrusted") return "That Harbor does not trust this computer. Pair with it again.";
  if (reason === "expired") return "That Harbor forgot this computer. Pair with it again.";
  if (reason === "no-response") return "That Harbor did not answer";
  if (reason === "no-ack") return "That Harbor answered but never confirmed the command";
  if (reason === "busy") return "That Harbor is busy with another device";
  if (reason === "refused") return "That Harbor refused the command";
  if (reason === "closed") return "That Harbor closed the connection";
  return "Could not reach that Harbor";
}

export function needsPairing(reason: string): boolean {
  return reason === "not-paired" || reason === "untrusted" || reason === "expired";
}
