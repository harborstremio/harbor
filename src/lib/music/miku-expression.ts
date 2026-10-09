/** EXPRESSION STORYBOARD
 * Settle onto the headphones → close the eyes → keep feeling the music.
 * Only leaving the listening pose releases the eyelids. Beats, quiet passages
 * and delayed frames never trigger a periodic look up.
 */
const CLOSE_MS = 180;

export function createMikuExpression() {
  let age = 0;
  return {
    reset() { age = 0; },
    advance(milliseconds: number, engaged: boolean) {
      if (!engaged) {
        age = 0;
        return { closure: 0, kind: "open" as const };
      }
      age = Math.min(CLOSE_MS, age + Math.max(0, Number.isFinite(milliseconds) ? milliseconds : 0));
      const t = age / CLOSE_MS;
      return { closure: t * t * (3 - 2 * t), kind: "enjoy" as const };
    },
  };
}
