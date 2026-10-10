import {
  BRAKE_CEILING,
  BRAKE_FLOOR,
  BRAKE_STOP_SHARE,
  DECAY_99,
  SPIN_CEILING,
  SPIN_FLOOR,
  SPIN_KICK,
  SPIN_KICK_MS,
  SPIN_TAU,
  stopSeconds,
} from "./scratch-physics";
import { acquireTakeover, dropTakeover, type Takeover } from "./takeover";

const MIN_DELAY = 0.05;
const MAX_DELAY = 1.5;
const MAX_TAIL = 4;
const TAIL_FADE = 0.3;

export type ReleaseKind = "echoOut" | "brake" | "spin";

function delaySeconds(beatMs: number): number {
  const span = Number.isFinite(beatMs) ? beatMs / 1000 : 0.5;
  return Math.min(MAX_DELAY, Math.max(MIN_DELAY, span));
}

function programSeconds(kind: ReleaseKind, beatMs: number): number {
  const beat = delaySeconds(beatMs);
  if (kind === "brake") return stopSeconds(beat, BRAKE_FLOOR, BRAKE_CEILING);
  if (kind === "spin") return stopSeconds(beat, SPIN_FLOOR, SPIN_CEILING);
  return Math.min(5, beat + Math.min(MAX_TAIL, beat * 6));
}

export class ReleaseFx {
  private deck: Takeover | null = acquireTakeover();
  private timers: number[] = [];
  private running: ReleaseKind | null = null;
  private arming = false;
  private ticket = 0;
  private done: ((value: boolean) => void) | null = null;

  get busy(): boolean {
    return this.running !== null || this.arming;
  }

  get ready(): boolean {
    return this.deck?.ready ?? false;
  }

  reset(trackKey: string): void {
    this.deck?.reset(trackKey);
  }

  async prime(position: number): Promise<boolean> {
    return this.deck ? this.deck.prime(position) : false;
  }

  async run(kind: ReleaseKind, position: number, beatMs: number): Promise<boolean> {
    const deck = this.deck;
    if (this.busy || !deck) return false;
    this.arming = true;
    const primed = await deck.prime(position);
    if (!primed || !this.deck) {
      this.arming = false;
      return false;
    }
    const ticket = deck.claim(position, deck.deckRate);
    this.arming = false;
    if (!ticket) return false;
    this.ticket = ticket;
    this.running = kind;
    const seconds = programSeconds(kind, beatMs);
    if (kind === "echoOut") {
      deck.rate(ticket, deck.deckRate);
      deck.echo(ticket, delaySeconds(beatMs), seconds, TAIL_FADE);
    } else if (kind === "brake") {
      deck.motor(ticket, 0, (seconds * BRAKE_STOP_SHARE) / DECAY_99);
    } else {
      deck.rate(ticket, SPIN_KICK);
      this.after(SPIN_KICK_MS, () => deck.motor(ticket, deck.deckRate, SPIN_TAU));
    }
    this.after(seconds * 1000, () => this.finish());
    return new Promise<boolean>((resolve) => {
      this.done = resolve;
    });
  }

  cancel(): void {
    if (this.running) this.finish();
  }

  dispose(): void {
    this.cancel();
    this.arming = false;
    this.deck = null;
    dropTakeover();
  }

  private after(ms: number, run: () => void): void {
    this.timers.push(window.setTimeout(run, ms));
  }

  private finish(): void {
    for (const timer of this.timers) window.clearTimeout(timer);
    this.timers = [];
    this.running = null;
    this.deck?.release(this.ticket, true);
    this.ticket = 0;
    const resolve = this.done;
    this.done = null;
    resolve?.(true);
  }
}
