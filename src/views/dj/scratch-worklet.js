const HALF = 8;
const STEPS = 1024;
const CUT = 0.92;
const MAX_RATE = 12;
const MAX_STRETCH = MAX_RATE;
const GRIP_TAU = 0.014;
const TOUCH_TAU = 0.0035;
const STARVE = 0.05;
const STARVE_TAU = 0.03;
const DC_HZ = 10;
const KNEE = 0.97;
const STOP_RATE = 0.012;
const GUARD = 2048;
const REPORT_BLOCKS = 4;
const FADE_FLOOR = 0.006;

const IDLE = 0;
const HAND = 1;
const FIXED = 2;
const MOTOR = 3;

function buildKernel() {
  const size = HALF * STEPS + 2;
  const table = new Float32Array(size);
  for (let index = 0; index < size; index += 1) {
    const x = index / STEPS;
    const arg = Math.PI * CUT * x;
    const sinc = index === 0 ? 1 : Math.sin(arg) / arg;
    const u = (Math.PI * x) / HALF;
    const shape =
      x >= HALF
        ? 0
        : 0.35875 + 0.48829 * Math.cos(u) + 0.14128 * Math.cos(2 * u) + 0.01168 * Math.cos(3 * u);
    table[index] = sinc * shape;
  }
  return table;
}

const KERNEL = buildKernel();

function num(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function ceiling(value) {
  const size = value < 0 ? -value : value;
  if (size <= KNEE) return value;
  const shaped = KNEE + (1 - KNEE) * Math.tanh((size - KNEE) / (1 - KNEE));
  return value < 0 ? -shaped : shaped;
}

class HarborScratchProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.kernel = KERNEL;
    this.sr = sampleRate;
    this.invSr = 1 / sampleRate;
    this.left = null;
    this.right = null;
    this.origin = 0;
    this.cursor = 0;
    this.rate = 0;
    this.mode = IDLE;
    this.fixed = 0;
    this.handPos = 0;
    this.handVel = 0;
    this.starve = 0;
    this.motorTarget = 1;
    this.motorAlpha = 0;
    this.env = 0;
    this.envTo = 0;
    this.envStep = 1;
    this.envGain = 0;
    this.seatAt = null;
    this.seatFade = FADE_FLOOR;
    this.dcLx = 0;
    this.dcLy = 0;
    this.dcRx = 0;
    this.dcRy = 0;
    this.dcPole = Math.exp((-2 * Math.PI * DC_HZ) / sampleRate);
    this.touch = 1 - Math.exp(-1 / (TOUCH_TAU * sampleRate));
    this.starveFall = Math.exp(-1 / (STARVE_TAU * sampleRate));
    this.blocks = 0;
    this.port.onmessage = (event) => this.accept(event.data);
  }

  accept(message) {
    const kind = message.kind;
    if (kind === "load") {
      const rows = message.left;
      if (!rows || !rows.length) return;
      const pair = message.right && message.right.length === rows.length ? message.right : rows;
      const keep = this.origin + this.cursor * this.invSr;
      const live = this.mode !== IDLE;
      this.left = rows;
      this.right = pair;
      this.origin = num(message.origin, this.origin);
      if (live) this.cursor = (keep - this.origin) * this.sr;
      return;
    }
    if (kind === "claim") {
      const position = num(message.position, this.origin + this.cursor * this.invSr);
      this.seatFade = Math.max(FADE_FLOOR, num(message.fade, FADE_FLOOR));
      this.seatAt = position;
      this.rate = num(message.rate, 0);
      this.mode = HAND;
      this.handVel = 0;
      this.starve = 0;
      if (this.env > 0) {
        this.handPos = this.origin + this.cursor * this.invSr;
        this.fadeTo(0, this.seatFade);
        return;
      }
      this.seat();
      return;
    }
    if (kind === "hand") {
      this.mode = HAND;
      this.handPos = num(message.position, this.handPos);
      this.handVel = num(message.velocity, 0);
      this.starve = 0;
      return;
    }
    if (kind === "rate") {
      this.mode = FIXED;
      this.fixed = num(message.rate, this.fixed);
      return;
    }
    if (kind === "motor") {
      this.mode = MOTOR;
      this.motorTarget = num(message.target, 0);
      this.motorAlpha = 1 - Math.exp(-1 / (Math.max(0.004, num(message.tau, 0.07)) * this.sr));
      return;
    }
    if (kind === "release") {
      this.seatAt = null;
      this.fadeTo(0, Math.max(FADE_FLOOR, num(message.fade, FADE_FLOOR)));
    }
  }

  seat() {
    const position = this.seatAt;
    this.seatAt = null;
    this.cursor = (position - this.origin) * this.sr;
    this.handPos = position;
    this.handVel = 0;
    this.starve = 0;
    this.dcLx = 0;
    this.dcLy = 0;
    this.dcRx = 0;
    this.dcRy = 0;
    this.fadeTo(1, this.seatFade);
  }

  fadeTo(value, seconds) {
    this.envTo = value;
    this.envStep = 1 / Math.max(1, (seconds > 0 ? seconds : FADE_FLOOR) * this.sr);
  }

  advance(step) {
    if (this.mode === HAND) {
      this.starve += step;
      if (this.starve > STARVE) this.handVel *= this.starveFall;
      this.handPos += this.handVel * step;
      const error = this.handPos - (this.origin + this.cursor * this.invSr);
      this.rate += (this.handVel + error / GRIP_TAU - this.rate) * this.touch;
    } else if (this.mode === MOTOR) {
      this.rate += (this.motorTarget - this.rate) * this.motorAlpha;
      if (this.motorTarget === 0 && Math.abs(this.rate) < STOP_RATE) this.rate = 0;
    } else if (this.mode === FIXED) {
      this.rate += (this.fixed - this.rate) * this.touch;
    }
    if (this.rate > MAX_RATE) this.rate = MAX_RATE;
    else if (this.rate < -MAX_RATE) this.rate = -MAX_RATE;
    if (this.env !== this.envTo) {
      const move = this.envTo > this.env ? this.envStep : -this.envStep;
      this.env = Math.max(0, Math.min(1, this.env + move));
      this.envGain = this.env <= 0 ? 0 : this.env >= 1 ? 1 : 0.5 - 0.5 * Math.cos(Math.PI * this.env);
    }
    if (this.seatAt !== null && this.env <= 0) this.seat();
  }

  process(_inputs, outputs) {
    const out = outputs[0];
    const left = out[0];
    const right = out.length > 1 ? out[1] : out[0];
    const buffer = this.left;
    const other = this.right;
    if (this.mode === IDLE || !buffer || buffer.length < 64) {
      left.fill(0);
      if (right !== left) right.fill(0);
      return true;
    }
    const kernel = this.kernel;
    const klen = kernel.length - 1;
    const last = buffer.length - 1;
    const step = this.invSr;
    const frames = left.length;
    for (let frame = 0; frame < frames; frame += 1) {
      this.advance(step);
      const speed = this.rate < 0 ? -this.rate : this.rate;
      const stretch = speed > MAX_STRETCH ? MAX_STRETCH : speed < 1 ? 1 : speed;
      const span = HALF * stretch;
      const at = this.cursor;
      const room = Math.min(at - span, last - at - span);
      const gate = room >= GUARD ? 1 : room <= 0 ? 0 : 0.5 - 0.5 * Math.cos((Math.PI * room) / GUARD);
      let rawL = 0;
      let rawR = 0;
      if (gate > 0) {
        const scale = STEPS / stretch;
        const first = Math.ceil(at - span);
        const stop = Math.floor(at + span);
        let x = (at - first) * scale;
        let sumL = 0;
        let sumR = 0;
        let weight = 0;
        for (let index = first; index <= stop; index += 1) {
          const ax = x < 0 ? -x : x;
          const slot = ax | 0;
          if (slot < klen) {
            const w = kernel[slot] + (kernel[slot + 1] - kernel[slot]) * (ax - slot);
            sumL += buffer[index] * w;
            sumR += other[index] * w;
            weight += w;
          }
          x -= scale;
        }
        if (weight > 1e-9) {
          rawL = sumL / weight;
          rawR = sumR / weight;
        }
      }
      const dcL = rawL - this.dcLx + this.dcPole * this.dcLy;
      this.dcLx = rawL;
      this.dcLy = dcL;
      const dcR = rawR - this.dcRx + this.dcPole * this.dcRy;
      this.dcRx = rawR;
      this.dcRy = dcR;
      const gain = this.envGain * gate;
      left[frame] = ceiling(dcL * gain);
      if (right !== left) right[frame] = ceiling(dcR * gain);
      this.cursor += this.rate;
    }
    if (this.envTo === 0 && this.env === 0) {
      this.mode = IDLE;
      this.rate = 0;
      this.dcLx = 0;
      this.dcLy = 0;
      this.dcRx = 0;
      this.dcRy = 0;
    }
    this.blocks += 1;
    if (this.blocks >= REPORT_BLOCKS) {
      this.blocks = 0;
      this.port.postMessage({ position: this.origin + this.cursor * this.invSr, rate: this.rate });
    }
    return true;
  }
}

registerProcessor("harbor-scratch", HarborScratchProcessor);
