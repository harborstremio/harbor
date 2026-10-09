export const SUBTITLE_FPS_PRESETS = [
  { label: "23.976", value: 24_000 / 1_001 },
  { label: "24", value: 24 },
  { label: "25", value: 25 },
  { label: "29.97", value: 30_000 / 1_001 },
  { label: "30", value: 30 },
  { label: "50", value: 50 },
  { label: "59.94", value: 60_000 / 1_001 },
  { label: "60", value: 60 },
] as const;

export const MIN_SUBTITLE_FPS = 1;
export const MAX_SUBTITLE_FPS = 240;
export const SUBTITLE_FPS_TRANSITION_FAILED_EVENT = "harbor:subtitle-fps-transition-failed";

export type SubtitleFpsChoice = "default" | number;
export type SubtitleFpsUnavailableReason =
  | "no-track"
  | "html5"
  | "not-text-based"
  | "secondary-active"
  | "video-fps-unavailable"
  | "native-unavailable"
  | "auto-sync-active";

export function validateSubtitleFps(
  input: unknown,
): { ok: true; value: number } | { ok: false; error: "out-of-range" } {
  if (typeof input !== "number" && typeof input !== "string") {
    return { ok: false, error: "out-of-range" };
  }
  if (typeof input === "string" && input.trim() === "") {
    return { ok: false, error: "out-of-range" };
  }
  const value = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(value) || value < MIN_SUBTITLE_FPS || value > MAX_SUBTITLE_FPS) {
    return { ok: false, error: "out-of-range" };
  }
  return { ok: true, value };
}

export function subtitleFpsToMpvValue(choice: SubtitleFpsChoice): number {
  if (choice === "default") return 0;
  const result = validateSubtitleFps(choice);
  if (!result.ok) throw new RangeError("Subtitle FPS must be between 1 and 240.");
  return result.value;
}

export function matchingSubtitleFpsPreset(value: number | null): string | null {
  if (value == null) return null;
  return (
    SUBTITLE_FPS_PRESETS.find((preset) => Math.abs(preset.value - value) < 0.001)?.label ?? null
  );
}

export function subtitleFpsMatchesVideo(
  subtitleFps: number | null,
  videoFps: number | null,
): boolean {
  return (
    subtitleFps != null &&
    videoFps != null &&
    Number.isFinite(subtitleFps) &&
    Number.isFinite(videoFps) &&
    Math.abs(subtitleFps - videoFps) < 0.001
  );
}

export function formatSubtitleFps(value: number | null | undefined, digits = 3): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return "-";
  const preset = matchingSubtitleFpsPreset(value);
  if (preset) return preset;
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(digits).replace(/\.?0+$/, "");
}

export function subtitleFpsAvailability(input: {
  engine: "html5" | "mpv";
  hasTrack: boolean;
  textBased: boolean;
  hasSecondary: boolean;
  videoFps: number | null;
  nativeSupported: boolean;
  autoSyncActive: boolean;
}): { enabled: true; reason: null } | { enabled: false; reason: SubtitleFpsUnavailableReason } {
  if (!input.hasTrack) return { enabled: false, reason: "no-track" };
  if (input.engine !== "mpv") return { enabled: false, reason: "html5" };
  if (!input.textBased) return { enabled: false, reason: "not-text-based" };
  if (input.hasSecondary) return { enabled: false, reason: "secondary-active" };
  if (input.autoSyncActive) return { enabled: false, reason: "auto-sync-active" };
  if (input.videoFps == null || !Number.isFinite(input.videoFps) || input.videoFps <= 0) {
    return { enabled: false, reason: "video-fps-unavailable" };
  }
  if (!input.nativeSupported) return { enabled: false, reason: "native-unavailable" };
  return { enabled: true, reason: null };
}

export async function runAfterSubtitleFpsReset(
  reset: () => Promise<void>,
  action: () => void | Promise<void>,
  onResetError: (error: unknown) => void,
  isCurrent: () => boolean = () => true,
): Promise<boolean> {
  try {
    await reset();
  } catch (error) {
    onResetError(error);
    return false;
  }
  if (!isCurrent()) return false;
  await action();
  return isCurrent();
}

export function buildSubtitleTimingMediaKey(input: {
  sourceUrl: string;
  mediaId: string;
  season?: number | null;
  episode?: number | null;
}): string {
  return JSON.stringify([
    input.sourceUrl,
    input.mediaId,
    input.season ?? null,
    input.episode ?? null,
  ]);
}

export function createSubtitleFpsRequestGuard() {
  let revision = 0;
  return {
    begin: () => {
      const requestRevision = ++revision;
      return () => requestRevision === revision;
    },
    invalidate: () => {
      revision += 1;
    },
  };
}

export function createSubtitleFpsAvailabilityController(deps: {
  read: () => Promise<boolean>;
  commit: (supported: boolean) => void;
}) {
  const guard = createSubtitleFpsRequestGuard();
  return {
    refresh: async (): Promise<boolean> => {
      const isCurrent = guard.begin();
      const supported = await deps.read();
      if (!isCurrent()) return false;
      deps.commit(supported);
      return true;
    },
    invalidate: guard.invalidate,
  };
}

export function isAutoSyncScopeCurrent(
  scope: { mediaKey: string; trackId: string } | null,
  current: { mediaKey: string; trackId: string | null; syncedTrack: boolean },
): boolean {
  return (
    scope != null &&
    scope.mediaKey === current.mediaKey &&
    (scope.trackId === current.trackId || current.syncedTrack)
  );
}

export function createSubtitleFpsCoordinator(deps: { writeFps: (value: number) => Promise<void> }) {
  let tail: Promise<void> = Promise.resolve();
  let active = false;
  let sessionRevision = 0;

  const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = tail.then(operation);
    tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };

  const resetActive = async (onResetError?: (error: unknown) => void) => {
    if (!active) return;
    try {
      await deps.writeFps(0);
      active = false;
    } catch (error) {
      onResetError?.(error);
      throw error;
    }
  };

  return {
    apply: (choice: SubtitleFpsChoice, isCurrent: () => boolean = () => true) => {
      const requestSession = sessionRevision;
      return enqueue(async () => {
        if (requestSession !== sessionRevision || !isCurrent()) {
          throw new Error("Subtitle FPS context changed.");
        }
        const value = subtitleFpsToMpvValue(choice);
        await deps.writeFps(value);
        if (requestSession !== sessionRevision) {
          throw new Error("Subtitle FPS context changed.");
        }
        active = value !== 0;
        if (isCurrent()) return;

        if (active) {
          try {
            await deps.writeFps(0);
            active = false;
          } catch {
            active = true;
          }
        }
        throw new Error("Subtitle FPS context changed.");
      });
    },
    resetForTransition: (onResetError?: (error: unknown) => void) =>
      enqueue(() => resetActive(onResetError)),
    markSessionRecreated: () => {
      sessionRevision += 1;
      active = false;
    },
    whenSettled: () => tail,
    isActive: () => active,
  };
}
