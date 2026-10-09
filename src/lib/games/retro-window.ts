import { isTauri } from '@tauri-apps/api/core';
import { emitTo, listen } from '@tauri-apps/api/event';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { Window } from '@tauri-apps/api/window';
import { embeddedCore, type EmbeddedGame } from './embedded-emulation';
import desktopConfig from '../../../src-tauri/tauri.conf.json';

export const RETRO_WINDOW = 'harbor-retro';
export const RETRO_DOCK = 'games-retro:dock';
const handoffKey = (id: string) => `harbor.retro.handoff.${id}`;
export function validRetroGame(value: unknown): value is EmbeddedGame {
  if (!value || typeof value !== 'object') return false;
  const game = value as EmbeddedGame;
  return !!embeddedCore(game.system) && ['name', 'path', 'root', 'profile', 'sessionId', 'format'].every(key => typeof (value as Record<string, unknown>)[key] === 'string')
    && /^[0-9a-f-]{36}$/i.test(game.sessionId) && game.path.length < 32768 && game.root.length < 32768 && game.profile.length <= 256;
}
export async function focusRetroPopout(): Promise<boolean> {
  if (!isTauri()) return false;
  const window = await WebviewWindow.getByLabel(RETRO_WINDOW);
  if (!window) return false;
  await window.unminimize(); await window.show(); await window.setFocus(); return true;
}
export async function openRetroPopout(game: EmbeddedGame): Promise<void> {
  if (await focusRetroPopout()) throw Error('retro_running');
  const next = { ...game, sessionId: crypto.randomUUID() };
  localStorage.setItem(handoffKey(next.sessionId), JSON.stringify(next));
  try {
    // Tauri's native WindowConfig accepts these settings even though its JS
    // WebviewOptions type omits them. WebView2 requires matching environment
    // options to share the main window's storage and handoff data.
    const main = desktopConfig.app.windows.find(window => window.label === 'main');
    const options = {
      url: `/retro-player.html?harbor-retro=${next.sessionId}`, title: game.linked?.name ?? game.name,
      width: 1000, height: 820, minWidth: 500, minHeight: 440, center: true,
      decorations: true, visible: true, backgroundColor: '#0f1111',
      additionalBrowserArgs: main?.additionalBrowserArgs,
      browserExtensionsEnabled: main?.browserExtensionsEnabled,
    };
    const popout = new WebviewWindow(RETRO_WINDOW, options);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('retro_window')), 20_000);
      void popout.once('tauri://created', () => { clearTimeout(timer); resolve(); });
      void popout.once('tauri://error', () => { clearTimeout(timer); reject(Error('retro_window')); });
    });
  } catch (error) { localStorage.removeItem(handoffKey(next.sessionId)); throw error; }
}
export function readRetroHandoff(id: string): EmbeddedGame | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(handoffKey(id)) ?? 'null');
    localStorage.removeItem(handoffKey(id));
    return validRetroGame(value) && value.sessionId === id ? value : null;
  } catch { return null; }
}
export async function dockRetroGame(game: EmbeddedGame): Promise<void> {
  const next = { ...game, sessionId: crypto.randomUUID() };
  let stop = () => {};
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('retro_dock')), 8_000);
      void listen<{ id: string; accepted: boolean }>('games-retro:docked', event => {
        if (event.payload.id !== next.sessionId) return;
        clearTimeout(timer); event.payload.accepted ? resolve() : reject(Error('retro_dock'));
      }).then(unlisten => { stop = unlisten; return emitTo('main', RETRO_DOCK, next); }).catch(() => { clearTimeout(timer); reject(Error('retro_dock')); });
    });
    const main = await Window.getByLabel('main');
    await main?.unminimize(); await main?.show(); await main?.setFocus();
  } finally { stop(); }
}
