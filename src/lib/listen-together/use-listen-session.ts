import { useEffect, useRef } from "react";
import type { RoomSnapshot, TogetherClient } from "@/lib/together/client";
import type { SyncState } from "@/lib/together/protocol";
import type { MusicAudioSettingsValue } from "@/lib/music/audio-settings";
import {
  getMusicAudioSettingsSnapshot,
  initializeMusicAudioSettings,
  saveMusicAudioSettings,
  subscribeMusicAudioSettings,
} from "@/lib/music/audio-settings";
import {
  getMusicState,
  playMusic,
  seekMusic,
  subscribeMusic,
  toggleMusicPlayback,
} from "@/lib/music/player";
import type { MusicTrack } from "@/lib/music/types";
import { createListenMixFollower, type ListenMixFollower } from "./mix-follow";
import { readListenMix, type ListenMix } from "./mix-state";
import { LISTEN_DRIFT_SECONDS, listenActionFor, listenRoleOf, listenShouldPublish } from "./session";
import { listenMixFromState, listenStateFromTrack, type ListenTrackRef } from "./track-state";

const SETTLE_MS = 1500;
const SAVE_RETRY_MS = 160;

export type ListenSessionParams = {
  room: string | null;
  clientId: string;
  snapshot: RoomSnapshot | null;
  clientRef: { current: TogetherClient | null };
};

function musicTrackFrom(ref: ListenTrackRef): MusicTrack {
  return {
    id: ref.id,
    connectorId: ref.connectorId ?? undefined,
    title: ref.title,
    artist: ref.artist,
    artwork: ref.artwork ?? "",
    durationSeconds: 0,
    durationLabel: "",
  };
}

function applyTransport(playing: boolean): void {
  const phase = getMusicState().phase;
  if (playing && phase !== "playing") toggleMusicPlayback();
  if (!playing && phase === "playing") toggleMusicPlayback();
}

function writeAudioSettings(next: MusicAudioSettingsValue): Promise<unknown> {
  return saveMusicAudioSettings(next).catch(
    () =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, SAVE_RETRY_MS);
      }).then(() => saveMusicAudioSettings(next)),
  );
}

export function useListenSession(params: ListenSessionParams): void {
  const { room, clientId, snapshot, clientRef } = params;

  const joined = !!room && snapshot?.state === "joined" && snapshot.room === room;
  const isHost = joined && !!snapshot && listenRoleOf(snapshot, clientId) === "host";
  const following = joined && !isHost;
  const hostClientId = snapshot?.hostClientId ?? null;
  const syncState = snapshot?.syncState ?? null;

  const settleUntil = useRef(0);
  const loadToken = useRef(0);
  const pendingMix = useRef<ListenMix | null>(null);
  const followerRef = useRef<ListenMixFollower | null>(null);
  if (!followerRef.current) {
    followerRef.current = createListenMixFollower({
      read: () => getMusicAudioSettingsSnapshot().settings,
      write: writeAudioSettings,
    });
  }

  useEffect(() => {
    if (!joined || !isHost) return;
    let published: SyncState | null = null;
    const tick = () => {
      const client = clientRef.current;
      if (!client) return;
      const music = getMusicState();
      const track = music.current;
      if (!track) return;
      if (music.phase !== "playing" && music.phase !== "paused") return;
      const audio = getMusicAudioSettingsSnapshot();
      const next = listenStateFromTrack(
        track,
        music.currentTime,
        music.phase === "playing",
        clientId,
        hostClientId,
        Date.now(),
        audio.ready ? readListenMix(audio.settings) : null,
      );
      if (!listenShouldPublish(published, next)) return;
      published = next;
      client.publishState(next);
    };
    void initializeMusicAudioSettings().then(tick, () => {});
    tick();
    const offMusic = subscribeMusic(tick);
    const offAudio = subscribeMusicAudioSettings(tick);
    return () => {
      offMusic();
      offAudio();
    };
  }, [joined, isHost, clientId, hostClientId, clientRef]);

  useEffect(() => {
    if (!following) {
      settleUntil.current = 0;
      loadToken.current += 1;
      return;
    }
    if (!syncState) return;
    if (syncState.updatedBy === clientId) return;
    const music = getMusicState();
    const action = listenActionFor(syncState, {
      track: music.current
        ? { id: music.current.id, connectorId: music.current.connectorId ?? null }
        : null,
      positionSeconds: music.currentTime,
      playing: music.phase === "playing",
    });
    if (action.kind === "none") return;
    const now = Date.now();
    if ((action.kind === "load" || action.kind === "seek") && now < settleUntil.current) return;
    if (action.kind === "play" || action.kind === "pause") {
      applyTransport(action.kind === "play");
      return;
    }
    if (action.kind === "seek") {
      settleUntil.current = now + SETTLE_MS;
      seekMusic(action.positionSeconds);
      applyTransport(syncState.playing);
      return;
    }
    settleUntil.current = now + SETTLE_MS;
    const token = (loadToken.current += 1);
    const wanted = action;
    void playMusic(musicTrackFrom(wanted.track))
      .then(() => {
        if (token !== loadToken.current) return;
        settleUntil.current = Date.now() + SETTLE_MS;
        if (wanted.positionSeconds > LISTEN_DRIFT_SECONDS) seekMusic(wanted.positionSeconds);
        applyTransport(wanted.playing);
      })
      .catch(() => {});
  }, [following, syncState, clientId]);

  useEffect(() => {
    const follower = followerRef.current;
    if (!follower || !following) return;
    let live = true;
    void initializeMusicAudioSettings().then(
      () => {
        if (!live) return;
        follower.begin();
        void follower.apply(pendingMix.current);
      },
      () => {},
    );
    return () => {
      live = false;
      pendingMix.current = null;
      void follower.end();
    };
  }, [following]);

  useEffect(() => {
    const follower = followerRef.current;
    if (!follower || !following) return;
    const mix = listenMixFromState(syncState);
    if (!mix) return;
    pendingMix.current = mix;
    void follower.apply(mix);
  }, [following, syncState]);
}
