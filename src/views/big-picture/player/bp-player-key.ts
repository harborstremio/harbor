import type { BpDir } from "../bp-focus-core";

export type BpPlayerKeyHandler = (dir: BpDir) => boolean;

const handlers: BpPlayerKeyHandler[] = [];

// Only one window listener may act on arrows, and stopPropagation does not stop
// a second listener registered on the same object. A player surface that needs
// its own stepping registers here instead of adding a listener: the shell asks
// the newest handler first and a false return falls straight through to spatial
// navigation, so Up out of the top row still reaches the row above it.
export function setBpPlayerKeyHandler(fn: BpPlayerKeyHandler): () => void {
  handlers.push(fn);
  return () => {
    const at = handlers.indexOf(fn);
    if (at >= 0) handlers.splice(at, 1);
  };
}

export function bpPlayerHandledKey(dir: BpDir): boolean {
  for (let i = handlers.length - 1; i >= 0; i -= 1) {
    if (handlers[i](dir)) return true;
  }
  return false;
}
