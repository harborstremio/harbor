// src/lib/sfx.ts

class SoundEffects {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;
  private currentVolume = 0.5;

  private activeTheme: "none" | "glass" | "modern" | "retro" | "cinematic" = "glass";

  public setTheme(theme: "none" | "glass" | "modern" | "retro" | "cinematic") {
    this.activeTheme = theme;
  }

  public setVolume(volume: number) {
    this.currentVolume = Math.max(0, Math.min(1, volume));
    if (this.masterGain) this.masterGain.gain.value = this.muted ? 0 : this.currentVolume;
  }

  private getCtx() {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.currentVolume;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
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

    if (this.activeTheme === "glass")
      this.playGlass({ freq: 720, dur: 0.5, vol: 0.04, modRatio: 3 });
    else if (this.activeTheme === "modern") {
      this.playTone(523.25, "sine", 0.3, 0.03);
      this.playTone(659.25, "sine", 0.3, 0.025);
      this.playTone(783.99, "sine", 0.3, 0.02);
    }
    if (this.activeTheme === "retro") {
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

  close() {
    if (this.activeTheme === "none") return;

    if (this.activeTheme === "glass") this.playGlass({ freq: 560, dur: 0.3, vol: 0.03 });
    else if (this.activeTheme === "modern") {
      this.playTone(392.0, "sine", 0.22, 0.03);
      this.playTone(329.63, "sine", 0.22, 0.02);
    }
    if (this.activeTheme === "retro") {
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
    if (this.activeTheme === "retro") {
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
