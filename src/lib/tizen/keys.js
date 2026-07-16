export function registerTizenKeys() {
  try {
    window.tizen?.tvinputdevice?.registerKey('Back');
    window.tizen?.tvinputdevice?.registerKey('Menu');
  } catch (e) {
    // Not on Tizen or already registered
  }
}

export function mapKey(event) {
  if (event.keyCode === 10009) return 'back';
  if (event.keyCode === 93 || event.keyCode === 457 || event.keyCode === 10182) return 'menu';
  const map = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    Enter: 'enter',
    Escape: 'back',
    ContextMenu: 'menu',
  };
  return map[event.key] ?? null;
}
