export function registerTizenKeys() {
  try {
    window.tizen?.tvinputdevice?.registerKey('Back');
  } catch (e) {
    // Not on Tizen or already registered
  }
}

export function mapKey(event) {
  if (event.keyCode === 10009) return 'back';
  const map = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    Enter: 'enter',
    Escape: 'back',
  };
  return map[event.key] ?? null;
}
