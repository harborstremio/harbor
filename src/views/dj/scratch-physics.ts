export const SECONDS_PER_TURN = 1.8;
export const REVERSAL_SECONDS = 0.004;

export const RELEASE_TAU = 0.07;
export const RELEASE_SECONDS = 0.34;

export const DECAY_99 = 4.6;

export const BRAKE_FLOOR = 0.24;
export const BRAKE_CEILING = 1.6;
export const BRAKE_STOP_SHARE = 0.7;

export const SPIN_KICK = -6;
export const SPIN_TAU = 0.2;
export const SPIN_KICK_MS = 45;
export const SPIN_FLOOR = 0.4;
export const SPIN_CEILING = 1.2;

export const CLAIM_FADE = 0.006;
export const LAND_FADE = 0.012;
export const REJOIN_FADE = 0.03;

const VELOCITY_WINDOW = 0.045;
const MAX_SAMPLES = 12;

type HandSample = { at: number; position: number };

export class HandTrack {
  private samples: HandSample[] = [];

  clear(at: number, position: number): void {
    this.samples = [{ at, position }];
  }

  push(at: number, position: number): void {
    this.samples.push({ at, position });
    if (this.samples.length > MAX_SAMPLES) this.samples.shift();
  }

  velocity(now: number): number {
    const kept = this.samples.filter((sample) => now - sample.at <= VELOCITY_WINDOW);
    if (kept.length < 2) return 0;
    let sumAt = 0;
    let sumPos = 0;
    let sumAtAt = 0;
    let sumAtPos = 0;
    for (const sample of kept) {
      sumAt += sample.at;
      sumPos += sample.position;
      sumAtAt += sample.at * sample.at;
      sumAtPos += sample.at * sample.position;
    }
    const count = kept.length;
    const denom = count * sumAtAt - sumAt * sumAt;
    if (Math.abs(denom) < 1e-12) return 0;
    const slope = (count * sumAtPos - sumAt * sumPos) / denom;
    return Number.isFinite(slope) ? slope : 0;
  }
}

export function stopSeconds(beatSeconds: number, floor: number, ceiling: number): number {
  const span = Number.isFinite(beatSeconds) ? beatSeconds : 0.5;
  return Math.min(ceiling, Math.max(floor, span));
}
