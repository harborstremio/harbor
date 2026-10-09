/** The playful loops need a regular, forward-driving drum pattern.
 * A learned tempo is useful for nodding even when syncopated kicks, sparse
 * 808s or a one-drop rhythm do not suit that choreography. This measures
 * rhythmic fit; it does not guess a genre from an artist or song title.
 */
export function createMikuDanceFit() {
  const attacks: { time: number; kick: number; snare: number }[] = [];
  let started: number | null = null;
  let previous = 0, lastAttack = -Infinity;
  let score = 0;
  return {
    sample(time: number, kick: number, snare: number) {
      if (started === null) started = time;
      const strength = Math.max(kick, snare * .65);
      if (strength >= .16 && (strength > previous * 1.35 || previous < .12)) {
        // Group consecutive meter windows from one attack into one event.
        if (time - lastAttack < 150 && attacks.length) {
          const last = attacks[attacks.length - 1];
          last.kick = Math.max(last.kick, kick); last.snare = Math.max(last.snare, snare);
        } else {
          attacks.push({ time, kick, snare }); lastAttack = time;
        }
      }
      previous = strength;
      while (attacks.length && time - attacks[0].time > 14000) attacks.shift();
    },
    advance(ms: number, now: number, beat: number, period: number | null, locked: boolean) {
      let target = 0;
      if (locked && period && started !== null && now - started >= period * 8) {
        const end = Math.floor(beat) - 1, start = end - 7;
        const covered = new Set<number>(), kicked = new Set<number>();
        let aligned = 0, total = 0, alignedCount = 0, totalCount = 0;
        const tolerance = Math.min(.23, .08 + 40 / period);
        for (const attack of attacks) {
          const position = beat + (attack.time - now) / period;
          if (position < start - .3 || position > end + .3) continue;
          const nearest = Math.round(position);
          if (nearest < start || nearest > end) continue;
          const weight = Math.max(attack.kick, attack.snare * .65);
          total += weight; totalCount++;
          if (Math.abs(position - nearest) <= tolerance) {
            aligned += weight; alignedCount++; covered.add(nearest);
            if (attack.kick >= .18) kicked.add(nearest);
          }
        }
        // Quieter but distinct offbeat drums still change the groove. A few
        // loud aligned kicks must not hide those already-qualified attacks.
        const alignment = total > .5 ? Math.min(aligned / total, alignedCount / totalCount) : 0;
        // Every-beat kicks or a consistent kick/snare backbeat can carry a
        // dance. Offbeat 808 bursts and sparse drums keep the listening groove.
        const coverage = covered.size / 8, kickCoverage = kicked.size / 8;
        target = alignment * Math.min(1, coverage / .875) * Math.min(1, kickCoverage / .5);
        if (alignment < .72 || coverage < .625) target *= .45;
      }
      const dt = Math.max(0, Math.min(250, ms));
      score += (target - score) * (1 - Math.exp(-dt / (target > score ? 1600 : 2200)));
      return score;
    },
    reset() { attacks.length = 0; started = null; previous = score = 0; lastAttack = -Infinity; },
  };
}
