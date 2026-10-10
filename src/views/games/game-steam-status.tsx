import { useEffect, useState } from 'react';
import { ArrowUpRight, X } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { openUrl } from '@/lib/window';
import { checkSteamServices, steamMaintenanceDay } from '@/lib/games/steam-service-status';
import { SteamMark } from './game-detail-marks';
import './game-service-notices.css';
export function GameSteamStatus({ active }: { active: boolean }) {
  const t = useT(), [incident, setIncident] = useState(''), [day, setDay] = useState(() => steamMaintenanceDay(Date.now()));
  const [dismissed, setDismissed] = useState(() => { try { return sessionStorage.getItem('harbor.games.steam-notice') ?? ''; } catch { return ''; } });
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController(); let failures = 0, busy = false;
    const check = async () => {
      if (busy || document.hidden) return;
      setDay(steamMaintenanceDay(Date.now())); busy = true;
      try { const state = await checkSteamServices(controller.signal); if (state === 'unreachable') { if (++failures >= 2) setIncident(old => old || `connection:${Date.now()}`); } else { failures = 0; setIncident(''); } } catch {} finally { busy = false; }
    };
    void check(); const timer = setInterval(() => void check(), 60_000);
    document.addEventListener('visibilitychange', check);
    return () => { controller.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', check); };
  }, [active]);
  const key = incident || (day ? `maintenance:${day}` : '');
  if (!key || key === dismissed) return null;
  return <aside className="games-steam-status" role="status"><SteamMark/><span><strong>{t(incident ? 'games.steamStatus.connection' : 'games.steamStatus.tuesday')}</strong><small>{t(incident ? 'games.steamStatus.connectionNote' : 'games.steamStatus.tuesdayNote')}</small></span><button className="games-status-link" onClick={() => openUrl('https://steamstat.us/')}>{t('games.steamStatus.details')}<ArrowUpRight size={14}/></button><button className="games-status-close" aria-label={t('common.close')} onClick={() => { setDismissed(key); try { sessionStorage.setItem('harbor.games.steam-notice', key); } catch {} }}><X size={16}/></button></aside>;
}
