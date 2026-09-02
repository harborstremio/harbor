import type { BpDir } from "../bp-focus-core";

type BpOnboardKeyHandler = (dir: BpDir, repeat: boolean) => boolean;

let handler: BpOnboardKeyHandler | null = null;

// The shape bp-guide-key.ts:7 and queue/bp-queue-key.ts:7 both record, for the
// same reason: the shell's arrow listener is capture phase and stopPropagations,
// so a second window listener is the only way an element could ever see a
// direction and both would then act. The repeat flag rides along because a hold
// and a burst of taps are otherwise identical and only the event knows which
// this is; dropping it from the signature silently kills the held-Down jump.
export function setBpOnboardKeyHandler(fn: BpOnboardKeyHandler | null): void {
  handler = fn;
}

export function bpOnboardHandledKey(dir: BpDir, repeat: boolean): boolean {
  return handler ? handler(dir, repeat) : false;
}
