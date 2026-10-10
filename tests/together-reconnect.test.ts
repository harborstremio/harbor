import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function harness() {
  let now = 100000, nextId = 0;
  const timers = new Map<number, { at: number; fn: () => void; repeat?: number }>();
  const timer = (fn: () => void, ms: number, repeat?: number) => {
    timers.set(++nextId, { at: now + ms, fn, repeat }); return nextId;
  };
  const sockets: Socket[] = [];
  class Socket {
    static OPEN = 1;
    readyState = 0;
    sent: any[] = [];
    onopen?: () => void;
    onclose?: () => void;
    onerror?: () => void;
    onmessage?: (event: { data: string }) => void;
    url: string;
    constructor(url: string) { this.url = url; sockets.push(this); }
    send(raw: string) { assert.equal(this.readyState, 1); this.sent.push(JSON.parse(raw)); }
    open() { this.readyState = 1; this.onopen?.(); }
    message(msg: any) { this.onmessage?.({ data: JSON.stringify(msg) }); }
    close() { this.readyState = 3; timer(() => this.onclose?.(), 0); }
  }
  const compiled = ts.transpileModule(readFileSync(new URL("../src/lib/together/client.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports: any = {};
  new Function("require", "exports", "window", "WebSocket", "Date", "Math", compiled)(
    (name: string) => name === "./protocol" ? { WT_PROTO: 1 } : { diagnoseRelayFailure: async () => "fixture unavailable" },
    exports, { setTimeout: timer, clearTimeout: (id: number) => timers.delete(id),
      setInterval: (fn: () => void, ms: number) => timer(fn, ms, ms), clearInterval: (id: number) => timers.delete(id) },
    Socket, { now: () => now }, Object.assign(Object.create(Math), { random: () => 0 }),
  );
  const client = new exports.TogetherClient("https://relay.test", "self", "Fixture");
  const advance = (ms: number) => {
    const target = now + ms;
    for (;;) {
      const first = [...timers].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
      if (!first) break;
      const [id, t] = first; now = t.at;
      if (t.repeat) t.at += t.repeat; else timers.delete(id);
      t.fn();
    }
    now = target;
  };
  const joined = (socket = sockets.at(-1)!) => {
    socket.open(); socket.message({ t: "joined", participants: [{ id: "self", name: "Fixture" }],
      hostClientId: "self", state: null, started: true, srvAt: now });
  };
  return { client, sockets, advance, joined };
}

test("an established room reconnects after the socket drops", () => {
  const h = harness(); h.client.join("ABC123"); h.joined();
  const first = h.sockets[0];
  h.client.claimHost(false);
  h.client.sendInvite({ mediaId: "tt123", mediaTitle: "Fixture" });
  first.close(); h.advance(0);
  assert.equal(h.client.getSnapshot().state, "connecting");
  h.advance(1000); assert.equal(h.sockets.length, 2);
  h.joined(); const next = h.sockets[1];
  assert.equal(h.client.getSnapshot().state, "joined");
  assert.equal(h.client.getSnapshot().room, "ABC123");
  assert.equal(next.url, first.url);
  assert.ok(next.sent.some(m => m.t === "hello" && m.clientId === "self"));
  assert.ok(next.sent.some(m => m.t === "claim-host"));
  assert.ok(next.sent.some(m => m.t === "invite" && m.invite.mediaId === "tt123"));
});

test("a silent established connection also reconnects after liveness timeout", () => {
  const h = harness(); h.client.join("ABC123"); h.joined();
  h.advance(51000);
  assert.equal(h.sockets.length, 2);
  assert.equal(h.client.getSnapshot().state, "connecting");
  h.joined(); assert.equal(h.client.getSnapshot().state, "joined");
});

test("leaving a joined room does not reconnect", () => {
  const h = harness(); h.client.join("ABC123"); h.joined();
  h.client.leave(); h.advance(60000);
  assert.equal(h.sockets.length, 1);
  assert.equal(h.client.getSnapshot().state, "disconnected");
  assert.equal(h.client.getSnapshot().room, null);
});

test("late events from an old room cannot close or corrupt the new connection", () => {
  const h = harness(); h.client.join("ABC123"); h.joined();
  const old = h.sockets[0];
  h.client.join("XYZ789"); const current = h.sockets[1];
  old.onerror?.();
  old.message({ t: "error", message: "old room" });
  h.advance(0);
  assert.equal(current.readyState, 0);
  assert.equal(h.client.getSnapshot().lastError, null);
  h.joined(current); h.advance(1000);
  assert.equal(h.sockets.length, 2);
  assert.equal(h.client.getSnapshot().room, "XYZ789");
  assert.equal(h.client.getSnapshot().state, "joined");
});

test("initial connection failures still stop after the existing retry limit", async () => {
  const h = harness(); h.client.join("ABC123");
  for (let i = 0; i < 4; i++) { h.sockets.at(-1)!.close(); h.advance(i === 3 ? 0 : 1000 * 2 ** i); }
  await Promise.resolve();
  assert.equal(h.sockets.length, 4);
  assert.equal(h.client.getSnapshot().state, "error");
  assert.equal(h.client.getSnapshot().lastError, "fixture unavailable");
  h.advance(60000); assert.equal(h.sockets.length, 4);
});

test("duplicate close callbacks schedule only one reconnect", () => {
  const h = harness(); h.client.join("ABC123"); h.joined();
  const first = h.sockets[0]; first.close(); first.close(); h.advance(1000);
  assert.equal(h.sockets.length, 2);
  h.joined(); h.advance(1000); assert.equal(h.sockets.length, 2);
});
