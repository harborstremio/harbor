import { invoke } from "@tauri-apps/api/core";
import workletUrl from "./scratch-worklet.js?url";
import { CLAIM_FADE, LAND_FADE, REJOIN_FADE } from "./scratch-physics";

const WINDOW_SECONDS = 24;
const LEAD_SECONDS = 9;
const SAFE_EDGE = 2.5;
const MAX_DELAY = 1.5;
const CUT_SECONDS = 0.06;
const ECHO_FEEDBACK = 0.66;
const ECHO_WET = 0.9;

type Span = { from: number; to: number };

type Rig = {
  context: AudioContext;
  node: AudioWorkletNode;
  dry: GainNode;
  send: GainNode;
  wet: GainNode;
  delay: DelayNode;
  feedback: GainNode;
};

export class Takeover {
  private rig: Rig | null = null;
  private span: Span | null = null;
  private priming: Promise<boolean> | null = null;
  private trackKey = "";
  private ticket = 0;
  private owner = 0;
  private spot = 0;
  private speed = 1;
  private holds: Promise<void> = Promise.resolve();
  private unlisten: (() => void) | null = null;

  constructor() {
    if (typeof window === "undefined") return;
    const leave = () => {
      if (this.owner !== 0) this.release(this.owner, true);
    };
    window.addEventListener("pagehide", leave);
    this.unlisten = () => window.removeEventListener("pagehide", leave);
  }

  get ready(): boolean {
    return this.rig !== null && this.span !== null;
  }

  get busy(): boolean {
    return this.owner !== 0;
  }

  get playhead(): number {
    return this.spot;
  }

  get deckRate(): number {
    return this.speed;
  }

  setDeckRate(value: number): void {
    if (Number.isFinite(value) && value >= 0) this.speed = value;
  }

  covers(position: number): boolean {
    const span = this.span;
    if (!span) return false;
    return position >= span.from + SAFE_EDGE && position <= span.to - SAFE_EDGE;
  }

  reset(trackKey: string): void {
    if (trackKey === this.trackKey) return;
    this.trackKey = trackKey;
    this.span = null;
    if (this.owner !== 0) this.release(this.owner, true);
  }

  async prime(position: number): Promise<boolean> {
    if (this.owner !== 0) return this.ready;
    if (this.covers(position)) return true;
    if (this.priming) return this.priming;
    this.priming = this.load(position).finally(() => {
      this.priming = null;
    });
    return this.priming;
  }

  claim(position: number, startRate: number): number {
    const rig = this.rig;
    if (!rig || !this.covers(position)) {
      if (this.owner !== 0) this.release(this.owner, true);
      return 0;
    }
    void rig.context.resume().catch(() => {});
    const first = this.owner === 0;
    this.ticket += 1;
    this.owner = this.ticket;
    this.spot = position;
    this.clean(rig);
    rig.node.port.postMessage({
      kind: "claim",
      position,
      rate: startRate,
      fade: CLAIM_FADE,
    });
    if (first) this.hold(true, position);
    return this.owner;
  }

  hand(ticket: number, position: number, velocity: number): void {
    if (!this.owns(ticket)) return;
    this.rig?.node.port.postMessage({ kind: "hand", position, velocity });
  }

  rate(ticket: number, value: number): void {
    if (!this.owns(ticket)) return;
    this.rig?.node.port.postMessage({ kind: "rate", rate: value });
  }

  motor(ticket: number, target: number, tau: number): void {
    if (!this.owns(ticket)) return;
    this.rig?.node.port.postMessage({ kind: "motor", target, tau });
  }

  echo(ticket: number, beat: number, seconds: number, tail: number): void {
    const rig = this.rig;
    if (!this.owns(ticket) || !rig) return;
    const at = rig.context.currentTime;
    const cut = at + beat;
    rig.delay.delayTime.setValueAtTime(beat, at);
    rig.feedback.gain.setValueAtTime(ECHO_FEEDBACK, at);
    for (const gain of [rig.dry.gain, rig.send.gain]) {
      gain.cancelScheduledValues(at);
      gain.setValueAtTime(1, at);
      gain.setValueAtTime(1, cut);
      gain.linearRampToValueAtTime(0, cut + CUT_SECONDS);
    }
    rig.wet.gain.cancelScheduledValues(at);
    rig.wet.gain.setValueAtTime(ECHO_WET, at);
    rig.wet.gain.setValueAtTime(ECHO_WET, Math.max(cut, at + seconds - tail));
    rig.wet.gain.linearRampToValueAtTime(0, at + seconds);
  }

  release(ticket: number, rejoin: boolean, at?: number): boolean {
    if (!this.owns(ticket)) return false;
    this.owner = 0;
    this.rig?.node.port.postMessage({
      kind: "release",
      fade: rejoin ? REJOIN_FADE : LAND_FADE,
    });
    this.hold(false, rejoin ? null : Math.max(0, at ?? this.spot));
    return true;
  }

  dispose(): void {
    this.unlisten?.();
    this.unlisten = null;
    if (this.owner !== 0) this.release(this.owner, true);
    const rig = this.rig;
    this.rig = null;
    this.span = null;
    rig?.node.disconnect();
    void rig?.context.close().catch(() => {});
  }

  private owns(ticket: number): boolean {
    return ticket !== 0 && ticket === this.owner;
  }

  private hold(active: boolean, position: number | null): void {
    const run = () =>
      invoke<void>("music_scratch_hold", { active, position }).catch(() => {});
    this.holds = this.holds.then(run, run);
  }

  private clean(rig: Rig): void {
    const at = rig.context.currentTime;
    rig.dry.gain.cancelScheduledValues(at);
    rig.dry.gain.setValueAtTime(1, at);
    for (const gain of [rig.send.gain, rig.wet.gain, rig.feedback.gain]) {
      gain.cancelScheduledValues(at);
      gain.setValueAtTime(0, at);
    }
  }

  private async build(): Promise<Rig | null> {
    if (this.rig) return this.rig;
    try {
      const context = new AudioContext();
      await context.audioWorklet.addModule(workletUrl);
      const node = new AudioWorkletNode(context, "harbor-scratch", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      });
      const dry = context.createGain();
      const send = context.createGain();
      const wet = context.createGain();
      const feedback = context.createGain();
      const delay = context.createDelay(MAX_DELAY + 0.5);
      dry.gain.value = 1;
      send.gain.value = 0;
      wet.gain.value = 0;
      feedback.gain.value = 0;
      node.connect(dry).connect(context.destination);
      node.connect(send).connect(delay);
      delay.connect(feedback).connect(delay);
      delay.connect(wet).connect(context.destination);
      node.port.onmessage = (event) => {
        const value = (event.data as { position?: number }).position;
        if (typeof value === "number" && Number.isFinite(value)) this.spot = value;
      };
      this.rig = { context, node, dry, send, wet, delay, feedback };
      return this.rig;
    } catch {
      return null;
    }
  }

  private async load(position: number): Promise<boolean> {
    const rig = await this.build();
    if (!rig) return false;
    const from = Math.max(0, position - LEAD_SECONDS);
    try {
      const bytes = await invoke<ArrayBuffer>("music_scratch_window", {
        start: from,
        seconds: WINDOW_SECONDS,
        rate: Math.round(rig.context.sampleRate),
      });
      const frames = new Float32Array(bytes);
      const count = Math.floor(frames.length / 2);
      if (count < rig.context.sampleRate) return false;
      const left = new Float32Array(count);
      const right = new Float32Array(count);
      for (let index = 0; index < count; index += 1) {
        left[index] = frames[index * 2];
        right[index] = frames[index * 2 + 1];
      }
      rig.node.port.postMessage({ kind: "load", left, right, origin: from }, [
        left.buffer,
        right.buffer,
      ]);
      this.span = { from, to: from + count / rig.context.sampleRate };
      return true;
    } catch {
      return false;
    }
  }
}

let shared: Takeover | null = null;
let holders = 0;

export function acquireTakeover(): Takeover {
  if (!shared) shared = new Takeover();
  holders += 1;
  return shared;
}

export function dropTakeover(): void {
  holders = Math.max(0, holders - 1);
  if (holders > 0 || !shared) return;
  shared.dispose();
  shared = null;
}
