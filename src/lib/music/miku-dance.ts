/** ANIMATION STORYBOARD
 * Most of the song → headphones and beat-driven nods.
 * A percussion lift at a phrase boundary → hands down → dance with that section.
 * A weak beat estimate never dissolves a dance. Carry its clock to the exit.
 * Pause → finish the gesture → hands down, with one opaque pose throughout.
 * The next song starts after the last dance actually performed, not after
 * the previous song's first routine. Skipped songs do not consume a dance.
 */
type DanceStops = { everyBeats: number; frameOffsets: readonly number[]; frames: number };
type DanceRepertoire = {
  loopFrames: readonly number[];
  loopBeats: readonly number[];
  breaksMs: readonly number[];
  stopExits: readonly (DanceStops | null)[];
};

export const MIKU_DANCE = {
  columns: 9, rows: [19, 25], frameWidths: [288, 384], reachFrames: 41, loopFrames: [64, 76], exitFrames: 41,
  prepareMs: 240, enterMs: 1100, leaveMs: 1000, recoverMs: 320,
  loopBeats: [2, 8], minimumEnergy: 0.5,
  firstWaitMs: 8000, breaksMs: [16000, 18000], minimumTrackBeats: 16,
  minimumDanceBeats: 8, minimumDanceMs: 20000, maximumDanceMs: 60000, defaultPeriodMs: 500,
  sectionLossGraceMs: 700, sectionLossGraceBeats: 1, quietEnergy: .35,
  quietGraceMs: 1400, quietGraceBeats: 4,
  stopLoopMs: 900, lowerMs: 680, entryRestFrame: 24, exitRestFrame: 19,
  phaseRecoveryMs: 700, maximumPhaseCorrection: 0.12,
  minimumDanceFit: .72, continuingDanceFit: .55,
  stopExits: [{ everyBeats: 1, frameOffsets: [105, 146], frames: 20 }, { everyBeats: 2, frameOffsets: [117, 158, 178, 198], frames: 20 }] as readonly (DanceStops | null)[],
} as const;

// The approved Classic MMD hands use the shared complete dance atlas layout.
export const MIKU_CLASSIC_MMD_DANCE = MIKU_DANCE;

type Stage = "listening" | "preparing" | "entering" | "dancing" | "leaving" | "recovering" | "lowering" | "disengaging";
type Pulse = { beat: number; locked: boolean; excitement: number; period?: number | null; highlight?: boolean; danceFit?: number };
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const ease = (n: number) => { const t = clamp(n); return t * t * t * (t * (t * 6 - 15) + 10); };

export function createMikuDanceMemory(initialKind = 0, repertoire: DanceRepertoire = MIKU_DANCE) {
  const first = Number.isInteger(initialKind) && initialKind >= 0 && initialKind < repertoire.loopFrames.length ? initialKind : 0;
  return {
    next: first,
    lastPerformed: null as number | null,
    track: null as string | null,
    remainingMs: Number(MIKU_DANCE.firstWaitMs),
  };
}

export function createMikuDance(initial: number | ReturnType<typeof createMikuDanceMemory> = 0, repertoire: DanceRepertoire = MIKU_DANCE) {
  const memory = typeof initial === "number" ? createMikuDanceMemory(initial, repertoire) : initial;
  if (!Number.isInteger(memory.next) || memory.next < 0 || memory.next >= repertoire.loopFrames.length) memory.next = 0;
  if (!Number.isInteger(memory.lastPerformed) || memory.lastPerformed! < 0 || memory.lastPerformed! >= repertoire.loopFrames.length) memory.lastPerformed = null;
  let stage: Stage = "listening", kind = memory.next, elapsed = 0, listened = 0;
  let previous: number | null = null, frame = 0, opacity = 0, listening = 1;
  let period: number = MIKU_DANCE.defaultPeriodMs;
  let handoffPeriod = period;
  let stopping = false, stopRate = 1, lowerFrom = 0, lowerTo = 0;
  let stopExit: number | null = null;
  let changingTrack = false;
  let performedSection = false;
  let performBeats = 16;
  let danceMs = 0, sectionLostMs = 0, quietMs = 0, sectionExitBeats: number | null = null;
  let prepareBeats = 0.28, enterBeats = 1.72, leaveBeats = 1, recoverBeats = 0.28;
  const rememberDance = () => {
    // Cycle the approved routines, including across track changes.
    if (!changingTrack) {
      memory.lastPerformed = kind;
      memory.next = (kind + 1) % repertoire.loopFrames.length;
      memory.remainingMs = repertoire.breaksMs[kind];
    }
  };
  const reset = () => {
    stage = "listening"; kind = memory.next; elapsed = listened = frame = opacity = 0;
    previous = null; listening = 1; stopping = false; stopRate = 1; stopExit = null;
    performedSection = false; changingTrack = false; danceMs = sectionLostMs = quietMs = 0; sectionExitBeats = null;
  };
  return {
    get next() { return kind; },
    reset,
    selectTrack(key: string) {
      if (memory.track === key) return;
      memory.track = key;
      if (memory.lastPerformed !== null) memory.next = (memory.lastPerformed + 1) % repertoire.loopFrames.length;
      memory.remainingMs = Math.max(memory.remainingMs, MIKU_DANCE.firstWaitMs);
      listened = 0; previous = null; performedSection = false;
      // Choose the next song's routine now, but finish the outgoing arm
      // gesture before handing over to it. Seeking the same song does neither.
      changingTrack = stage !== "listening";
      if (!changingTrack) kind = memory.next;
    },
    advance(milliseconds: number, pulse: Pulse, active: boolean, ready: boolean) {
      if (changingTrack && stage === "listening") changingTrack = false;
      active = active && !changingTrack;
      const wallMs = Math.max(0, Number.isFinite(milliseconds) ? milliseconds : 0);
      const ms = Math.min(250, wallMs);
      const beat = Number.isFinite(pulse.beat) ? pulse.beat : 0;
      const excitement = Number.isFinite(pulse.excitement) ? clamp(pulse.excitement) : 0;
      const last = previous;
      if (!changingTrack && !stopping && active && pulse.locked && typeof pulse.period === "number" && Number.isFinite(pulse.period) && pulse.period >= 250 && pulse.period <= 1000) period = pulse.period;
      // A missed render cannot slow the music. Carry the full clock through
      // the loop, while keeping arm handoffs bounded so they remain visible.
      const expected = (stage === "dancing" && active && !stopping ? wallMs : ms) / period;
      const measured = last === null ? 0 : beat - last;
      // The meter may miss frames or temporarily lose its tempo estimate.
      // Continue this gesture on the last measured tempo instead of freezing,
      // dissolving to a second body, or jumping to a different arm position.
      const following = active && !stopping && pulse.locked && last !== null &&
        measured > 0 && measured >= expected * 0.25 && measured <= expected * 2;
      let delta = following ? measured : expected;
      if (stage === "dancing" && following) {
        // After a confidence gap or clock rebase, deltas alone retain the
        // old phase error forever. Rejoin the nearest drum gradually without
        // reversing hands, restarting a phrase or speeding through an exit.
        const difference = beat - (elapsed + delta);
        const error = difference - Math.round(difference);
        const correction = error * (1 - Math.exp(-ms / MIKU_DANCE.phaseRecoveryMs));
        const limit = expected * MIKU_DANCE.maximumPhaseCorrection;
        // The incoming beat may already be correcting its phase. Bound the
        // total adjustment, rather than adding another speed change to it.
        delta = expected + Math.max(-limit, Math.min(limit, delta + correction - expected));
      }
      previous = beat;
      const driving = active && pulse.locked;
      // A strong section can be excellent for nodding yet unsuitable for the
      // playful loops. Audio callers always provide the measured rhythmic fit.
      const fitThreshold = stage === "listening" ? MIKU_DANCE.minimumDanceFit : MIKU_DANCE.continuingDanceFit;
      const suitable = pulse.danceFit === undefined || pulse.danceFit >= fitThreshold;
      const highlight = pulse.highlight === true && suitable;
      if (!highlight && stage === "listening") performedSection = false;
      let resting = false;
      const lower = (to: number) => {
        lowerFrom = frame; lowerTo = to; elapsed = 0; stage = "lowering";
      };
      if (!active && !stopping && stage !== "listening" && stage !== "recovering") {
        stopping = true;
        if (stage === "entering") lower(MIKU_DANCE.entryRestFrame);
        if (stage === "dancing") {
          const stops = repertoire.stopExits[kind];
          const interval = stops?.everyBeats ?? repertoire.loopBeats[kind];
          const boundary = Math.ceil((elapsed + 0.001) / interval);
          performBeats = boundary * interval;
          // Longer routines have authored short exits at gesture boundaries.
          // Finish at the current tempo, then lower; never race the full loop.
          stopExit = stops ? stops.frameOffsets[boundary % stops.frameOffsets.length] : null;
          stopRate = stops ? 1 : Math.max(1, (performBeats - elapsed) * period / MIKU_DANCE.stopLoopMs);
        }
        if (stage === "leaving") {
          lower(MIKU_DANCE.reachFrames + repertoire.loopFrames[kind] + MIKU_DANCE.exitRestFrame);
        }
      }
      if (stage === "lowering") {
        elapsed += ms;
        opacity = 1; listening = 0;
        frame = Math.round(lowerFrom + (lowerTo - lowerFrom) * clamp(elapsed / MIKU_DANCE.lowerMs));
        if (elapsed >= MIKU_DANCE.lowerMs) {
          stage = "listening"; kind = memory.next; listened = 0; opacity = 0; listening = 1;
          stopping = false; stopRate = 1; resting = true;
        }
      } else if (stage === "listening") {
        opacity = 0; listening = 1;
        stopping = false; stopRate = 1; stopExit = null;
        if (driving) {
          listened += delta;
          memory.remainingMs = Math.max(0, memory.remainingMs - ms);
        } else listened = 0;
        const boundary = last !== null && Math.floor(beat / 4) > Math.floor(last / 4);
        if (driving && highlight && !performedSection && ready && boundary && memory.remainingMs === 0 && listened >= MIKU_DANCE.minimumTrackBeats && excitement >= MIKU_DANCE.minimumEnergy) {
          // Keep the sample's fractional beat, so the dance lands on the
          // measured drum pulse rather than starting a separate local clock.
          stage = "preparing"; elapsed = beat % 4;
          handoffPeriod = period;
          performedSection = true; danceMs = sectionLostMs = quietMs = 0; sectionExitBeats = null;
          // Whole loops keep the hands aligned with the outgoing transition.
          // The arrangement chooses the exit; the cap prevents one unchanging
          // loud recording from turning into an entire song of dancing.
          const loop = repertoire.loopBeats[kind];
          performBeats = Math.max(1, Math.round(MIKU_DANCE.maximumDanceMs / period / loop)) * loop;
          const entrance = Math.max(1, Math.round(MIKU_DANCE.enterMs / period));
          prepareBeats = Math.min(entrance * 0.3, MIKU_DANCE.prepareMs / period);
          enterBeats = entrance - prepareBeats;
          leaveBeats = Math.max(1, Math.round(MIKU_DANCE.leaveMs / period));
          recoverBeats = MIKU_DANCE.recoverMs / period;
        }
      } else {
        // Finish a handoff at the tempo it began. A corrected tempo estimate
        // mid-reach must not stretch the hands-down pose or rush the wrists.
        elapsed += stage === "disengaging" ? ms : stage === "dancing" ? delta * stopRate : ms / handoffPeriod;
        if (stage === "preparing") {
          listening = 1 - ease(elapsed / prepareBeats);
          if (elapsed >= prepareBeats) {
            elapsed -= prepareBeats; stage = "entering";
            if (stopping) { frame = 0; opacity = 1; listening = 0; lower(MIKU_DANCE.entryRestFrame); }
          }
        }
        if (stage === "entering") {
          listening = 0; opacity = 1;
          // Authored release, brief hands-down rest, then a moving dance pose.
          frame = Math.round(clamp(elapsed / enterBeats) * (MIKU_DANCE.reachFrames - 1));
          if (elapsed >= enterBeats) {
            elapsed = (elapsed - enterBeats) * handoffPeriod / period;
            stage = "dancing"; rememberDance();
          }
        }
        if (stage === "dancing") {
          if (!stopping) {
            // Classifier/fit fluctuations get a full bout. Sustained quiet
            // percussion can still end it early; transport stops bypass this.
            danceMs += wallMs;
            sectionLostMs = highlight ? 0 : sectionLostMs + wallMs;
            quietMs = excitement <= MIKU_DANCE.quietEnergy ? quietMs + wallMs : 0;
            const grace = Math.max(MIKU_DANCE.sectionLossGraceMs, period * MIKU_DANCE.sectionLossGraceBeats);
            const quietGrace = Math.max(MIKU_DANCE.quietGraceMs, period * MIKU_DANCE.quietGraceBeats);
            const ending = quietMs >= quietGrace || (danceMs >= MIKU_DANCE.minimumDanceMs && sectionLostMs >= grace);
            if (ending && elapsed >= MIKU_DANCE.minimumDanceBeats) {
              const loop = repertoire.loopBeats[kind];
              sectionExitBeats ??= Math.ceil(elapsed / loop) * loop;
            } else sectionExitBeats = null;
          }
          const endBeats = stopping ? performBeats : Math.min(performBeats, sectionExitBeats ?? Infinity);
          const cycle = (elapsed / repertoire.loopBeats[kind]) % 1;
          frame = MIKU_DANCE.reachFrames + Math.floor(cycle * repertoire.loopFrames[kind]);
          if (elapsed >= endBeats) {
            if (!stopping && sectionExitBeats !== null) performedSection = false;
            elapsed -= endBeats; stopRate = 1;
            stage = stopExit === null ? "leaving" : "disengaging";
            handoffPeriod = period;
            leaveBeats = Math.max(1, Math.round(MIKU_DANCE.leaveMs / handoffPeriod));
            recoverBeats = MIKU_DANCE.recoverMs / handoffPeriod;
            // A delayed render can overshoot the beat boundary. Begin the
            // lower at its matching pose instead of skipping its first frames.
            elapsed = stage === "disengaging" ? 0 : Math.min(elapsed, ms / handoffPeriod);
          }
        }
        if (stage === "leaving") {
          // The exit finishes the gesture before reaching the cups; it is a
          // separate performance, not the entrance played in reverse.
          frame = MIKU_DANCE.reachFrames + repertoire.loopFrames[kind]
            + Math.round(clamp(elapsed / leaveBeats) * (MIKU_DANCE.exitFrames - 1));
          if (stopping && elapsed / leaveBeats >= MIKU_DANCE.exitRestFrame / (MIKU_DANCE.exitFrames - 1)) {
            stage = "listening"; kind = memory.next; listened = 0; opacity = 0; listening = 1;
            stopping = false; resting = true;
          } else if (elapsed >= leaveBeats) { elapsed -= leaveBeats; stage = "recovering"; }
        }
        if (stage === "disengaging") {
          const stops = repertoire.stopExits[kind]!;
          frame = stopExit! + Math.round(clamp(elapsed / MIKU_DANCE.lowerMs) * (stops.frames - 1));
          if (elapsed >= MIKU_DANCE.lowerMs) {
            stage = "listening"; kind = memory.next; listened = 0; opacity = 0; listening = 1;
            stopping = false; stopExit = null; resting = true;
          }
        }
        if (stage === "recovering") {
          opacity = 0; listening = ease(elapsed / recoverBeats);
          if (elapsed >= recoverBeats) {
            stage = "listening"; listened = 0; listening = 1; kind = memory.next;
          }
        }
      }
      return { stage, kind, frame, opacity, listening, resting };
    },
  };
}
