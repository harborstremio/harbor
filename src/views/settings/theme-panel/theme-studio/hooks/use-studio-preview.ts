import { useEffect, useState } from "react";
import type { ThemeLayout } from "@/lib/theme";
import type { NavCustomization } from "@/chrome/nav-items";
import { setThemePreview } from "@/lib/theme-preview";
import { useView } from "@/lib/view";

export function useStudioPreview(layout: ThemeLayout, bokeh: boolean, navCustomization: NavCustomization) {
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
    setThemePreview({ layout, bokeh, navCustomization });
  }, [layout, bokeh, navCustomization]);

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
