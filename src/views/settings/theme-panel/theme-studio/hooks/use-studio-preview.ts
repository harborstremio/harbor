import type { ThemeLayout } from "@/lib/theme";
import { setThemePreview } from "@/lib/theme-preview";
import { useView } from "@/lib/view";
import { useEffect, useState } from "react";

export function useStudioPreview(layout: ThemeLayout, bokeh: boolean) {
  const { setView } = useView();
  const [inspectorHidden, setInspectorHidden] = useState(false);

  useEffect(() => {
    setView("home");
    return () => {
      setThemePreview(null);
      setView("settings");
    };
  }, [setView]);

  useEffect(() => {
    setThemePreview({ layout, bokeh });
  }, [layout, bokeh]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key ?? "").toLowerCase() === "p") {
        e.preventDefault();
        setInspectorHidden((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return { inspectorHidden, setInspectorHidden };
}
