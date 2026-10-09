import { useEffect, useMemo, useState } from 'react';
import { loadSourceGroupMatches } from '@/lib/games/source-deferred-matches';
import type { SourceMatch, SourceMatchGroup } from '@/lib/games/source-groups';
import { sourceError } from '@/lib/games/sources';

export function useSourceGroupMatches(group: SourceMatchGroup, open: boolean, limit: number, retaining = open) {
  const deferred = group.matches.some(item => 'deferred' in item);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ group: SourceMatchGroup; limit: number; attempt: number; matches: SourceMatch[]; error: string; loading: boolean } | null>(null);
  const immediate = useMemo(() => (open || retaining) && !deferred ? (group.matches as SourceMatch[]).slice(0, limit) : [], [group, open, retaining, deferred, limit]);
  useEffect(() => {
    if (!open || !deferred) { if (!retaining || !deferred) setState(null); return; }
    const controller = new AbortController();
    setState(previous => ({ group, limit, attempt, matches: previous?.group === group ? previous.matches : [], error: '', loading: true }));
    void loadSourceGroupMatches(group, limit, controller.signal).then(matches => {
      if (!controller.signal.aborted) setState({ group, limit, attempt, matches, error: '', loading: false });
    }).catch(error => {
      if (!controller.signal.aborted) setState(previous => ({ group, limit, attempt, matches: previous?.group === group ? previous.matches : [], error: sourceError(error), loading: false }));
    });
    return () => controller.abort();
  }, [group, open, retaining, deferred, limit, attempt]);
  const current = state?.group === group;
  return { matches: !open && !retaining ? [] : !deferred ? immediate : current ? state.matches : [],
    loading: open && deferred && (!current || state.limit !== limit || state.attempt !== attempt || state.loading),
    error: open && current ? state.error : '', retry: () => setAttempt(value => value + 1) };
}
