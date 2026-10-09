import { deckSnapshot, type MusicDeckSnapshot } from "./decks";
import { queueTrackKey } from "./queue-order";
import { musicTrackIdentity } from "./track-identity";
import type { MusicPlayerState, MusicTrack } from "./types";

const WATCH_MS = 600;
const END_GAP = 0.4;
const RELEASE_MS = 4000;

export type DeckAdoptRequest = {
  deck: number;
  track: MusicTrack | null;
  trackId: string | null;
  connectorId: string | null;
  live: boolean;
  paused: boolean;
  position: number | null;
  duration: number | null;
};

export type DeckAdoptionHost = {
  read: () => MusicPlayerState;
  publish: (patch: Partial<MusicPlayerState>) => void;
  announce: (track: MusicTrack) => void;
  ended: () => void;
  snapshot?: () => Promise<MusicDeckSnapshot>;
  releaseMs?: number;
};

export type DeckAdoption = {
  deck: () => number;
  adopt: (request: DeckAdoptRequest) => boolean;
};

function carrying(track: MusicTrack, trackId: string | null, connectorId: string | null): boolean {
  if (!trackId || track.id !== trackId) return false;
  if (!connectorId || !track.connectorId) return true;
  return track.connectorId === connectorId;
}

export function createDeckAdoption(host: DeckAdoptionHost): DeckAdoption {
  const states = host.snapshot ?? deckSnapshot;
  const releaseAfter = host.releaseMs ?? RELEASE_MS;
  let adopted = 0;
  let parked: MusicTrack | null = null;
  let watch: ReturnType<typeof setInterval> | null = null;
  let ending = false;
  let deadSince = 0;

  function known(state: MusicPlayerState): MusicTrack[] {
    const held: MusicTrack[] = [];
    if (state.current) held.push(state.current);
    if (parked) held.push(parked);
    return [...held, ...state.queue, ...state.recents];
  }

  function resolve(request: DeckAdoptRequest): MusicTrack | null {
    const { track, trackId, connectorId } = request;
    if (track && (!trackId || carrying(track, trackId, connectorId))) return track;
    const pool = known(host.read());
    const onDeck = pool.find((item) => carrying(item, trackId, connectorId));
    if (onDeck || !track) return onDeck ?? null;
    const key = queueTrackKey(track);
    const identity = musicTrackIdentity(track);
    return (
      pool.find((item) => queueTrackKey(item) === key) ??
      pool.find((item) => musicTrackIdentity(item) === identity) ??
      track
    );
  }

  function stopWatch(): void {
    if (watch === null) return;
    clearInterval(watch);
    watch = null;
  }

  function release(): void {
    adopted = 0;
    parked = null;
    ending = false;
    deadSince = 0;
    stopWatch();
  }

  function tick(): void {
    if (adopted === 0) {
      stopWatch();
      return;
    }
    void states().then((snapshot) => {
      if (adopted === 0) return;
      const deck = snapshot.decks[adopted];
      if (!deck?.live) {
        if (snapshot.primary !== 0) return;
        const now = Date.now();
        if (deadSince === 0) deadSince = now;
        if (now - deadSince >= releaseAfter) release();
        return;
      }
      deadSince = 0;
      const state = host.read();
      if (state.phase === "resolving" || state.phase === "idle") return;
      const duration = deck.durationSeconds ?? state.duration;
      const position = deck.positionSeconds ?? state.currentTime;
      const playing = state.phase === "playing" || state.phase === "paused";
      const phase = playing ? (deck.paused ? "paused" : "playing") : state.phase;
      if (position !== state.currentTime || duration !== state.duration || phase !== state.phase)
        host.publish({ currentTime: position, duration, phase });
      const finished = duration > 0 && position >= duration - END_GAP;
      if (!finished) {
        ending = false;
        return;
      }
      if (ending) return;
      ending = true;
      host.ended();
    });
  }

  function startWatch(): void {
    deadSince = 0;
    if (watch !== null) return;
    watch = setInterval(tick, WATCH_MS);
    tick();
  }

  function settle(request: DeckAdoptRequest, track: MusicTrack): Partial<MusicPlayerState> {
    const state = host.read();
    const duration =
      request.duration && request.duration > 0 ? request.duration : track.durationSeconds;
    const running = state.phase === "playing" || state.phase === "paused";
    return {
      currentTime: request.position ?? 0,
      duration,
      phase: running ? (request.paused ? "paused" : "playing") : state.phase,
    };
  }

  function move(track: MusicTrack, request: DeckAdoptRequest): void {
    const state = host.read();
    const key = queueTrackKey(track);
    const identity = musicTrackIdentity(track);
    let at = state.queue.findIndex((item) => queueTrackKey(item) === key);
    if (at < 0) at = state.queue.findIndex((item) => musicTrackIdentity(item) === identity);
    const slot = at < 0 ? null : state.queue[at];
    const seated =
      slot && queueTrackKey(slot) !== key
        ? {
            ...track,
            collectionOrigin: slot.collectionOrigin ?? {
              id: slot.id,
              connectorId: slot.connectorId,
            },
          }
        : track;
    const queue =
      at < 0
        ? [...state.queue, seated]
        : state.queue.map((item, index) => (index === at ? seated : item));
    host.publish({
      current: seated,
      queue,
      queueIndex: at < 0 ? queue.length - 1 : at,
      error: null,
      ...settle(request, seated),
    });
    host.announce(seated);
  }

  return {
    deck: () => adopted,
    adopt: (request) => {
      const wanted = request.deck === 1 ? 1 : 0;
      if (wanted === adopted) return true;
      if (wanted === 1 && !request.live) return false;
      const target = resolve(request);
      if (wanted === 1 && !target) return false;
      const state = host.read();
      const closed = !state.current;
      parked = wanted === 1 ? state.current : null;
      adopted = wanted;
      ending = false;
      if (target && !closed) move(target, request);
      if (wanted === 1) startWatch();
      else stopWatch();
      return true;
    },
  };
}
