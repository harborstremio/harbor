import { useEffect, useRef, useState } from "react";
import { fetchWebsiteSource } from "@/lib/games/source-fetch";
import { matchingReleases, type GameSource } from "@/lib/games/sources";
import type { GameSources } from "./use-game-sources";

type Matches = ReturnType<typeof matchingReleases>;
type WebsiteLookup = { source: GameSource; next: number | null; pending: boolean; failed: boolean };
type LookupScope = { key: string; controller: AbortController; websites: WebsiteLookup[]; matches: Matches };

/** Each website keeps its own continuation and failed page; successful pages stay usable. */
export function useWebsiteMatches(sources: GameSources, game: Parameters<typeof matchingReleases>[1]) {
  const websites = sources.sources.filter(source => source.enabled && source.website);
  const key = JSON.stringify([sources.profile, game.id, game.name, game.steamId, game.igdbId, game.platforms, game.sourceOrigin, ...websites.map(source => [source.id, source.checkedAt, source.website])]);
  const scope = useRef<LookupScope | null>(null);
  const [state, setState] = useState({ key: "", matches: [] as Matches, loading: false, failed: false, hasMore: false });
  const publish = (current: LookupScope) => {
    if (scope.current !== current || current.controller.signal.aborted) return;
    setState({
      key: current.key,
      matches: current.matches,
      loading: current.websites.some(website => website.pending),
      failed: current.websites.some(website => website.failed),
      hasMore: current.websites.some(website => website.next !== null && !website.failed),
    });
  };
  const run = async (current: LookupScope, selected: WebsiteLookup[], refresh = false) => {
    if (scope.current !== current || current.controller.signal.aborted || current.websites.some(website => website.pending)) return;
    for (const website of selected) { website.pending = true; website.failed = false; }
    publish(current);
    await Promise.allSettled(selected.map(async website => {
      try {
        const page = await fetchWebsiteSource(website.source.website!, game.name, website.next!, current.controller.signal, refresh, sources.profile);
        if (scope.current !== current || current.controller.signal.aborted) return;
        const matches = matchingReleases([{ ...website.source, entries: page.entries }], game);
        current.matches = [...new Map([...current.matches, ...matches].map(match => [`${match.source.id}:${match.release.id}`, match])).values()];
        website.next = page.next;
      } catch {
        if (!current.controller.signal.aborted) website.failed = true;
      } finally { website.pending = false; publish(current); }
    }));
  };
  useEffect(() => {
    const current: LookupScope = { key, controller: new AbortController(), websites: websites.map(source => ({ source, next: 1, pending: false, failed: false })), matches: [] };
    scope.current = current;
    void run(current, current.websites);
    return () => { current.controller.abort(); if (scope.current === current) scope.current = null; };
  }, [key]);
  const continueLookup = (retry: boolean) => {
    const current = scope.current;
    if (!current || current.key !== key) return;
    return run(current, current.websites.filter(website => website.next !== null && website.failed === retry), retry);
  };
  return {
    ...(state.key === key ? state : { key, matches: [], loading: !!websites.length, failed: false, hasMore: !!websites.length }),
    more: () => continueLookup(false),
    retry: () => continueLookup(true),
  };
}
