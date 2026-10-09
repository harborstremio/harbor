import type { MusicAudioMeterState } from "./audio-meter";
import { createMikuRhythm } from "./miku-rhythm";
import { createMikuSection } from "./miku-section";
import { createMikuDanceFit } from "./miku-dance-fit";

export const MIKU_TIMING = {
  lift: 780,
  settle: 900,
  headSettle: 240,
  silence: 850,
  stale: 700,
  meterGrace: 1800,
  beatGap: 180,
  maximumPhaseCorrection: 0.08,
} as const;

/** Reject outgoing-track samples, missing taps and silence before driving the character. */
export function mikuEnergy(state: MusicAudioMeterState, trackId: string, connectorId: string | null) {
  const data = state.data;
  if (state.status !== "ready" || !data?.active || data.trackId !== trackId ||
      (data.connectorId ?? null) !== connectorId) return 0;
  const channels = data.channels.map(c => c.rmsDb).filter(Number.isFinite);
  if (!channels.length) return 0;
  const rms = Math.max(...channels);
  if (rms < -55) return 0;
  const bass = data.spectrumDb?.slice(0, 3).filter(db => Number.isFinite(db) && db > -119) ?? [];
  const bassDb = bass.length ? bass.reduce((a, b) => a + b, 0) / bass.length : rms;
  return Math.max(0, Math.min(1, ((rms + 55) / 45) * 0.65 + ((bassDb + 60) / 50) * 0.35));
}

export const MIKU_ATLAS = { columns: 18, rows: 29, frames: 516, reachFrames: 41, tilts: 19 } as const;

/** A staggered, curved hand reach, then 25 nod depths at nineteen head/hair tilts.
 * Reach easing is authored into the frames; easing again would rush the middle.
 */
export function mikuFrame(lift: number, bob: number, sway: number) {
  const clamp = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  lift = clamp(lift); bob = clamp(bob);
  if (lift < 0.99) return Math.round(lift * (MIKU_ATLAS.reachFrames - 1));
  const lastTilt = MIKU_ATLAS.tilts - 1;
  const tilt = Number.isFinite(sway) ? Math.round(clamp((sway + 1) / 2) * lastTilt) : lastTilt / 2;
  return MIKU_ATLAS.reachFrames + tilt * 25 + Math.round(bob * 24);
}

/** Learn the recurring pulse from bass onsets and carry it through softer beats.
 * Before a rhythm is established, isolated transients get a small relaxed nod.
 * A steady tone never establishes a tempo; missing/silent audio stops the drive.
 */
export function createMikuGroove() {
  let bands: number[] | null = null;
  let noise = 0, kickNoise = 0, snareNoise = 0, hatNoise = 0, lastSample = 0, lastBeat = -Infinity;
  let position = 0, velocity = 0, sway = 0, swayVelocity = 0;
  let energy = 0, clock = 0, period: number | null = null, phase = 0, correction = 0, mix = 0;
  let estimatedAt = 0, confirmedAt = 0, pulseOrigin = 0;
  let proposedPeriod = 0, proposedAt = 0, proposedSince = 0, proposedCount = 0;
  let punch = 0, excitement = 0;
  let percussion = 0, highlight = false;
  let interrupted = false;
  const section = createMikuSection();
  const rhythm = createMikuRhythm();
  const danceSuitability = createMikuDanceFit();
  let danceFit = 0;
  return {
    suspend() {
      // The transport can unsubscribe before an inactive meter sample arrives.
      // Keep the outgoing pose, but learn fresh drums when playback resumes.
      interrupted = true; energy = 0;
    },
    sample(state: MusicAudioMeterState, trackId: string, connectorId: string | null, now: number) {
      energy = mikuEnergy(state, trackId, connectorId); clock = now;
      if (energy <= 0) {
        bands = null;
        if (state.status === "ready" && state.data?.trackId === trackId && !state.data.active) interrupted = true;
        return false;
      }
      if (interrupted || (lastSample && now - lastSample > MIKU_TIMING.meterGrace)) {
        // After buffering/seek, learn from the newly audible segment. Old
        // pre-seek onsets otherwise dilute a fresh rhythm for the whole window.
        bands = null; rhythm.reset(); period = null; correction = 0;
        noise = kickNoise = snareNoise = hatNoise = punch = percussion = 0;
        estimatedAt = confirmedAt = pulseOrigin = 0; lastBeat = -Infinity;
        proposedPeriod = proposedAt = proposedSince = proposedCount = 0;
        highlight = false; section.reset(); danceSuitability.reset(); danceFit = 0;
        interrupted = false;
      }
      // Kick and snare drive the nod. Upper percussion only corroborates a
      // sparse drum clock; it cannot turn fast hi-hats into double-time nods.
      const spectrum = state.data?.spectrumDb?.slice(0, 8) ?? [];
      const hasSpectrum = spectrum.filter(db => Number.isFinite(db) && db > -119).length >= 3;
      const values = hasSpectrum
        ? spectrum.map(db => Number.isFinite(db) ? Math.max(0, Math.min(1, (db + 70) / 70)) : 0)
        : [energy];
      const rise = values.map((value, index) => bands?.length === values.length ? Math.max(0, value - bands[index]) : 0);
      const kickFlux = hasSpectrum ? (Math.max(rise[0], rise[1]) > 0.004
        ? rise[0] * 0.5 + rise[1] * 0.35 + rise[2] * 0.15 : 0) : rise[0];
      // Snare attacks occupy several mid bands at once; sustained vocal tone
      // in one band must not raise the kick detector's threshold.
      const hatFlux = hasSpectrum ? ((rise[6] ?? 0) + (rise[7] ?? 0)) / 2 : 0;
      // Hi-hats spill into the upper midrange. Require a broader snare body
      // before allowing those bright ticks to influence the head-nod clock.
      const brightTick = hatFlux > 0.02 && ((rise[3] ?? 0) + (rise[4] ?? 0)) < hatFlux * 0.48;
      const accentFlux = (rise[3] ?? 0) * 0.2 + (rise[4] ?? 0) * 0.5 + (rise[5] ?? 0) * 0.3;
      const snareFlux = hasSpectrum && !brightTick && rise.slice(3, 6).filter(value => value > 0.005).length >= 2
        ? accentFlux : 0;
      const kick = Math.max(0, kickFlux - kickNoise * 0.7) / (0.04 + kickNoise * 2);
      const snare = Math.max(0, snareFlux - snareNoise * 0.7) / (0.06 + snareNoise * 2);
      const hat = Math.max(0, hatFlux - hatNoise * 0.7) / (0.04 + hatNoise * 2);
      const flux = hasSpectrum ? Math.min(1, Math.max(kick, snare * 0.85)) : kickFlux;
      const threshold = Math.max(hasSpectrum ? 0.08 : 0.012, noise * 1.6 + 0.004);
      const hit = flux > threshold && now - lastBeat >= MIKU_TIMING.beatGap;
      const dt = Math.max(1, Math.min(150, lastSample ? now - lastSample : 50));
      kickNoise += (kickFlux - kickNoise) * (1 - Math.exp(-dt / 1200));
      snareNoise += (snareFlux - snareNoise) * (1 - Math.exp(-dt / 1200));
      hatNoise += (hatFlux - hatNoise) * (1 - Math.exp(-dt / 1200));
      noise += (flux - noise) * (1 - Math.exp(-dt / 1000));
      bands = values; lastSample = now;
      // Midrange accents can punch up a nod without outvoting a steady kick
      // when choosing tempo. This also keeps vocal rhythm out of the clock.
      const rhythmFlux = hasSpectrum ? Math.min(1, Math.max(kick, snare * 0.45)) : flux;
      rhythm.push(now, rhythmFlux, Math.min(1, snare), Math.min(1, hat), accentFlux, hatFlux);
      danceSuitability.sample(now, Math.min(1, kick), Math.min(1, snare));
      if (now - estimatedAt >= 350) {
        estimatedAt = now;
        const estimate = rhythm.estimate(period);
        let accepted = !!estimate;
        const octave = !!estimate && period !== null &&
          (Math.abs(estimate.period / period - 0.5) < 0.08 || Math.abs(estimate.period / period - 2) < 0.12);
        if (estimate && period !== null && Math.abs(estimate.period - period) > period * 0.12 &&
            (octave || (estimate.confidence < 0.48 && !("votes" in estimate && Number(estimate.votes) >= 3)))) {
          // One weak alternate lag must not pull a known drum pulse toward
          // an unrelated tempo. Half/double-time aliases can correlate very
          // strongly too; require repeated support before changing octaves.
          const agrees = proposedCount > 0 && now - proposedAt < 1200 &&
            Math.abs(estimate.period - proposedPeriod) < estimate.period * 0.06;
          if (!agrees) { proposedCount = 0; proposedSince = now; }
          proposedPeriod = estimate.period; proposedAt = now; proposedCount++;
          accepted = proposedCount >= 3 && now - proposedSince >= 700;
        }
        if (estimate && accepted) {
          proposedPeriod = proposedAt = proposedSince = proposedCount = 0;
          const fraction = ((now - estimate.origin) / estimate.period) % 1;
          if (period === null) phase = fraction;
          else {
            const error = fraction - ((phase % 1 + 1) % 1);
            correction = error - Math.round(error);
          }
          // Correct a confirmed half/double-time reading directly. Averaging
          // the two would spend seconds moving at a tempo the song never had.
          period = period === null || octave ? estimate.period : period + (estimate.period - period) * 0.2;
          // Classify the drums on their measured grid, independent of how
          // gently the visible head catches up with that grid.
          pulseOrigin = now - fraction * period;
          confirmedAt = now;
        }
      }
      if (hit) {
        lastBeat = now;
        const strength = Math.max(0.28, Math.min(1, Math.sqrt(Math.max(0, flux - threshold)) * 1.15));
        punch = Math.max(punch * 0.65, strength);
        const body = hasSpectrum
          ? Math.max(...spectrum.slice(0, 3).map(db => Math.max(0, Math.min(1, (db + 55) / 50))))
          : energy;
        // Pair the attack with its actual bass level: quiet drums and a loud
        // smooth singer should not look like a new drop in the arrangement.
        percussion = Math.max(percussion, strength * 0.3 + body * 0.7);
        // Actual kick/snare arrivals gently anchor the learned pulse between
        // window estimates. Offbeat fills can add weight without pulling the
        // whole choreography off its beat or snapping the head's position.
        if (mix > 0.8 && period !== null) {
          const error = phase - Math.round(phase);
          if (Math.abs(error) < 0.2) correction = -error * 4;
        }
        // Syncopated drums can be obvious before a repeating tempo is clear.
        // Give each measured attack a visible nod, scaled by its low-end body;
        // quiet acoustic percussion stays lighter than a hard kick or 808 hit.
        if (mix < 0.2) velocity = Math.min(14, velocity + (8 + 8 * body) * strength);
      }
      return hit;
    },
    advance(milliseconds: number, driving = true, now?: number) {
      const elapsed = Math.max(0, Number.isFinite(milliseconds) ? milliseconds : 0);
      // The musical clock uses elapsed time even when a busy renderer misses
      // a frame. Bound the spring work, not the beat: dropping all time above
      // 64 ms made the character run slower than the audio under load.
      let remaining = Math.min(250, elapsed) / 1000;
      const skipped = elapsed - remaining * 1000;
      if (Number.isFinite(now)) clock = now! - elapsed;
      if (period && clock - confirmedAt < 6000) phase += skipped / period;
      clock += skipped;
      while (remaining > 0) {
        const dt = Math.min(0.008, remaining);
        clock += dt * 1000;
        const active = driving && energy > 0.04 && clock - lastSample < MIKU_TIMING.stale;
        const locked = active && period !== null && clock - confirmedAt < 6000;
        mix += ((locked ? 1 : 0) - mix) * Math.min(1, dt * 5);
        // Keep the learned clock through short gaps; confidence still gates
        // visible motion. A missed meter frame must not restart a dance phrase.
        if (period && clock - confirmedAt < 6000) {
          // Correct alignment gently. An offbeat accent must not make the
          // continuous clock race or drag while its tempo is unchanged.
          const rate = 1000 / period;
          const limit = rate * MIKU_TIMING.maximumPhaseCorrection;
          phase += dt * (rate + Math.max(-limit, Math.min(limit, correction)));
        }
        correction *= Math.exp(-dt * 2);
        punch *= Math.exp(-dt / 0.8);
        percussion *= Math.exp(-dt / 1.4);
        highlight = section.advance(dt * 1000, percussion, active, locked, period);
        const tempoEnergy = period ? Math.max(0, Math.min(1, (60000 / period - 95) / 90)) : 0;
        // Movement intensity follows percussion, not overall RMS or the vocal
        // envelope. A gentle singer over hard kicks must keep the full bounce.
        const feeling = active ? Math.max(0.12, Math.min(1,
          0.12 + (tempoEnergy * 0.52 + 0.65) * punch * (0.35 + percussion * 0.9))) : 0;
        excitement += (feeling - excitement) * Math.min(1, dt / (feeling > excitement ? 0.45 : 1.8));
        // Fast, percussive sections earn the deeper poses; breakdowns ease back.
        const amplitude = Math.min(1.06, 0.24 + excitement * 1.18);
        // Lead the spring by its frequency-dependent lag, so the visible dip
        // lands on the pulse instead of trailing it more at faster tempos.
        const angular = period ? Math.PI * 2000 / period : 0;
        // A fixed soft spring attenuates fast kicks. Tune its response to the
        // learned tempo so fast EDM gets the same authored nod range as hip-hop.
        // An isolated measured drum needs a rounded dip and recovery. The
        // fast locked spring used here before made unclocked 808 hits look
        // like short twitches whenever the tempo estimate was unavailable.
        const natural = 8 + mix * (Math.max(14, angular * 2.4) - 8);
        const stiffness = natural * natural, damping = natural * 1.8;
        const anticipation = Math.atan2(damping * angular, stiffness - angular * angular) / (Math.PI * 2) + 0.015;
        const target = mix * amplitude * (0.18 + 0.82 * (1 + Math.cos((phase + anticipation) * Math.PI * 2)) / 2);
        velocity += (stiffness * (target - position) - damping * velocity) * dt;
        position += velocity * dt;
        const swayTarget = mix * (0.38 + excitement * 0.58) * Math.sin(phase * Math.PI);
        swayVelocity += (26 * (swayTarget - sway) - 9 * swayVelocity) * dt;
        sway += swayVelocity * dt;
        if (position > 1) { position = 1; velocity = Math.min(0, velocity); }
        if (position < 0) { position = 0; velocity = 0; }
        remaining -= dt;
      }
      if (Math.abs(position) < 0.001 && Math.abs(velocity) < 0.01) position = velocity = 0;
      const measuredBeat = period ? (clock - pulseOrigin) / period : 0;
      danceFit = danceSuitability.advance(elapsed, clock, measuredBeat, period, driving && mix > .8);
      return { bob: position, sway, period, locked: mix > 0.8, excitement, beat: phase, highlight, danceFit };
    },
    reset(preservePose = false) {
      bands = null; noise = kickNoise = snareNoise = hatNoise = 0; lastSample = 0; lastBeat = -Infinity;
      if (!preservePose) position = velocity = sway = swayVelocity = 0;
      energy = clock = phase = correction = mix = estimatedAt = confirmedAt = pulseOrigin = 0; period = null; rhythm.reset();
      proposedPeriod = proposedAt = proposedSince = proposedCount = 0;
      punch = excitement = 0;
      percussion = 0; highlight = false; section.reset();
      danceSuitability.reset(); danceFit = 0;
      interrupted = false;
    },
  };
}
