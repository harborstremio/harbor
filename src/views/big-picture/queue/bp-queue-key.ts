import type { BpDir } from "../bp-focus-core";

type BpQueueKeyHandler = (dir: BpDir) => boolean;

let handler: BpQueueKeyHandler | null = null;

// The same shape bp-guide-key.ts:7 records, for the same reason. The shell's
// arrow listener is capture phase and stopPropagations, so no element handler
// can ever see a direction; a second window listener does fire, and both would
// act, stepping the queue twice per press. The shell asks this first and a
// decline falls straight through to spatial nav, which is what puts the shake
// and the hover tick on a press at either end of the run.
export function setBpQueueKeyHandler(fn: BpQueueKeyHandler | null): void {
  handler = fn;
}

export function bpQueueHandledKey(dir: BpDir): boolean {
  return handler ? handler(dir) : false;
}
