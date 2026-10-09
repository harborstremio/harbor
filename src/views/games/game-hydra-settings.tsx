import { useT } from '@/lib/i18n';
import type { HydraGame } from '@/lib/games/hydra-import-records';
import './game-hydra-import.css';

export function HydraOriginalSettings({ game, pending = false, expanded = false }: { game: HydraGame; pending?: boolean; expanded?: boolean }) {
  const t = useT();
  const fields = [
    ['games.hydra.fileLabel', game.executable],
    ['games.hydra.argumentsLabel', game.launchOptions],
    ['games.hydra.prefixLabel', game.winePrefix],
    ['Proton', game.proton],
  ];
  return <details className="games-hydra-original" open={expanded || undefined}>
    <summary>{t('games.hydra.original')}</summary>
    <dl>{fields.filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label === 'Proton' ? label : t(label!)}</dt><dd><bdi>{value}</bdi></dd></div>)}</dl>
    {!game.executable && <p>{t('games.hydra.missing')}</p>}
    {pending && <p>{t('games.hydra.pendingNote')}</p>}
    {game.issues.length > 0 && <p>{t('games.hydra.unsupported', { count: game.issues.length })}</p>}
  </details>;
}
