import { evaluateGate, measuredQuality, type SyncTransform, type GateDecision } from "./fp-gate";
import { fuseConfidence, DEFAULT_PRIOR, type SignalEvidence } from "./confidence";
import {
  DEFAULT_DRIFT_CONFIG,
  localFit,
  onsetResidual,
  speechFraction,
  aggregateQuality,
  onlineBounds,
  stableCandidate,
  sampleUsable,
  driftStep,
  vadEvidence,
  asrEvidence,
  type DriftConfig,
  type DriftSample,
  type Interval,
} from "./drift-dsp";
import type {
  DriftPlayerState,
  DriftPorts,
  DriftDeps,
  DriftStatus,
  CorrectionEvent,
  PendingOffer,
} from "./drift-ports";

export {
  DEFAULT_DRIFT_CONFIG,
  localFit,
  onsetResidual,
  stableCandidate,
  aggregateQuality,
} from "./drift-dsp";
export type { DriftConfig, Interval, LocalFit, DriftSample } from "./drift-dsp";
export { makeTauriDriftPorts } from "./drift-ports";
export type {
  DriftPlayerState,
  AsrConfirm,
  DriftPorts,
  DriftDeps,
  DriftStatus,
  CorrectionEvent,
  PendingOffer,
} from "./drift-ports";

export class DriftMonitor {
  private cfg: DriftConfig;
  private samples: DriftSample[] = [];
  private appliedDelta = 0;
  private myLastSetDelay: number | null = null;
  private lastSampleSec = -Infinity;
  private cooldownUntilSec = -Infinity;
  private frozen = false;
  private awaitingConverge = false;
  private reversals: Array<{ atSec: number; sign: number }> = [];
  private lastApplySign = 0;
  private sampling = false;
  private lastPos = 0;
  private lastWall = 0;
  private lastTrackKey = "";
  private statusValue: DriftStatus = "idle";
  private pending: PendingOffer | null = null;
  private lastEvent: CorrectionEvent | null = null;

  constructor(
    private ports: DriftPorts,
    private deps: DriftDeps,
    config?: Partial<DriftConfig>,
  ) {
    this.cfg = { ...DEFAULT_DRIFT_CONFIG, ...config };
  }

  get status(): DriftStatus {
    return this.statusValue;
  }

  get pendingOffer(): PendingOffer | null {
    return this.pending;
  }

  get correctionTotalSec(): number {
    return this.appliedDelta;
  }

  get lastCorrection(): CorrectionEvent | null {
    return this.lastEvent;
  }

  observe(): void {
    const st = this.deps.getState();
    const wall = (this.deps.now ?? Date.now)();
    if (st.trackKey !== this.lastTrackKey) {
      this.resetForNewTrack(st);
      return;
    }
    this.detectExternalDelay(st);
    if (this.detectSeek(st, wall)) {
      this.lastPos = st.positionSec;
      this.lastWall = wall;
      return;
    }
    this.lastPos = st.positionSec;
    this.lastWall = wall;
    if (this.frozen) {
      this.statusValue = "frozen";
      return;
    }
    if (!st.playing || st.buffering || Math.abs(st.rate - 1) > 0.05) return;
    if (st.cues.length < 4) return;
    if (this.statusValue === "idle") this.statusValue = "watching";
    if (st.positionSec - this.lastSampleSec < this.cfg.samplePeriodSec) return;
    void this.runSample(st);
  }

  private resetForNewTrack(st: DriftPlayerState): void {
    this.samples = [];
    this.appliedDelta = 0;
    this.myLastSetDelay = null;
    this.lastSampleSec = -Infinity;
    this.cooldownUntilSec = -Infinity;
    this.frozen = false;
    this.awaitingConverge = false;
    this.reversals = [];
    this.lastApplySign = 0;
    this.pending = null;
    this.lastTrackKey = st.trackKey;
    this.lastPos = st.positionSec;
    this.statusValue = "watching";
  }

  private detectExternalDelay(st: DriftPlayerState): void {
    if (this.myLastSetDelay === null) return;
    const off = Math.abs(st.subDelaySec - this.myLastSetDelay);
    if (this.awaitingConverge) {
      if (off <= this.cfg.externalDelayEpsSec) this.awaitingConverge = false;
      return;
    }
    if (off > this.cfg.externalDelayEpsSec) {
      this.appliedDelta = 0;
      this.myLastSetDelay = st.subDelaySec;
      this.samples = [];
      this.pending = null;
      this.statusValue = "watching";
    }
  }

  private detectSeek(st: DriftPlayerState, wall: number): boolean {
    if (this.lastWall === 0) return false;
    const posDelta = st.positionSec - this.lastPos;
    const wallDelta = Math.max(0, (wall - this.lastWall) / 1000) * (st.rate || 1);
    const seeked = posDelta < -0.5 || (st.playing && posDelta - wallDelta > this.cfg.seekTolSec);
    if (!seeked) return false;
    this.samples = [];
    this.pending = null;
    this.lastSampleSec = st.positionSec;
    this.cooldownUntilSec = st.positionSec + this.cfg.cooldownSec / 2;
    if (this.statusValue !== "frozen" && this.statusValue !== "escalate")
      this.statusValue = "watching";
    return true;
  }

  private async runSample(st: DriftPlayerState): Promise<void> {
    if (this.sampling) return;
    this.sampling = true;
    this.lastSampleSec = st.positionSec;
    const prevStatus = this.statusValue;
    this.statusValue = "sampling";
    try {
      const w1 = st.positionSec - this.cfg.windowLeadSec;
      const w0 = w1 - this.cfg.sampleWindowSec;
      if (w0 < 0) {
        this.statusValue = prevStatus;
        return;
      }
      const window: Interval = [w0, w1];
      const speech = await this.ports.sampleSpeech(w0, this.cfg.sampleWindowSec);
      const cues = st.cues.filter(
        (c) =>
          c.end + st.subDelaySec >= w0 - this.cfg.maxLagSec &&
          c.start + st.subDelaySec <= w1 + this.cfg.maxLagSec,
      );
      const frac = speechFraction(speech, window);
      const fit = localFit(speech, cues, st.subDelaySec, window, this.cfg);
      const onset = onsetResidual(speech, cues, st.subDelaySec, window, 1.0);
      const usable = sampleUsable(fit, frac, cues.length, onset, this.cfg);
      this.pushSample({
        playbackSec: st.positionSec,
        residualSec: fit.lagSec,
        fit,
        speechFrac: frac,
        speech,
        cues,
        delayAtFit: st.subDelaySec,
        window,
        usable,
      });
      if (st.positionSec < this.cooldownUntilSec) {
        this.statusValue = "watching";
        return;
      }
      const cand = stableCandidate(this.samples, st.positionSec, this.cfg);
      if (!cand) {
        this.statusValue = this.appliedDelta !== 0 ? "corrected" : "watching";
        return;
      }
      await this.attemptCorrection(st, cand.residualSec, cand.members);
    } catch {
      this.statusValue = prevStatus;
    } finally {
      this.sampling = false;
    }
  }

  private pushSample(s: DriftSample): void {
    this.samples.push(s);
    const horizon =
      s.playbackSec - Math.max(this.cfg.stabilityWindowSec, this.cfg.rollingQualitySec) - 5;
    this.samples = this.samples.filter((x) => x.playbackSec >= horizon);
  }

  private async attemptCorrection(
    st: DriftPlayerState,
    residualSec: number,
    members: DriftSample[],
  ): Promise<void> {
    const step = driftStep(residualSec, this.cfg);
    if (Math.abs(this.appliedDelta + step) > this.cfg.cumulativeCapSec) {
      this.statusValue = "escalate";
      this.pending = null;
      return;
    }
    const lead = members[members.length - 1];
    const evidence: SignalEvidence[] = [vadEvidence(lead.fit, lead.speechFrac, this.cfg)];

    let asrUsed = false;
    let asrWordMatch: number | undefined;
    if (this.ports.confirmAsr) {
      this.statusValue = "pending-confirm";
      const asr = await this.ports.confirmAsr(
        lead.window[0],
        this.cfg.sampleWindowSec,
        lead.cues,
        residualSec,
      );
      if (asr) {
        asrUsed = true;
        asrWordMatch = asr.wordMatch;
        evidence.push(asrEvidence(asr.residualSec, asr.wordMatch, residualSec, this.cfg));
      }
    }

    const rolling = this.samples.filter(
      (s) => s.usable && lead.playbackSec - s.playbackSec <= this.cfg.rollingQualitySec,
    );
    const qualityBefore = aggregateQuality(rolling, 0, this.cfg);
    const qualityAfter = aggregateQuality(rolling, step, this.cfg);
    const confidence = fuseConfidence(evidence, DEFAULT_PRIOR);
    const transform: SyncTransform = { kind: "affine", offsetSec: step, ratio: 1 };
    const decision = evaluateGate({
      transform,
      confidence,
      qualityBefore: measuredQuality(qualityBefore, "rolling-drift-samples"),
      qualityAfter: measuredQuality(qualityAfter, "rolling-drift-samples"),
      bounds: onlineBounds(this.cfg),
      exactIdentity: false,
      candidateKind: "structural",
      calibrationReady: false,
      structuralAutoApplyEnabled: true,
      subtitleFormat: "unknown",
      asrWordMatch,
      priorRuntimeOk: undefined,
      inputAlreadyGood: false,
    });

    if (decision.decision === "apply") {
      this.applyStep(st, step, residualSec, decision, confidence.agreeingSignals, asrUsed);
      return;
    }

    if (decision.decision === "offer") {
      this.pending = { residualSec, stepSec: step, pCorrect: confidence.pCorrect };
      this.statusValue = "offer";
      return;
    }

    this.pending = null;
    this.statusValue = this.appliedDelta !== 0 ? "corrected" : "watching";
  }

  private applyStep(
    st: DriftPlayerState,
    step: number,
    residualSec: number,
    decision: GateDecision,
    agreeingSignals: number,
    asrUsed: boolean,
  ): void {
    const newDelay = st.subDelaySec + step;
    this.deps.setSubDelay(newDelay);
    this.appliedDelta += step;
    this.myLastSetDelay = newDelay;
    this.awaitingConverge = true;
    this.cooldownUntilSec = st.positionSec + this.cfg.cooldownSec;
    this.samples = [];
    this.pending = null;
    this.statusValue = "corrected";
    this.trackReversal(st.positionSec, Math.sign(step));
    this.lastEvent = {
      atPlaybackSec: st.positionSec,
      outcome: decision.decision,
      stepSec: step,
      cumulativeSec: this.appliedDelta,
      residualSec,
      pCorrect: decision.pCorrect,
      agreeingSignals,
      bindingRule: decision.bindingRule,
      reason: decision.reason,
      asrUsed,
    };
  }

  private trackReversal(atSec: number, sign: number): void {
    if (this.lastApplySign !== 0 && sign !== 0 && sign !== this.lastApplySign) {
      this.reversals.push({ atSec, sign });
    }
    this.lastApplySign = sign;
    this.reversals = this.reversals.filter((r) => atSec - r.atSec <= this.cfg.reversalWindowSec);
    if (this.reversals.length >= this.cfg.maxReversals) {
      this.frozen = true;
      this.statusValue = "frozen";
    }
  }

  applyPending(): boolean {
    if (!this.pending) return false;
    const st = this.deps.getState();
    const step = this.pending.stepSec;
    if (Math.abs(this.appliedDelta + step) > this.cfg.cumulativeCapSec) {
      this.pending = null;
      this.statusValue = "escalate";
      return false;
    }
    const newDelay = st.subDelaySec + step;
    this.deps.setSubDelay(newDelay);
    this.appliedDelta += step;
    this.myLastSetDelay = newDelay;
    this.awaitingConverge = true;
    this.cooldownUntilSec = st.positionSec + this.cfg.cooldownSec;
    this.samples = [];
    this.trackReversal(st.positionSec, Math.sign(step));
    this.pending = null;
    this.statusValue = "corrected";
    return true;
  }

  revert(): void {
    if (Math.abs(this.appliedDelta) < 1e-6) return;
    const st = this.deps.getState();
    const restored = st.subDelaySec - this.appliedDelta;
    this.deps.setSubDelay(restored);
    this.myLastSetDelay = restored;
    this.awaitingConverge = true;
    this.appliedDelta = 0;
    this.samples = [];
    this.pending = null;
    this.statusValue = "watching";
  }

  unfreeze(): void {
    this.frozen = false;
    this.reversals = [];
    this.lastApplySign = 0;
    this.statusValue = "watching";
  }

  dispose(): void {
    this.samples = [];
    this.pending = null;
    this.statusValue = "idle";
  }
}
