import { useEffect, useRef, useState, type RefObject } from 'react';
import { isGamepadCaptured, setGamepadCapture } from '@/lib/gamepad/capture';
import { isLikelyGamepad } from '@/lib/gamepad/web-source';
import { RETRO_PAD_AXES, RETRO_PAD_BUTTONS, type RetroPad } from '@/lib/games/retro-controls';

type Action = 'pause' | 'play' | 'save' | 'load' | 'disconnected';
const visibleControls = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>('button:not(:disabled),select:not(:disabled),input[type=range],a[href]')].filter(el => el.getClientRects().length && !el.closest('[inert]'));

export function useRetroNavigation(root: RefObject<HTMLDivElement | null>, playing: boolean, action: (value: Action) => void) {
  const live = useRef({ playing, action }); live.current = { playing, action };
  const [pads, setPads] = useState<RetroPad[]>([]);
  useEffect(() => {
    const previous = isGamepadCaptured(); setGamepadCapture(true);
    let frame = 0, signature = '', prior = new Set<string>(), repeatAt = 0, lastDirection = '', seen = new Set<number>();
    const navigate = (direction: string) => {
      if (!root.current) return;
      const scope = root.current.querySelector<HTMLElement>('[data-retro-menu]') ?? root.current;
      const controls = visibleControls(scope), current = document.activeElement as HTMLElement;
      if (!controls.includes(current)) { controls[0]?.focus(); return; }
      if (current instanceof HTMLInputElement && current.type === 'range' && ['left', 'right'].includes(direction)) {
        const value = Math.max(+current.min, Math.min(+current.max, +current.value + (direction === 'right' ? 1 : -1) * (+current.step || 1)));
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(current, String(value)); current.dispatchEvent(new Event('input', { bubbles: true })); return;
      }
      if (current instanceof HTMLSelectElement && ['left', 'right'].includes(direction)) {
        current.selectedIndex = Math.max(0, Math.min(current.options.length - 1, current.selectedIndex + (direction === 'right' ? 1 : -1)));
        current.dispatchEvent(new Event('change', { bubbles: true })); return;
      }
      const a = current.getBoundingClientRect();
      const horizontal = direction === 'left' || direction === 'right', sign = direction === 'left' || direction === 'up' ? -1 : 1;
      const next = controls.filter(el => el !== current).map(el => { const b = el.getBoundingClientRect(), dx = b.x + b.width / 2 - a.x - a.width / 2, dy = b.y + b.height / 2 - a.y - a.height / 2; return { el, main: horizontal ? dx : dy, cross: horizontal ? Math.abs(dy) : Math.abs(dx) }; }).filter(x => x.main * sign > 5).sort((a, b) => Math.abs(a.main) + a.cross * 3 - Math.abs(b.main) - b.cross * 3)[0];
      next?.el.focus({ preventScroll: true }); next?.el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    };
    const back = () => {
      const scope = root.current?.querySelector<HTMLElement>('[data-retro-menu]');
      if (scope) { scope.dispatchEvent(new CustomEvent('retro-menu-back', { bubbles: true })); return; }
      if (!live.current.playing) live.current.action('play');
    };
    const key = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (root.current?.querySelector('[data-retro-binding]')) return;
      const shortcuts = { F1: 'pause', F2: 'save', F4: 'load' } as const;
      if (event.key in shortcuts || event.key === 'Escape') {
        event.preventDefault(); event.stopImmediatePropagation();
        if (!event.repeat) { if (event.key === 'Escape') live.current.playing ? live.current.action('pause') : back(); else live.current.action(shortcuts[event.key as keyof typeof shortcuts]); } return;
      }
      if (event.key === 'Tab' && root.current) {
        const scope = root.current.querySelector<HTMLElement>('[data-retro-menu]') ?? root.current;
        const controls = visibleControls(scope), index = controls.indexOf(document.activeElement as HTMLElement);
        event.preventDefault(); event.stopImmediatePropagation(); controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus(); return;
      }
      if (!live.current.playing && event.key.startsWith('Arrow') && !(event.target instanceof HTMLSelectElement)) { event.preventDefault(); event.stopImmediatePropagation(); navigate(event.key.slice(5).toLowerCase()); }
    };
    const tick = (now: number) => {
      const list = Array.from(navigator.getGamepads?.() ?? []).filter((p): p is Gamepad => !!p?.connected && isLikelyGamepad(p));
      const nextSignature = list.map(p => `${p.index}:${p.id}`).join('|');
      if (signature !== nextSignature) {
        if (list.length < seen.size && live.current.playing) live.current.action('disconnected');
        signature = nextSignature; seen = new Set(list.map(p => p.index)); setPads(list.map(p => ({ id: `${p.id}_${p.index}`, index: p.index, name: p.id })));
      }
      const down = new Set<string>(); let direction = '';
      const binding = !!root.current?.querySelector('[data-retro-binding]');
      for (const pad of list) {
        pad.buttons.forEach((button, index) => { if (button.pressed || button.value > .5) down.add(`${pad.index}:b${index}`); });
        pad.axes.forEach((value, index) => { if (index < 4 && Math.abs(value) > .6) down.add(`${pad.index}:a${index}:${value > 0 ? '+1' : '-1'}`); });
        const edge = (index: number) => down.has(`${pad.index}:b${index}`) && !prior.has(`${pad.index}:b${index}`);
        if (binding) {
          for (const value of down) if (!prior.has(value) && value.startsWith(`${pad.index}:`)) {
            const token = value.split(':')[1], axis = token.startsWith('a'), index = +token.slice(1);
            if (index === 16 && !axis) continue;
            root.current?.dispatchEvent(new CustomEvent('retro-bind-pad', { detail: { pad: pad.id, value: axis ? `${RETRO_PAD_AXES[index]}:${value.split(':')[2]}` : RETRO_PAD_BUTTONS[index] ?? index } }));
          }
          continue;
        }
        const chord = pad.buttons[8]?.pressed && pad.buttons[9]?.pressed;
        if (edge(16) || chord && (edge(8) || edge(9))) { live.current.playing ? live.current.action('pause') : back(); continue; }
        if (live.current.playing || document.hidden || !document.hasFocus()) continue;
        if (edge(0)) (document.activeElement as HTMLElement)?.click();
        if (edge(1)) back();
        direction ||= pad.buttons[12]?.pressed || pad.axes[1] < -.6 ? 'up' : pad.buttons[13]?.pressed || pad.axes[1] > .6 ? 'down' : pad.buttons[14]?.pressed || pad.axes[0] < -.6 ? 'left' : pad.buttons[15]?.pressed || pad.axes[0] > .6 ? 'right' : '';
      }
      if (direction && (direction !== lastDirection || now >= repeatAt)) { navigate(direction); repeatAt = now + (direction !== lastDirection ? 350 : 100); }
      lastDirection = direction; prior = down; frame = requestAnimationFrame(tick);
    };
    window.addEventListener('keydown', key, true); frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('keydown', key, true); setGamepadCapture(previous); };
  }, [root]);
  return pads;
}
