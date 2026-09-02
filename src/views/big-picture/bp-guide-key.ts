import type { BpDir } from "./bp-focus-core";

type BpGuideKeyHandler = (dir: BpDir) => boolean;

let handler: BpGuideKeyHandler | null = null;

// The guide used to run its own window capture listener beside the shell's.
// stopPropagation does not stop a second listener on the same object, so both
// acted and the guide stepped twice per press. One listener asks the guide
// first instead, and a decline falls straight through to normal spatial nav so
// Up out of the first channel row still reaches the chips above it.
export function setBpGuideKeyHandler(fn: BpGuideKeyHandler | null): void {
  handler = fn;
}

export function bpGuideHandledKey(dir: BpDir): boolean {
  return handler ? handler(dir) : false;
}
