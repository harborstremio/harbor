import { useSyncExternalStore } from "react";
import { bundledAwardsVersion, subscribeBundledAwards } from "./awards-history";

/**
 * Re-render when the bundled award table arrives.
 *
 * On desktop the table is set before the root mounts, so this subscribes to a
 * value that never changes again and costs a single store read. On television
 * it is fetched after the first paint, and anything that merges bundled awards
 * into live ones has to be told, or the marks stay missing until some unrelated
 * state happens to move.
 */
const NEVER = () => () => {};

export function useBundledAwardsVersion(enabled = true): number {
  return useSyncExternalStore(
    enabled ? subscribeBundledAwards : NEVER,
    bundledAwardsVersion,
    bundledAwardsVersion,
  );
}
