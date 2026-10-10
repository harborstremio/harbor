import { mikuPulseOrigin, mikuTempo, type MikuOnset } from "./miku-tempo";

/** Separate drum voices so syncopated bass cannot drown out a regular backbeat. */
export function createMikuRhythm() {
  const drums: MikuOnset[] = [], snares: MikuOnset[] = [], hats: MikuOnset[] = [];
  const accents: MikuOnset[] = [], ticks: MikuOnset[] = [];
  const votes: { time: number; period: number }[] = [];
  return {
    push(time: number, drum: number, snare: number, hat: number, accent = snare, tick = hat) {
      for (const [history, flux] of [[drums, drum], [snares, snare], [hats, hat], [accents, accent], [ticks, tick]] as const) {
        history.push({ time, flux });
        if (history.length > 192) history.shift();
      }
    },
    estimate(previous: number | null) {
      const primary = mikuTempo(drums.slice(-128), previous);
      // A clear kick/backbeat clock already gives the right musical pulse.
      if (primary && primary.confidence >= 0.48) return primary;
      // A sustained 808 can obscure individual kicks. Preserve the raw
      // mid-band attack pattern as a second cue: it may repeat over two,
      // three or four beats, rather than on every quarter note. Upper
      // percussion must corroborate the proposed pulse across several
      // windows; a single bright hi-hat pattern cannot choose the tempo.
      const now = drums.at(-1)?.time ?? 0;
      while (votes.length && now - votes[0].time > 5000) votes.shift();
      let syncopated: ReturnType<typeof mikuTempo> = null;
      // Correlation ignores amplitude. Tiny hat leakage into the mid bands
      // can correlate perfectly, so independent kick/snare evidence is
      // required before considering this fallback at all.
      const hasDrums = drums.slice(-128).filter(sample => sample.flux > 0.12).length >= 3;
      const pattern = hasDrums ? mikuTempo(accents.slice(-128), null, { min: 900, max: 2400, subdivisions: false }) : null;
      if (pattern && pattern.confidence >= 0.26) {
        const candidates = [];
        for (const beats of [2, 3, 4]) {
          const period = pattern.period / beats;
          if (period < 300 || period > 900) continue;
          const support = mikuTempo(ticks.slice(-128), null, { min: period * 0.94, max: period * 1.06, subdivisions: false });
          if (!support || support.confidence < 0.22) continue;
          votes.push({ time: now, period });
          const agreeing = votes.filter(vote => Math.abs(vote.period - period) < period * 0.05);
          if (agreeing.length < 3 || now - agreeing[0].time < 700) continue;
          candidates.push({ period, origin: mikuPulseOrigin(accents.slice(-128), period),
            confidence: Math.min(pattern.confidence, support.confidence), votes: agreeing.length });
        }
        candidates.sort((a, b) => b.votes - a.votes || b.confidence - a.confidence);
        if (candidates.length) syncopated = candidates[0];
      }
      const backbeat = mikuTempo(snares, null, { min: 450, max: 1800, subdivisions: true });
      const subdivision = mikuTempo(hats, null, { min: 140, max: 600, subdivisions: true });
      const aligned = (period: number, unit: number) => {
        const ratio = period / unit, beats = Math.round(ratio);
        return beats >= 1 && beats <= 8 && Math.abs(ratio - beats) < 0.13;
      };
      if (backbeat && backbeat.confidence >= 0.5 &&
          backbeat.confidence > (primary?.confidence ?? 0) + 0.12) {
        const period = backbeat.period / 2;
        const support = mikuTempo(hats, null, { min: period * 0.94, max: period * 1.06, subdivisions: false });
        // Hats corroborate the subdivision; they never set double time alone.
        if (period >= 300 && period <= 900 && support && support.confidence >= 0.25) {
          return { ...backbeat, period };
        }
      }
      if (!primary || primary.confidence < 0.35) {
        // A one-drop or similarly sparse groove may have only one low drum
        // per bar. Its recurring bar and eighth-note percussion must agree
        // before filling the missing quarter-note pulse.
        const bar = mikuTempo(drums, null, { min: 1800, max: 3600, subdivisions: false });
        if (bar && subdivision && bar.confidence >= 0.35 && subdivision.confidence >= 0.45) {
          const period = bar.period / 4;
          if (period >= 450 && period <= 900 && aligned(period, subdivision.period)) {
            return { ...bar, period };
          }
        }
      }
      return primary && primary.confidence >= 0.35 ? primary : syncopated ?? primary;
    },
    reset() { drums.length = snares.length = hats.length = accents.length = ticks.length = votes.length = 0; },
  };
}
