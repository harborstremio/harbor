import { useEffect, useState } from 'react';
import { downloadHistoryId, downloadHistoryKey, readDownloadDismissals, type DownloadDismissals } from '@/lib/games/download-history';
import type { DownloadItem } from '@/lib/games/download-presentation';

export function useDownloadHistory(profile: string) {
  const read = () => { try { return readDownloadDismissals(localStorage.getItem(downloadHistoryKey(profile))); } catch { return {}; } };
  const [state, setState] = useState<{ profile: string; dismissed: DownloadDismissals }>(() => ({ profile, dismissed: read() }));
  const [now, setNow] = useState(Date.now), [showHistory, setShowHistory] = useState(false);
  useEffect(() => {
    setState({ profile, dismissed: read() }); setShowHistory(false);
    const refresh = (event: StorageEvent) => { if (event.key === downloadHistoryKey(profile)) setState({ profile, dismissed: read() }); };
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    window.addEventListener('storage', refresh);
    return () => { clearInterval(timer); window.removeEventListener('storage', refresh); };
  }, [profile]);
  const dismiss = (items: DownloadItem[]) => {
    const dismissed = { ...read(), ...(state.profile === profile ? state.dismissed : {}) };
    for (const item of items) if (item.record.profile === profile && item.record.status === 'complete') dismissed[downloadHistoryId(item)] = Date.now();
    const bounded = Object.fromEntries(Object.entries(dismissed).sort((a,b) => b[1]-a[1]).slice(0,2000));
    try { localStorage.setItem(downloadHistoryKey(profile), JSON.stringify(bounded)); } catch { /* Still clear this session when storage is unavailable. */ }
    setState({ profile, dismissed: bounded });
  };
  return { dismissed: state.profile === profile ? state.dismissed : {}, now, showHistory, setShowHistory, dismiss };
}
