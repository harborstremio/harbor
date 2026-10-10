import { useEffect, useRef, useState } from 'react';
import { Keyboard, RotateCcw, X } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { ButtonGlyph } from '@/components/gamepad-button-glyph';
import { detectLayout } from '@/lib/gamepad/layout';
import { retroControlRows, retroKeyLabel, RETRO_PAD_BUTTONS, type RetroBindings, type RetroPad } from '@/lib/games/retro-controls';
import './game-retro-controls.css';

export function RetroControls({ system, bindings, pads, selection, select, change, reset, close }: { system: number; bindings: RetroBindings; pads: RetroPad[]; selection: string[]; select: (port: number, device: string) => void; change: (next: RetroBindings) => void; reset: () => void; close: () => void }) {
  const t = useT(), root = useRef<HTMLDivElement>(null), [port, setPort] = useState(0), [capture, setCapture] = useState<{ button: number; kind: 'value' | 'value2' } | null>(null);
  const trigger = useRef<HTMLElement | null>(null), began = useRef(0);
  const layout = detectLayout(pads.filter(p => p.id === selection[port]).map(p => p.name)) ?? 'xbox';
  const finish = () => { setCapture(null); requestAnimationFrame(() => trigger.current?.focus()); };
  const assign = (value: number | string) => {
    if (!capture) return;
    const next = structuredClone(bindings); next[port] ??= {};
    for (const binding of Object.values(next[port])) if (binding[capture.kind] === value) delete binding[capture.kind];
    next[port][capture.button] = { ...next[port][capture.button], [capture.kind]: value };
    change(next); finish();
  };
  useEffect(() => { root.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, []);
  useEffect(() => {
    const host = root.current?.closest<HTMLElement>('.games-retro-player');
    const back = () => capture ? finish() : close();
    host?.addEventListener('retro-menu-back', back);
    return () => host?.removeEventListener('retro-menu-back', back);
  }, [capture, close]);
  useEffect(() => {
    if (!capture) return;
    const host = root.current?.closest<HTMLElement>('.games-retro-player');
    const key = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.repeat) return;
      if (event.key === 'Escape') { finish(); return; }
      if (capture.kind !== 'value' || ['F1', 'F2', 'F4'].includes(event.key) || event.metaKey || event.ctrlKey || event.altKey) return;
      assign(event.keyCode);
    };
    const pad = (event: Event) => {
      if (capture.kind !== 'value2' || performance.now() - began.current < 250) return;
      assign((event as CustomEvent<{ value: string | number }>).detail.value);
    };
    const timeout = setTimeout(finish, 12000);
    window.addEventListener('keydown', key, true); host?.addEventListener('retro-bind-pad', pad);
    return () => { clearTimeout(timeout); window.removeEventListener('keydown', key, true); host?.removeEventListener('retro-bind-pad', pad); };
  }, [capture, bindings, port]);
  const padLabel = (value?: string | number) => {
    const index = typeof value === 'number' ? value : RETRO_PAD_BUTTONS.indexOf(value ?? '');
    const kind = (['south', 'east', 'west', 'north'] as const)[index];
    return kind ? <ButtonGlyph kind={kind} pad={layout} imageClassName="retro-control-glyph"/> : <span>{({ LEFT_TOP_SHOULDER: 'L1 / LB', RIGHT_TOP_SHOULDER: 'R1 / RB', LEFT_BOTTOM_SHOULDER: 'L2 / LT', RIGHT_BOTTOM_SHOULDER: 'R2 / RT', SELECT: 'Select', START: 'Start', DPAD_UP: '↑', DPAD_DOWN: '↓', DPAD_LEFT: '←', DPAD_RIGHT: '→', LEFT_STICK: 'L3', RIGHT_STICK: 'R3' } as Record<string, string>)[String(value)] ?? (value === undefined ? '—' : String(value).replace('LEFT_STICK_', 'L ').replace('RIGHT_STICK_', 'R '))}</span>;
  };
  return <div className="retro-controls-backdrop"><section className="retro-controls" ref={root} data-retro-menu="controls" aria-label={t('games.retro.controls')}>
    <div className="retro-controls-heading"><div><h2>{t('games.retro.controls')}</h2><p>{t('games.retro.controlsHint')}</p></div><button onClick={close} aria-label={t('common.close')}><X size={19}/></button></div>
    <div className="retro-control-ports" role="group" aria-label={t('games.retro.player')}>
      {Array.from({ length: [24, 33, 22, 35].includes(system) ? 1 : [4, 19].includes(system) ? 4 : 2 }, (_, i) => i).map(value => <button key={value} aria-pressed={port === value} onClick={() => { setPort(value); setCapture(null); }}>{t('games.retro.player')} {value + 1}</button>)}
    </div>
    <select className="retro-control-device" aria-label={t('games.retro.controller')} value={selection[port] ?? ''} onChange={event => select(port, event.target.value)}><option value="">{t('games.retro.keyboardOnly')}</option>{pads.map(pad => <option key={pad.id} value={pad.id}>{pad.name}</option>)}</select>
    <div className="retro-controls-table">
      <div className="retro-control-columns"><span/ ><span><Keyboard size={15}/>{t('games.retro.keyboard')}</span><span>{t('games.retro.controller')}</span></div>
      {retroControlRows(system).map(([button, label]) => <div className="retro-control-row" key={button}><strong>{label}</strong>{(['value', 'value2'] as const).map(kind => <button key={kind} aria-label={`${label} · ${t(kind === 'value' ? 'games.retro.keyboard' : 'games.retro.controller')}`} onClick={event => { trigger.current = event.currentTarget; began.current = performance.now(); setCapture({ button, kind }); }}>{kind === 'value' ? <kbd>{retroKeyLabel(bindings[port]?.[button]?.value)}</kbd> : padLabel(bindings[port]?.[button]?.value2)}</button>)}</div>)}
    </div>
    <div className="retro-controls-footer"><button onClick={reset}><RotateCcw size={15}/>{t('games.retro.resetControls')}</button><small>{t('games.retro.controlsSaved')}</small></div>
    {capture && <div className="retro-bind-prompt" data-retro-binding="true" role="status"><strong>{retroControlRows(system).find(([id]) => id === capture.button)?.[1]}</strong><p>{t(capture.kind === 'value' ? 'games.retro.pressKey' : 'games.retro.pressButton')}</p><button onClick={finish}>{t('common.cancel')}</button></div>}
  </section></div>;
}
