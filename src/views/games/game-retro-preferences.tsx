import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Maximize2, Minimize2 } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauri } from '@tauri-apps/api/core';
import { useT } from '@/lib/i18n';

export function useRetroPreferences(profile: string, system: number, send: (type: string, extra?: object) => void, ready: boolean) {
  const key = `harbor.retro.viewer.${encodeURIComponent(profile)}.${system}`;
  const [value, setValue] = useState(() => {
    try { const saved = JSON.parse(localStorage.getItem(key) ?? 'null'); if (saved && Number.isFinite(saved.volume) && saved.volume >= 0 && saved.volume <= 100 && typeof saved.sharp === 'boolean') return { volume: saved.volume as number, sharp: saved.sharp as boolean }; } catch {}
    return { volume: 65, sharp: true };
  });
  const lastVolume = useRef(value.volume || 65);
  if (value.volume) lastVolume.current = value.volume;
  useEffect(() => { if (ready) send('viewer', value); }, [ready, value]);
  const change = (next: typeof value) => { setValue(next); try { localStorage.setItem(key, JSON.stringify(next)); } catch {} };
  return { value, change, toggleMute: () => change({ ...value, volume: value.volume ? 0 : lastVolume.current }) };
}

export function RetroPreferences({ value, change, toggleMute }: ReturnType<typeof useRetroPreferences>) {
  const t = useT();
  return <div className="retro-viewer-preferences">
    <div className="retro-volume"><button aria-label={t(value.volume ? 'games.retro.mute' : 'games.retro.unmute')} onClick={toggleMute}>{value.volume ? <Volume2 size={19}/> : <VolumeX size={19}/>}</button><input aria-label={t('games.retro.volume')} type="range" min={0} max={100} step={5} value={value.volume} onChange={event => change({ ...value, volume: +event.target.value })}/><output>{value.volume}%</output></div>
    <div className="retro-sampling" role="group" aria-label={t('games.retro.picture')}>{[true, false].map(sharp => <button key={String(sharp)} aria-pressed={value.sharp === sharp} onClick={() => change({ ...value, sharp })}>{t(sharp ? 'games.retro.sharp' : 'games.retro.smooth')}</button>)}</div>
  </div>;
}

export function useRetroFullscreen() {
  const t = useT(), [fullscreen, setFullscreen] = useState(false), original = useRef<Promise<boolean>>(Promise.resolve(false));
  const restore = async () => {
    try {
      const initial = await original.current;
      if (isTauri()) await getCurrentWindow().setFullscreen(initial);
      else if (!initial && document.fullscreenElement) await document.exitFullscreen();
    } catch { /* A closing window can already be unavailable. */ }
  };
  useEffect(() => {
    if (!isTauri()) { original.current = Promise.resolve(!!document.fullscreenElement); const sync = () => setFullscreen(!!document.fullscreenElement); sync(); document.addEventListener('fullscreenchange', sync); return () => { document.removeEventListener('fullscreenchange', sync); void restore(); }; }
    const window = getCurrentWindow(); let alive = true;
    original.current = window.isFullscreen().catch(() => false);
    void original.current.then(value => { if (alive) setFullscreen(value); });
    const resize = window.onResized(() => { void window.isFullscreen().then(value => { if (alive) setFullscreen(value); }).catch(() => {}); });
    return () => { alive = false; void resize.then(stop => stop()).catch(() => {}); void restore(); };
  }, []);
  const toggle = async () => {
    try {
      if (isTauri()) { const window = getCurrentWindow(); const next = !await window.isFullscreen(); await window.setFullscreen(next); setFullscreen(next); }
      else if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { /* The native window may be closing during a move. */ }
  };
  return { restore, button: <button onClick={() => void toggle()} aria-label={t(fullscreen ? 'games.retro.exitFullscreen' : 'games.retro.fullscreen')} title={t(fullscreen ? 'games.retro.exitFullscreen' : 'games.retro.fullscreen')}>{fullscreen ? <Minimize2 size={18}/> : <Maximize2 size={18}/>}</button> };
}
