import { Play } from "@/components/icons/play-filled";
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { invoke } from '@tauri-apps/api/core';
import { ArrowLeft, Download, Gamepad2, LoaderCircle, Pause, RotateCcw, Save, AppWindow, PanelTop } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useT } from '@/lib/i18n';
import { openUrl } from '@/lib/window';
import { useSectionBack } from '@/lib/section-back';
import { ButtonGlyph } from '@/components/gamepad-button-glyph';
import { detectLayout } from '@/lib/gamepad/layout';
import { validRetroBindings, type RetroBindings } from '@/lib/games/retro-controls';
import { EMULATION_SYSTEMS } from '@/lib/games/emulation';
import type { EmbeddedGame, EmbeddedRuntime, EmbeddedSession } from '@/lib/games/embedded-emulation';
import { dockRetroGame, openRetroPopout } from '@/lib/games/retro-window';
import { RetroPreferences, useRetroPreferences, useRetroFullscreen } from './game-retro-preferences';
import { RetroControls } from './game-retro-controls';
import { useRetroNavigation } from './use-retro-navigation';
import './game-retro-player.css';

export function GameRetroPlayer({ game, close, onStarted, detached = false }: { game: EmbeddedGame; close: () => void; onStarted: () => void; detached?: boolean }) {
  const t = useT(), frame = useRef<HTMLIFrameElement>(null), resume = useRef<HTMLButtonElement>(null), root = useRef<HTMLDivElement>(null);
  const [runtime, setRuntime] = useState<EmbeddedRuntime | null>(null), [session, setSession] = useState<EmbeddedSession | null>(null);
  const [phase, setPhase] = useState<'setup'|'starting'|'playing'|'paused'|'exiting'|'error'>('setup'), [note, setNote] = useState(''), [saveFailed, setSaveFailed] = useState(false);
  const alive = useRef(true), starting = useRef(false), loaded = useRef(false), phaseRef = useRef(phase); phaseRef.current = phase;
  const moving = useRef(false), exiting = useRef(false), exitRef = useRef(() => {});
  const fullscreen = useRetroFullscreen(), controlsTrigger = useRef<HTMLButtonElement>(null), returnToControls = useRef(false);
  const [chrome, setChrome] = useState(true), activity = useRef(Date.now()), chromeHeld = useRef(false);
  const wake = () => { activity.current = Date.now(); setChrome(true); };
  const [controlsOpen, setControlsOpen] = useState(false);
  const [bindings, setBindings] = useState<RetroBindings>({});
  const [selection, setSelection] = useState<string[]>([]);
  const controlsRestored = useRef(false);
  const controlsKey = `harbor.retro.controls.${encodeURIComponent(game.profile)}.${game.system}`;
  const sessionKey = 'harbor.retro.active-session';
  const send = (type: string, extra = {}) => { if (session) frame.current?.contentWindow?.postMessage({ channel: 'harbor-retro', id: game.sessionId, type, ...extra }, new URL(session.url).origin); };
  const preferences = useRetroPreferences(game.profile, game.system, send, loaded.current);
  const play = () => { if (!loaded.current) return; setControlsOpen(false); send('play'); frame.current?.focus(); };
  const pads = useRetroNavigation(root, phase === 'playing', action => {
    if (action === 'disconnected') { setNote('games.retro.disconnected'); send('pause'); }
    else if (action === 'play') play();
    else if (loaded.current && phase !== 'exiting') send(action);
  });
  useEffect(() => { if (pads.length && note === 'games.retro.disconnected') setNote(''); }, [pads.length, note]);
  const exit = () => { if (!loaded.current) { void fullscreen.restore().then(close); return; } setPhase('exiting'); send('exit'); };
  exitRef.current = exit;
  const move = () => { if (phase === 'exiting' || !loaded.current) return; moving.current = true; setPhase('exiting'); send('exit'); };
  const finish = async () => {
    if (exiting.current) return; exiting.current = true;
    await fullscreen.restore();
    await invoke('games_retro_close', { id: game.sessionId }).catch(() => {});
    if (!moving.current) { close(); return; }
    setSession(null); loaded.current = false;
    try { await (detached ? dockRetroGame(game) : openRetroPopout(game)); close(); }
    catch { moving.current = false; exiting.current = false; setNote('games.retro.moveFailed'); setPhase('error'); }
  };
  const start = async () => {
    if (starting.current) return; starting.current = true; setPhase('starting'); setNote('');
    try {
      await invoke('games_retro_close', { id: game.sessionId });
      if (!alive.current) return;
      sessionStorage.setItem(sessionKey, game.sessionId);
      setSession(null); loaded.current = false; exiting.current = false; controlsRestored.current = false;
      const value = await invoke<EmbeddedSession>('games_retro_start', { id: game.sessionId, profile: game.profile, gamePath: game.path, root: game.root, system: game.system });
      if (alive.current) setSession(value); else void invoke('games_retro_close', { id: game.sessionId });
    } catch { if (alive.current) { setPhase('error'); setNote('games.retro.failed'); } }
    finally { starting.current = false; }
  };
  useEffect(() => {
    alive.current = true;
    const previous = document.activeElement as HTMLElement | null, background = document.getElementById('root'), wasInert = background?.inert;
    if (background) background.inert = true;
    root.current?.focus();
    // A webview reload skips React cleanup. Recover only this window's prior
    // session, leaving a game running in a separate popout untouched.
    const priorSession = sessionStorage.getItem(sessionKey);
    void (async () => {
      if (priorSession) await invoke('games_retro_close', { id: priorSession });
      const value = await invoke<EmbeddedRuntime>('games_retro_status', { system: game.system });
      if (alive.current) { setRuntime(value); if (value.installed) void start(); }
    })().catch(() => { if (alive.current) { setPhase('error'); setNote('games.retro.failed'); } });
    const unload = () => { void invoke('games_retro_close', { id: game.sessionId }); };
    window.addEventListener('pagehide', unload);
    return () => { alive.current = false; unload(); window.removeEventListener('pagehide', unload); if (sessionStorage.getItem(sessionKey) === game.sessionId) sessionStorage.removeItem(sessionKey); if (background) background.inert = !!wasInert; previous?.focus({ preventScroll: true }); };
  }, [game.sessionId]);
  useEffect(() => {
    if (!detached) return;
    const subscription = getCurrentWindow().onCloseRequested(event => { event.preventDefault(); if (phaseRef.current !== 'exiting') exitRef.current(); });
    return () => { void subscription.then(stop => stop()); };
  }, [detached]);
  useEffect(() => {
    const blur = () => { requestAnimationFrame(() => { if (!document.hasFocus() && phaseRef.current === 'playing') send('pause'); }); };
    window.addEventListener('blur', blur); return () => window.removeEventListener('blur', blur);
  }, [session]);
  useEffect(() => {
    if (!session) return;
    const listener = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== new URL(session.url).origin || event.data?.channel !== 'harbor-retro') return;
      if (event.data.id !== game.sessionId && event.data.type !== 'load-error') return;
      switch (event.data.type) {
        case 'started': loaded.current = true; onStarted(); setPhase('playing'); frame.current?.focus(); break;
        case 'playing': setControlsOpen(false); setPhase('playing'); wake(); break;
        case 'activity': wake(); break;
        case 'paused': if (phaseRef.current !== 'exiting') setPhase('paused'); break;
        case 'saved': setNote('games.retro.saved'); setSaveFailed(false); break;
        case 'loaded': setNote('games.retro.loaded'); break;
        case 'no-save': setNote('games.retro.noSave'); break;
        case 'save-error': moving.current = false; setNote('games.retro.saveFailed'); setSaveFailed(true); setPhase('paused'); break;
        case 'load-error': setNote('games.retro.failed'); setPhase('error'); break;
        case 'closed': void finish(); break;
        case 'shortcut': if (['save', 'load'].includes(event.data.action) && phaseRef.current !== 'exiting') send(event.data.action); break;
        case 'controls-info': {
          if (!validRetroBindings(event.data.bindings)) break;
          if (Array.isArray(event.data.selection)) setSelection(event.data.selection.filter((value: unknown) => typeof value === 'string').slice(0, 4));
          if (!controlsRestored.current) {
            controlsRestored.current = true;
            try { const stored: unknown = JSON.parse(localStorage.getItem(controlsKey) ?? 'null'); if (validRetroBindings(stored)) { send('controls-set', { bindings: stored }); break; } } catch {}
          }
          setBindings(event.data.bindings);
          try { localStorage.setItem(controlsKey, JSON.stringify(event.data.bindings)); } catch { setNote('games.retro.controlsSaveFailed'); }
          break;
        }
      }
    };
    window.addEventListener('message', listener); return () => window.removeEventListener('message', listener);
  }, [session, game.sessionId, close, onStarted]);
  useEffect(() => { if (phase !== 'starting') return; const timer = setTimeout(() => { setPhase('error'); setNote('games.retro.failed'); }, 120_000); return () => clearTimeout(timer); }, [phase]);
  useEffect(() => { if (phase !== 'exiting') return; const timer = setTimeout(() => { moving.current = false; setSaveFailed(true); setNote('games.retro.saveFailed'); setPhase('paused'); }, 30_000); return () => clearTimeout(timer); }, [phase]);
  useEffect(() => { if (phase === 'paused') resume.current?.focus({ preventScroll: true }); }, [phase]);
  useEffect(() => { if (!controlsOpen && returnToControls.current) { returnToControls.current = false; controlsTrigger.current?.focus({ preventScroll: true }); } }, [controlsOpen]);
  useEffect(() => {
    if (phase !== 'playing') { setChrome(true); return; }
    activity.current = Date.now();
    const timer = setInterval(() => { if (!chromeHeld.current && !root.current?.querySelector('.games-retro-chrome :focus') && Date.now() - activity.current > 3000) setChrome(false); }, 300);
    return () => clearInterval(timer);
  }, [phase]);
  useEffect(() => { if (!['games.retro.saved', 'games.retro.loaded'].includes(note)) return; const timer = setTimeout(() => setNote(''), 2500); return () => clearTimeout(timer); }, [note]);
  useSectionBack(() => { const menu = root.current?.querySelector('[data-retro-menu]'); if (menu) menu.dispatchEvent(new CustomEvent('retro-menu-back', { bubbles: true })); else if (phase === 'playing') send('pause'); else if (loaded.current && phase !== 'exiting') play(); else if (phase !== 'exiting') exit(); }, true);
  const system = EMULATION_SYSTEMS.find(s => s.id === game.system);
  return createPortal(<div className="games-retro-player" data-local-keyboard ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label={game.linked?.name ?? game.name} onPointerMove={wake}>
    <div className="games-retro-screen">
      {session && <iframe ref={frame} src={session.url} title={game.name} sandbox="allow-scripts allow-same-origin" allow="gamepad; autoplay; screen-wake-lock"/>}
      {(phase === 'setup' || phase === 'error' || (!session && phase === 'starting')) && <div className="games-retro-start"><Gamepad2 size={54}/><h2>{t('games.retro.playInside')}</h2><p>{t(phase === 'error' ? 'games.retro.failed' : phase === 'starting' ? 'games.retro.installing' : 'games.retro.setup', { system: system?.name ?? '' })}</p>{phase === 'error' && <button onClick={() => void start()}>{t('games.retro.resume')}</button>}{runtime && phase === 'setup' && <><button className="games-button" onClick={() => void start()}><Download size={17}/>{t('games.retro.install', { size: (runtime.bytes / 1024 / 1024).toFixed(1) })}</button><small>{t('games.retro.runtime', { version: runtime.version })}</small><button className="games-retro-runtime-link" onClick={() => openUrl('https://github.com/EmulatorJS/EmulatorJS/tree/v4.2.3')}>{t('games.retro.aboutRuntime')}</button></>}{phase === 'starting' && <LoaderCircle className="games-retro-spinner" size={22}/>}</div>}
    </div>
    <div className="games-retro-chrome" data-visible={chrome || phase !== 'playing'} inert={!chrome && phase === 'playing'} onPointerEnter={() => { chromeHeld.current = true; wake(); }} onPointerLeave={() => { chromeHeld.current = false; wake(); }} onFocusCapture={wake}>
      <button onClick={exit} disabled={phase === 'exiting'} aria-label={t(loaded.current ? 'games.retro.saveExit' : 'common.back')} title={t(loaded.current ? 'games.retro.saveExit' : 'common.back')}><ArrowLeft size={19}/></button>
      <div className="games-retro-title"><strong>{game.linked?.name ?? game.name}</strong><small>{system?.name}</small></div>
      {loaded.current && <div className="games-retro-player-actions">
        {phase === 'playing' && <button onClick={() => send('pause')}><Pause size={18}/>{t('games.retro.pause')}</button>}
        {fullscreen.button}
        <button onClick={move} disabled={phase === 'exiting'} aria-label={t(detached ? 'games.retro.dock' : 'games.retro.popout')} title={t(detached ? 'games.retro.dock' : 'games.retro.popout')}>{detached ? <PanelTop size={18}/> : <AppWindow size={18}/>}</button>
      </div>}
    </div>
    {phase === 'paused' && !controlsOpen && <div className="retro-pause-backdrop"><section className="retro-pause-menu" aria-label={t('games.retro.pause')}>
      <button className="retro-resume" ref={resume} onClick={play} aria-label={t('games.retro.resume')}><Play size={19}/>{t('games.retro.resume')}<kbd aria-hidden="true">Esc</kbd></button>
      <div className="retro-save-actions"><button onClick={() => send('save')} aria-label={t('games.retro.save')}><Save size={17}/>{t('games.retro.save')}<kbd aria-hidden="true">F2</kbd></button><button onClick={() => send('load')} aria-label={t('games.retro.load')}><RotateCcw size={17}/>{t('games.retro.load')}<kbd aria-hidden="true">F4</kbd></button></div>
      <button ref={controlsTrigger} onClick={() => { send('controls'); setControlsOpen(true); }}><Gamepad2 size={19}/>{t('games.retro.controls')}</button>
      <RetroPreferences {...preferences}/>
      <div className="retro-pause-footer">{pads.length > 0 && <span><ButtonGlyph kind="center" pad={detectLayout(pads.map(p => p.name)) ?? 'xbox'} imageClassName="retro-control-glyph"/>{t('games.retro.menuChord')}</span>}<button onClick={() => openUrl('https://github.com/EmulatorJS/EmulatorJS/tree/v4.2.3')}>{t('games.retro.aboutRuntime')}</button></div>
    </section></div>}
    {controlsOpen && <RetroControls system={game.system} bindings={bindings} pads={pads} selection={selection} select={(port, device) => send('controller-port', { port, device })} change={bindings => send('controls-set', { bindings })} reset={() => send('controls-reset')} close={() => { returnToControls.current = true; setControlsOpen(false); }}/ >}
    {(note || phase === 'exiting') && <div className="games-retro-note" role={saveFailed ? 'alert' : 'status'}>{t(phase === 'exiting' ? 'games.retro.saving' : note)}{saveFailed && <button onClick={() => void fullscreen.restore().then(close)}>{t('games.retro.exitWithoutSave')}</button>}</div>}
  </div>, document.body);
}
