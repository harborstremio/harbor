import { useSyncExternalStore } from "react";
import { activeProfileId, activeProfileIsPrimary } from "@/lib/active-profile-id";
import { getMusicState, initializeMusic, nextMusic, playMusic, setMusicQueue, subscribeMusic } from "./player";
import { getLikedArtists } from "./liked-artists";
import { hydrateListeningAffinity, readListeningAffinity } from "./listening-affinity";
import { loadSurpriseLibrary } from "./surprise-library";
import { recordMusicSimilarPlayback } from "./playback-origin";
import { heldMusicContextTracks, hydrateMusicContextTracks, musicContextArtwork, recordMusicRecentContext, rememberMusicContextTracks } from "./recent-context";
import { musicQueueAutomationStarted, ownMusicQueueAutomation, ownsMusicQueueAutomation, releaseMusicQueueAutomation } from "./queue-automation";
import { artistIdentityKey } from "./artist-popularity";
import { dailyArtistKey } from "./daily-discovery-selection";
import { createSurpriseCatalog } from "./surprise-catalog";
import { noteSurpriseTrack, resetSurpriseFeedback } from "./surprise-feedback";
import { getSurpriseBlend, hydrateSurpriseBlend } from "./surprise-preferences";
import { selectSurpriseTracks } from "./surprise-selection";
import { musicTrackIdentity } from "./track-identity";
import { getMusicTransport, musicUpcoming } from "./transport";
import type { MusicCatalogRow, MusicTrack } from "./types";

type Status = "idle" | "loading" | "playing" | "waiting" | "empty" | "error";
let status: Status = "idle";
let activeOwner: symbol | undefined;
const listeners = new Set<() => void>();
const publish = (value: Status) => { if (status !== value) { status = value; listeners.forEach(fn => fn()); } };
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const useMusicSurprise = () => useSyncExternalStore(subscribe, () => status, () => "idle" as Status);

export function stopMusicSurprise(): void {
  if (!activeOwner || !ownsMusicQueueAutomation(activeOwner)) return;
  const started = musicQueueAutomationStarted(activeOwner);
  releaseMusicQueueAutomation(activeOwner);
  if (!started) return;
  const current = getMusicState();
  setMusicQueue(current.queue.slice(0, current.queueIndex + 1));
}

let lastStart: { name: string; homeRows: readonly MusicCatalogRow[]; spotifyConnected: boolean } | null = null;
export function restartMusicSurprise(genres: readonly number[]): Promise<void> {
  const held = lastStart;
  if (!held) return Promise.resolve();
  stopMusicSurprise();
  return startMusicSurprise(genres, held.name, held.homeRows, held.spotifyConnected);
}

export async function startMusicSurprise(genres: readonly number[], name: string, homeRows: readonly MusicCatalogRow[] = [], spotifyConnected = false): Promise<void> {
  lastStart = { name, homeRows, spotifyConnected };
  resetSurpriseFeedback();
  const profile = activeProfileId(), abort = new AbortController();
  const contextId = `mix:surprise:${profile}`;
  let unsubscribe = () => {}, timer: ReturnType<typeof setTimeout> | undefined;
  let busy = false, started = false, failures = 0;
  const played: MusicTrack[] = [];
  let lastTrack = "";
  const owner = ownMusicQueueAutomation(() => {
    abort.abort(); unsubscribe(); clearTimeout(timer); activeOwner = undefined; publish("idle");
  });
  activeOwner = owner;
  const live = () => ownsMusicQueueAutomation(owner) && activeProfileId() === profile;
  const finish = (value: Status) => { if (live()) { releaseMusicQueueAutomation(owner); publish(value); } };
  publish("loading");
  try {
    await initializeMusic();
    if (!live()) return;
    const primary = activeProfileIsPrimary();
    const [, , library] = await Promise.all([
      hydrateMusicContextTracks(),
      hydrateListeningAffinity(profile),
      loadSurpriseLibrary(primary, spotifyConnected, abort.signal),
      hydrateSurpriseBlend(),
    ]);
    if (!live()) return;
    const state = getMusicState();
    const spotifyRecent = primary && spotifyConnected ? homeRows.filter(row =>
      row.source === "spotify" && ["spotify:home:recently-played", "spotify:home:top-tracks"].includes(row.id))
      .flatMap(row => row.items.filter((item): item is MusicTrack & { kind: "track" } => item.kind === "track")) : [];
    const taste = { recents: [...state.recents, ...spotifyRecent], liked: state.likedTracks, followed: getLikedArtists(), library, affinity: readListeningAffinity(profile) };
    if (!taste.recents.length && !taste.liked.length && !taste.followed.length && !library.length && !genres.length) { finish("empty"); return; }
    const familiar = new Set([...Object.keys(taste.affinity), ...taste.recents.map(musicTrackIdentity), ...taste.liked.map(musicTrackIdentity), ...library.map(musicTrackIdentity)]);
    const knownArtists = new Set(
      [...taste.recents, ...taste.liked, ...library].map(dailyArtistKey),
    );
    for (const artist of taste.followed) knownArtists.add(artistIdentityKey(artist.name));
    const seen = new Set((heldMusicContextTracks("similar", contextId) ?? []).slice(-2048).map(musicTrackIdentity));
    if (state.current) seen.add(musicTrackIdentity(state.current));
    const catalog = createSurpriseCatalog(taste, genres, profile, abort.signal);
    await catalog.warm();
    if (!live()) return;
    const fill = async () => {
      if (busy || !live()) return;
      if (started && getMusicTransport().repeat === "one") return;
      busy = true;
      try {
        let current = getMusicState();
        // A song heard or saved outside this mix during the session is no longer a discovery.
        [...current.recents, ...current.likedTracks].forEach(track => familiar.add(musicTrackIdentity(track)));
        const previous = started ? [...played.slice(-3), ...(current.current ? [current.current] : [])] : [];
        const choose = (strict: boolean) => selectSurpriseTracks(catalog.candidates(), familiar, seen, previous, 12, Math.random, { knownArtists, blend: getSurpriseBlend(), strict });
        let picks = choose(true);
        for (let pass = 0; picks.length < 8 && pass < 6 && live(); pass++) {
          await catalog.expand();
          if (!live()) return;
          picks = choose(true);
        }
        if (!live()) return;
        // Only after the catalogue has genuinely run dry does familiar listening fill the gap.
        if (picks.length < 4) picks = choose(false);
        if (!picks.length) {
          if (!started) { finish("error"); return; }
          publish("waiting");
          timer = setTimeout(() => { timer = undefined; void fill(); }, Math.min(120_000, 15_000 * 2 ** Math.min(failures++, 3)));
          return;
        }
        failures = 0;
        picks.forEach(track => seen.add(musicTrackIdentity(track)));
        // Bounded session memory; the most recent 2,048 recommendations cannot repeat.
        while (seen.size > 2048) seen.delete(seen.values().next().value!);
        catalog.consume(picks);
        if (!started) {
          started = true;
          recordMusicSimilarPlayback(picks[0], picks, { id: contextId, name });
          await playMusic(picks[0], picks, new Set(), false, true, false, owner);
        } else {
          current = getMusicState();
          const playedKeys = new Set(played.map(musicTrackIdentity));
          const upcoming = musicUpcoming(current.queue, current.queueIndex, 24, false).filter(track => !playedKeys.has(musicTrackIdentity(track)));
          const ended = current.phase === "paused" && current.duration > 0 && current.currentTime >= current.duration && !upcoming.length;
          // Keep a little Back history without growing a many-thousand-row queue all day.
          const history = getMusicTransport().shuffle ? [] : played.slice(-20);
          const queue = [...history, ...(current.current ? [current.current] : []), ...upcoming, ...picks]
            .filter((track, at, all) => all.findIndex(value => musicTrackIdentity(value) === musicTrackIdentity(track)) === at);
          setMusicQueue(queue, owner);
          rememberMusicContextTracks("similar", contextId, picks);
          const mix = heldMusicContextTracks("similar", contextId)!;
          recordMusicRecentContext({ kind: "similar", id: contextId, name, seed: mix[0], artwork: musicContextArtwork(mix) }, picks);
          if ((ended || current.phase === "error") && live()) nextMusic(true);
        }
        if (live()) publish("playing");
      } catch {
        if (!started) finish("error");
        else if (live()) {
          publish("waiting");
          timer = setTimeout(() => { timer = undefined; void fill(); }, 30_000);
        }
      } finally { busy = false; }
    };
    unsubscribe = subscribeMusic(() => {
      if (activeProfileId() !== profile) { releaseMusicQueueAutomation(owner); return; }
      const current = getMusicState();
      if (!started || !live() || !current.current) return;
      const key = musicTrackIdentity(current.current);
      if (key !== lastTrack) {
        noteSurpriseTrack(current.current);
        if (lastTrack) {
          const previous = current.queue.find(track => musicTrackIdentity(track) === lastTrack);
          if (previous) played.push(previous);
          if (played.length > 20) played.shift();
        }
        lastTrack = key;
      }
      if (busy || timer || current.phase === "resolving") return;
      if (musicUpcoming(current.queue, current.queueIndex, 6, false).length <= 5) void fill();
    });
    await fill();
  } catch { finish("error"); }
}
