import { useEffect } from "react";

export function useHistoryBackGuard(active: boolean) {
  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    const sentinel = { harborMangaGuard: true };
    let popping = false;
    try {
      window.history.pushState(sentinel, "");
    } catch {
      return;
    }
    const onPop = () => {
      if (popping) return;
      popping = true;
      try {
        window.history.pushState(sentinel, "");
      } catch {}
      popping = false;
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      try {
        const st = window.history.state as { harborMangaGuard?: boolean } | null;
        if (st && st.harborMangaGuard) window.history.back();
      } catch {}
    };
  }, [active]);
}
