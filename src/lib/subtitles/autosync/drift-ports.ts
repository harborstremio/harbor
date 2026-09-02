import type { Outcome } from "./fp-gate";
import type { Interval } from "./drift-dsp";
import type { SubCue } from "@/lib/subtitles/parser";

export type DriftPlayerState = {
  positionSec: number;
  durationSec: number;
  subDelaySec: number;
  playing: boolean;
  buffering: boolean;
  rate: number;
  cues: SubCue[];
  trackKey: string;
};

export type AsrConfirm = { residualSec: number; wordMatch: number };

export type DriftPorts = {
  sampleSpeech: (startSec: number, lenSec: number) => Promise<Interval[]>;
  confirmAsr?: (
    startSec: number,
    lenSec: number,
    cues: SubCue[],
    candidateResidualSec: number,
  ) => Promise<AsrConfirm | null>;
};

export type DriftDeps = {
  getState: () => DriftPlayerState;
  setSubDelay: (sec: number) => void;
  now?: () => number;
};

export type DriftStatus =
  | "idle"
  | "watching"
  | "sampling"
  | "pending-confirm"
  | "offer"
  | "corrected"
  | "frozen"
  | "escalate";

export type CorrectionEvent = {
  atPlaybackSec: number;
  outcome: Outcome;
  stepSec: number;
  cumulativeSec: number;
  residualSec: number;
  pCorrect: number;
  agreeingSignals: number;
  bindingRule: string;
  reason: string;
  asrUsed: boolean;
};

export type PendingOffer = { residualSec: number; stepSec: number; pCorrect: number };

export function makeTauriDriftPorts(
  mediaUrl: string,
  headers: Record<string, string> | undefined,
  opts: { mapSpec?: string } = {},
): DriftPorts {
  const invokePort = async <T>(cmd: string, args: Record<string, unknown>): Promise<T> => {
    const core = await import("@tauri-apps/api/core");
    return core.invoke<T>(cmd, args);
  };
  const mapSpec = opts.mapSpec;
  const ports: DriftPorts = {
    sampleSpeech: (startSec, lenSec) =>
      invokePort<Interval[]>("vad_speech_window", {
        url: mediaUrl,
        headers,
        startSec,
        lenSec,
        mapSpec,
      }),
  };
  // Lexical drift confirmation stays disabled until a native command can verify
  // the selected audio and subtitle languages before comparing their words.
  return ports;
}
