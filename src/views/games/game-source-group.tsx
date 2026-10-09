import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { useT } from '@/lib/i18n';
import type { SourceMatch, SourceMatchGroup } from '@/lib/games/source-groups';
import { GameSourceIcon } from './game-source-icon';
import { useSourceGroupMatches } from '@/hooks/use-source-group-matches';

export function GameSourceGroup({ group, render }: { group: SourceMatchGroup; render: (match: SourceMatch, single: boolean) => ReactNode }) {
  const t = useT(), id = useId(), [open, setOpen] = useState(false), [limit, setLimit] = useState(4);
  const [present, setPresent] = useState(false);
  const root = useRef<HTMLDivElement>(null), focusNext = useRef<{ row: number; button: HTMLButtonElement } | undefined>(undefined);
  const { source, matches } = group;
  const result = useSourceGroupMatches(group, open, limit, present);
  useEffect(() => {
    if (open || !present) return;
    // Keep the existing collapse transition, then release hydrated file records.
    const timer = setTimeout(() => setPresent(false), window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 280);
    return () => clearTimeout(timer);
  }, [open, present]);
  useLayoutEffect(() => {
    const pending = focusNext.current; if (!pending || result.loading) return;
    focusNext.current = undefined;
    if (!open || !(document.activeElement === pending.button || !pending.button.isConnected && document.activeElement === document.body)) return;
    const next = result.error ? root.current?.querySelector<HTMLElement>('.games-source-website-error button') : root.current?.querySelectorAll<HTMLElement>('.games-source-release>summary')[pending.row] ?? root.current?.querySelector<HTMLElement>('.games-source-release button');
    next?.focus({ preventScroll: true });
  }, [result.matches, result.loading, result.error, open]);
  return <div ref={root} className="games-source-group" data-release-key={source.id}>
    <button className="games-source-group-heading" aria-expanded={open} aria-controls={id} onClick={() => { setPresent(true); setOpen(value => !value); }}>
      <GameSourceIcon url={source.url} homepage={source.homepage || matches[0]?.release.sourcePage} icon={source.icon} name={source.name} className="games-source-release-mark"/>
      <span><strong>{source.name}</strong><small>{matches[0]?.release.title}</small></span>
      <span className="games-source-group-count">{matches.length === 1 ? t('games.sources.singleRelease') : t('games.sources.count', { count: matches.length.toLocaleString() })}</span><ChevronRight size={17} aria-hidden="true"/>
    </button>
    <div id={id} className="games-source-group-reveal" data-open={open} aria-hidden={!open} inert={!open}><div>{present && <div className="games-source-group-content" aria-busy={result.loading}>
      {result.matches.map(match => render(match, matches.length === 1))}
      {result.loading && <p className="games-source-explainer" role="status">{t('common.loading')}</p>}
      {result.error && <div className="games-source-website-error" role="alert"><span>{t(result.error)}</span><button className="games-button" onClick={event => { focusNext.current = { row: result.matches.length, button: event.currentTarget }; result.retry(); }}>{t('common.retry')}</button></div>}
      {!result.error && result.matches.length > 0 && matches.length > result.matches.length && <button className="games-button" aria-disabled={result.loading} onClick={event => { if (result.loading) return; focusNext.current = { row: result.matches.length, button: event.currentTarget }; setLimit(result.matches.length + 8); }}>{t('games.sources.more', { count: matches.length - result.matches.length })}</button>}
    </div>}</div></div>
  </div>;
}
