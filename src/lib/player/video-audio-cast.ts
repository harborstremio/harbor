import type { CastDeviceInfo, CastStatus, castLoad } from "@/lib/cast";
import type { PlayerBridge, PlayerSnapshot } from "./bridge";

type LoadOptions = Parameters<typeof castLoad>[0];
type Receiver = {
  load: typeof castLoad;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seek: (sec: number) => Promise<void>;
  stop: () => Promise<void>;
  status: () => Promise<CastStatus | null>;
};
export type VideoAudioCastState = {
  device: CastDeviceInfo | null;
  phase: "idle" | "connecting" | "playing" | "paused" | "stopping" | "error";
  position: number;
  error: string | null;
};

/** Owns one speaker route, including the local bridge guard, until STOP is acknowledged. */
export class VideoAudioCast {
  private state: VideoAudioCastState = { device: null, phase: "idle", position: 0, error: null };
  private listeners = new Set<() => void>();
  private bridge: PlayerBridge | null = null;
  private guardedBridge: PlayerBridge | null = null;
  private originalMuted = false;
  private desiredPlaying = false;
  private originalRate = 1;
  private generation = 0;
  private tail: Promise<unknown> = Promise.resolve();
  private receiverMayPlay = false;
  private offSnapshot: (() => void) | null = null;
  private local: PlayerSnapshot | null = null;
  private polling = false;
  private receiver: Receiver;
  private bridgeRef: { current: PlayerBridge | null };
  private snapshot: () => PlayerSnapshot;

  constructor(
    receiver: Receiver,
    bridgeRef: { current: PlayerBridge | null },
    snapshot: () => PlayerSnapshot,
  ) {
    this.receiver = receiver;
    this.bridgeRef = bridgeRef;
    this.snapshot = snapshot;
  }

  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(patch: Partial<VideoAudioCastState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const result = this.tail.then(work);
    this.tail = result.catch(() => {});
    return result;
  }
  private fail(error: unknown) {
    this.bridge?.pause();
    const key = error instanceof Error ? error.message : String(error);
    this.update({
      phase: "error",
      error: key.startsWith("video.cast.") ? key : "video.cast.controlFailed",
    });
  }
  private fire(work: Promise<unknown>) {
    void work.catch(() => {});
  }

  private guardBridge() {
    const bridge = this.bridgeRef.current;
    if (!bridge) throw new Error("video.cast.noPlayer");
    this.bridge = bridge;
    this.local = this.snapshot();
    this.originalMuted = this.local.muted;
    this.originalRate = this.local.rate;
    this.desiredPlaying = this.local.status === "playing" || this.local.status === "loading";
    this.offSnapshot = bridge.subscribe((s) => {
      this.local = s;
    });
    // Every local input path (hotkeys, remote control, wheels and shell sliders) uses this ref.
    // In particular HTML5 setVolume also unmutes, so both volume and mute are guarded.
    this.guardedBridge = {
      ...bridge,
      play: () => (this.state.device ? this.play() : bridge.play()),
      pause: () => (this.state.device ? this.fire(this.pause()) : bridge.pause()),
      seek: (sec) => (this.state.device ? this.fire(this.seek(sec)) : bridge.seek(sec)),
      setVolume: (value) =>
        this.state.device ? this.update({ error: "video.cast.volume" }) : bridge.setVolume(value),
      setMuted: (value) =>
        this.state.device ? this.update({ error: "video.cast.volume" }) : bridge.setMuted(value),
      setRate: (value) =>
        this.state.device ? this.update({ error: "video.cast.settings" }) : bridge.setRate(value),
      setAudioTrack: (value) =>
        this.state.device
          ? this.update({ error: "video.cast.settings" })
          : bridge.setAudioTrack(value),
      setAudioDelay: (value) =>
        this.state.device
          ? this.update({ error: "video.cast.settings" })
          : bridge.setAudioDelay(value),
      load: async (source) => {
        await this.stop();
        await bridge.load(source);
      },
    };
    this.bridgeRef.current = this.guardedBridge;
    bridge.pause();
  }

  private release(resume: boolean) {
    const bridge = this.bridge;
    const stillLocal = this.bridgeRef.current === this.guardedBridge;
    if (stillLocal) this.bridgeRef.current = bridge;
    this.offSnapshot?.();
    this.offSnapshot = null;
    this.guardedBridge = null;
    this.bridge = null;
    this.receiverMayPlay = false;
    if (bridge && stillLocal) {
      bridge.setRate(this.originalRate);
      bridge.setMuted(this.originalMuted);
      if (resume) this.fire(bridge.play({ preserveMuted: true }));
    }
    this.update({ device: null, phase: "idle", error: null });
  }

  private async confirmMuted() {
    if (!this.bridge) throw new Error("video.cast.noPlayer");
    this.bridge.setMuted(true);
    const until = Date.now() + 3000;
    while (!this.local?.muted) {
      if (Date.now() >= until) throw new Error("video.cast.muteFailed");
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
  }

  start(device: CastDeviceInfo, options: Omit<LoadOptions, "host" | "port">) {
    const generation = ++this.generation;
    return this.enqueue(async () => {
      if (generation !== this.generation) return;
      if (this.state.device) await this.stopCurrent(false);
      this.guardBridge();
      this.update({
        device,
        phase: "connecting",
        error: null,
        position: options.startTimeSec ?? 0,
      });
      try {
        this.receiverMayPlay = true;
        const result = await this.receiver.load({
          ...options,
          host: device.host,
          port: device.port,
          kind: device.kind,
          controlUrl: device.control_url,
          audioOnly: true,
          audioStartPaused: true,
        });
        if (!result.ok) throw new Error(result.error || "video.cast.loadFailed");
        if (generation !== this.generation) return;
        const status = await this.receiver.status();
        if (
          !status?.connected ||
          !Number.isFinite(status.position_sec) ||
          status.position_sec < 0 ||
          !["PLAYING", "PAUSED", "PAUSED_PLAYBACK"].includes(status.player_state)
        ) {
          throw new Error("video.cast.notReady");
        }
        if (status.player_state === "PLAYING") await this.receiver.pause();
        await this.confirmMuted();
        if (generation !== this.generation) return;
        this.bridge!.setRate(1);
        this.bridge!.seek(status.position_sec);
        if (this.desiredPlaying) {
          await this.receiver.play();
          await this.bridge!.play({ preserveMuted: true });
        }
        this.update({
          phase: this.desiredPlaying ? "playing" : "paused",
          position: status.position_sec,
        });
      } catch (error) {
        // A failed LOAD can still have reached the receiver. Never resume local audio until STOP.
        const shouldResume = this.desiredPlaying;
        try {
          await this.receiver.stop();
          this.release(shouldResume && generation === this.generation);
          const key = error instanceof Error ? error.message : String(error);
          this.update({ error: key.startsWith("video.cast.") ? key : "video.cast.loadFailed" });
        } catch {
          this.fail(error);
        }
        throw error;
      }
    });
  }

  private async stopCurrent(resume: boolean) {
    if (!this.state.device) return;
    this.bridge?.pause();
    this.update({ phase: "stopping", error: null });
    try {
      if (this.receiverMayPlay) await this.receiver.stop();
      this.release(resume);
    } catch (error) {
      this.fail(error);
      throw error;
    }
  }
  stop = (resume = false) => {
    ++this.generation;
    return this.enqueue(() => this.stopCurrent(resume));
  };
  returnToComputer = () => this.stop(this.desiredPlaying);

  private control(work: () => Promise<void>) {
    const generation = this.generation;
    return this.enqueue(async () => {
      if (generation !== this.generation || !this.state.device) return;
      try {
        await work();
      } catch (error) {
        this.fail(error);
        throw error;
      }
    });
  }
  play = () =>
    this.control(async () => {
      if (this.state.phase === "error") throw new Error("video.cast.retryReturn");
      await this.confirmMuted();
      const status = await this.receiver.status();
      if (!status?.connected) throw new Error("video.cast.disconnected");
      this.bridge!.seek(status.position_sec);
      await this.receiver.play();
      this.desiredPlaying = true;
      await this.bridge!.play({ preserveMuted: true });
      this.update({ phase: "playing", error: null });
    });
  pause = () =>
    this.control(async () => {
      this.desiredPlaying = false;
      this.bridge?.pause();
      await this.receiver.pause();
      this.update({ phase: "paused", error: null });
    });
  seek = (sec: number) =>
    this.control(async () => {
      this.bridge?.pause();
      const target = Math.max(0, Number.isFinite(sec) ? sec : 0);
      await this.receiver.pause();
      await this.receiver.seek(target);
      // The native audio bridge regenerates from the source offset and confirms receiver progress.
      const status = await this.receiver.status();
      if (!status?.connected) throw new Error("video.cast.disconnected");
      await this.confirmMuted();
      this.bridge!.seek(status.position_sec);
      if (this.desiredPlaying) {
        await this.receiver.play();
        await this.bridge!.play({ preserveMuted: true });
      }
      this.update({
        position: status.position_sec,
        phase: this.desiredPlaying ? "playing" : "paused",
        error: null,
      });
    });

  poll = async () => {
    if (this.polling || !["playing", "paused"].includes(this.state.phase)) return;
    this.polling = true;
    try {
      await this.control(async () => {
        if (this.bridgeRef.current !== this.guardedBridge) {
          throw new Error("video.cast.playerChanged");
        }
        if (this.local?.status === "ended" || this.local?.status === "error") {
          await this.receiver.pause();
          this.desiredPlaying = false;
          this.update({ phase: "paused" });
          return;
        }
        const status = await this.receiver.status();
        if (!status?.connected) throw new Error("video.cast.disconnected");
        const paused = ["PAUSED", "PAUSED_PLAYBACK", "IDLE", "STOPPED"].includes(
          status.player_state,
        );
        if (paused) {
          this.bridge?.pause();
          this.desiredPlaying = false;
        } else if (status.player_state !== "PLAYING") {
          this.bridge?.pause();
          return;
        } else if (this.local?.buffering) {
          await this.receiver.pause();
          this.bridge?.pause();
          this.desiredPlaying = false;
          this.update({ phase: "paused", error: "video.cast.buffering" });
          return;
        } else {
          // Receiver position is coarse; only correct large drift, never claim frame-accurate sync.
          if (Math.abs(status.position_sec - (this.local?.positionSec ?? 0)) > 2)
            this.bridge?.seek(status.position_sec);
          if (this.local?.status !== "playing") await this.bridge?.play({ preserveMuted: true });
          this.desiredPlaying = true;
        }
        this.update({ position: status.position_sec, phase: paused ? "paused" : "playing" });
      });
    } catch {
      /* control preserves the route and reports failure until an acknowledged return */
    } finally {
      this.polling = false;
    }
  };
}
