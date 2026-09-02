const enabled = import.meta.env?.DEV === true;

export function dlog(...args: unknown[]): void {
  if (enabled) console.log(...args);
}

export function dinfo(...args: unknown[]): void {
  if (enabled) console.info(...args);
}

export function dwarn(...args: unknown[]): void {
  if (enabled) console.warn(...args);
}
