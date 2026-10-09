import { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { HoverTooltip } from '@/components/hover-tooltip';
import { useT, useUiLanguage } from '@/lib/i18n';
import { openUrl } from '@/lib/window';
import { loadHumbleBundles } from '@/lib/games/humble-bundles';
import { bundlesWithGame } from '@/lib/games/humble-bundle-data';
import './game-service-notices.css';
export function GameHumbleBundles({ name, active }: { name: string; active: boolean }) {
  const t = useT(), language = useUiLanguage();
  const [data, setData] = useState<Awaited<ReturnType<typeof loadHumbleBundles>> | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(Date.now);
  useEffect(() => { if (!active) return; const timer = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(timer); }, [active]);
  useEffect(() => { if (!active) return; let current = true; void loadHumbleBundles().then(value => { if (current) { setData(value); setFailed(false); } }, () => { if (current) setFailed(true); }); return () => { current = false; }; }, [active, name]);
  const matches = bundlesWithGame(data?.bundles ?? [], name, now);
  return <div className="games-humble-bundles">
    {matches.map(bundle => <HoverTooltip key={bundle.url} label={t('games.bundles.terms')} side="top" arrow><a href={bundle.url} onClick={e => { e.preventDefault(); openUrl(bundle.url); }} className="games-humble-match">
      <img src="/games/shops/humble.png" width={30} height={30} alt="Humble Bundle"/><span><small>{t('games.bundles.included')}</small><strong>{bundle.name}</strong><small>{t('games.bundles.ends', { date: new Date(bundle.endsAt).toLocaleDateString(language, { month: 'short', day: 'numeric' }) })}</small></span><ArrowUpRight size={17}/>
    </a></HoverTooltip>)}
    {(failed || data?.partial) && <small className="games-bundle-status">{t('games.bundles.unavailable')}</small>}
  </div>;
}
