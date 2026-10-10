import { invoke } from "@tauri-apps/api/core";
import type { CastDeviceInfo, CastStatus } from "@/lib/cast";
import type { MusicTrack } from "./types";
import {
  claimCastSession,
  ownsCastSession,
  releaseCastSession,
  withCastSession,
  type CastLease,
} from "@/lib/cast-ownership";

export type MusicSpeakerPhase =
  | "idle"
  | "loading"
  | "playing"
  | "paused"
  | "buffering"
  | "stopped"
  | "unknown"
  | "disconnected"
  | "error";
export type MusicSpeakerState = {
  active: boolean;
  device: CastDeviceInfo | null;
  track: MusicTrack | null;
  phase: MusicSpeakerPhase;
  positionSec: number;
  transportCodec?: string;
  errorKey: string | null;
  error: string | null;
};

export class MusicSpeakerError extends Error {
  constructor(
    public readonly key: string,
    cause?: unknown,
  ) {
    super(cause instanceof Error ? cause.message : cause == null ? key : String(cause));
    this.name = "MusicSpeakerError";
  }
}

const idle: MusicSpeakerState = {
  active: false,
  device: null,
  track: null,
  phase: "idle",
  positionSec: 0,
  errorKey: null,
  error: null,
};
let state = idle;
let revision = 0;
let mutations: Promise<unknown> = Promise.resolve();
let lease: CastLease | null = null;
let acquiring: Promise<CastLease> | null = null;
function acquire(): Promise<CastLease> {
  if (ownsCastSession(lease)) return Promise.resolve(lease!);
  if (!acquiring)
    acquiring = claimCastSession("music", stopMusicSpeaker)
      .then((value) => {
        lease = value;
        return value;
      })
      .finally(() => {
        acquiring = null;
      });
  return acquiring;
}
const listeners = new Set<() => void>();
export const getMusicSpeakerState = (): MusicSpeakerState => state;
export function subscribeMusicSpeakerState(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function update(patch: Partial<MusicSpeakerState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}
function requireDesktop() {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window))
    throw new MusicSpeakerError("music.cast.desktop");
}
function enqueue<T>(run: () => Promise<T>): Promise<T> {
  const next = mutations.then(run, run);
  mutations = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}
function current(token: number) {
  if (token !== revision) throw new MusicSpeakerError("music.cast.cancelled");
}
function report(error: unknown, key: string, token: number) {
  const failure = error instanceof MusicSpeakerError ? error : new MusicSpeakerError(key, error);
  if (token === revision) update({ phase: "error", errorKey: failure.key, error: failure.message });
  return failure;
}

export function musicSpeakerCompatibility(device: CastDeviceInfo): string | null {
  if (device.kind === "airplay") return "music.cast.airplay";
  if (device.kind !== "dlna" && device.kind !== "chromecast") return "music.cast.unsupportedDevice";
  if (
    !device.host ||
    (device.kind === "dlna" && !device.control_url) ||
    (device.kind === "chromecast" && !(device.port > 0))
  )
    return "music.cast.invalidDevice";
  return null;
}

/** Discovery runs only from an explicit UI action, never when the module is imported. */
export async function discoverMusicSpeakers(): Promise<CastDeviceInfo[]> {
  requireDesktop();
  try {
    const devices = await invoke<CastDeviceInfo[]>("cast_discover");
    if (!Array.isArray(devices)) throw new Error("Invalid device response");
    const unique = new Map<string, CastDeviceInfo>();
    for (const device of devices) {
      if (device && typeof device.id === "string" && typeof device.name === "string")
        unique.set(device.id, device);
    }
    return [...unique.values()].sort(
      (a, b) =>
        Number(Boolean(musicSpeakerCompatibility(a))) -
          Number(Boolean(musicSpeakerCompatibility(b))) ||
        Number(b.audio_only) - Number(a.audio_only) ||
        a.name.localeCompare(b.name),
    );
  } catch (error) {
    throw error instanceof MusicSpeakerError
      ? error
      : new MusicSpeakerError("music.cast.discoveryFailed", error);
  }
}

export function musicTrackSpeakerIssue(track: MusicTrack): string | null {
  if (
    track.connectorId === "spotify" ||
    track.id.startsWith("spotify:") ||
    track.playbackUrl?.startsWith("spotify:")
  )
    return "music.cast.spotify";
  if (track.connectorId === "local" || track.id.startsWith("local:")) return "music.cast.local";
  return null;
}

export function musicSpeakerPhase(status: CastStatus | null): MusicSpeakerPhase {
  if (!status?.connected) return "disconnected";
  switch (status.player_state.trim().toUpperCase()) {
    case "PLAY":
    case "PLAYING":
      return "playing";
    case "PAUSE":
    case "PAUSED":
    case "PAUSED_PLAYBACK":
      return "paused";
    case "BUFFERING":
    case "BUFFER":
    case "TRANSITIONING":
      return "buffering";
    case "IDLE":
    case "STOP":
    case "STOPPED":
    case "NO_MEDIA_PRESENT":
      return "stopped";
    default:
      return "unknown";
  }
}

/** Resolve a provider-issued stream. A track's artwork, page URL, or catalog ID is never used as audio. */
export async function loadMusicOnSpeaker(
  track: MusicTrack,
  device: CastDeviceInfo,
  positionSec = 0,
): Promise<MusicSpeakerState> {
  requireDesktop();
  const issue = musicSpeakerCompatibility(device) ?? musicTrackSpeakerIssue(track);
  if (issue) throw new MusicSpeakerError(issue);
  const token = ++revision;
  update({ phase: "loading", error: null, errorKey: null });
  // Claim outside the music command queue: replacing video may need that queue to STOP.
  const claimed = acquire();
  return enqueue(async () => {
    let session: CastLease | null = null;
    let loading = false;
    try {
      session = await claimed;
      current(token);
      const stream = await invoke<{
        url: string;
        mimeType: string;
        httpHeaders?: Record<string, string>;
      }>("music_resolve_stream", { track });
      current(token);
      if (typeof stream?.url !== "string")
        throw new MusicSpeakerError("music.cast.unsupportedStream");
      if (/^(?:[a-z]:[\\/]|\\\\|\/[^/])/i.test(stream.url))
        throw new MusicSpeakerError("music.cast.local");
      let url: URL;
      try {
        url = new URL(stream.url);
      } catch {
        throw new MusicSpeakerError("music.cast.local");
      }
      if (url.protocol !== "http:" && url.protocol !== "https:")
        throw new MusicSpeakerError(
          url.protocol === "file:" ? "music.cast.local" : "music.cast.unsupportedStream",
        );
      if (
        typeof stream.mimeType !== "string" ||
        !/^audio\/[a-z0-9.+-]+(?:\s*;[^\r\n]*)?$/i.test(stream.mimeType)
      )
        throw new MusicSpeakerError("music.cast.unsupportedStream");
      const position = Number.isFinite(positionSec) ? Math.max(0, positionSec) : 0;
      const start =
        track.durationSeconds > 0 && position >= track.durationSeconds - 0.5 ? 0 : position;
      loading = true;
      await withCastSession(session, () =>
        invoke("cast_load", {
          host: device.host,
          port: device.port,
          kind: device.kind,
          controlUrl: device.control_url,
          url: stream.url,
          contentType: stream.mimeType,
          title: `${track.title} — ${track.artist}`,
          poster: /^https?:\/\//i.test(track.artwork) ? track.artwork : null,
          // The native cast proxy forwards source-issued headers; the speaker receives its LAN URL.
          startTimeSec: start,
          headers: stream.httpHeaders ?? null,
          transcode: false,
          profile: null,
          subtitle: null,
          subStyle: null,
          audioOnly: device.kind === "dlna",
        }),
      );
      current(token);
      if (!ownsCastSession(session)) throw new MusicSpeakerError("music.cast.cancelled");
      update({
        active: true,
        device,
        track,
        phase: "unknown",
        positionSec: start,
        transportCodec: undefined,
        errorKey: null,
        error: null,
      });
      return state;
    } catch (error) {
      if (loading && token === revision && ownsCastSession(session)) {
        // A receiver that did not acknowledge cleanup may still be audible. Keep ownership
        // and local audio paused until the user can confirm STOP or return to this computer.
        const uncertain = String(error).includes("CAST_AUDIO_STOP_UNCONFIRMED");
        update({
          active: uncertain,
          device: uncertain ? device : null,
          track: uncertain ? track : null,
        });
        if (!uncertain) {
          releaseCastSession(session);
          lease = null;
        }
      } else if (!loading && token === revision && !state.active && ownsCastSession(session)) {
        releaseCastSession(session);
        lease = null;
      }
      throw report(error, "music.cast.loadFailed", token);
    }
  });
}

/** The owning player polls this while active. Stale replies cannot restore an old session. */
export async function refreshMusicSpeakerStatus(): Promise<MusicSpeakerState> {
  if (!state.active || state.phase === "loading") return state;
  const token = revision;
  const session = lease;
  if (!ownsCastSession(session)) return state;
  try {
    const status = await invoke<CastStatus | null>("cast_status");
    if (token !== revision || !ownsCastSession(session)) return state;
    const phase = musicSpeakerPhase(status);
    const positionSec =
      status && Number.isFinite(status.position_sec)
        ? Math.max(0, status.position_sec)
        : state.positionSec;
    update({
      phase,
      positionSec,
      transportCodec: status?.transport_codec === "mp3" ? "MP3" : undefined,
      active: phase !== "disconnected",
      errorKey: phase === "disconnected" ? "music.cast.disconnected" : null,
      error: null,
    });
    return state;
  } catch (error) {
    if (token === revision && ownsCastSession(session))
      update({
        active: false,
        phase: "disconnected",
        errorKey: "music.cast.disconnected",
        error: error instanceof Error ? error.message : String(error),
      });
    throw error instanceof MusicSpeakerError
      ? error
      : new MusicSpeakerError("music.cast.disconnected", error);
  }
}

async function control(
  command: "cast_play" | "cast_pause" | "cast_seek",
  args?: Record<string, number>,
): Promise<void> {
  requireDesktop();
  if (!state.active) return Promise.reject(new MusicSpeakerError("music.cast.disconnected"));
  const token = ++revision;
  const session = lease;
  return enqueue(async () => {
    try {
      current(token);
      if (!session) throw new MusicSpeakerError("music.cast.disconnected");
      await withCastSession(session, () => invoke(command, args));
      current(token);
      update({ error: null, errorKey: null });
    } catch (error) {
      throw report(error, "music.cast.controlFailed", token);
    }
  });
}
export const playMusicSpeaker = (): Promise<void> => control("cast_play");
export const pauseMusicSpeaker = (): Promise<void> => control("cast_pause");
export const seekMusicSpeaker = (sec: number): Promise<void> =>
  control("cast_seek", { sec: Number.isFinite(sec) ? Math.max(0, sec) : 0 });

export async function stopMusicSpeaker(): Promise<void> {
  requireDesktop();
  if (!state.device && state.phase !== "loading" && !ownsCastSession(lease) && !acquiring) return;
  const token = ++revision;
  // Queue behind an in-flight load so a late native LOAD cannot restart a stopped speaker.
  return enqueue(async () => {
    try {
      current(token);
      const session = acquiring ? await acquiring : lease;
      if (session && ownsCastSession(session)) {
        await withCastSession(session, () => invoke("cast_stop"));
        releaseCastSession(session);
        if (lease === session) lease = null;
      }
      current(token);
      state = { ...idle };
      listeners.forEach((listener) => listener());
    } catch (error) {
      throw report(error, "music.cast.controlFailed", token);
    }
  });
}
