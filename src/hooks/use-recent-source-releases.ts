import { useEffect, useState } from 'react';
import { recentSourceReleasesAsync, type RecentSourceRelease } from '@/lib/games/recent-sources';
import { sourceError, type GameSource } from '@/lib/games/sources';

export function useRecentSourceReleases(sources: GameSource[]) {
  const [state, setState] = useState<{ sources: GameSource[]; entries: RecentSourceRelease[]; error: string; failed: string[]; loading: boolean }>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const request = new AbortController();
    const failed: string[] = [];
    setState(previous => previous?.sources === sources ? { ...previous, loading: true } : { sources, entries: [], error: '', failed: [], loading: true });
    void recentSourceReleasesAsync(sources, request.signal, Date.now(), source => failed.push(source.name)).then(entries => { if (!request.signal.aborted) setState({ sources, entries, error: failed.length ? 'games.sources.partialRecent' : '', failed, loading: false }); }).catch(error => { if (!request.signal.aborted) setState({ sources, entries: [], error: sourceError(error), failed, loading: false }); });
    return () => request.abort();
  }, [sources, attempt]);
  const current = state?.sources === sources;
  return { entries: current ? state.entries : [], loading: !current || state.loading, error: current ? state.error : '', failed: current ? state.failed : [], retry: () => setAttempt(value => value + 1) };
}
