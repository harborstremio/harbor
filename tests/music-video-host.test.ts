// @ts-expect-error Node test types are outside the browser tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are outside the browser tsconfig.
import test from "node:test";
// @ts-expect-error Node test types are outside the browser tsconfig.
import { readFileSync } from "node:fs";
import ts from "typescript";

function read(file: string): string {
  return readFileSync(new URL(`../src/lib/music/${file}`, import.meta.url), "utf8");
}

function evaluate(file: string, resolve: (name: string) => unknown): any {
  const outputText = ts.transpileModule(read(file), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", outputText)(resolve, module, module.exports);
  return module.exports;
}

class FakeNode {
  parentElement: FakeNode | null = null;
  children: FakeNode[] = [];
  listeners = new Map<string, Set<() => void>>();
  attrs = new Map<string, string>();
  style = { cssText: "" };
  className = "";
  playsInline = false;
  preload = "";
  disablePictureInPicture = false;
  muted = false;
  volume = 1;
  currentTime = 0;
  duration = 200;
  playbackRate = 1;
  seeking = false;
  readyState = 4;
  paused = true;
  loads = 0;
  get src(): string {
    return this.attrs.get("src") ?? "";
  }
  set src(value: string) {
    this.attrs.set("src", value);
    this.loads += 1;
  }
  getAttribute(name: string): string | null {
    return this.attrs.has(name) ? this.attrs.get(name)! : null;
  }
  setAttribute(name: string, value: string): void {
    this.attrs.set(name, value);
  }
  hasAttribute(name: string): boolean {
    return this.attrs.has(name);
  }
  removeAttribute(name: string): void {
    this.attrs.delete(name);
  }
  addEventListener(type: string, fn: () => void): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn);
  }
  removeEventListener(type: string, fn: () => void): void {
    this.listeners.get(type)?.delete(fn);
  }
  count(type: string): number {
    return this.listeners.get(type)?.size ?? 0;
  }
  dispatch(type: string): void {
    // Snapshot emulates dispatch: subscriptions can change inside a callback.
    // eslint-disable-next-line unicorn/no-useless-spread
    for (const fn of [...(this.listeners.get(type) ?? [])]) fn();
  }
  appendChild(node: FakeNode): FakeNode {
    node.parentElement?.remove(node);
    node.parentElement = this;
    this.children.push(node);
    return node;
  }
  remove(node: FakeNode): void {
    this.children = this.children.filter((child) => child !== node);
  }
  append(...nodes: FakeNode[]): void {
    for (const node of nodes) this.appendChild(node);
  }
  insertBefore(node: FakeNode, ref: FakeNode | null): FakeNode {
    node.parentElement?.remove(node);
    node.parentElement = this;
    const at = ref ? this.children.indexOf(ref) : -1;
    if (at < 0) this.children.push(node);
    else this.children.splice(at, 0, node);
    return node;
  }
  get firstChild(): FakeNode | null {
    return this.children[0] ?? null;
  }
  play(): Promise<void> {
    this.paused = false;
    return Promise.resolve();
  }
  pause(): void {
    this.paused = true;
  }
  load(): void {}
}

function loadHost() {
  const body = new FakeNode();
  (globalThis as any).document = { createElement: () => new FakeNode(), body };
  const reports: any[] = [];
  let controller: any = null;
  let registrations = 0;
  const sync = evaluate("video-sync.ts", (name: string) => {
    throw Error(name);
  });
  const host = evaluate("video-host.ts", (name: string) => {
    if (name === "./video-sync") return sync;
    if (name === "./player")
      return {
        reportMusicVideoPlayback: (report: any) => {
          reports.push(report);
        },
        setMusicVideoController: (next: any) => {
          controller = next;
          registrations += 1;
          return () => {
            if (controller === next) controller = null;
          };
        },
      };
    throw Error(name);
  });
  return { host, body, reports, controller: () => controller, registrations: () => registrations };
}

const stream = {
  url: "https://example.test/picture.mp4",
  audioUrl: "https://example.test/sound.m4a",
} as any;

test("setting the source wires the dock to the session, not to whatever screen is mounted", () => {
  const { host, reports, controller } = loadHost();
  const nodes = host.setMusicVideoHostSource("youtube:a", stream);
  assert.ok(nodes, "the host produced no media elements");
  assert.equal(nodes.video.playsInline, true);
  assert.equal(nodes.video.muted, true, "a separate audio track must mute the picture");
  assert.ok(controller(), "no controller reached the dock");
  nodes.audio.currentTime = 41.5;
  nodes.audio.dispatch("timeupdate");
  assert.deepEqual(reports.at(-1), { currentTime: 41.5, duration: 200 });
  host.releaseMusicVideoHostSource("youtube:a");
});

test("parking every surface leaves the transport alive, so the dock never freezes off-page", () => {
  const { host, reports, controller } = loadHost();
  const nodes = host.setMusicVideoHostSource("youtube:a", stream);
  const before = nodes.audio.count("timeupdate");
  host.parkMusicVideoHost();
  assert.equal(nodes.audio.count("timeupdate"), before, "parking tore the clock listeners down");
  assert.ok(controller(), "parking stranded the dock with a null controller");
  nodes.audio.currentTime = 90;
  nodes.audio.dispatch("timeupdate");
  assert.deepEqual(reports.at(-1), { currentTime: 90, duration: 200 });
  controller().setPaused(true);
  assert.equal(nodes.audio.paused, true, "the dock's pause never reached the parked audio");
  assert.equal(nodes.video.paused, true, "the dock's pause never reached the parked picture");
  controller().seek(12);
  assert.equal(nodes.audio.currentTime, 12);
  assert.equal(nodes.video.currentTime, 12);
  controller().setVolume(0.25);
  assert.equal(nodes.audio.volume, 0.25);
  host.releaseMusicVideoHostSource("youtube:a");
});

test("a song that ends with no surface mounted still advances the queue", () => {
  const { host, reports } = loadHost();
  const nodes = host.setMusicVideoHostSource("youtube:a", stream);
  host.parkMusicVideoHost();
  nodes.audio.dispatch("ended");
  assert.deepEqual(reports.at(-1), { ended: true });
  host.releaseMusicVideoHostSource("youtube:a");
});

test("a handoff re-parents the same elements without reloading or rewiring them", () => {
  const { host, body, controller, registrations } = loadHost();
  const nodes = host.setMusicVideoHostSource("youtube:a", stream);
  const loads = nodes.video.loads;
  const registered = registrations();
  const watch = new FakeNode();
  const restore = host.adoptMusicVideoHost(watch);
  assert.equal(nodes.video.parentElement, watch);
  assert.equal(nodes.audio.parentElement, watch);
  const popout = new FakeNode();
  host.adoptMusicVideoHost(popout);
  restore();
  assert.equal(
    nodes.video.parentElement,
    popout,
    "the losing surface's cleanup stole the picture back",
  );
  assert.equal(host.musicVideoHostSource("youtube:a"), stream);
  host.setMusicVideoHostSource("youtube:a", stream);
  assert.equal(
    nodes.video.loads,
    loads,
    "the same stream was assigned twice and reloaded the decoder",
  );
  assert.equal(
    registrations(),
    registered + 1,
    "re-asserting the source left a second controller behind",
  );
  assert.ok(controller());
  assert.equal(body.children.length, 1, "the park anchor left the document");
  host.releaseMusicVideoHostSource("youtube:a");
});

test("only the session that owns the source may end it, and ending it really does tear down", () => {
  const { host, controller } = loadHost();
  const nodes = host.setMusicVideoHostSource("youtube:a", stream);
  host.releaseMusicVideoHostSource("youtube:b");
  assert.ok(controller(), "a stale key was allowed to kill a live session");
  assert.equal(host.musicVideoHostSource("youtube:a"), stream);
  host.releaseMusicVideoHostSource("youtube:a");
  assert.equal(
    controller(),
    null,
    "the controller outlived the session and will fight the audio engine",
  );
  assert.equal(nodes.audio.count("timeupdate"), 0);
  assert.equal(nodes.audio.count("ended"), 0);
  assert.equal(nodes.video.paused, true);
  assert.equal(nodes.audio.hasAttribute("src"), false);
  assert.equal(host.musicVideoHostSource("youtube:a"), null);
});

test("a picture with no separate audio track is its own clock and is left unmuted", () => {
  const { host, reports, controller } = loadHost();
  const nodes = host.setMusicVideoHostSource("youtube:a", {
    url: "https://example.test/only.mp4",
    audioUrl: null,
  } as any);
  assert.equal(nodes.video.muted, false);
  nodes.video.currentTime = 7;
  nodes.video.dispatch("timeupdate");
  assert.deepEqual(reports.at(-1), { currentTime: 7, duration: 200 });
  controller().setVolume(0.5);
  assert.equal(nodes.video.volume, 0.5);
  host.releaseMusicVideoHostSource("youtube:a");
});
