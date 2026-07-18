import { useRouter } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useView, type View } from "@/lib/view";
import { metaPath, pathFromView, viewFromPath } from "./paths";

/**
 * Bidirectional bridge: root tab changes ↔ TanStack Router path.
 * Nested stack frames (meta, player, …) stay View-only until fully migrated.
 */
export function ViewRouterSync() {
  const router = useRouter();
  const { view, setView, topKind, meta } = useView();
  const lastPath = useRef(router.state.location.pathname);
  const lastView = useRef(view);
  const suppress = useRef(false);

  // View → Router
  useEffect(() => {
    if (suppress.current) {
      suppress.current = false;
      lastView.current = view;
      return;
    }
    if (view === lastView.current && topKind !== "meta") return;
    lastView.current = view;

    let next = pathFromView(view);
    if (topKind === "meta" && meta?.type && meta?.id) {
      next = metaPath(meta.type, meta.id);
    }

    if (router.state.location.pathname === next) return;
    lastPath.current = next;
    void router.navigate({ to: next, replace: false });
  }, [view, topKind, meta?.type, meta?.id, router]);

  // Router → View (back/forward or external navigate)
  useEffect(() => {
    return router.subscribe("onResolved", ({ toLocation }) => {
      const path = toLocation.pathname;
      if (path === lastPath.current) return;
      lastPath.current = path;

      const asView = viewFromPath(path);
      if (asView && asView !== lastView.current) {
        suppress.current = true;
        lastView.current = asView;
        setView(asView as View);
      }
    });
  }, [router, setView]);

  return null;
}
