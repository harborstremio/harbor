type SoundTheme = "none" | "glass" | "modern" | "retro" | "cinematic";

class SoundEffects {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;
  private currentVolume = 0.5;
  private activeTheme: SoundTheme = "none";
  private lastTurnAt = 0;

  constructor() {
    if (typeof window === "undefined") return;
    const unlock = () => {
      if (this.activeTheme === "none") return;
      this.getCtx();
    };
    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
    window.addEventListener("touchstart", unlock, true);
  }

  setTheme(theme: SoundTheme) {
    this.activeTheme = theme;
  }

  setVolume(volume: number) {
    this.currentVolume = Math.max(0, Math.min(1, volume));
    if (this.masterGain) this.masterGain.gain.value = this.muted ? 0 : this.currentVolume;
  }

  private getCtx() {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.currentVolume;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  private playTone(freq: number, type: OscillatorType, dur: number, vol: number) {
    if (this.muted) return;
    const c = this.getCtx();
    if (!c || !this.masterGain) return;
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + dur * 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(this.masterGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.01);
  }

  private playGlass({ freq = 880, dur = 0.5, vol = 0.05, modRatio = 2.76, modDepth = 6 }) {
    if (this.muted) return;
    const c = this.getCtx();
    if (!c || !this.masterGain) return;
    const t0 = c.currentTime;
    const carrier = c.createOscillator();
    const modulator = c.createOscillator();
    const modGain = c.createGain();
    const filter = c.createBiquadFilter();
    const amp = c.createGain();
    carrier.type = "sine";
    carrier.frequency.setValueAtTime(freq, t0);
    modulator.type = "sine";
    modulator.frequency.setValueAtTime(freq * modRatio, t0);
    modGain.gain.setValueAtTime(modDepth, t0);
    modGain.gain.exponentialRampToValueAtTime(0.01, t0 + dur * 0.6);
    modulator.connect(modGain).connect(carrier.frequency);
    filter.type = "lowpass";
    filter.frequency.value = 4000;
    amp.gain.setValueAtTime(0, t0);
    amp.gain.linearRampToValueAtTime(vol, t0 + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    carrier.connect(filter).connect(amp).connect(this.masterGain);
    carrier.start(t0);
    modulator.start(t0);
    carrier.stop(t0 + dur);
    modulator.stop(t0 + dur);
  }

  navigate(dir: "up" | "down" | "left" | "right", soundType: "light" | "movie" = "light") {
    if (this.activeTheme === "none") return;
    const up = dir === "up" || dir === "left";
    if (this.activeTheme === "modern") {
      if (soundType === "light") this.playTone(420, "sine", 0.03, 0.03);
      else this.playTone(310, "sine", 0.04, 0.045);
      return;
    }
    if (this.activeTheme === "glass") {
      if (soundType === "light") this.playGlass({ freq: 2000, dur: 0.08, vol: 0.012 });
      else this.playGlass({ freq: up ? 980 : 1120, dur: 0.22, vol: 0.03 });
    } else if (this.activeTheme === "retro") {
      this.playTone(880, "square", 0.018, 0.004);
      setTimeout(() => {
        this.playTone(1046, "square", 0.022, 0.0035);
      }, 12);
      return;
    } else if (this.activeTheme === "cinematic") {
      this.playTone(200, "sine", 0.12, 0.01);
      return;
    }
  }

  open() {
    if (this.activeTheme === "none") return;
    if (this.activeTheme === "glass") this.playGlass({ freq: 720, dur: 0.5, vol: 0.04, modRatio: 3 });
    else if (this.activeTheme === "modern") {
      this.playTone(523.25, "sine", 0.3, 0.03);
      this.playTone(659.25, "sine", 0.3, 0.025);
      this.playTone(783.99, "sine", 0.3, 0.02);
    } else if (this.activeTheme === "retro") {
      this.playTone(523, "triangle", 0.06, 0.012);
      setTimeout(() => {
        this.playTone(659, "triangle", 0.045, 0.01);
      }, 15);
      return;
    } else if (this.activeTheme === "cinematic") {
      const c = this.getCtx();
      if (!c || !this.masterGain) return;
      const t = c.currentTime;
      const bass = c.createOscillator();
      const bassGain = c.createGain();
      bass.type = "sine";
      bass.frequency.setValueAtTime(100, t);
      bass.frequency.exponentialRampToValueAtTime(35, t + 0.35);
      bassGain.gain.setValueAtTime(0.0001, t);
      bassGain.gain.exponentialRampToValueAtTime(0.06, t + 0.04);
      bassGain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
      bass.connect(bassGain).connect(this.masterGain);
      bass.start(t);
      bass.stop(t + 1.3);
      const shimmer = c.createOscillator();
      const shimmerGain = c.createGain();
      shimmer.type = "sine";
      shimmer.frequency.value = 900;
      shimmerGain.gain.setValueAtTime(0.0001, t);
      shimmerGain.gain.exponentialRampToValueAtTime(0.012, t + 0.05);
      shimmerGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      shimmer.connect(shimmerGain).connect(this.masterGain);
      shimmer.start(t);
      shimmer.stop(t + 0.6);
      return;
    }
  }

  boot() {
    if (this.muted || this.activeTheme === "none") return;
    const c = this.getCtx();
    if (!c || !this.masterGain) return;
    const t0 = c.currentTime + 0.05;

    const tone = c.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.setValueAtTime(2600, t0);
    tone.Q.setValueAtTime(0.4, t0);
    tone.connect(this.masterGain);

    // Overtones decay faster than the fundamental, which is what makes a
    // struck body sound played rather than synthesised.
    const strike = (freq: number, at: number, vol: number, dur: number) => {
      const partials: Array<[number, number]> = [
        [1, 1],
        [2, 0.3],
        [3, 0.11],
        [4, 0.05],
      ];
      for (const [ratio, share] of partials) {
        const osc = c.createOscillator();
        const gain = c.createGain();
        const start = t0 + at;
        const life = dur / Math.sqrt(ratio);
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq * ratio, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(vol * share, start + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + life);
        osc.connect(gain).connect(tone);
        osc.start(start);
        osc.stop(start + life + 0.05);
      }
    };

    strike(73.42, 0, 0.05, 2.8);
    strike(146.83, 0.02, 0.036, 2.5);
    strike(220.0, 0.13, 0.03, 2.3);
    strike(293.66, 0.25, 0.026, 2.1);
    strike(369.99, 0.37, 0.022, 2.0);
    strike(440.0, 0.49, 0.018, 1.9);
    strike(587.33, 0.66, 0.014, 1.8);
  }

  close() {
    if (this.activeTheme === "none") return;
    if (this.activeTheme === "glass") this.playGlass({ freq: 560, dur: 0.3, vol: 0.03 });
    else if (this.activeTheme === "modern") {
      this.playTone(392.0, "sine", 0.22, 0.03);
      this.playTone(329.63, "sine", 0.22, 0.02);
    } else if (this.activeTheme === "retro") {
      this.playTone(560, "triangle", 0.05, 0.01);
      setTimeout(() => {
        this.playTone(430, "triangle", 0.06, 0.008);
      }, 35);
      return;
    } else if (this.activeTheme === "cinematic") this.playTone(90, "sine", 0.4, 0.05);
  }

  hover() {
    if (this.activeTheme === "none") return;
    if (this.activeTheme === "glass") this.playGlass({ freq: 2200, dur: 0.05, vol: 0.015 });
    else if (this.activeTheme === "modern") this.playTone(1200, "sine", 0.015, 0.01);
    else if (this.activeTheme === "retro") {
      this.playTone(740, "square", 0.016, 0.0035);
      setTimeout(() => {
        this.playTone(880, "triangle", 0.018, 0.003);
      }, 10);
      return;
    } else if (this.activeTheme === "cinematic") this.playTone(350, "sine", 0.04, 0.01);
  }

  click() {
    if (this.activeTheme === "none") return;
    if (this.activeTheme === "glass") this.playGlass({ freq: 1500, dur: 0.08, vol: 0.04 });
    else if (this.activeTheme === "modern") this.playTone(400, "sine", 0.05, 0.035);
    else if (this.activeTheme === "retro") {
      this.playTone(520, "square", 0.022, 0.007);
      setTimeout(() => {
        this.playTone(360, "triangle", 0.028, 0.005);
      }, 12);
      return;
    } else if (this.activeTheme === "cinematic") {
      this.playTone(180, "sine", 0.12, 0.02);
    }
  }

  volumeChange(isUp: boolean) {
    if (this.activeTheme === "none") return;

    if (this.activeTheme === "glass") {
      this.playGlass({ freq: isUp ? 1750 : 1250, dur: 0.05, vol: 0.012 });
    } else if (this.activeTheme === "modern") {
      this.playTone(isUp ? 620 : 420, "sine", 0.04, 0.02);
    } else if (this.activeTheme === "retro") {
      this.playTone(isUp ? 780 : 560, "square", 0.04, 0.012);
    } else if (this.activeTheme === "cinematic") {
      this.playTone(isUp ? 220 : 150, "triangle", 0.07, 0.025);
    }
  }

  private playSwipe(startHz: number, endHz: number, dur: number, vol: number, pan: number) {
    if (this.muted) return;
    const c = this.getCtx();
    if (!c || !this.masterGain) return;
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const filter = c.createBiquadFilter();
    const gain = c.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(startHz, t0);
    if (endHz !== startHz) osc.frequency.exponentialRampToValueAtTime(endHz, t0 + dur);
    filter.type = "lowpass";
    filter.frequency.value = 2200;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    const panner = typeof c.createStereoPanner === "function" ? c.createStereoPanner() : null;
    if (panner) {
      panner.pan.setValueAtTime(pan, t0);
      osc.connect(filter).connect(gain).connect(panner).connect(this.masterGain);
    } else {
      osc.connect(filter).connect(gain).connect(this.masterGain);
    }
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  pageTurn(dir: "next" | "prev", opts?: { reduce?: boolean }) {
    if (this.muted) return;
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (now - this.lastTurnAt < 55) return;
    this.lastTurnAt = now;
    if (opts?.reduce) {
      if (dir === "next") this.playSwipe(470, 470, 0.035, 0.038, 0.3);
      else this.playSwipe(360, 360, 0.04, 0.032, -0.3);
      return;
    }
    if (dir === "next") this.playSwipe(390, 560, 0.075, 0.05, 0.4);
    else this.playSwipe(430, 300, 0.09, 0.04, -0.4);
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.masterGain) this.masterGain.gain.value = muted ? 0 : this.currentVolume;
  }

  init() {
    if (this.activeTheme === "none") return;
    this.getCtx();
  }
}

export const SFX = new SoundEffects();
