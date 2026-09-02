import { lazy } from "react";

/**
 * What a split route shows while its chunk resolves.
 *
 * The ambient backdrop and the top bar both live outside the route, so this
 * only has to fill the body, and it deliberately does not draw a page shell:
 * a skeleton that guesses wrong is worse than a held frame. Almost nobody ever
 * sees it, because bpWarmRoutes resolves the chunks during the first idle.
 */
export function BpRouteFallback() {
  return (
    <div className="absolute inset-0 grid place-items-center" aria-hidden>
      <span
        className="block rounded-full border-2 border-[var(--bp-edge-2)] border-t-[var(--bp-touch)] [animation:bp-intro-spin_1100ms_linear_infinite] motion-reduce:[animation:none]"
        style={{ width: "clamp(26px, 3.2vh, 42px)", height: "clamp(26px, 3.2vh, 42px)" }}
      />
    </div>
  );
}

/**
 * Every Big Picture surface except the home screen, split out of the boot.
 *
 * Statically importing these put about sixty chunks on the television's
 * critical path: they were fetched and parsed before the first paint even
 * though a cold start only ever shows home. Live TV alone dragged in the whole
 * channel hydration graph, and the streams picker dragged in season download.
 *
 * The cost of splitting is a first navigation that has to wait for a chunk, so
 * bpWarmRoutes below pulls them in the moment the home screen is up. By the
 * time anyone presses a direction the module is already resolved and lazy
 * settles without ever showing a fallback.
 */
export const BpAnime = lazy(() => import("./bp-anime").then((m) => ({ default: m.BpAnime })));
export const BpShows = lazy(() => import("./bp-shows").then((m) => ({ default: m.BpShows })));
export const BpMovies = lazy(() => import("./bp-movies").then((m) => ({ default: m.BpMovies })));
export const BpLive = lazy(() => import("./bp-live").then((m) => ({ default: m.BpLive })));
export const BpDiscover = lazy(() =>
  import("./bp-discover").then((m) => ({ default: m.BpDiscover })),
);
export const BpSearch = lazy(() => import("./bp-search").then((m) => ({ default: m.BpSearch })));
export const BpLibrary = lazy(() => import("./bp-library").then((m) => ({ default: m.BpLibrary })));
export const BpDetail = lazy(() => import("./bp-detail").then((m) => ({ default: m.BpDetail })));
export const BpPerson = lazy(() => import("./bp-person").then((m) => ({ default: m.BpPerson })));
export const BpCollection = lazy(() =>
  import("./bp-collection").then((m) => ({ default: m.BpCollection })),
);
export const BpCollections = lazy(() =>
  import("./bp-collections").then((m) => ({ default: m.BpCollections })),
);
export const BpCollectionDetail = lazy(() =>
  import("./bp-collection-detail").then((m) => ({ default: m.BpCollectionDetail })),
);
export const BpService = lazy(() => import("./bp-service").then((m) => ({ default: m.BpService })));
export const BpAddon = lazy(() =>
  import("./addons/bp-addon").then((m) => ({ default: m.BpAddon })),
);
export const BpSettings = lazy(() =>
  import("./bp-settings").then((m) => ({ default: m.BpSettings })),
);
export const BpStreams = lazy(() => import("./bp-streams").then((m) => ({ default: m.BpStreams })));

// Ordered by how soon a viewer can reach it. The top bar tabs are one press
// away, a title is two, and settings is buried. Sequential on purpose: firing
// sixteen imports at once on a television puts the parse cost straight back
// onto the frame budget the home screen is still using to draw itself.
const WARM: Array<() => Promise<unknown>> = [
  () => import("./bp-detail"),
  () => import("./bp-search"),
  () => import("./bp-shows"),
  () => import("./bp-movies"),
  () => import("./bp-anime"),
  () => import("./bp-library"),
  () => import("./bp-streams"),
  () => import("./bp-discover"),
  () => import("./bp-live"),
  () => import("./bp-collections"),
  () => import("./bp-person"),
  () => import("./bp-settings"),
];

let warmed = false;

export function bpWarmRoutes(): void {
  if (warmed) return;
  warmed = true;
  let i = 0;
  const idle: (cb: () => void) => void =
    typeof requestIdleCallback === "function"
      ? (cb) => requestIdleCallback(() => cb(), { timeout: 2000 })
      : (cb) => window.setTimeout(cb, 120);
  const next = () => {
    const step = WARM[i];
    i += 1;
    if (!step) return;
    void step()
      .catch(() => {})
      .then(() => idle(next));
  };
  idle(next);
}
