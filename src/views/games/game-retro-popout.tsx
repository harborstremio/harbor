import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { useT } from '@/lib/i18n';
import { readRetroHandoff } from '@/lib/games/retro-window';
import { GameRetroPlayer } from './game-retro-player';

export function GameRetroPopout() {
  const t = useT();
  const [game] = useState(() => readRetroHandoff(new URLSearchParams(location.search).get('harbor-retro') ?? ''));
  useEffect(() => { void getCurrentWindow().show(); }, []);
  return game ? <GameRetroPlayer game={game} detached close={() => { void invoke('games_retro_close', { id: game.sessionId }).finally(() => getCurrentWindow().destroy()); }} onStarted={() => {}}/>
    : <div className="games-retro-start"><p>{t('games.retro.failed')}</p><button onClick={() => void getCurrentWindow().destroy()}>{t('common.close')}</button></div>;
}
