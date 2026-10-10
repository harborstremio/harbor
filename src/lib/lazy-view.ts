import { lazy, type ComponentType } from "react";

const RETRY_DELAYS_MS = [400, 1200];

/**
 * React caches a lazy import's rejection forever, so a route that lost a single fetch never loads
 * again until the page is reloaded. A dev rebuild or a fresh release both drop module URLs a
 * mounted page is still holding, which makes that one lost fetch ordinary rather than rare.
 */
// oxlint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyView<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(async () => {
    let failure: unknown;
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      if (attempt > 0)
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt - 1]));
      try {
        return await load();
      } catch (error) {
        failure = error;
      }
    }
    throw failure;
  });
}
