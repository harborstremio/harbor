export type RetroBinding = { value?: number; value2?: string | number };
export type RetroBindings = Record<number, Record<number, RetroBinding>>;
export type RetroPad = { id: string; index: number; name: string };
export const RETRO_PAD_BUTTONS = ['BUTTON_1', 'BUTTON_2', 'BUTTON_3', 'BUTTON_4', 'LEFT_TOP_SHOULDER', 'RIGHT_TOP_SHOULDER', 'LEFT_BOTTOM_SHOULDER', 'RIGHT_BOTTOM_SHOULDER', 'SELECT', 'START', 'LEFT_STICK', 'RIGHT_STICK', 'DPAD_UP', 'DPAD_DOWN', 'DPAD_LEFT', 'DPAD_RIGHT'];
export const RETRO_PAD_AXES = ['LEFT_STICK_X', 'LEFT_STICK_Y', 'RIGHT_STICK_X', 'RIGHT_STICK_Y'];

export function retroControlRows(system: number): [number, string][] {
  const directions: [number, string][] = [[4, '↑'], [5, '↓'], [6, '←'], [7, '→']];
  if (system === 4) return [[0, 'A'], [1, 'B'], [3, 'Start'], ...directions, [10, 'L'], [11, 'R'], [12, 'Z'], [19, 'Stick ↑'], [18, 'Stick ↓'], [17, 'Stick ←'], [16, 'Stick →'], [23, 'C ↑'], [22, 'C ↓'], [21, 'C ←'], [20, 'C →']];
  if (system === 29) return [[1, 'A'], [0, 'B'], [8, 'C'], [10, 'X'], [9, 'Y'], [11, 'Z'], [3, 'Start'], [2, 'Mode'], ...directions];
  if ([64, 35].includes(system)) return [[0, '1'], [8, '2'], [3, 'Start'], ...directions];
  return [[8, 'A'], [0, 'B'], ...(system === 19 ? [[9, 'X'], [1, 'Y']] as [number, string][] : []), ...([19, 24].includes(system) ? [[10, 'L'], [11, 'R']] as [number, string][] : []), [3, 'Start'], [2, 'Select'], ...directions];
}

export function validRetroBindings(value: unknown): value is RetroBindings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value).every(([port, rows]) => /^[0-3]$/.test(port) && rows && typeof rows === 'object' && !Array.isArray(rows) && Object.entries(rows).every(([button, binding]) => {
    const b = binding as RetroBinding;
    return /^\d+$/.test(button) && +button < 24 && b && typeof b === 'object' && (b.value === undefined || Number.isInteger(b.value) && b.value >= 0 && b.value <= 255) && (b.value2 === undefined || typeof b.value2 === 'number' && Number.isInteger(b.value2) && b.value2 >= 0 && b.value2 < 64 || typeof b.value2 === 'string' && b.value2.length < 64);
  }));
}

export function retroKeyLabel(code?: number): string {
  if (!code) return '—';
  return ({ 8: '⌫', 9: 'Tab', 13: 'Enter', 16: 'Shift', 17: 'Ctrl', 18: 'Alt', 32: 'Space', 37: '←', 38: '↑', 39: '→', 40: '↓' } as Record<number, string>)[code] ?? (code >= 65 && code <= 90 || code >= 48 && code <= 57 ? String.fromCharCode(code) : `#${code}`);
}
