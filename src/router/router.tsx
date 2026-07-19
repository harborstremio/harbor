import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { createContext, useContext, type ReactNode } from "react";

/**
 * Slot so the existing App tree can render inside RouterProvider without
 * rewriting every screen as a route component yet.
 */
const AppSlotContext = createContext<ReactNode>(null);

function RootRouteComponent() {
  const app = useContext(AppSlotContext);
  return (
    <>
      {app}
      <Outlet />
    </>
  );
}

const rootRoute = createRootRoute({
  component: RootRouteComponent,
});

function tabRoute(path: string) {
  return createRoute({
    getParentRoute: () => rootRoute,
    path,
    component: () => null,
  });
}

const routeTree = rootRoute.addChildren([
  tabRoute("/"),
  tabRoute("/discover"),
  tabRoute("/catalogs"),
  tabRoute("/movies"),
  tabRoute("/shows"),
  tabRoute("/kids"),
  tabRoute("/anime"),
  tabRoute("/live"),
  tabRoute("/vod"),
  tabRoute("/calendar"),
  tabRoute("/library"),
  tabRoute("/downloads"),
  tabRoute("/addons"),
  tabRoute("/settings"),
  tabRoute("/wrapped"),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/detail/$type/$id",
    component: () => null,
  }),
]);

const harborRouter = createRouter({
  routeTree,
  history: createMemoryHistory({ initialEntries: ["/"] }),
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof harborRouter;
  }
}

export function HarborRouterProvider({ children }: { children: ReactNode }) {
  return (
    <AppSlotContext.Provider value={children}>
      <RouterProvider router={harborRouter} />
    </AppSlotContext.Provider>
  );
}
