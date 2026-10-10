/** Recognize sustained percussion lifts, not vocal loudness or a dance timer.
 * A section survives short fills, but a breakdown rearms the next drop.
 */
export function createMikuSection() {
  let age = 0, level = 0, baseline = 0, rising = 0, falling = 0;
  let peak = 0, highlight = false;
  return {
    advance(ms: number, strength: number, active: boolean, locked: boolean, period: number | null) {
      const dt = Math.max(0, Math.min(64, ms));
      const beat = period ?? 500;
      age += active ? dt : 0;
      level += ((active ? strength : 0) - level) * (1 - Math.exp(-dt / 650));
      baseline += (level - baseline) * (1 - Math.exp(-dt / (level < baseline ? 2200 : 14000)));
      if (!highlight) {
        const lifted = level > 0.48 && (level > baseline * 1.2 + 0.06 || level > 0.68);
        rising = active && locked && lifted ? rising + dt : Math.max(0, rising - dt * 2);
        if (age >= 4000 && rising >= Math.max(700, beat * 2)) {
          highlight = true; peak = level; falling = rising = 0;
        }
      } else {
        peak = Math.max(peak, level);
        // Four quieter beats distinguish a breakdown from a one-beat fill.
        const soft = !active || !locked || level < Math.max(0.3, peak * 0.68);
        falling = soft ? falling + dt : Math.max(0, falling - dt * 2);
        if (falling >= Math.max(1400, beat * 4)) {
          highlight = false; falling = rising = 0;
        }
      }
      return highlight;
    },
    reset() { age = level = baseline = rising = falling = peak = 0; highlight = false; },
  };
}
