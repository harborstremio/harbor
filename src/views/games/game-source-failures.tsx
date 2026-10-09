import { useT } from '@/lib/i18n';

export function GameSourceFailures({ error, failed, retry, manage, busy = false }: { error: string; failed: string[]; retry: () => void; manage: () => void; busy?: boolean }) {
  const t = useT();
  return <div className="games-inline-status games-source-failures" role="alert">
    <span>{t(error, { count: failed.length })}{failed.length > 0 && <small title={failed.join(', ')}>{failed.slice(0, 3).join(' · ')}{failed.length > 3 ? '…' : ''}</small>}</span>
    <button className="games-button" disabled={busy} onClick={retry}>{t(busy ? 'common.loading' : 'common.retry')}</button>
    <button className="games-button" onClick={manage}>{t('games.sources.manage')}</button>
  </div>;
}
