import { useSyncExternalStore } from "react";
import { REMOTE_PROTO, REMOTE_WS_PATH } from "@/lib/remote/protocol";
import { setItemWithRecovery } from "@/lib/storage-recovery";

export const LAN_TRUST_PROTO = REMOTE_PROTO;
export const PAIR_CODE_LEN = 8;

const TRUST_KEY = "harbor.lan.trust.v1";
const TOKEN_MIN = 8;
const TOKEN_MAX = 64;
const TOKEN_RE = /^[0-9A-Za-z._~+/=-]+$/;
const HELLO_MS = 4000;
const BEGIN_MS = 6000;
const SUBMIT_MS = 8000;

export type LanSelf = { id: string; name: string; platform: string; version: string };

export type TrustPeerRef = { id: string; host: string; port: number };

export type PairedHarbor = {
  peerId: string;
  token: string;
  name: string;
  platform: string;
  version: string;
  host: string;
  pairedAt: number;
};

export type LanTrustHello = { t: "hello"; proto: number; server: string; trust?: string };

export type LanTrustAck = {
  t: "ack";
  id: string;
  ok: boolean;
  code?: string | null;
  token?: string;
  expiresAt?: number;
  len?: number;
  peer?: Partial<LanSelf>;
};

export type LanTrustServerFrame = LanTrustHello | LanTrustAck;

export type PairBegin = { ok: true; expiresAt: number; len: number } | { ok: false; code: string };
export type PairFinish = { ok: true; peer: PairedHarbor } | { ok: false; code: string };

const paired = new Map<string, PairedHarbor>();
const listeners = new Set<() => void>();
let snapshot: PairedHarbor[] = [];
let loaded = false;

function sane(row: unknown): PairedHarbor | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const peerId = typeof r.peerId === "string" ? r.peerId : "";
  const token = typeof r.token === "string" ? r.token : "";
  if (!peerId || !validToken(token)) return null;
  return {
    peerId,
    token,
    name: typeof r.name === "string" ? r.name : "",
    platform: typeof r.platform === "string" ? r.platform : "",
    version: typeof r.version === "string" ? r.version : "",
    host: typeof r.host === "string" ? r.host : "",
    pairedAt: typeof r.pairedAt === "number" ? r.pairedAt : 0,
  };
}

function load(): void {
  if (loaded) return;
  loaded = true;
  try {
    const raw = localStorage.getItem(TRUST_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return;
    for (const row of parsed) {
      const clean = sane(row);
      if (clean) paired.set(clean.peerId, clean);
    }
  } catch {
    void 0;
  }
  rebuild();
}

function rebuild(): void {
  snapshot = [...paired.values()].sort((a, b) => b.pairedAt - a.pairedAt);
}

function persist(): void {
  rebuild();
  try {
    setItemWithRecovery(TRUST_KEY, JSON.stringify(snapshot));
  } catch {
    void 0;
  }
  listeners.forEach((fn) => fn());
}

export function validToken(token: string): boolean {
  if (typeof token !== "string") return false;
  if (token.length < TOKEN_MIN || token.length > TOKEN_MAX) return false;
  return TOKEN_RE.test(token);
}

export function pairedHarbors(): PairedHarbor[] {
  load();
  return snapshot;
}

export function pairedHarbor(peerId: string): PairedHarbor | null {
  load();
  return paired.get(peerId) ?? null;
}

export function trustTokenFor(peerId: string): string | null {
  return pairedHarbor(peerId)?.token ?? null;
}

export function rememberPairing(record: PairedHarbor): void {
  load();
  const clean = sane(record);
  if (!clean) return;
  paired.set(clean.peerId, clean);
  persist();
}

export function forgetPairing(peerId: string): void {
  load();
  if (!paired.delete(peerId)) return;
  persist();
}

function subscribe(fn: () => void): () => void {
  load();
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function usePairedHarbors(): PairedHarbor[] {
  return useSyncExternalStore(subscribe, pairedHarbors, () => snapshot);
}

export function useIsPaired(peerId: string): boolean {
  const rows = usePairedHarbors();
  return rows.some((row) => row.peerId === peerId);
}

export function normalizePairCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/O/g, "0")
    .replace(/I/g, "1")
    .replace(/L/g, "1");
}

export function readTrustFrame(raw: string): LanTrustServerFrame | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.t === "hello") return parsed as unknown as LanTrustHello;
    if (parsed.t === "ack" && typeof parsed.id === "string") {
      return parsed as unknown as LanTrustAck;
    }
    return null;
  } catch {
    return null;
  }
}

export function speaksTrust(hello: LanTrustHello): boolean {
  return typeof hello.trust === "string" && hello.trust.length > 0;
}

const PAIR_TEXT: Record<string, string> = {
  badCode: "That code did not match. Read it off the television again.",
  expired: "That code has expired. Ask the television for a fresh one.",
  alreadyPaired:
    "That Harbor already trusts a computer under this name. Forget it on the television, then pair again.",
  busy: "That Harbor is already pairing with something else. Finish that first.",
  gone: "That Harbor dropped off mid-pair. Wake it and make sure it is on this network.",
  "no-response": "That Harbor did not answer.",
  unreachable: "Could not reach that Harbor.",
  "too-old": "That Harbor does not know how to pair yet. Update Harbor on it first.",
  mismatch: "That Harbor answered with a different identity. Scan again before pairing.",
  off: "Remote control is switched off on that Harbor.",
};

export function pairFailureText(code: string): string {
  return PAIR_TEXT[code] ?? "That Harbor refused to pair.";
}

let nonceSeq = 0;

function nextNonce(): string {
  nonceSeq += 1;
  return `p${Date.now().toString(36)}${nonceSeq.toString(36)}`;
}

type Waiter = {
  resolve: (ack: LanTrustAck) => void;
  reject: (code: string) => void;
  timer: number;
};

export class LanPairSession {
  private socket: WebSocket | null = null;
  private readonly waiting = new Map<string, Waiter>();
  private dead = false;
  private hello: LanTrustHello | null = null;

  constructor(
    private readonly target: TrustPeerRef,
    private readonly self: LanSelf | null,
  ) {}

  close(): void {
    this.kill("gone");
  }

  async open(): Promise<PairBegin> {
    if (this.dead) return { ok: false, code: "gone" };
    const connected = await this.connect();
    if (connected) return { ok: false, code: connected };
    try {
      const ack = await this.ask(
        {
          t: "pair",
          proto: LAN_TRUST_PROTO,
          step: "begin",
          peer: this.identity(),
        },
        BEGIN_MS,
      );
      if (!ack.ok) return { ok: false, code: ack.code || "refused" };
      const expiresAt = typeof ack.expiresAt === "number" ? ack.expiresAt : 0;
      const asked = typeof ack.len === "number" ? Math.round(ack.len) : PAIR_CODE_LEN;
      const len = asked >= 4 && asked <= 16 ? asked : PAIR_CODE_LEN;
      return { ok: true, expiresAt, len };
    } catch (code) {
      return { ok: false, code: typeof code === "string" ? code : "refused" };
    }
  }

  async submit(code: string): Promise<PairFinish> {
    const clean = normalizePairCode(code);
    if (!clean) return { ok: false, code: "badCode" };
    if (this.dead || !this.socket) return { ok: false, code: "gone" };
    try {
      const ack = await this.ask(
        {
          t: "pair",
          proto: LAN_TRUST_PROTO,
          step: "code",
          code: clean,
          peer: this.identity(),
        },
        SUBMIT_MS,
      );
      if (!ack.ok) return { ok: false, code: ack.code || "refused" };
      const claimed = typeof ack.peer?.id === "string" ? ack.peer.id : "";
      if (claimed && claimed !== this.target.id) return { ok: false, code: "mismatch" };
      const token = typeof ack.token === "string" ? ack.token : "";
      if (!validToken(token)) return { ok: false, code: "refused" };
      const record: PairedHarbor = {
        peerId: this.target.id,
        token,
        name: typeof ack.peer?.name === "string" ? ack.peer.name : "",
        platform: typeof ack.peer?.platform === "string" ? ack.peer.platform : "",
        version: typeof ack.peer?.version === "string" ? ack.peer.version : "",
        host: this.target.host,
        pairedAt: Date.now(),
      };
      rememberPairing(record);
      return { ok: true, peer: record };
    } catch (thrown) {
      return { ok: false, code: typeof thrown === "string" ? thrown : "refused" };
    }
  }

  private identity(): LanSelf {
    return {
      id: this.self?.id ?? "",
      name: this.self?.name ?? "",
      platform: this.self?.platform ?? "",
      version: this.self?.version ?? "",
    };
  }

  private connect(): Promise<string | null> {
    if (this.socket && this.hello) return Promise.resolve(null);
    return new Promise<string | null>((resolve) => {
      let socket: WebSocket;
      try {
        socket = new WebSocket(`ws://${this.target.host}:${this.target.port}${REMOTE_WS_PATH}`);
      } catch {
        this.dead = true;
        return resolve("unreachable");
      }
      this.socket = socket;
      let settled = false;
      const done = (reason: string | null) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(guard);
        if (reason) this.kill(reason);
        resolve(reason);
      };
      const guard = window.setTimeout(() => done("no-response"), HELLO_MS);
      socket.onerror = () => done("unreachable");
      socket.onclose = () => {
        this.kill("gone");
        done("unreachable");
      };
      socket.onopen = () => {
        socket.send(
          JSON.stringify({ t: "hello", client: "harbor-remote", proto: LAN_TRUST_PROTO }),
        );
      };
      socket.onmessage = (event) => {
        const frame = typeof event.data === "string" ? readTrustFrame(event.data) : null;
        if (!frame) return;
        if (frame.t === "ack") {
          this.settle(frame);
          return;
        }
        this.hello = frame;
        done(speaksTrust(frame) ? null : "too-old");
      };
    });
  }

  private ask(body: Record<string, unknown>, ms: number): Promise<LanTrustAck> {
    const socket = this.socket;
    if (!socket || this.dead) return Promise.reject("gone");
    const id = nextNonce();
    return new Promise<LanTrustAck>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.waiting.delete(id);
        reject("no-response");
      }, ms);
      this.waiting.set(id, { resolve, reject, timer });
      try {
        socket.send(JSON.stringify({ ...body, id }));
      } catch {
        window.clearTimeout(timer);
        this.waiting.delete(id);
        reject("gone");
      }
    });
  }

  private settle(ack: LanTrustAck): void {
    const waiter = this.waiting.get(ack.id);
    if (!waiter) return;
    this.waiting.delete(ack.id);
    window.clearTimeout(waiter.timer);
    waiter.resolve(ack);
  }

  private kill(code: string): void {
    if (this.dead) return;
    this.dead = true;
    for (const waiter of this.waiting.values()) {
      window.clearTimeout(waiter.timer);
      waiter.reject(code);
    }
    this.waiting.clear();
    const socket = this.socket;
    this.socket = null;
    if (!socket) return;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    try {
      socket.close();
    } catch {
      void 0;
    }
  }
}
