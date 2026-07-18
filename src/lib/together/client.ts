import {
  WT_PROTO,
  type ClientMessage,
  type Participant,
  type ParticipantLocation,
  type PlayInvite,
  type RoomCode,
  type RoomCommand,
  type ServerMessage,
  type SummonTarget,
  type SyncState,
} from "./protocol";
import { diagnoseRelayFailure, type RoomEvent, type RoomSnapshot } from "./client-types";

export type { ClientState, RoomEvent, RoomSnapshot } from "./client-types";

const AVATAR_MAX_CHARS = 590_000;
const PING_INTERVAL_MS = 25_000;
const LIVENESS_TIMEOUT_MS = 40_000;
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30_000;
const MAX_RENAME_ATTEMPTS = 8;
const RENAME_RECONNECT_MS = 60;
const CONNECT_TIMEOUT_MS = 10_000;
const MAX_FAIL_STREAK = 4;

function capAvatar(avatar: string | null): string | null {
  return avatar && avatar.length > AVATAR_MAX_CHARS ? null : avatar;
}

export class TogetherClient {
  private ws: WebSocket | null = null;
  private url: string;
  private clientId: string;
  private name: string;
  private originalName: string;
  private renameAttempts = 0;
  private room: RoomCode | null = null;
  private snapshot: RoomSnapshot;
  private listeners = new Set<(e: RoomEvent) => void>();
  private pingTimer: number | null = null;
  private reconnectTimer: number | null = null;
  private reconnectAttempt = 0;
  private intentional = false;
  private suppressUntil = 0;
  private outQueue: ClientMessage[] = [];
  private lastSentInvite: PlayInvite | null = null;
  private claimedHost = false;

  private connectWatchdog: number | null = null;
  private everJoined = false;
  private joinedThisAttempt = false;
  private attemptResolved = false;
  private failStreak = 0;
  private terminal = false;

  private avatar: string | null;
  private color: string | null;

  private relayOffset: number | null = null;
  private haveRttOffset = false;
  private pingSentAt = 0;
  private lastInboundAt = 0;

  constructor(
    url: string,
    clientId: string,
    name: string,
    avatar: string | null = null,
    color: string | null = null,
  ) {
    this.url = url;
    this.clientId = clientId;
    this.name = name;
    this.originalName = name;
    this.avatar = capAvatar(avatar);
    this.color = color;
    this.snapshot = {
      state: "disconnected",
      room: null,
      participants: [],
      syncState: null,
      hostClientId: null,
      started: false,
      relayVersion: null,
      lastError: null,
    };
  }

  setName(name: string) {
    this.name = name;
    this.originalName = name;
    this.renameAttempts = 0;
    if (this.room && this.snapshot.state === "joined") {
      this.send({
        t: "profile",
        room: this.room,
        clientId: this.clientId,
        name: this.name,
        avatar: this.avatar,
        color: this.color,
      });
    }
  }

  setProfile(avatar: string | null, color: string | null) {
    this.avatar = capAvatar(avatar);
    this.color = color;
    if (this.room && this.snapshot.state === "joined") {
      this.send({
        t: "profile",
        room: this.room,
        clientId: this.clientId,
        name: this.name,
        avatar: this.avatar,
        color: this.color,
      });
    }
  }

  on(listener: (e: RoomEvent) => void): () => void {
    this.listeners.add(listener);
    listener({ kind: "snapshot", snapshot: this.snapshot });
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): RoomSnapshot {
    return this.snapshot;
  }

  suppressOutgoingFor(ms: number) {
    this.suppressUntil = Date.now() + ms;
  }

  join(room: RoomCode): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.room && this.room !== room) {
      this.sendNow({ t: "leave", room: this.room, clientId: this.clientId });
    }
    this.cleanup();
    this.outQueue = [];
    this.lastSentInvite = null;
    this.reconnectAttempt = 0;
    this.intentional = false;
    this.room = room;
    this.claimedHost = false;
    this.everJoined = false;
    this.failStreak = 0;
    this.terminal = false;
    this.update({ state: "connecting", room, lastError: null, started: false, relayVersion: null });
    this.openSocket();
  }

  leave(): void {
    this.intentional = true;
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.room) {
      this.sendNow({ t: "leave", room: this.room, clientId: this.clientId });
    }
    this.cleanup();
    this.reconnectAttempt = 0;
    this.room = null;
    this.outQueue = [];
    this.lastSentInvite = null;
    this.claimedHost = false;
    this.update({
      state: "disconnected",
      room: null,
      participants: [],
      syncState: null,
      hostClientId: null,
      started: false,
      relayVersion: null,
      lastError: null,
    });
  }

  retry(): void {
    if (!this.room) return;
    this.terminal = false;
    this.failStreak = 0;
    this.reconnectAttempt = 0;
    this.everJoined = false;
    this.update({ state: "connecting", lastError: null });
    this.openSocket();
  }

  publishState(state: SyncState): void {
    if (!this.room) return;
    if (Date.now() < this.suppressUntil) return;
    this.send({ t: "state", room: this.room, clientId: this.clientId, state });
    this.update({ syncState: state });
  }

  sendCommand(command: RoomCommand): void {
    if (!this.room) return;
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.sendNow({ t: "cmd", room: this.room, clientId: this.clientId, command });
  }

  sendChat(text: string): void {
    if (!this.room || !text.trim()) return;
    this.send({ t: "chat", room: this.room, clientId: this.clientId, text: text.trim() });
  }

  sendInvite(invite: PlayInvite): void {
    if (!this.room || !invite.mediaId) return;
    this.lastSentInvite = invite;
    this.send({ t: "invite", room: this.room, clientId: this.clientId, invite });
  }

  clearInvite(): void {
    this.lastSentInvite = null;
  }

  markReady(ready: boolean): void {
    if (!this.room) return;
    this.send({ t: "ready", room: this.room, clientId: this.clientId, ready });
  }

  claimHost(fresh: boolean): void {
    if (!this.room) return;
    this.claimedHost = true;
    this.send({ t: "claim-host", room: this.room, clientId: this.clientId, fresh });
  }

  private reconcileHostClaim(hostClientId: string | null): void {
    if (!hostClientId) return;
    this.claimedHost = hostClientId === this.clientId;
  }

  startRoom(): void {
    if (!this.room) return;
    this.send({ t: "start", room: this.room, clientId: this.clientId });
  }

  notifyHostLeaving(): void {
    if (!this.room) return;
    this.send({ t: "host-leaving", room: this.room, clientId: this.clientId });
  }

  sendSummon(target: SummonTarget): void {
    if (!this.room) return;
    this.send({ t: "summon", room: this.room, clientId: this.clientId, target });
  }

  sendCursor(x: number, y: number, visible: boolean, path: string): void {
    if (!this.room) return;
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.sendNow({ t: "cursor", room: this.room, clientId: this.clientId, x, y, visible, path });
  }

  sendDraw(
    strokeId: string,
    phase: "start" | "point" | "end" | "clear",
    path: string,
    x?: number,
    y?: number,
    color?: string,
  ): void {
    if (!this.room) return;
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.sendNow({
      t: "draw",
      room: this.room,
      clientId: this.clientId,
      strokeId,
      phase,
      x,
      y,
      color,
      path,
    });
  }

  sendPresence(location?: ParticipantLocation): void {
    if (!this.room) return;
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.sendNow({
      t: "presence",
      room: this.room,
      clientId: this.clientId,
      activeAt: Date.now(),
      location,
    });
  }

  private openSocket() {
    if (!this.room) return;
    this.attemptResolved = false;
    this.joinedThisAttempt = false;
    try {
      const base = this.url
        .trim()
        .replace(/^https:\/\//i, "wss://")
        .replace(/^http:\/\//i, "ws://")
        .replace(/\/+$/, "");
      const wsBase = /^wss?:\/\//i.test(base) ? base : `wss://${base}`;
      this.ws = new WebSocket(`${wsBase}/r/${this.room}`);
    } catch {
      this.failAttempt();
      return;
    }
    this.armWatchdog();
    this.ws.onopen = () => {
      if (!this.room) return;
      this.reconnectAttempt = 0;
      this.lastInboundAt = Date.now();
      this.sendPing();
      this.sendNow({
        t: "hello",
        room: this.room,
        clientId: this.clientId,
        name: this.name,
        avatar: this.avatar,
        color: this.color,
      });
      this.flushOutQueue();
      if (this.claimedHost) {
        this.sendNow({ t: "claim-host", room: this.room, clientId: this.clientId, fresh: false });
      }
      if (this.lastSentInvite) {
        this.sendNow({
          t: "invite",
          room: this.room,
          clientId: this.clientId,
          invite: this.lastSentInvite,
        });
      }
      this.startPing();
    };
    this.ws.onmessage = (ev) => {
      this.lastInboundAt = Date.now();
      try {
        const msg = JSON.parse(ev.data) as ServerMessage;
        this.handleServer(msg);
      } catch {
        // ignore malformed
      }
    };
    this.ws.onclose = () => {
      this.stopPing();
      this.resetClockState();
      this.clearWatchdog();
      if (this.intentional || this.terminal) return;
      this.failAttempt();
    };
    this.ws.onerror = () => {
      try {
        this.ws?.close();
      } catch {
        /* ignore */
      }
    };
  }

  private handleServer(msg: ServerMessage) {
    switch (msg.t) {
      case "joined":
        if (this.handleNameCollision(msg.participants)) return;
        this.renameAttempts = 0;
        this.everJoined = true;
        this.joinedThisAttempt = true;
        this.attemptResolved = true;
        this.failStreak = 0;
        this.clearWatchdog();
        if (msg.state) this.localizeStateClock(msg.state, msg.srvAt);
        this.update({
          state: "joined",
          room: this.room,
          participants: msg.participants,
          syncState: msg.state,
          hostClientId: msg.hostClientId,
          started: msg.started ?? false,
          relayVersion: typeof msg.relayVersion === "number" ? msg.relayVersion : null,
        });
        this.reconcileHostClaim(msg.hostClientId);
        if (msg.state) {
          this.emit({ kind: "incoming-state", state: msg.state });
          const stateAuthorPresent =
            !!msg.state.updatedBy && msg.participants.some((p) => p.id === msg.state!.updatedBy);
          if (msg.state.mediaId && msg.state.updatedBy !== this.clientId && stateAuthorPresent) {
            const hostName =
              msg.participants.find((p) => p.id === msg.state!.updatedBy)?.name ?? "Host";
            this.emit({
              kind: "invite",
              from: msg.state.updatedBy,
              name: hostName,
              invite: {
                mediaId: msg.state.mediaId,
                mediaType: msg.state.episode ? "series" : "movie",
                mediaTitle: msg.state.mediaTitle ?? "Watch Together",
                posterUrl: msg.state.posterUrl ?? undefined,
                episode: msg.state.episode ?? undefined,
                proto: msg.state.source ? WT_PROTO : undefined,
                guestPick: msg.state.guestPick === true ? true : undefined,
              },
              at: msg.state.updatedAt ?? Date.now(),
            });
          }
        }
        return;
      case "host":
        this.update({ hostClientId: msg.hostClientId });
        this.reconcileHostClaim(msg.hostClientId);
        return;
      case "started":
        this.update({ started: msg.started });
        this.emit({ kind: "started", started: msg.started });
        return;
      case "participant-joined": {
        const nextParticipants = [
          ...this.snapshot.participants.filter((p) => p.id !== msg.participant.id),
          msg.participant,
        ];
        const incoming = msg.participant;
        if (
          incoming.id !== this.clientId &&
          incoming.name === this.name &&
          this.clientId > incoming.id &&
          this.handleNameCollision(nextParticipants)
        ) {
          return;
        }
        this.update({ participants: nextParticipants });
        if (incoming.id !== this.clientId && this.room && this.ws?.readyState === WebSocket.OPEN) {
          this.sendNow({
            t: "profile",
            room: this.room,
            clientId: this.clientId,
            name: this.name,
            avatar: this.avatar,
            color: this.color,
          });
        }
        if (
          incoming.id !== this.clientId &&
          this.lastSentInvite &&
          this.snapshot.hostClientId === this.clientId &&
          this.room &&
          this.ws?.readyState === WebSocket.OPEN
        ) {
          this.sendNow({
            t: "invite",
            room: this.room,
            clientId: this.clientId,
            invite: this.lastSentInvite,
          });
        }
        return;
      }
      case "participant-left": {
        const leftName =
          msg.name ??
          this.snapshot.participants.find((p) => p.id === msg.clientId)?.name ??
          "Someone";
        this.emit({ kind: "participant-left", clientId: msg.clientId, name: leftName });
        this.update({
          participants: this.snapshot.participants.filter((p) => p.id !== msg.clientId),
        });
        return;
      }
      case "participant-ready":
        this.update({
          participants: this.snapshot.participants.map((p) =>
            p.id === msg.clientId ? { ...p, ready: msg.ready } : p,
          ),
        });
        return;
      case "participant-profile":
        this.update({
          participants: this.snapshot.participants.map((p) =>
            p.id === msg.participant.id
              ? {
                  ...p,
                  name: msg.participant.name,
                  avatar: msg.participant.avatar,
                  color: msg.participant.color,
                }
              : p,
          ),
        });
        return;
      case "state":
        this.localizeStateClock(msg.state, msg.srvAt);
        this.update({ syncState: msg.state });
        this.emit({ kind: "incoming-state", state: msg.state });
        return;
      case "cmd":
        this.emit({ kind: "incoming-command", from: msg.from, command: msg.command });
        return;
      case "chat":
        this.emit({ kind: "chat", from: msg.from, name: msg.name, text: msg.text, at: msg.at });
        return;
      case "invite":
        if (msg.from === this.clientId) return;
        this.emit({
          kind: "invite",
          from: msg.from,
          name: msg.name,
          invite: msg.invite,
          at: msg.at,
        });
        return;
      case "host-leaving":
        this.emit({ kind: "host-leaving", from: msg.from, name: msg.name, at: msg.at });
        return;
      case "summon":
        this.emit({
          kind: "summon",
          from: msg.from,
          name: msg.name,
          target: msg.target,
          at: msg.at,
        });
        return;
      case "cursor":
        this.emit({
          kind: "cursor",
          from: msg.from,
          name: msg.name,
          x: msg.x,
          y: msg.y,
          visible: msg.visible,
          path: msg.path,
        });
        return;
      case "draw":
        this.emit({
          kind: "draw",
          from: msg.from,
          name: msg.name,
          strokeId: msg.strokeId,
          phase: msg.phase,
          x: msg.x,
          y: msg.y,
          color: msg.color,
          path: msg.path,
        });
        return;
      case "presence":
        this.emit({
          kind: "presence",
          from: msg.from,
          activeAt: msg.activeAt,
          location: msg.location,
        });
        return;
      case "error":
        this.update({ state: "error", lastError: msg.message });
        return;
      case "pong":
        this.recordPong(msg.srvAt);
        return;
    }
  }

  private send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendNow(msg);
      return;
    }
    if (
      msg.t === "cursor" ||
      msg.t === "draw" ||
      msg.t === "ping" ||
      msg.t === "presence" ||
      msg.t === "leave" ||
      msg.t === "hello" ||
      msg.t === "profile" ||
      msg.t === "claim-host"
    ) {
      return;
    }
    if (msg.t === "state") {
      this.outQueue = this.outQueue.filter((m) => m.t !== "state");
    }
    this.outQueue.push(msg);
  }

  private sendNow(msg: ClientMessage) {
    this.ws?.send(JSON.stringify(msg));
  }

  private flushOutQueue() {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    const queue = this.outQueue;
    this.outQueue = [];
    for (const m of queue) this.sendNow(m);
  }

  private handleNameCollision(participants: Participant[]): boolean {
    if (this.renameAttempts >= MAX_RENAME_ATTEMPTS) return false;
    const others = participants.filter((p) => p.id !== this.clientId);
    const taken = new Set(others.map((p) => p.name));
    if (!taken.has(this.name)) return false;
    let n = 2;
    let candidate = `${this.originalName} (${n})`;
    while (taken.has(candidate)) {
      n += 1;
      candidate = `${this.originalName} (${n})`;
    }
    this.name = candidate;
    this.renameAttempts += 1;
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.room) {
      this.send({ t: "leave", room: this.room, clientId: this.clientId });
    }
    this.intentional = true;
    this.cleanup();
    this.intentional = false;
    if (this.room) {
      window.setTimeout(() => this.openSocket(), RENAME_RECONNECT_MS);
    }
    return true;
  }

  private sendPing() {
    if (this.ws?.readyState !== WebSocket.OPEN || !this.room) return;
    this.pingSentAt = Date.now();
    this.sendNow({ t: "ping", room: this.room, clientId: this.clientId });
  }

  private startPing() {
    this.stopPing();
    this.pingTimer = window.setInterval(() => {
      if (this.lastInboundAt && Date.now() - this.lastInboundAt > LIVENESS_TIMEOUT_MS) {
        try {
          this.ws?.close();
        } catch {
          /* ignore */
        }
        return;
      }
      this.sendPing();
    }, PING_INTERVAL_MS);
  }

  private recordPong(srvAt: number | undefined) {
    if (typeof srvAt !== "number" || this.pingSentAt === 0) return;
    const rtt = Date.now() - this.pingSentAt;
    if (rtt < 0 || rtt > 10_000) return;
    const sample = srvAt - (this.pingSentAt + rtt / 2);
    if (!this.haveRttOffset) {
      this.relayOffset = sample;
      this.haveRttOffset = true;
    } else {
      this.relayOffset = this.relayOffset! * 0.7 + sample * 0.3;
    }
    this.pingSentAt = 0;
  }

  private localizeStateClock(state: SyncState, srvAt: number | undefined) {
    if (typeof srvAt !== "number") return;
    if (this.relayOffset == null) this.relayOffset = srvAt - Date.now();
    state.updatedAt = srvAt - this.relayOffset;
  }

  private resetClockState() {
    this.pingSentAt = 0;
    this.relayOffset = null;
    this.haveRttOffset = false;
  }

  private stopPing() {
    if (this.pingTimer != null) {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect() {
    if (this.intentional || this.terminal) return;
    if (this.reconnectTimer != null) return;
    const exp = Math.min(RECONNECT_BASE_MS * 2 ** this.reconnectAttempt, RECONNECT_MAX_MS);
    const jitter = Math.random() * 0.3 * exp;
    const delay = exp + jitter;
    this.reconnectAttempt += 1;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket();
    }, delay);
  }

  private failAttempt() {
    if (this.attemptResolved) return;
    this.attemptResolved = true;
    this.clearWatchdog();
    this.failStreak += 1;
    const limit = this.everJoined ? MAX_FAIL_STREAK * 3 : MAX_FAIL_STREAK;
    if (this.failStreak >= limit) {
      void this.goTerminal();
      return;
    }
    this.update({ state: "connecting" });
    this.scheduleReconnect();
  }

  private armWatchdog() {
    this.clearWatchdog();
    this.connectWatchdog = window.setTimeout(() => {
      this.connectWatchdog = null;
      if (this.joinedThisAttempt || this.attemptResolved) return;
      try {
        this.ws?.close();
      } catch {
        /* ignore */
      }
      this.failAttempt();
    }, CONNECT_TIMEOUT_MS);
  }

  private clearWatchdog() {
    if (this.connectWatchdog != null) {
      window.clearTimeout(this.connectWatchdog);
      this.connectWatchdog = null;
    }
  }

  private async goTerminal() {
    this.terminal = true;
    this.stopPing();
    this.clearWatchdog();
    if (this.reconnectTimer != null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    try {
      this.ws?.close();
    } catch {
      /* ignore */
    }
    this.ws = null;
    this.update({ state: "error", lastError: await diagnoseRelayFailure(this.httpBase()) });
  }

  private httpBase(): string {
    const b = this.url
      .trim()
      .replace(/^wss:\/\//i, "https://")
      .replace(/^ws:\/\//i, "http://")
      .replace(/\/+$/, "");
    return /^https?:\/\//i.test(b) ? b : `https://${b}`;
  }

  private cleanup() {
    this.stopPing();
    this.clearWatchdog();
    if (this.reconnectTimer != null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
  }

  private update(patch: Partial<RoomSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.emit({ kind: "snapshot", snapshot: this.snapshot });
  }

  private emit(event: RoomEvent) {
    for (const l of this.listeners) l(event);
  }
}
