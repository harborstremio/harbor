/** Small listening responses layered over the measured drum pulse. */
type ListeningPulse = {
  beat: number; locked: boolean; excitement: number; period: number | null;
  bob: number; sway: number; danceFit?: number;
};
type Key = readonly [beat: number, lean: number, spread: number, gain: number];
type Gesture = { name: string; keys: readonly Key[] };
const gestures: readonly Gesture[] = [
  { name: "lean-left", keys: [[0, 0, 1, 1], [.8, -.24, .72, 1], [1.35, -.24, .72, 1], [2, 0, 1, 1]] },
  { name: "lean-right", keys: [[0, 0, 1, 1], [.8, .24, .72, 1], [1.35, .24, .72, 1], [2, 0, 1, 1]] },
  { name: "center-accent", keys: [[0, 0, 1, 1], [.65, 0, .45, 1.045], [1.3, 0, .45, 1.045], [2, 0, 1, 1]] },
  { name: "left-right-reply", keys: [[0, 0, 1, 1], [.8, -.25, .62, 1], [1.35, -.25, .62, 1], [2.7, .25, .62, 1], [3.2, .25, .62, 1], [4, 0, 1, 1]] },
  { name: "right-left-reply", keys: [[0, 0, 1, 1], [.8, .25, .62, 1], [1.35, .25, .62, 1], [2.7, -.25, .62, 1], [3.2, -.25, .62, 1], [4, 0, 1, 1]] },
];
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const ease = (n: number) => { const t = clamp(n, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
function sample(gesture: Gesture, beat: number) {
  const keys = gesture.keys;
  for (let i = 1; i < keys.length; i++) if (beat <= keys[i][0]) {
    const a = keys[i - 1], b = keys[i], mix = ease((beat - a[0]) / (b[0] - a[0]));
    return [a[1] + (b[1] - a[1]) * mix, a[2] + (b[2] - a[2]) * mix, a[3] + (b[3] - a[3]) * mix];
  }
  return [0, 1, 1];
}

export function createMikuListeningPerformance() {
  let previous: number | null = null, earnedBeats = 0, quietMs = 0;
  let reaction: Gesture | null = null, reactionBeat = 0, next = 0;
  let gain = 1, lean = 0, spread = 1, strength = 0;
  const reset = (preservePose = false) => {
    previous = null; earnedBeats = quietMs = 0; reaction = null; reactionBeat = 0;
    if (!preservePose) { gain = spread = 1; lean = 0; }
  };
  return {
    reset,
    advance(milliseconds: number, pulse: ListeningPulse, engaged: boolean) {
      const ms = Math.max(0, Number.isFinite(milliseconds) ? milliseconds : 0);
      const valid = engaged && pulse.locked && pulse.period !== null && Number.isFinite(pulse.beat) && pulse.excitement > .12;
      const delta = previous === null ? 0 : pulse.beat - previous;
      const continuous = delta >= 0 && delta < 1.25 && ms < 700;
      const crossed = previous !== null && Math.floor(pulse.beat) > Math.floor(previous);
      previous = valid ? pulse.beat : null;
      if (!valid || !continuous) { reaction = null; reactionBeat = earnedBeats = quietMs = 0; }
      else {
        if (reaction) {
          reactionBeat += delta;
          if (reactionBeat >= reaction.keys.at(-1)![0]) { reaction = null; reactionBeat = 0; }
        } else { earnedBeats += delta; quietMs += ms; }
        // Leave room for ordinary nods. A busy hat pattern cannot accelerate
        // these reactions because only the already-learned beat clock enters.
        if (!reaction && crossed && earnedBeats >= 12 && quietMs >= 7500 && pulse.excitement > .38) {
          const selectedIndex = next, selected = gestures[next]; next = (next + 1) % gestures.length;
          // Sparse/syncopated drums get a planted accent, rather than the
          // playful side-to-side reply. This is rhythmic fit, not genre lookup.
          reaction = pulse.danceFit !== undefined && pulse.danceFit < .55 && selectedIndex >= 3 ? gestures[2] : selected;
          reactionBeat = 0; earnedBeats = quietMs = 0;
          strength = clamp((pulse.excitement - .18) / .6, .28, 1);
        }
      }
      const [targetLean, targetSpread, targetGain] = reaction ? sample(reaction, reactionBeat) : [0, 1, 1];
      const phrase = valid ? .96 + .04 * Math.cos(pulse.beat * Math.PI / 2) : 1;
      const weight = 1 - Math.exp(-Math.min(ms, 250) / 110);
      gain += ((phrase + (targetGain - 1) * strength) - gain) * weight;
      lean += (targetLean * strength - lean) * weight;
      spread += ((1 + (targetSpread - 1) * strength) - spread) * weight;
      return {
        bob: clamp(pulse.bob * gain, 0, 1),
        sway: clamp(pulse.sway * spread + lean, -1, 1),
        reaction: valid ? reaction?.name ?? null : null,
      };
    },
  };
}
