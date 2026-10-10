import { useEffect, useRef, useState } from "react";
import { activeProfileId } from "../active-profile-id";
import { filterBlockedTracks } from "./artist-blocks";
import { getMusicState } from "./player";
import { discoverSnippetTracks } from "./snippet-discovery";
import { snippetSeedArtists, unheardSnippetCandidates } from "./snippet-candidates";
import { hydrateSnippetHistory, snippetHeardKeys } from "./snippet-history";
import { prepareMusicSnippet, type PreparedMusicSnippet } from "./snippets";
import { musicTrackIdentity } from "./track-identity";
import type { MusicTrack } from "./types";

const pause = (ms: number, signal: AbortSignal) => new Promise<void>(resolve => {
  const finish = () => { clearTimeout(timer); signal.removeEventListener("abort", finish); resolve(); };
  const timer = setTimeout(finish, ms);
  signal.addEventListener("abort", finish, { once: true });
  if (signal.aborted) finish();
});

export function useSnippetFeed(seeds: MusicTrack[], index: number) {
  const [items, setItems] = useState<PreparedMusicSnippet[]>([]);
  const [building, setBuilding] = useState(true);
  const currentIndex = useRef(index);
  currentIndex.current = index;
  const reject = useRef<(item: PreparedMusicSnippet) => void>(() => {});

  useEffect(() => {
    const controller = new AbortController(), { signal } = controller;
    const profile = activeProfileId();
    const choices = snippetSeedArtists(filterBlockedTracks(seeds.filter(track => track.mediaKind !== "video"), "play"));
    const accepted: PreparedMusicSnippet[] = [], allocated = new Set<PreparedMusicSnippet>();
    const attempted = new Map<string, { track: MusicTrack; until: number }>();
    const excluded = () => {
      const state = getMusicState();
      return [...seeds, ...state.recents, ...(state.current ? [state.current] : []), ...accepted.map(item => item.track)];
    };
    reject.current = item => {
      attempted.set(musicTrackIdentity(item.track), { track: item.track, until: Date.now() + 60_000 });
      const at = accepted.indexOf(item);
      if (at !== -1) accepted.splice(at, 1);
      setItems([...accepted]);
      item.dispose(); allocated.delete(item);
    };
    void (async () => {
      await hydrateSnippetHistory(profile);
      let seedIndex = 0, emptyRounds = 0;
      while (!signal.aborted && accepted.length < 40) {
        if (accepted.length >= currentIndex.current + 4) { setBuilding(false); await pause(750, signal); continue; }
        setBuilding(true);
        for (const [key, attempt] of attempted) if (attempt.until < Date.now()) attempted.delete(key);
        const before = accepted.length;
        const round = new AbortController();
        const discoverySignal = AbortSignal.any([signal, round.signal, AbortSignal.timeout(15_000)]);
        const pending: { track: MusicTrack; seed: MusicTrack | null }[] = [];
        const queued = new Set<string>();
        let discoveryDone = false;
        const full = () => accepted.length >= Math.min(40, currentIndex.current + 4);
        const batch = choices.length
          ? Array.from({ length: Math.min(2, choices.length) }, () => choices[seedIndex++ % choices.length])
          : [null];
        const discovery = Promise.allSettled(batch.map(seed => discoverSnippetTracks(seed, discoverySignal, candidates => {
          const fresh = filterBlockedTracks(unheardSnippetCandidates(candidates, seed, excluded(), snippetHeardKeys(profile)), "play");
          for (const track of fresh) {
            const key = musicTrackIdentity(track);
            if (attempted.has(key) || queued.has(key)) continue;
            queued.add(key); pending.push({ track, seed });
          }
        }))).finally(() => { discoveryDone = true; });
        // Independent workers: a slow/broken clip must not hold the next playable one behind it.
        await Promise.all(Array.from({ length: 2 }, async () => {
          while (!signal.aborted && !full()) {
            const next = pending.shift();
            if (!next) { if (discoveryDone) return; await pause(50, signal); continue; }
            const { track, seed } = next;
            attempted.set(musicTrackIdentity(track), { track, until: Date.now() + 60_000 });
            const item = await prepareMusicSnippet(track, signal).catch(() => null);
            if (!item) continue;
            if (signal.aborted || full() || !unheardSnippetCandidates([item.track], seed, excluded(), snippetHeardKeys(profile)).length) { item.dispose(); continue; }
            accepted.push(item); allocated.add(item); setItems([...accepted]);
            if (full()) { setBuilding(false); round.abort(); }
          }
        }));
        round.abort();
        await discovery;
        if (signal.aborted) return;
        emptyRounds = accepted.length > before ? 0 : emptyRounds + 1;
        // A failed provider response is not proof that the listener has heard everything.
        const seedCount = Math.max(1, choices.length);
        if (emptyRounds * batch.length >= seedCount) await pause(Math.min(15_000, 2000 * Math.ceil(emptyRounds * batch.length / seedCount)), signal);
      }
      if (!signal.aborted) setBuilding(false);
    })().catch(() => {});
    return () => { controller.abort(); for (const item of allocated) item.dispose(); };
  }, []);

  return { items, building, reject: (item: PreparedMusicSnippet) => reject.current(item) };
}
