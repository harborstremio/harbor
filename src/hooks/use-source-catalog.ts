import { useEffect, useState } from 'react';
import { browseSourceCatalog, type CatalogBrowse } from '@/lib/games/source-catalog-query';
import { sourceError, type GameSource } from '@/lib/games/sources';

type State = CatalogBrowse & { source?: GameSource; query: string; limit: number; loading: boolean; error: string };
export function useSourceCatalog(source: GameSource | undefined, query: string, limit: number) {
  const [state, setState] = useState<State>(), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!source) return;
    const controller = new AbortController();
    setState(previous => ({ source, query, limit, entries: previous?.source === source && previous.query === query ? previous.entries : [], total: previous?.source === source && previous.query === query ? previous.total : 0, loading: true, error: '' }));
    const timer = setTimeout(() => {
      void browseSourceCatalog(source, query, limit, controller.signal).then(result => {
        if (!controller.signal.aborted) setState({ ...result, source, query, limit, loading: false, error: '' });
      }).catch(error => {
        if (!controller.signal.aborted) setState(previous => ({ ...previous!, loading: false, error: sourceError(error) }));
      });
    }, query.trim() ? 250 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [source, query, limit, attempt]);
  const current = state && state.source === source && state.query === query ? state : undefined;
  return { entries: current?.entries ?? [], total: current?.total ?? 0, loading: !!source && (!current || current.limit !== limit || current.loading), error: current?.error ?? '', retry: () => setAttempt(value => value + 1) };
}
