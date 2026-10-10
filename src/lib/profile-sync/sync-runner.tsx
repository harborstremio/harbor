import { useEffect } from "react";
import "@/lib/layout-sync/register";
import { startProfileSync, stopProfileSync } from "./scheduler";

/**
 * Mount once, high in the tree, inside ProfilesProvider. Everything below is event
 * driven, so this renders nothing and never re-renders.
 *
 * Section adapters register themselves. For layout to reach the wire, the module that
 * calls registerSection has to be imported somewhere, and this is the natural place:
 * add `import "@/lib/layout-sync/register";` above once that module lands.
 */
export function ProfileSyncRunner() {
  useEffect(() => {
    const stop = startProfileSync();
    return () => stop();
  }, []);
  return null;
}

export { startProfileSync, stopProfileSync };
